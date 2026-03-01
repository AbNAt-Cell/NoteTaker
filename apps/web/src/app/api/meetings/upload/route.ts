import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/deepgram";
import { v4 as uuidv4 } from "uuid";
import { query, ensureProfile } from "@/lib/db";

export async function POST(req: Request) {
    console.log("Upload request received");
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("Auth error:", authError);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.log("User authenticated:", user.id);

        const formData = await req.formData();
        const audioFile = formData.get("audio_file") as File;
        const title = (formData.get("title") as string) || "Untitled Meeting";
        const durationSeconds = parseInt((formData.get("duration_seconds") as string) || "0");

        if (!audioFile) {
            console.error("No audio file in formData");
            return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
        }

        // 0. Ensure Profile exists in external Postgres
        console.log("Ensuring profile in Postgres...");
        try {
            await ensureProfile(user.id, user.email!, (user.user_metadata as any)?.full_name);
            console.log("Profile check complete");
        } catch (dbErr) {
            console.error("Database error during ensureProfile:", dbErr);
            return NextResponse.json({ error: "Failed to connect to database" }, { status: 503 });
        }

        // 1. Upload to Supabase Storage
        console.log("Uploading to Supabase Storage...");
        const fileExt = audioFile.name.split(".").pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("meetings")
            .upload(filePath, audioFile);

        if (uploadError) {
            console.error("Supabase storage error:", uploadError);
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from("meetings")
            .getPublicUrl(filePath);

        console.log("Storage upload success:", publicUrl);

        // 2. Create Meeting Record in external Postgres
        console.log("Creating meeting record in Postgres...");
        let meeting;
        try {
            const meetingRes = await query(
                'INSERT INTO meetings (user_id, title, duration_minutes, audio_url, transcript_status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [user.id, title, Math.ceil(durationSeconds / 60), publicUrl, "processing"]
            );
            meeting = meetingRes.rows[0];
            console.log("Meeting record created:", meeting.id);
        } catch (dbErr) {
            console.error("Database error during meeting creation:", dbErr);
            return NextResponse.json({ error: "Failed to create meeting in database" }, { status: 503 });
        }

        // 3. Trigger Transcription (Async)
        (async () => {
            try {
                console.log("Starting transcription for meeting:", meeting.id);
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
                console.log("Transcription complete for meeting:", meeting.id);

            } catch (transcribeErr) {
                console.error("Transcription failed for meeting:", meeting.id, transcribeErr);
                await query(
                    'UPDATE meetings SET transcript_status = $1 WHERE id = $2',
                    ["failed", meeting.id]
                );
            }
        })().catch(err => console.error("Async task error:", err));

        return NextResponse.json({
            success: true,
            meeting_id: meeting.id,
            audio_url: publicUrl
        });

    } catch (error: any) {
        console.error("Global meeting upload error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
