"""
Background worker for Deepgram batch transcription.
All heavy imports are deferred to function body to prevent startup crashes
when optional dependencies (deepgram-sdk etc.) are not available.
"""

import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def _process_deepgram_batch_transcription(
    user_id: int,
    meeting_id: int,
    storage_path: str,
    duration_seconds: float
):
    """
    Downloads audio from MinIO, sends to Deepgram for transcription,
    stores transcript segments in Postgres, and generates a summary.
    All imports are lazy so the bot-manager can start even without deepgram-sdk.
    """
    try:
        # --- Lazy imports ---
        from deepgram import DeepgramClient, PrerecordedOptions, FileSource
        from shared_models.database import async_session_local
        from shared_models.models import Meeting, Transcription, MeetingStatus

        # Load audio from MinIO
        import boto3
        s3 = boto3.client(
            "s3",
            endpoint_url=os.environ.get("MINIO_ENDPOINT", "http://minio:9000"),
            aws_access_key_id=os.environ.get("MINIO_ACCESS_KEY", "minioadmin"),
            aws_secret_access_key=os.environ.get("MINIO_SECRET_KEY", "minioadmin"),
        )
        bucket = os.environ.get("MINIO_BUCKET", "vexa-recordings")

        logger.info(f"Downloading {storage_path} for transcription of meeting {meeting_id}")
        obj = s3.get_object(Bucket=bucket, Key=storage_path)
        audio_bytes = obj["Body"].read()

        # Deepgram API Key Check
        deepgram_key = os.environ.get("DEEPGRAM_API_KEY")
        if not deepgram_key:
            raise ValueError("DEEPGRAM_API_KEY env var not set on bot-manager")

        deepgram = DeepgramClient(deepgram_key)

        payload: FileSource = {
            "buffer": audio_bytes,
        }

        options = PrerecordedOptions(
            model="nova-3",
            smart_format=True,
            diarize=True,
            language="en",
        )

        logger.info(f"Sending audio to Deepgram API for meeting {meeting_id}...")
        response = deepgram.listen.rest.v("1").transcribe_file(payload, options)
        dg_json = response.to_dict()

        # Parse output into transcripts
        results = (
            dg_json.get("results", {})
            .get("channels", [{}])[0]
            .get("alternatives", [{}])[0]
        )
        words = results.get("words", [])

        # Group by speaker to form segments
        segments = []
        current_segment = None

        for word in words:
            speaker = str(word.get("speaker", 0))
            text = word.get("word", "")

            if current_segment is None or current_segment["speaker"] != speaker:
                if current_segment:
                    segments.append(current_segment)
                current_segment = {
                    "text": text,
                    "speaker": speaker,
                    "start_time": word.get("start", 0.0),
                    "end_time": word.get("end", 0.0),
                }
            else:
                current_segment["text"] += f" {text}"
                current_segment["end_time"] = word.get("end", 0.0)

        if current_segment:
            segments.append(current_segment)

        full_transcript_text = "\n".join(
            [f"Speaker {seg['speaker']}: {seg['text']}" for seg in segments]
        )

        async with async_session_local() as db:
            meeting = await db.get(Meeting, meeting_id)
            if not meeting:
                logger.error(f"Meeting {meeting_id} disappeared during transcription.")
                return

            # Save segments to Postgres
            for seg in segments:
                t_row = Transcription(
                    meeting_id=meeting.id,
                    start_time=seg["start_time"],
                    end_time=seg["end_time"],
                    text=seg["text"],
                    speaker=f"Speaker {seg['speaker']}",
                    language="en",
                    created_at=datetime.utcnow(),
                )
                db.add(t_row)

            # Store full transcript as summary placeholder
            current_data = dict(meeting.data) if meeting.data else {}
            current_data["full_transcript"] = full_transcript_text
            meeting.data = current_data

            meeting.status = MeetingStatus.COMPLETED.value
            meeting.end_time = datetime.utcnow()

            await db.commit()

        logger.info(
            f"Batch transcription for meeting {meeting_id} finished successfully."
        )

    except Exception as e:
        logger.error(
            f"Error in batch transcription for meeting {meeting_id}: {e}",
            exc_info=True,
        )
        try:
            from shared_models.database import async_session_local
            from shared_models.models import Meeting, MeetingStatus

            async with async_session_local() as db:
                meeting = await db.get(Meeting, meeting_id)
                if meeting:
                    meeting.status = MeetingStatus.FAILED.value
                    current_data = dict(meeting.data) if meeting.data else {}
                    current_data["error_details"] = str(e)
                    meeting.data = current_data
                    await db.commit()
        except Exception as inner_e:
            logger.error(f"Failed to update meeting status: {inner_e}")
