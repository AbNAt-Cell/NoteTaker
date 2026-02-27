"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Video, Clock, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MeetingList } from "@/components/meetings/meeting-list";
import { ErrorState } from "@/components/ui/error-state";
import { MCPConfigButton } from "@/components/mcp/mcp-config-button";
import { useMeetingsStore } from "@/stores/meetings-store";
import { useJoinModalStore } from "@/stores/join-modal-store";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import RecordingWidget from "./RecordingWidget";

export default function DashboardPage() {
    const [showRecordingWidget, setShowRecordingWidget] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const { meetings, isLoadingMeetings, fetchMeetings, error } = useMeetingsStore();
    const openJoinModal = useJoinModalStore((state) => state.openModal);

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings]);

    // Calculate stats
    const totalMeetings = meetings.length;
    const activeMeetings = meetings.filter((m) => m.status === "active").length;

    // Get meetings from this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeekMeetings = meetings.filter(
        (m) => new Date(m.created_at) >= oneWeekAgo
    ).length;

    // Get recent meetings (last 5)
    const recentMeetings = meetings.slice(0, 5);

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

                    <Button onClick={openJoinModal}>
                        <Plus className="mr-2 h-4 w-4" />
                        Join Meeting
                    </Button>
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

            {/* Recent Meetings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Recent Meetings</CardTitle>
                            <CardDescription>Your latest transcribed meetings</CardDescription>
                        </div>
                        {meetings.length > 5 && (
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/dashboard/meetings/all">
                                    View all
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <ErrorState
                            error={error}
                            onRetry={fetchMeetings}
                        />
                    ) : (
                        <MeetingList
                            meetings={recentMeetings}
                            isLoading={isLoadingMeetings}
                            limit={5}
                            emptyMessage="No meetings yet. Join your first meeting to get started!"
                        />
                    )}
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

                            const meetingData = {
                                user_id: user.id,
                                title: data.title || "Dashboard Recording",
                                platform: 'web_recording',
                                status: 'completed',
                                start_time: new Date(Date.now() - data.duration * 1000).toISOString(),
                                end_time: new Date().toISOString(),
                                duration_minutes: Math.ceil(data.duration / 60) || 1,
                                scratchpad_notes: data.notes
                            };

                            const { data: newMeeting, error: meetingError } = await supabase
                                .from('meetings')
                                .insert(meetingData)
                                .select()
                                .single();

                            if (meetingError) throw meetingError;

                            const transcriptData = {
                                meeting_id: newMeeting.id,
                                user_id: user.id,
                                transcript_data: { segments: data.transcript },
                                status: 'completed'
                            };

                            await supabase.from('transcripts').insert(transcriptData);

                            toast.success("Recording saved successfully");
                            setShowRecordingWidget(false);

                            router.push(`/dashboard/meetings/${newMeeting.id}`);
                        } catch (error: any) {
                            console.error("Save recording error:", error);
                            toast.error(`Failed to save: ${error.message}`);
                        }
                    }}
                />
            )}
        </div>
    );
}

