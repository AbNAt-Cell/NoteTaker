/**
 * Google OAuth Initiation
 *
 * Redirects the user to Google's consent screen to authorize
 * calendar access. After consent, Google redirects back to /api/auth/google/callback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export async function GET(request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!clientId) {
        return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
    }

    // Get the current user's session from the cookie
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Extract auth token from cookie
    const cookieHeader = request.headers.get('cookie') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { cookie: cookieHeader },
        },
    });

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
