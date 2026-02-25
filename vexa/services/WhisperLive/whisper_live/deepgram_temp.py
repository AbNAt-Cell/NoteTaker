import asyncio
import threading
import json
import logging
import time
import os

from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)

class ServeClientDeepgram(ServeClientBase):
    """
    Client for streaming raw audio bytes directly to Deepgram over WebSockets.
    This guarantees that Deepgram maintains context for Speaker Diarization
    across the entire meeting, avoiding the ID reset problem seen with chunked APIs.
    """

    def __init__(
        self,
        websocket,
        language=None,
        task="transcribe",
        client_uid=None,
        initial_prompt=None,
        platform=None,
        meeting_url=None,
        token=None,
        meeting_id=None,
        transcription_tier="realtime",
        collector_client_ref=None,
        server_options=None,
    ):
        super().__init__(
            websocket,
            language,
            task,
            client_uid,
            platform,
            meeting_url,
            token,
            meeting_id,
            transcription_tier=transcription_tier,
            collector_client_ref=collector_client_ref,
            server_options=server_options,
        )

        self.api_key = os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            logging.error("DEEPGRAM_API_KEY not found in environment.")
            self.websocket.send(
                json.dumps({
                    "uid": self.client_uid,
                    "status": "ERROR",
                    "message": "DEEPGRAM_API_KEY not configured on server.",
                })
            )
            self.websocket.close()
            return

        self.deepgram_thread = None
        self._stop_event = threading.Event()
        self.dg_connection = None
        self.loop = None
        self.audio_queue = None

        self.last_segment_id = 0
        self.t_start = time.time()

        # Start the Deepgram background thread
        self.deepgram_thread = threading.Thread(target=self._run_deepgram_loop, daemon=True)
        self.deepgram_thread.start()

        self.websocket.send(
            json.dumps({
                "uid": self.client_uid,
                "message": self.SERVER_READY,
                "backend": "deepgram"
            })
        )

    def _run_deepgram_loop(self):
        """Runs the asyncio event loop for the Deepgram connection in a separate thread."""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.audio_queue = asyncio.Queue()
        try:
            self.loop.run_until_complete(self._deepgram_stream())
        except Exception as e:
            logging.error(f"[Deepgram] Event loop exception: {e}")
        finally:
            self.loop.close()

    async def _deepgram_stream(self):
        """Manages the Deepgram Live Client connection and message passing."""
        config = DeepgramClientOptions(
            options={"keepalive": "true"}
        )
        deepgram = DeepgramClient(self.api_key, config)

        self.dg_connection = deepgram.listen.asyncwebsocket.v("1")

        async def on_message(self_dg, result, **kwargs):
            try:
                # Deepgram returns results as nested JSON. Let's extract the transcript.
                if "channel" in result and "alternatives" in result["channel"]:
                    alt = result["channel"]["alternatives"][0]
                    text = alt.get("transcript", "")
                    words = alt.get("words", [])

                    if not text.strip():
                        return

                    is_final = result.get("is_final", False)
                    start_time = result.get("start", 0.0)
                    end_time = start_time + result.get("duration", 0.0)

                    speaker = None
                    if words and "speaker" in words[0]:
                        speaker = f"Speaker {words[0]['speaker']}"

                    if self.collector_client and hasattr(self.collector_client, 'server_ref') and self.collector_client.server_ref:
                        self.collector_client.server_ref.server_last_transcription_ts = time.time()

                    filtered_text = self._filter_hallucinations(text)
                    if filtered_text is None:
                        return

                    segment = {
                        "start": "{:.3f}".format(start_time),
                        "end": "{:.3f}".format(end_time),
                        "text": filtered_text,
                        "completed": is_final,
                    }
                    if self.language:
                        segment["language"] = self.language
                    if speaker is not None:
                        segment["speaker"] = speaker

                    if is_final:
                        self.transcript.append(segment)
                        self.text.append(filtered_text)

                    # Prepare WebSocket payload back to Frontend
                    response = {
                        "uid": self.client_uid,
                        "segments": [segment],
                        "backend": "deepgram"
                    }

                    try:
                        self.websocket.send(json.dumps(response))
                    except Exception as e:
                        logging.error(f"[Deepgram] Error sending to websocket: {e}")

                    # Publish to Redis for Backend processing
                    if is_final and self.collector_client:
                        try:
                            self.collector_client.send_transcription(
                                token=self.token,
                                platform=self.platform,
                                meeting_id=self.meeting_id,
                                segments=self.transcript,
                                session_uid=self.client_uid
                            )
                        except Exception as e:
                            logging.error(f"[Deepgram] Redis publish error: {e}")

            except Exception as e:
                logging.error(f"[Deepgram] Error processing message: {e}")

        async def on_error(self_dg, error, **kwargs):
            logging.error(f"[Deepgram] Connection Error: {error}")

        self.dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        self.dg_connection.on(LiveTranscriptionEvents.Error, on_error)

        options = LiveOptions(
            model="nova-3",
            language=self.language or "en",
            smart_format=True,
            diarize=True,
            encoding="linear16",
            channels=1,
            sample_rate=16000,
        )

        if not await self.dg_connection.start(options):
            logging.error("[Deepgram] Failed to connect")
            return

        logging.info(f"[{self.client_uid}] Deepgram WebSocket Connected.")

        while not self._stop_event.is_set():
            try:
                audio_bytes = await asyncio.wait_for(self.audio_queue.get(), timeout=1.0)
                await self.dg_connection.send(audio_bytes)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logging.error(f"[Deepgram] Send error: {e}")
                break

        await self.dg_connection.finish()

    def process_audio_buffer(self):
        while not self._stop_event.is_set():
            if len(self.audio_bytes) == 0:
                time.sleep(0.01)
                continue

            chunk = self.audio_bytes.copy()
            self.audio_bytes.clear()

            if self.loop and self.loop.is_running() and self.audio_queue:
                asyncio.run_coroutine_threadsafe(self.audio_queue.put(chunk), self.loop)

    def cleanup(self):
        super().cleanup()
        self._stop_event.set()
        if self.deepgram_thread and self.deepgram_thread.is_alive():
            self.deepgram_thread.join(timeout=2.0)
