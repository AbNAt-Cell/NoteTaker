/**
 * Google OAuth Callback
 *
 * Google redirects here after user consents. We exchange the auth code
 * for tokens, fetch the user's email, and store the connection in Supabase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // Handle errors or missing code
    if (error || !code || !state) {
        console.error('[Google OAuth] Error or missing params:', error);
        return NextResponse.redirect(
            new URL('/dashboard?calendar=error&reason=denied', appUrl)
        );
    }

    // Decode state to get userId
    let userId: string;
    try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = decoded.userId;
    } catch {
        console.error('[Google OAuth] Invalid state param');
        return NextResponse.redirect(
            new URL('/dashboard?calendar=error&reason=invalid_state', appUrl)
        );
    }

    try {
        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error('[Google OAuth] Token exchange failed:', errText);
            return NextResponse.redirect(
                new URL('/dashboard?calendar=error&reason=token_exchange', appUrl)
            );
        }

        const tokens = await tokenRes.json();
        const { access_token, refresh_token, expires_in } = tokens;

        // Get user's Google email
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        let calendarEmail = '';
        if (profileRes.ok) {
            const profile = await profileRes.json();
            calendarEmail = profile.email || '';
        }

        // Store in Supabase
        const supabase = await createServerSupabaseClient();
        const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

        // Upsert the connection (update if already exists for this user+provider)
        const { error: dbError } = await supabase
            .from('calendar_connections')
            .upsert(
                {
                    user_id: userId,
                    provider: 'google',
                    access_token,
                    refresh_token: refresh_token || null,
                    token_expires_at: expiresAt,
                    calendar_email: calendarEmail,
                    connected_at: new Date().toISOString(),
                    is_active: true,
                },
                { onConflict: 'user_id,provider' }
            );

        if (dbError) {
            console.error('[Google OAuth] DB upsert error:', dbError);
            return NextResponse.redirect(
                new URL('/dashboard?calendar=error&reason=db_save', appUrl)
            );
        }

        console.log(`[Google OAuth] Successfully connected calendar for user ${userId} (${calendarEmail})`);

        // Redirect back to dashboard with success
        return NextResponse.redirect(
            new URL('/dashboard?calendar=connected', appUrl)
        );
    } catch (err: any) {
        console.error('[Google OAuth] Unexpected error:', err);
        return NextResponse.redirect(
            new URL('/dashboard?calendar=error&reason=unknown', appUrl)
        );
    }
}
