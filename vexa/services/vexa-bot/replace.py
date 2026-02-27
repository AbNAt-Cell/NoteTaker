import os

file_path = "core/src/utils/browser.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the start of BrowserWhisperLiveService
start_idx = content.find("export class BrowserWhisperLiveService")
if start_idx == -1:
    print("Could not find BrowserWhisperLiveService in file")
    exit(1)

# Backtrack to include the preceding comment
comment_start = content.rfind("/**", 0, start_idx)

new_class = """/**
 * Browser-compatible DeepgramService for browser context
 * Connects directly to Deepgram WebSocket and pushes transcripts via Playwright exposed function
 */
export class BrowserDeepgramService {
  private apiKey: string;
  private socket: WebSocket | null = null;
  private isServerReady: boolean = false;
  private botConfigData: any;
  private currentUid: string | null = null;
  private onMessageCallback: ((data: any) => void) | null = null;
  private onErrorCallback: ((error: Event) => void) | null = null;
  private onCloseCallback: ((event: CloseEvent) => void) | null = null;
  private reconnectInterval: any = null;
  private retryCount: number = 0;
  private retryDelayMs: number = 2000;
  private stubbornMode: boolean = false;
  private isManualReconnect: boolean = false;

  constructor(config: any, stubbornMode: boolean = false) {
    this.apiKey = config.deepgramApiKey;
    this.stubbornMode = stubbornMode;
  }

  async connectToDeepgram(
    botConfigData: any,
    onMessage: (data: any) => void,
    onError: (error: Event) => void,
    onClose: (event: CloseEvent) => void
  ): Promise<WebSocket | null> {
    this.botConfigData = botConfigData;
    this.onMessageCallback = onMessage;
    this.onErrorCallback = onError;
    this.onCloseCallback = onClose;

    if (this.stubbornMode) {
      return this.attemptConnection();
    } else {
      return this.simpleConnection();
    }
  }

  private async simpleConnection(): Promise<WebSocket | null> {
    try {
      const url = `wss://api.deepgram.com/v1/listen?model=nova-3&language=${this.botConfigData.language || 'en'}&smart_format=true&diarize=true&encoding=linear16&sample_rate=16000&channels=1`;
      this.socket = new WebSocket(url, ['token', this.apiKey]);
      this.socket.binaryType = "arraybuffer";
      
      this.socket.onopen = () => {
        this.currentUid = generateBrowserUUID();
        (window as any).logBot(`[Deepgram] WebSocket connection opened successfully.`);
        this.isServerReady = true;
        if (this.onMessageCallback) {
           this.onMessageCallback({ message: 'SERVER_READY', backend: 'deepgram' });
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
            language: this.botConfigData.language,
            speaker: speaker,
          };

          if (this.onMessageCallback) {
            this.onMessageCallback({
              uid: this.currentUid,
              segments: [segment],
              backend: 'deepgram'
            });
          }

          if (isFinal && typeof (window as any).vexa_pushTranscriptToRedis === 'function') {
            (window as any).vexa_pushTranscriptToRedis(this.currentUid, segment, this.botConfigData);
          }
        } catch (e) {
          (window as any).logBot(`[Deepgram] Parse error: ${e}`);
        }
      };

      this.socket.onerror = this.onErrorCallback;
      this.socket.onclose = this.onCloseCallback;

      return this.socket;
    } catch (error: any) {
      (window as any).logBot(`[Deepgram] Connection error: ${error.message}`);
      return null;
    }
  }

  private async attemptConnection(): Promise<WebSocket | null> {
    try {
      (window as any).logBot(`[STUBBORN] 🚀 Connecting to Deepgram... (attempt ${this.retryCount + 1})`);
      const url = `wss://api.deepgram.com/v1/listen?model=nova-3&language=${this.botConfigData.language || 'en'}&smart_format=true&diarize=true&encoding=linear16&sample_rate=16000&channels=1`;
      this.socket = new WebSocket(url, ['token', this.apiKey]);
      this.socket.binaryType = "arraybuffer";
      
      this.socket.onopen = (event) => {
        (window as any).logBot(`[STUBBORN] ✅ Deepgram WebSocket CONNECTED!`);
        this.retryCount = 0; 
        this.clearReconnectInterval(); 
        this.isServerReady = true; 
        this.currentUid = generateBrowserUUID();
        if (this.onMessageCallback) {
           this.onMessageCallback({ message: 'SERVER_READY', backend: 'deepgram' });
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
            language: this.botConfigData.language,
            speaker: speaker,
          };

          if (this.onMessageCallback) {
            this.onMessageCallback({
              uid: this.currentUid,
              segments: [segment],
              backend: 'deepgram'
            });
          }

          if (isFinal && typeof (window as any).vexa_pushTranscriptToRedis === 'function') {
            (window as any).vexa_pushTranscriptToRedis(this.currentUid, segment, this.botConfigData);
          }
        } catch (e) {
          (window as any).logBot(`[Deepgram] Parse error: ${e}`);
        }
      };

      this.socket.onerror = (event) => {
        if (this.onErrorCallback) this.onErrorCallback(event);
        if (!this.isManualReconnect) this.startStubbornReconnection();
      };

      this.socket.onclose = (event) => {
        this.isServerReady = false;
        this.socket = null;
        if (this.onCloseCallback) this.onCloseCallback(event);
        if (!this.isManualReconnect) {
          this.startStubbornReconnection();
        } else {
          this.isManualReconnect = false; 
        }
      };

      return this.socket;
    } catch (error: any) {
      this.startStubbornReconnection();
      return null;
    }
  }

  private startStubbornReconnection(): void {
    if (this.reconnectInterval) return;
    const delay = Math.min(this.retryDelayMs * Math.pow(1.5, Math.min(this.retryCount, 10)), 10000);
    this.reconnectInterval = setTimeout(async () => {
      this.reconnectInterval = null;
      this.retryCount++;
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        await this.attemptConnection();
      }
    }, delay);
  }

  private clearReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  // Expects Float32Array from BrowserAudioProcessor, converts to Int16Array and sends to Deepgram
  sendAudioData(audioData: Float32Array): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      const pcm = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        let s = Math.max(-1, Math.min(1, audioData[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.socket.send(pcm.buffer);
      return true;
    } catch (error: any) {
      return false;
    }
  }

  sendAudioChunkMetadata(chunkLength: number, sampleRate: number): boolean { return true; }
  sendSpeakerEvent(...args: any[]): boolean { return true; }
  sendSessionControl(...args: any[]): boolean { return true; }

  getCurrentUid(): string | null { return this.currentUid; }
  isReady(): boolean { return this.isServerReady; }
  setServerReady(ready: boolean): void { this.isServerReady = ready; }
  isOpen(): boolean { return this.socket?.readyState === WebSocket.OPEN; }

  close(): void {
    this.clearReconnectInterval();
    this.currentUid = null;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  closeForReconfigure(): void {
    this.isManualReconnect = true;
    this.close();
  }
}
"""

new_content = content[:comment_start] + new_class

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Successfully replaced BrowserWhisperLiveService with BrowserDeepgramService")
