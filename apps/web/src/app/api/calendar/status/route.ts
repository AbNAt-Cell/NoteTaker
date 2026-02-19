/**
 * Calendar Connection Status
 *
 * Returns whether the user has a connected calendar and its details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const cookieHeader = request.headers.get('cookie') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { cookie: cookieHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: connection } = await supabase
        .from('calendar_connections')
        .select('id, provider, calendar_email, connected_at, last_synced_at, is_active')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .single();

    return NextResponse.json({
        connected: !!connection,
        connection: connection || null,
    });
}

// Disconnect calendar
export async function DELETE(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const cookieHeader = request.headers.get('cookie') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { cookie: cookieHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await supabase
        .from('calendar_connections')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('provider', 'google');

    return NextResponse.json({ disconnected: true });
}
