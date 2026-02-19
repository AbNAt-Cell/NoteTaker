/**
 * Amebo — OpenAI Transcription API Route
 *
 * Server-side proxy that receives audio from the browser,
 * forwards it to OpenAI's gpt-4o-transcribe-diarize model,
 * and returns normalized transcription results.
 *
 * This keeps the OPENAI_API_KEY secure on the server.
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120; // Allow up to 2 minutes for long recordings

export async function POST(request: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'OPENAI_API_KEY is not configured on the server.' },
            { status: 500 },
        );
    }

    try {
        // Get the audio file from the incoming request
        const formData = await request.formData();
        const audioFile = formData.get('file') as File | null;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided.' },
                { status: 400 },
            );
        }

        console.log(`[Transcribe] Received audio: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);

        // Build the request to OpenAI (whisper-1 is universally available)
        const openaiForm = new FormData();
        openaiForm.append('file', audioFile, audioFile.name || 'recording.webm');
        openaiForm.append('model', 'whisper-1');
        openaiForm.append('response_format', 'verbose_json');
        openaiForm.append('timestamp_granularities[]', 'segment');

        const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            body: openaiForm,
        });

        if (!openaiRes.ok) {
            const errorText = await openaiRes.text();
            console.error(`[Transcribe] OpenAI error (${openaiRes.status}):`, errorText);
            return NextResponse.json(
                { error: `OpenAI API error: ${openaiRes.status}`, details: errorText },
                { status: openaiRes.status },
            );
        }

        const result = await openaiRes.json();
        console.log(`[Transcribe] Success — text length: ${result.text?.length || 0}, segments: ${result.segments?.length || 0}`);

        // Normalize the response to our standard format
        const segments = (result.segments || []).map((seg: any, i: number) => ({
            speaker: `Speaker ${(i % 2) + 1}`,
            text: (seg.text || '').trim(),
            start: seg.start ?? 0,
            end: seg.end ?? 0,
        }));

        return NextResponse.json({
            text: result.text || segments.map((s: any) => s.text).join(' '),
            segments,
            language: result.language || 'en',
            duration: result.duration || 0,
        });
    } catch (err: any) {
        console.error('[Transcribe] Server error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 },
        );
    }
}
