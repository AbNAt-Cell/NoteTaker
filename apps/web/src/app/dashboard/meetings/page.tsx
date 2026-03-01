"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

export default function MeetingsPage() {
    const [meetings, setMeetings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        const fetchMeetings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("meetings")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (!error && data) {
                setMeetings(data);
            }
            setLoading(false);
        };

        fetchMeetings();
    }, [supabase]);

    const filteredMeetings = meetings.filter(m =>
        m.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
                    <p className="text-muted-foreground">All your recorded and transcribed sessions.</p>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search meetings..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : filteredMeetings.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredMeetings.map((meeting) => (
                        <Card
                            key={meeting.id}
                            className="hover:border-primary/50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/dashboard/meetings/${meeting.id}`)}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg truncate">{meeting.title || "Untitled Meeting"}</CardTitle>
                                <CardDescription>
                                    {meeting.created_at ? format(new Date(meeting.created_at), "PPP") : "Unknown Date"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Video className="h-4 w-4" />
                                    <span>{meeting.duration_minutes || 0} mins</span>
                                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground capitalize">
                                        {meeting.transcript_status || "processing"}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="text-center py-12">
                    <CardHeader>
                        <CardTitle>No meetings found</CardTitle>
                        <CardDescription>
                            {searchQuery ? "Try a different search term" : "Start recording your first meeting from the dashboard."}
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}
        </div>
    );
}
