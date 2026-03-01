import { log } from '../utils';
import { BotConfig } from '../types';
import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { createClient as createRedisClient, RedisClientType } from 'redis';

export interface DeepgramConfig {
    deepgramApiKey?: string;
    redisUrl?: string;
}

export interface DeepgramConnection {
    client: LiveClient | null;
    isServerReady: boolean;
    sessionUid: string;
}

export class DeepgramService {
    private config: DeepgramConfig;
    private connection: DeepgramConnection | null = null;
    private redisClient: RedisClientType | null = null;
    private transcriptCount = 0;

    constructor(config: DeepgramConfig) {
        this.config = config;
    }

    async initialize(): Promise<string | null> {
        try {
            const apiKey = this.config.deepgramApiKey || process.env.DEEPGRAM_API_KEY;
            if (!apiKey) {
                log('[Deepgram] CRITICAL: DEEPGRAM_API_KEY not found in environment');
                return null;
            }

            this.connection = {
                client: null,
                isServerReady: false,
                sessionUid: this.generateUUID(),
            };

            // Initialize Redis cache client for pushing transcripts
            const redisUrl = this.config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379/0';
            this.redisClient = createRedisClient({ url: redisUrl }) as any;
            this.redisClient!.on('error', (err) => log(`[Deepgram] Redis connection error: ${err.message}`));
            await this.redisClient!.connect();
            log(`[Deepgram] Connected to Redis for sending transcription segments at ${redisUrl}`);

            return 'api.deepgram.com';
        } catch (error: any) {
            log(`[Deepgram] Initialization error: ${error.message}`);
            return null;
        }
    }

    async connectToDeepgram(
        botConfig: BotConfig,
        onMessage: (data: any) => void,
        onError: (error: any) => void,
        onClose: (event: any) => void
    ): Promise<any> {
        const apiKey = this.config.deepgramApiKey || process.env.DEEPGRAM_API_KEY;
        if (!apiKey) return null;

        try {
            const deepgram = createClient(apiKey);

            const connection = deepgram.listen.live({
                model: 'nova-3',
                language: botConfig.language || 'en',
                smart_format: true,
                diarize: true,
                encoding: 'linear16',
                sample_rate: 16000,
                channels: 1,
            });

            connection.on(LiveTranscriptionEvents.Open, () => {
                log(`[Deepgram] Connected to Deepgram WebSocket`);
                this.connection!.isServerReady = true;
                onMessage({ message: 'SERVER_READY', backend: 'deepgram' });
            });

            connection.on(LiveTranscriptionEvents.Transcript, (data) => {
                try {
                    // Parse Deepgram result
                    const channel = data.channel;
                    if (!channel || !channel.alternatives || channel.alternatives.length === 0) return;

                    const alt = channel.alternatives[0];
                    const text = alt.transcript;
                    if (!text || text.trim() === '') return;

                    const isFinal = data.is_final;
                    const start = data.start;
                    const end = start + data.duration;

                    let speaker = undefined;
                    if (alt.words && alt.words.length > 0 && typeof alt.words[0].speaker === 'number') {
                        speaker = `Speaker ${alt.words[0].speaker}`;
                    }

                    const segment = {
                        start: start.toFixed(3),
                        end: end.toFixed(3),
                        text: text,
                        completed: isFinal,
                        language: botConfig.language,
                        speaker: speaker,
                    };

                    // Send to WS clients for realtime preview (if needed, but mainly for logs)
                    onMessage({
                        uid: this.connection!.sessionUid,
                        segments: [segment],
                        backend: 'deepgram'
                    });

                    // Publish to Redis immediately if it's a final transcript segment
                    if (isFinal) {
                        this.pushToRedis(segment, botConfig);
                    }

                } catch (err: any) {
                    log(`[Deepgram] Parse error: ${err.message}`);
                }
            });

            connection.on(LiveTranscriptionEvents.Close, (event) => {
                this.connection!.isServerReady = false;
                onClose(event);
            });

            connection.on(LiveTranscriptionEvents.Error, (err) => {
                log(`[Deepgram] Error: ${(err as any)?.message}`);
                onError(err);
            });

            this.connection!.client = connection;
            return connection;
        } catch (error: any) {
            log(`[Deepgram] Connection Error: ${error.message}`);
            return null;
        }
    }

