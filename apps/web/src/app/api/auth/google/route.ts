/**
 * Google OAuth Initiation
 *
 * Redirects the user to Google's consent screen to authorize
 * calendar access. After consent, Google redirects back to /api/auth/google/callback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export async function GET(_request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

    if (!clientId) {
        return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/login', appUrl));
    }

    // Build Google OAuth URL
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.redirect(authUrl);
}
