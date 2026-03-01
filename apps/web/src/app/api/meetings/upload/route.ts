import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/deepgram";
import { v4 as uuidv4 } from "uuid";

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

        // 2. Create Meeting Record
        const { data: meeting, error: meetingError } = await supabase
            .from("meetings")
            .insert({
                user_id: user.id,
                title,
                duration_minutes: Math.ceil(durationSeconds / 60),
                audio_url: publicUrl,
                transcript_status: "processing",
            })
            .select()
            .single();

        if (meetingError) throw meetingError;

        // 3. Trigger Transcription (Async-ish for now)
        // In a real production app, this should be a background job (e.g. Inngest or Upstash)
        // For now, we'll do it inline but handle the result
        try {
            const transcript = await transcribeAudio(publicUrl);

            // 4. Save Transcript
            await supabase
                .from("transcripts")
                .insert({
                    meeting_id: meeting.id,
                    raw_text: transcript,
                    cleaned_text: transcript, // Placeholder
                });

            await supabase
                .from("meetings")
                .update({ transcript_status: "completed" })
                .eq("id", meeting.id);

        } catch (transcribeErr) {
            console.error("Transcription failed:", transcribeErr);
            await supabase
                .from("meetings")
                .update({ transcript_status: "failed" })
                .eq("id", meeting.id);
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
