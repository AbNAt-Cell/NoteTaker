/**
 * Calendar Connection Status
 *
 * Returns whether the user has a connected calendar and its details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ connected: false, connection: null });
    }

    const { data: connection } = await supabase
        .from('calendar_connections')
        .select('id, provider, calendar_email, connected_at, last_synced_at, is_active')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .maybeSingle();

    return NextResponse.json({
        connected: !!connection,
        connection: connection || null,
    });
}

// Disconnect calendar
export async function DELETE(_request: NextRequest) {
    const supabase = await createServerSupabaseClient();

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
