/**
 * Calendar Sync
 *
 * Fetches upcoming events from Google Calendar and syncs them
 * as meetings in the database. Also refreshes expired tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!res.ok) {
        console.error('[Calendar Sync] Token refresh failed:', await res.text());
        return null;
    }

    return res.json();
}

export async function POST(_request: NextRequest) {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the user's Google Calendar connection
    const { data: connection, error: connError } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .maybeSingle();

    if (connError || !connection) {
        return NextResponse.json({ error: 'No calendar connected' }, { status: 404 });
    }

    let accessToken = connection.access_token;

    // Refresh if expired
    const isExpired = new Date(connection.token_expires_at) < new Date();
    if (isExpired && connection.refresh_token) {
        console.log('[Calendar Sync] Token expired, refreshing...');
        const refreshed = await refreshAccessToken(connection.refresh_token);
        if (refreshed) {
            accessToken = refreshed.access_token;
            const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

            await supabase
                .from('calendar_connections')
                .update({
                    access_token: accessToken,
                    token_expires_at: newExpiry,
                })
                .eq('id', connection.id);
        } else {
            return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
        }
    }

    try {
        // Fetch events from Google Calendar (next 7 days)
        const now = new Date().toISOString();
        const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${encodeURIComponent(now)}&` +
            `timeMax=${encodeURIComponent(weekLater)}&` +
            `singleEvents=true&orderBy=startTime&maxResults=50`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!calRes.ok) {
            const errText = await calRes.text();
            console.error('[Calendar Sync] Calendar API error:', errText);
            return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
        }

        const calData = await calRes.json();
        const events = calData.items || [];

        console.log(`[Calendar Sync] Found ${events.length} upcoming events`);

        // Sync events as meetings
        let synced = 0;
        for (const event of events) {
            if (!event.summary) continue; // Skip events without titles

            const startTime = event.start?.dateTime || event.start?.date;
            const endTime = event.end?.dateTime || event.end?.date;

            if (!startTime) continue;

            // Calculate duration
            let durationMinutes = 30;
            if (startTime && endTime) {
                durationMinutes = Math.round(
                    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
                );
            }

            // Extract attendees
            const attendees = (event.attendees || [])
                .filter((a: any) => !a.self)
                .map((a: any) => a.displayName || a.email)
                .slice(0, 10);

            // Check if meeting already exists for this event
            const { data: existing } = await supabase
                .from('meetings')
                .select('id')
                .eq('user_id', user.id)
                .eq('google_event_id', event.id)
                .maybeSingle();

            if (existing) {
                // Update existing meeting
                await supabase
                    .from('meetings')
                    .update({
                        title: event.summary,
                        scheduled_at: startTime,
                        duration_minutes: durationMinutes,
                        speakers: attendees,
                    })
                    .eq('id', existing.id);
            } else {
                // Create new meeting
                await supabase
                    .from('meetings')
                    .insert({
                        user_id: user.id,
                        title: event.summary,
                        scheduled_at: startTime,
                        duration_minutes: durationMinutes,
                        speakers: attendees,
                        google_event_id: event.id,
                        transcript_status: 'pending',
                    });
            }
            synced++;
        }

        // Update last synced timestamp
        await supabase
            .from('calendar_connections')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', connection.id);

        return NextResponse.json({
            synced,
            total: events.length,
            message: `Synced ${synced} calendar events`,
        });
    } catch (err: any) {
        console.error('[Calendar Sync] Error:', err);
        return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
    }
}
