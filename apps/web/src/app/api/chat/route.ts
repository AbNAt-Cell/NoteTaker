/**
 * Amebo — AI Chat API Route
 *
 * Handles chat messages with context from meeting transcripts.
 * Supports model selection.
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const MODEL_MAP: Record<string, string> = {
    'auto': 'gpt-4o',
    'gpt-4o': 'gpt-4o',
    'gpt-4.1': 'gpt-4.1',
    'gpt-4.1-mini': 'gpt-4.1-mini',
    'gpt-5': 'gpt-4o', // fallback until GPT-5 is available
};

const SYSTEM_PROMPT = `You are Amebo AI, a smart meeting assistant. You help users understand, organize, and act on their meeting data.

You have access to the user's meeting transcripts and summaries. When asked:
- Recap meetings clearly and concisely
- Identify key decisions, action items, and open questions
- Surface patterns across meetings (recurring topics, unresolved issues)
- Help draft follow-up messages or tasks
- Answer questions about what was discussed

Be helpful, concise, and professional. Use bullet points where appropriate.
If you don't have enough context from the provided meetings, say so honestly.`;

export async function POST(request: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'OPENAI_API_KEY is not configured.' },
            { status: 500 },
        );
    }

    try {
        const { messages, model = 'auto', meetingContext } = await request.json();

        if (!messages || messages.length === 0) {
            return NextResponse.json(
                { error: 'No messages provided.' },
                { status: 400 },
            );
        }

        const selectedModel = MODEL_MAP[model] || 'gpt-4o';

        // Build system message with meeting context
        let systemContent = SYSTEM_PROMPT;
        if (meetingContext) {
            systemContent += `\n\nHere is the user's meeting data for context:\n\n${meetingContext}`;
        }

        const apiMessages = [
            { role: 'system', content: systemContent },
            ...messages,
        ];

        console.log(`[Chat] Model: ${selectedModel}, Messages: ${messages.length}`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: apiMessages,
                temperature: 0.5,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Chat] OpenAI error (${response.status}):`, errorText);
            return NextResponse.json(
                { error: `AI error: ${response.status}` },
                { status: response.status },
            );
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';

        return NextResponse.json({ reply, model: selectedModel });
    } catch (err: any) {
        console.error('[Chat] Server error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 },
        );
    }
}
