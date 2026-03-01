"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, Clock, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import RecordingWidget from "./RecordingWidget";

export default function DashboardPage() {
    const [showRecordingWidget, setShowRecordingWidget] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    // Placeholder data for now
    const meetings = [];
    const isLoadingMeetings = false;
    const error = null;

    // Calculate stats
    const totalMeetings = 0;
    const thisWeekMeetings = 0;
    const activeMeetings = 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Overview of your meeting transcriptions
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setShowRecordingWidget(true)}>
                        <Video className="mr-2 h-4 w-4" />
                        Record Meeting
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                        <Video className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalMeetings}</div>
                        <p className="text-xs text-muted-foreground">
                            All recorded meetings
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Week</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{thisWeekMeetings}</div>
                        <p className="text-xs text-muted-foreground">
                            Meetings in the last 7 days
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Now</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeMeetings}</div>
                        <p className="text-xs text-muted-foreground">
                            Currently recording
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Meetings Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Meetings</CardTitle>
                    <CardDescription>Your latest transcribed meetings</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">
                        No meetings yet. Start recording to get started!
                    </p>
                </CardContent>
            </Card>


            {showRecordingWidget && (
                <RecordingWidget
                    onClose={() => setShowRecordingWidget(false)}
                    onSave={async (data) => {
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) {
                                toast.error("Not logged in");
                                return;
                            }

                            if (!data.audioBlob) {
                                toast.error("No audio recorded");
                                return;
                            }

                            toast.loading("Uploading and transcribing recording...", { id: "upload-recording" });

                            const formData = new FormData();
                            formData.append("audio_file", data.audioBlob, "recording.webm");
                            formData.append("title", data.title || "Dashboard Recording");
                            formData.append("duration_seconds", data.duration.toString());

                            const res = await fetch("/api/vexa/recordings/upload", {
                                method: "POST",
                                body: formData
                            });

                            if (!res.ok) {
                                const errText = await res.text();
                                throw new Error(errText || "Failed to upload recording");
                            }

                            const result = await res.json();

                            toast.success("Recording saved successfully! Transcription is processing.", { id: "upload-recording" });
                            setShowRecordingWidget(false);

                            router.push(`/dashboard/meetings/${result.meeting_id}`);
                        } catch (error: any) {
                            console.error("Save recording error:", error);
                            toast.error(`Failed to save: ${error.message}`, { id: "upload-recording" });
                        }
                    }}
                />
            )}
        </div>
    );
}

