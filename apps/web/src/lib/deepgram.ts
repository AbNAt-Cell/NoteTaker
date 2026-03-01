import { createClient } from "@deepgram/sdk";

let _deepgram: ReturnType<typeof createClient> | null = null;

export function getDeepgram() {
    if (_deepgram) return _deepgram;

    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

    if (!deepgramApiKey) {
        throw new Error("DEEPGRAM_API_KEY is not set. Please add it to your environment variables.");
    }

    _deepgram = createClient(deepgramApiKey);
    return _deepgram;
}

/**
 * Transcribes an audio file using Deepgram
 * @param audioSource URL or Buffer of the audio file
 * @returns The transcribed text
 */
export async function transcribeAudio(audioSource: string | Buffer) {
    try {
        const deepgram = getDeepgram();
        const options = {
            smart_format: true,
            model: "nova-2",
            language: "en",
        };

        const { result, error } = typeof audioSource === "string"
            ? await deepgram.listen.prerecorded.transcribeUrl({ url: audioSource }, options)
            : await deepgram.listen.prerecorded.transcribeFile(audioSource, { ...options, mimetype: "audio/webm" });

        if (error) throw error;

        return result.results.channels[0].alternatives[0].transcript;
    } catch (err) {
        console.error("Deepgram transcription error:", err);
        throw err;
    }
}
