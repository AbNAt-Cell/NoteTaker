/**
 * Amebo — AI Summary API Route
 *
 * Takes a transcript (text + diarized segments) and generates
 * a structured meeting summary using GPT-4o.
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are Amebo, an AI meeting assistant. Given a meeting transcript with speaker labels, generate a structured meeting summary in Markdown format.

Follow this exact format:

## Executive Summary

- 3-5 bullet points capturing the most important themes, decisions, and outcomes
- Be specific about what was discussed and decided
- Note any conflicts, action items, or key conclusions

## Full Summary

Organize the content into logical sections with #### headers. Under each section, use bullet points with sub-points for details. Common section types include:

- Topic discussions
- Decisions made
- Action items
- Conflicts or disagreements
- Key takeaways

Rules:
- Use speaker names from the transcript (never say "Speaker" generically if a name is available)
- Be concise but capture all important details
- Use bullet points, not paragraphs
- If the transcript is very short (< 30 seconds), still provide a brief summary`;

export async function POST(request: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'OPENAI_API_KEY is not configured on the server.' },
            { status: 500 },
        );
    }

    try {
        const { text, segments } = await request.json();

        if (!text && (!segments || segments.length === 0)) {
            return NextResponse.json(
                { error: 'No transcript text or segments provided.' },
                { status: 400 },
            );
        }

        // Build a readable transcript with speaker labels
        let formattedTranscript = '';
        if (segments && segments.length > 0) {
            for (const seg of segments) {
                const speaker = seg.speaker || 'Unknown';
                const startTime = formatTime(seg.start || 0);
                const endTime = formatTime(seg.end || 0);
                formattedTranscript += `[${startTime} - ${endTime}] ${speaker}: ${seg.text}\n`;
            }
        } else {
            formattedTranscript = text;
        }

        console.log(`[Summarize] Generating summary for ${formattedTranscript.length} chars of transcript`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: `Please summarize this meeting transcript:\n\n${formattedTranscript}`,
                    },
                ],
                temperature: 0.3,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Summarize] OpenAI error (${response.status}):`, errorText);
            return NextResponse.json(
                { error: `OpenAI API error: ${response.status}` },
                { status: response.status },
            );
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content || '';

        console.log(`[Summarize] Generated summary: ${summary.length} chars`);

        return NextResponse.json({ summary });
    } catch (err: any) {
        console.error('[Summarize] Server error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 },
        );
    }
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
