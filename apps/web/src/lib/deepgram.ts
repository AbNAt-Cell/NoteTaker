import { createClient } from "@deepgram/sdk";

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

if (!deepgramApiKey) {
    console.warn("DEEPGRAM_API_KEY is not set. Transcription will not work.");
}

export const deepgram = createClient(deepgramApiKey || "");

/**
 * Transcribes an audio file using Deepgram
 * @param audioSource URL or Buffer of the audio file
 * @returns The transcribed text
 */
export async function transcribeAudio(audioSource: string | Buffer) {
    try {
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
