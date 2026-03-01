import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { query } from "@/lib/db";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch meeting
        const meetingRes = await query(
            'SELECT * FROM meetings WHERE id = $1 AND user_id = $2',
            [id, user.id]
        );

        if (meetingRes.rowCount === 0) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        const meeting = meetingRes.rows[0];

        // Fetch transcript
        const transcriptRes = await query(
            'SELECT * FROM transcripts WHERE meeting_id = $1',
            [id]
        );

        const transcript = transcriptRes.rows[0] || null;

        return NextResponse.json({
            ...meeting,
            transcript
        });
    } catch (error: any) {
        console.error("Fetch meeting detail error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
