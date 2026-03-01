import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/deepgram";
import { v4 as uuidv4 } from "uuid";
import { query, ensureProfile } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const audioFile = formData.get("audio_file") as File;
        const title = (formData.get("title") as string) || "Untitled Meeting";
        const durationSeconds = parseInt((formData.get("duration_seconds") as string) || "0");

        if (!audioFile) {
            return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
        }

        // 0. Ensure Profile exists in external Postgres
        await ensureProfile(user.id, user.email!, (user.user_metadata as any)?.full_name);

        // 1. Upload to Supabase Storage
        const fileExt = audioFile.name.split(".").pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("meetings")
            .upload(filePath, audioFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from("meetings")
            .getPublicUrl(filePath);

        // 2. Create Meeting Record in external Postgres
        const meetingRes = await query(
            'INSERT INTO meetings (user_id, title, duration_minutes, audio_url, transcript_status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [user.id, title, Math.ceil(durationSeconds / 60), publicUrl, "processing"]
        );
        const meeting = meetingRes.rows[0];

        // 3. Trigger Transcription (Async-ish for now)
        // In a real production app, this should be a background job
        try {
            const transcript = await transcribeAudio(publicUrl);

            // 4. Save Transcript to external Postgres
            await query(
                'INSERT INTO transcripts (meeting_id, raw_text, cleaned_text) VALUES ($1, $2, $3)',
                [meeting.id, transcript, transcript]
            );

            await query(
                'UPDATE meetings SET transcript_status = $1 WHERE id = $2',
                ["completed", meeting.id]
            );

        } catch (transcribeErr) {
            console.error("Transcription failed:", transcribeErr);
            await query(
                'UPDATE meetings SET transcript_status = $1 WHERE id = $2',
                ["failed", meeting.id]
            );
        }

        return NextResponse.json({
            success: true,
            meeting_id: meeting.id,
            audio_url: publicUrl
        });

    } catch (error: any) {
        console.error("Meeting upload error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
