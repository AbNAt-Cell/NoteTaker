/**
 * Amebo — Whisper Service (RunPod)
 *
 * Sends audio blobs to a RunPod-hosted Fast Whisper endpoint
 * for transcription with diarization.
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
 * Transcribe an audio blob using the RunPod Whisper endpoint.
 */
export async function transcribeAudio(
    audioBlob: Blob,
    endpoint: string,
    apiKey: string,
): Promise<WhisperResult> {
    // Convert blob to base64 robustly
    const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64 || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
    });

    const response = await fetch(`${endpoint}/runsync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            input: {
                audio: base64Audio,
                model: 'large-v3',
                language: 'en',
                word_timestamps: true,
                diarize: true,
                initial_prompt: 'This is a meeting transcription.',
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // RunPod wraps the output
    const output = data.output || data;

    // Normalize segments to our format
    const segments: WhisperSegment[] = (output.segments || []).map((seg: {
        speaker?: string;
        text?: string;
        start?: number;
        end?: number;
    }) => ({
        speaker: seg.speaker || 'Speaker 1',
        text: seg.text || '',
        start: seg.start || 0,
        end: seg.end || 0,
    }));

    return {
        text: output.text || segments.map((s: WhisperSegment) => s.text).join(' '),
        segments,
        language: output.language || 'en',
        duration: output.duration || 0,
    };
}

/**
 * Transcribe audio asynchronously (submit and poll).
 * Use this for longer recordings where runsync may timeout.
 */
export async function transcribeAudioAsync(
    audioBlob: Blob,
    endpoint: string,
    apiKey: string,
    onProgress?: (status: string) => void,
): Promise<WhisperResult> {
    // Convert blob to base64 robustly
    const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64 || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
    });

    // Submit job
    const submitRes = await fetch(`${endpoint}/run`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            input: {
                audio: base64Audio,
                model: 'large-v3',
                language: 'en',
                word_timestamps: true,
                diarize: true,
                initial_prompt: 'This is a meeting transcription.',
            },
        }),
    });

    if (!submitRes.ok) {
        throw new Error(`Failed to submit transcription job: ${submitRes.status}`);
    }

    const { id: jobId } = await submitRes.json();
    onProgress?.('Submitted');

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 120; // 10 min max

    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)); // poll every 5s
        attempts++;

        const statusRes = await fetch(`${endpoint}/status/${jobId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!statusRes.ok) continue;

        const statusData = await statusRes.json();
        onProgress?.(statusData.status || 'Processing...');

        if (statusData.status === 'COMPLETED') {
            const rawOutput = statusData.output || {};
            console.log('RunPod Output Keys:', Object.keys(rawOutput));

            // Handle various Whisper worker output formats
            const text = rawOutput.text || rawOutput.transcription || rawOutput.transcription_text || '';
            const rawSegments = rawOutput.segments || rawOutput.transcription_segments || [];

            console.log('Raw text length:', text?.length || 0);
            console.log('Raw segments count:', rawSegments?.length || 0);

            const segments: WhisperSegment[] = (rawSegments || []).map((seg: any) => ({
                speaker: seg.speaker || seg.speaker_label || 'Speaker 1',
                text: seg.text || seg.transcription || '',
                start: seg.start !== undefined ? seg.start : 0,
                end: seg.end !== undefined ? seg.end : 0,
            }));

            const finalResult = {
                text: text || segments.map((s: WhisperSegment) => s.text).join(' '),
                segments,
                language: rawOutput.language || 'en',
                duration: rawOutput.duration || 0,
            };

            console.log('Final normalized result:', {
                textLength: finalResult.text.length,
                segmentCount: finalResult.segments.length
            });

            return finalResult;
        }

        if (statusData.status === 'FAILED') {
            throw new Error(`Transcription failed: ${statusData.error || 'Unknown error'}`);
        }
    }

    throw new Error('Transcription timed out after 10 minutes');
}
