/**
 * Amebo — Transcription Service (OpenAI)
 *
 * Sends audio blobs to our server-side /api/transcribe route,
 * which proxies them to OpenAI's gpt-4o-transcribe-diarize model
 * for transcription with speaker diarization.
 */

export interface WhisperSegment {
    speaker: string;
    text: string;
    start: number;
    end: number;
}

export interface WhisperResult {
    text: string;
    segments: WhisperSegment[];
    language: string;
    duration: number;
}

/**
 * Transcribe an audio blob using OpenAI via our server-side API route.
 * The API key is kept secure on the server — never exposed to the browser.
 */
export async function transcribeAudio(
    audioBlob: Blob,
    onProgress?: (status: string) => void,
): Promise<WhisperResult> {
    onProgress?.('Preparing audio...');

    // Create a File from the Blob for FormData
    const audioFile = new File([audioBlob], 'recording.webm', {
        type: audioBlob.type || 'audio/webm',
    });

    const formData = new FormData();
    formData.append('file', audioFile);

    onProgress?.('Transcribing with OpenAI...');

    const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Transcription failed (${response.status})`);
    }

    const result: WhisperResult = await response.json();

    onProgress?.('Transcription complete!');

    return result;
}