    // Sends raw audio buffer directly to Deepgram
    sendAudioData(audioBuffer: Buffer | Float32Array | Int16Array): boolean {
        if (!this.connection?.client || !this.connection.isServerReady) {
            return false;
        }

        try {
            // If Float32Array (from legacy WhisperLiveService), convert to Int16
            if (audioBuffer instanceof Float32Array) {
                const pcm = new Int16Array(audioBuffer.length);
                for (let i = 0; i < audioBuffer.length; i++) {
                    let s = Math.max(-1, Math.min(1, audioBuffer[i]));
                    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                this.connection.client.send(Buffer.from(pcm.buffer));
            } else {
                // Send raw Buffer (already Int16LE)
                this.connection.client.send(audioBuffer as Buffer);
            }
            return true;
        } catch (error: any) {
            log(`[Deepgram] Error sending audio: ${error.message}`);
            return false;
        }
    }

    private async pushToRedis(segment: any, botConfig: BotConfig) {
        if (!this.redisClient || !this.redisClient.isOpen) return;

        try {
            this.transcriptCount++;
            const payload = {
                token: botConfig.token,
                platform: botConfig.platform,
                meeting_id: botConfig.meeting_id,
                native_meeting_id: botConfig.nativeMeetingId,
                meeting_url: botConfig.meetingUrl,
                segments: [segment], // Transcription Collector expects a list
                session_uid: this.connection!.sessionUid
            };

            const streamKey = process.env.REDIS_STREAM_KEY || 'transcription_segments';
            console.log(`[Deepgram] Pushing transcript segment to Redis stream "${streamKey}". Text: "${segment.text}"`);

            try {
                const messageId = await this.redisClient.xAdd(streamKey, '*', {
                    payload: JSON.stringify(payload)
                });
                console.log(`[Deepgram] Successfully pushed transcript to Redis. Message ID: ${messageId}`);
            } catch (redisError: any) {
                console.error(`[Deepgram] FAILED to push transcript to Redis:`, redisError);
                log(`[Deepgram] Redis push failed: ${redisError.message}`);
            }
        } catch (error: any) {
            console.error(`[Deepgram] Unexpected error in pushToRedis:`, error);
        }
    }

    // Ignored / No-Op methods needed for compatibility with old interface
    sendAudioChunkMetadata(chunkLen: number, sr: number): boolean { return true; }
    sendSpeakerEvent(...args: any[]): boolean { return true; }
    sendSessionControl(...args: any[]): boolean { return true; }

    async getNextCandidate(failedUrl: string | null): Promise<string | null> {
        return 'api.deepgram.com';
    }

    isReady(): boolean { return true; }
    getSessionUid(): string | null { return this.connection ? this.connection.sessionUid : null; }

    async cleanup() {
        if (this.connection) {
            this.connection.client.close();
        }
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.quit();
        }
    }
}
return this.connection?.isServerReady || false;
        }

getSessionUid(): string | null {
    return this.connection?.sessionUid || null;
}

    async cleanup(): Promise < void> {
    if(this.connection?.client) {
    this.connection.client.finish();
    this.connection.client = null;
}
this.connection = null;

if (this.redisClient && this.redisClient.isOpen) {
    await this.redisClient.quit();
    this.redisClient = null;
}
    }

    async initializeWithStubbornReconnection(platform: string): Promise < string > {
    const url = await this.initialize();
    if(!url) throw new Error("Could not initialize DeepgramService");
    return url;
}

    private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0, v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
}
