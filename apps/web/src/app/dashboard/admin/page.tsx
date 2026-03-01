"use client";

import { useState, useEffect } from "react";
import {
    Users,
    Video,
    Clock,
    TrendingUp,
    CheckCircle,
    XCircle,
    Loader2,
    Trash2,
    ExternalLink
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminDashboardPage() {
    const [meetings, setMeetings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalMeetings: 0,
        completedTranscripts: 0,
        failedTranscripts: 0,
        totalMinutes: 0
    });

    const supabase = createClient();

    const fetchMeetings = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("meetings")
                .select(`
          *,
          profiles:user_id (full_name, email)
        `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setMeetings(data || []);

            // Calculate stats
            const total = data?.length || 0;
            const completed = data?.filter(m => m.transcript_status === "completed").length || 0;
            const failed = data?.filter(m => m.transcript_status === "failed").length || 0;
            const minutes = data?.reduce((acc, m) => acc + (m.duration_minutes || 0), 0) || 0;

            setStats({
                totalMeetings: total,
                completedTranscripts: completed,
                failedTranscripts: failed,
                totalMinutes: minutes
            });
        } catch (error: any) {
            toast.error("Failed to fetch meetings: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetings();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this meeting?")) return;

        try {
            const { error } = await supabase
                .from("meetings")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast.success("Meeting deleted");
            fetchMeetings();
        } catch (error: any) {
            toast.error("Delete failed: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-muted-foreground">
                    System-wide overview of all meetings and transcriptions
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                        <Video className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalMeetings}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Minutes Transcribed</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalMinutes}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.totalMeetings > 0
                                ? Math.round((stats.completedTranscripts / stats.totalMeetings) * 100)
                                : 0}%
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failed</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.failedTranscripts}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Meetings</CardTitle>
                    <CardDescription>Managed list of every meeting in the system</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : meetings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        No meetings found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                meetings.map((meeting) => (
                                    <TableRow key={meeting.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(meeting.created_at), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{meeting.profiles?.full_name || "Unknown"}</span>
                                                <span className="text-xs text-muted-foreground">{meeting.profiles?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{meeting.title}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                meeting.transcript_status === "completed" ? "default" :
                                                    meeting.transcript_status === "failed" ? "destructive" :
                                                        "secondary"
                                            }>
                                                {meeting.transcript_status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{meeting.duration_minutes}m</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <a href={`/dashboard/meetings/${meeting.id}`} target="_blank" rel="noreferrer">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(meeting.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
