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

    // Base endpoint normalization
    const baseEndpoint = endpoint.replace(/\/run(sync)?$/, '');

    const response = await fetch(`${baseEndpoint}/runsync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            input: {
                audio: base64Audio,
                audio_base64: base64Audio,
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

    const output = data.output || data;

    let text = output.text || '';
    let rawSegments = output.segments || [];

    // Handle nested transcription object
    if (output.transcription && typeof output.transcription === 'object') {
        text = output.transcription.text || text;
        rawSegments = output.transcription.segments || rawSegments;
    }

    // Fallback for other keys
    if (!text && typeof output.transcription === 'string') text = output.transcription;
    if (!text && output.transcription_text) text = output.transcription_text;
    if (rawSegments.length === 0 && output.transcription_segments) rawSegments = output.transcription_segments;

    // Normalize segments to our format
    const segments: WhisperSegment[] = (Array.isArray(rawSegments) ? rawSegments : []).map((seg: any) => ({
        speaker: seg.speaker || seg.speaker_label || 'Speaker 1',
        text: seg.text || seg.transcription || '',
        start: seg.start !== undefined ? seg.start : 0,
        end: seg.end !== undefined ? seg.end : 0,
    }));

    return {
        text: typeof text === 'string' ? text : segments.map((s: WhisperSegment) => s.text).join(' '),
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

    // Base endpoint normalization (remove trailing /run or /runsync if provided)
    const baseEndpoint = endpoint.replace(/\/run(sync)?$/, '');

    // Submit job
    const submitUrl = `${baseEndpoint}/run`;
    console.log('Submitting transcription job to:', submitUrl);

    const submitRes = await fetch(submitUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            input: {
                audio: base64Audio,
                audio_base64: base64Audio, // Some public endpoints prefer this
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

        const statusUrl = `${baseEndpoint}/status/${jobId}`;
        const statusRes = await fetch(statusUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!statusRes.ok) continue;

        const statusData = await statusRes.json();
        onProgress?.(statusData.status || 'Processing...');

        if (statusData.status === 'COMPLETED') {
            const rawOutput = statusData.output || {};
            console.log('RunPod Output Keys:', Object.keys(rawOutput));

            let text = rawOutput.text || '';
            let rawSegments = rawOutput.segments || [];

            // Handle nested transcription object (common in some workers)
            if (rawOutput.transcription && typeof rawOutput.transcription === 'object') {
                text = rawOutput.transcription.text || text;
                rawSegments = rawOutput.transcription.segments || rawSegments;
            }

            // Fallback for other potential keys
            if (!text && typeof rawOutput.transcription === 'string') text = rawOutput.transcription;
            if (!text && rawOutput.transcription_text) text = rawOutput.transcription_text;
            if (rawSegments.length === 0 && rawOutput.transcription_segments) rawSegments = rawOutput.transcription_segments;

            console.log('Normalized text length:', typeof text === 'string' ? text.length : 'NOT A STRING');
            console.log('Normalized segments count:', Array.isArray(rawSegments) ? rawSegments.length : 'NOT AN ARRAY');

            const segments: WhisperSegment[] = (Array.isArray(rawSegments) ? rawSegments : []).map((seg: any) => ({
                speaker: seg.speaker || seg.speaker_label || 'Speaker 1',
                text: seg.text || seg.transcription || '',
                start: seg.start !== undefined ? seg.start : 0,
                end: seg.end !== undefined ? seg.end : 0,
            }));

            const finalResult = {
                text: typeof text === 'string' ? text : segments.map((s: WhisperSegment) => s.text).join(' '),
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
