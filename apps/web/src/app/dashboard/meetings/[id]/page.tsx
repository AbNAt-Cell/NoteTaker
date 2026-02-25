"use client";

import { useEffect, useState, useRef, useCallback, useMemo, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import {
    ArrowLeft,
    Calendar,
    Clock,
    Users,
    Globe,
    Video,
    Pencil,
    Check,
    X,
    Sparkles,
    Loader2,
    FileText,
    StopCircle,
    FileJson,
    FileVideo,
    ChevronDown,
    Settings,
    ExternalLink,
    Trash2,
    Zap,
} from "lucide-react";
import { AudioPlayer, type AudioPlayerHandle, type AudioFragment } from "@/components/recording/audio-player";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/error-state";
import { TranscriptViewer } from "@/components/transcript/transcript-viewer";
import { BotStatusIndicator, BotFailedIndicator } from "@/components/meetings/bot-status-indicator";
import { AIChatPanel } from "@/components/ai";
import { useMeetingsStore } from "@/stores/meetings-store";
import { useLiveTranscripts } from "@/hooks/use-live-transcripts";
import { PLATFORM_CONFIG, getDetailedStatus } from "@/types/vexa";
import type { MeetingStatus, Meeting } from "@/types/vexa";
import { StatusHistory } from "@/components/meetings/status-history";
import { cn } from "@/lib/utils";
import { vexaAPI } from "@/lib/api";
import { toast } from "sonner";
import { LanguagePicker } from "@/components/language-picker";
import { WHISPER_LANGUAGE_CODES, getLanguageDisplayName } from "@/lib/languages";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    exportToTxt,
    exportToJson,
    exportToSrt,
    exportToVtt,
    downloadFile,
    generateFilename,
} from "@/lib/export";
import { getCookie, setCookie } from "@/lib/cookies";
import { DecisionsPanel } from "@/components/decisions/decisions-panel";

export default function MeetingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const idParam = (params as { id?: string | string[] } | null)?.id;
    const meetingId = Array.isArray(idParam) ? idParam[0] : (idParam ?? "");

    const {
        currentMeeting,
        transcripts,
        recordings,
        chatMessages,
        isLoadingMeeting,
        isLoadingTranscripts,
        isUpdatingMeeting,
        error,
        fetchMeeting,
        refreshMeeting,
        fetchTranscripts,
        fetchChatMessages,
        updateMeetingStatus,
        updateMeetingData,
        deleteMeeting,
        clearCurrentMeeting,
    } = useMeetingsStore();

    // Decisions panel state
    const [decisionsOpen, setDecisionsOpen] = useState(false);

    // Title editing state
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState("");
    const [isSavingTitle, setIsSavingTitle] = useState(false);

    // Notes editing state
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [editedNotes, setEditedNotes] = useState("");
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);
    const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
    const shouldSetCursorToEnd = useRef(false);

    // ChatGPT prompt editing state
    const [chatgptPrompt, setChatgptPrompt] = useState(() => {
        if (typeof window !== "undefined") {
            return getCookie("vexa-chatgpt-prompt") || "Read from {url} so I can ask questions about it.";
        }
        return "Read from {url} so I can ask questions about it.";
    });
    const [isChatgptPromptExpanded, setIsChatgptPromptExpanded] = useState(false);
    const [editedChatgptPrompt, setEditedChatgptPrompt] = useState(chatgptPrompt);
    const chatgptPromptTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Bot control state
    const [isStoppingBot, setIsStoppingBot] = useState(false);
    const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [forcePostMeetingMode, setForcePostMeetingMode] = useState(false);

    // Bot config state
    const [currentLanguage, setCurrentLanguage] = useState<string | undefined>(
        currentMeeting?.data?.languages?.[0] || "auto"
    );
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

    // Audio playback state
    const audioPlayerRef = useRef<AudioPlayerHandle>(null);
    const [playbackTime, setPlaybackTime] = useState<number | null>(null);
    const [isPlaybackActive, setIsPlaybackActive] = useState(false);
    const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(null);
    const [activeFragmentIndex, setActiveFragmentIndex] = useState(0);

    const recordingFragments = useMemo((): AudioFragment[] => {
        const availableRecordings = recordings
            .filter(r => (r.status === "completed" || r.status === "in_progress") && r.media_files?.some((mf: any) => mf.type === "audio"))
            .sort((a, b) => a.created_at.localeCompare(b.created_at));

        return availableRecordings.map(rec => {
            const audioMedia = rec.media_files.find((mf: any) => mf.type === "audio")!;
            return {
                src: vexaAPI.getRecordingAudioUrl(rec.id, audioMedia.id),
                duration: audioMedia.duration_seconds || 0,
                sessionUid: rec.session_uid,
                createdAt: rec.created_at,
            };
        });
    }, [recordings]);

    const hasRecordingAudio = recordingFragments.length > 0;

    const handlePlaybackTimeUpdate = useCallback((time: number) => {
        setPlaybackTime(time);
        setIsPlaybackActive(true);
    }, []);

    const handleFragmentChange = useCallback((index: number) => {
        setActiveFragmentIndex(index);
    }, []);

    const handleSegmentClick = useCallback((startTimeSeconds: number, absoluteStartTime?: string) => {
        if (!hasRecordingAudio) {
            setPendingSeekTime(startTimeSeconds);
            return;
        }

        if (recordingFragments.length <= 1) {
            audioPlayerRef.current?.seekTo(startTimeSeconds);
            setPlaybackTime(startTimeSeconds);
            setIsPlaybackActive(true);
            return;
        }

        let targetFragmentIndex = 0;
        if (absoluteStartTime) {
            const segTime = new Date(absoluteStartTime).getTime();
            for (let i = recordingFragments.length - 1; i >= 0; i--) {
                const fragTime = new Date(recordingFragments[i].createdAt).getTime();
                if (fragTime <= segTime) {
                    targetFragmentIndex = i;
                    break;
                }
            }
        }

        audioPlayerRef.current?.seekToFragment(targetFragmentIndex, startTimeSeconds);

        const virtualOffset = recordingFragments
            .slice(0, targetFragmentIndex)
            .reduce((sum, f) => sum + (f.duration || 0), 0);
        setPlaybackTime(virtualOffset + startTimeSeconds);
        setIsPlaybackActive(true);
    }, [hasRecordingAudio, recordingFragments]);

    useEffect(() => {
        if (!hasRecordingAudio || pendingSeekTime == null) return;
        const timer = setTimeout(() => {
            audioPlayerRef.current?.seekTo(pendingSeekTime);
            setPlaybackTime(pendingSeekTime);
            setIsPlaybackActive(true);
            setPendingSeekTime(null);
        }, 0);
        return () => clearTimeout(timer);
    }, [hasRecordingAudio, pendingSeekTime]);

    const hasLoadedRef = useRef(false);

    const handleStatusChange = useCallback((status: MeetingStatus) => {
        if (status === "active" || status === "stopping" || status === "completed" || status === "failed") {
            fetchMeeting(meetingId);
        }
        if (
            (status === "stopping" || status === "completed") &&
            currentMeeting?.platform &&
            currentMeeting?.platform_specific_id
        ) {
            fetchTranscripts(currentMeeting.platform, currentMeeting.platform_specific_id);
        }
    }, [fetchMeeting, fetchTranscripts, meetingId, currentMeeting?.platform, currentMeeting?.platform_specific_id]);

    const handleStopBot = useCallback(async () => {
        if (!currentMeeting) return;
        setIsStoppingBot(true);
        try {
            await vexaAPI.stopBot(currentMeeting.platform, currentMeeting.platform_specific_id);
            setForcePostMeetingMode(true);
            updateMeetingStatus(String(currentMeeting.id), "stopping");
            fetchTranscripts(currentMeeting.platform, currentMeeting.platform_specific_id);
            toast.success("Bot stopped", {
                description: "The transcription has been stopped.",
            });
            fetchMeeting(meetingId);
        } catch (error) {
            toast.error("Failed to stop bot", {
                description: (error as Error).message,
            });
        } finally {
            setIsStoppingBot(false);
        }
    }, [currentMeeting, fetchMeeting, fetchTranscripts, meetingId, updateMeetingStatus]);

    const handleLanguageChange = useCallback(async (newLanguage: string) => {
        if (!currentMeeting) return;
        setIsUpdatingConfig(true);
        try {
            await vexaAPI.updateBotConfig(currentMeeting.platform, currentMeeting.platform_specific_id, {
                language: newLanguage === "auto" ? undefined : newLanguage,
                task: "transcribe",
            });
            setCurrentLanguage(newLanguage);
            updateMeetingData(currentMeeting.platform, currentMeeting.platform_specific_id, {
                languages: [newLanguage],
            });
            toast.success("Language updated successfully");
        } catch (error) {
            toast.error("Failed to update language", {
                description: (error as Error).message,
            });
        } finally {
            setIsUpdatingConfig(false);
        }
    }, [currentMeeting, updateMeetingData]);

    const handleDeleteMeeting = useCallback(async () => {
        if (!currentMeeting) return;
        setIsDeletingMeeting(true);
        try {
            await deleteMeeting(
                currentMeeting.platform,
                currentMeeting.platform_specific_id,
                currentMeeting.id
            );
            toast.success("Meeting deleted");
            router.push("/dashboard/meetings/all");
        } catch (error) {
            toast.error("Failed to delete meeting", {
                description: (error as Error).message,
            });
        } finally {
            setIsDeletingMeeting(false);
        }
    }, [currentMeeting, deleteMeeting, router]);

    const handleExport = useCallback((format: "txt" | "json" | "srt" | "vtt") => {
        if (!currentMeeting) {
            toast.error("No meeting selected");
            return;
        }
        if (transcripts.length === 0) {
            toast.info("No transcript available yet", {
                description: "The transcript will be available once the meeting starts and transcription begins.",
            });
            return;
        }

        let content: string;
        let mimeType: string;

        switch (format) {
            case "txt":
                content = exportToTxt(currentMeeting, transcripts);
                mimeType = "text/plain";
                break;
            case "json":
                content = exportToJson(currentMeeting, transcripts);
                mimeType = "application/json";
                break;
            case "srt":
                content = exportToSrt(transcripts);
                mimeType = "text/plain";
                break;
            case "vtt":
                content = exportToVtt(transcripts);
                mimeType = "text/vtt";
                break;
        }

        const filename = generateFilename(currentMeeting, format);
        downloadFile(content, filename, mimeType);
    }, [currentMeeting, transcripts]);

    const formatTranscriptForChatGPT = useCallback((meeting: Meeting, segments: typeof transcripts): string => {
        let output = "Meeting Transcript\n\n";

        if (meeting.data?.name || meeting.data?.title) {
            output += `Title: ${meeting.data?.name || meeting.data?.title}\n`;
        }

        if (meeting.start_time) {
            output += `Date: ${format(new Date(meeting.start_time), "PPPp")}\n`;
        }

        if (meeting.data?.participants?.length) {
            output += `Participants: ${meeting.data.participants.join(", ")}\n`;
        }

        output += "\n---\n\n";

        for (const segment of segments) {
            let timestamp = "";
            if (segment.absolute_start_time) {
                try {
                    const date = new Date(segment.absolute_start_time);
                    timestamp = date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "").replace("Z", "");
                } catch {
                    timestamp = segment.absolute_start_time;
                }
            } else if (segment.start_time !== undefined) {
                const minutes = Math.floor(segment.start_time / 60);
                const seconds = Math.floor(segment.start_time % 60);
                timestamp = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            }

            if (timestamp) {
                output += `[${timestamp}] ${segment.speaker}: ${segment.text}\n\n`;
            } else {
                output += `${segment.speaker}: ${segment.text}\n\n`;
            }
        }

        return output;
    }, []);

    const handleOpenInProvider = useCallback(async (provider: "chatgpt" | "perplexity") => {
        if (!currentMeeting) {
            toast.error("No meeting selected");
            return;
        }
        if (transcripts.length === 0) {
            toast.info("No transcript available yet", {
                description: "The transcript will be available once the meeting starts and transcription begins.",
            });
            return;
        }

        try {
            const share = await vexaAPI.createTranscriptShare(
                currentMeeting.platform,
                currentMeeting.platform_specific_id,
                meetingId
            );

            const publicBase = process.env.NEXT_PUBLIC_TRANSCRIPT_SHARE_BASE_URL?.replace(/\/$/, "");
            const shareUrl =
                publicBase && share.share_id
                    ? `${publicBase}/public/transcripts/${share.share_id}.txt`
                    : share.url;

            const prompt = chatgptPrompt.replace(/{url}/g, shareUrl);

            let providerUrl: string;
            if (provider === "chatgpt") {
                providerUrl = `https://chatgpt.com/?hints=search&q=${encodeURIComponent(prompt)}`;
            } else {
                providerUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`;
            }

            window.open(providerUrl, "_blank", "noopener,noreferrer");
            return;
        } catch (err) {
            console.error("Failed to create transcript share link:", err);
        }

        try {
            const transcriptText = formatTranscriptForChatGPT(currentMeeting, transcripts);
            await navigator.clipboard.writeText(transcriptText);
            toast.success("Transcript copied to clipboard", {
                description: `Opening ${provider === "chatgpt" ? "ChatGPT" : "Perplexity"}. Please paste the transcript when prompted.`,
            });
            const q = "I've copied a meeting transcript to my clipboard. Please wait while I paste it, then I'll ask questions about it.";
            let providerUrl: string;
            if (provider === "chatgpt") {
                providerUrl = `https://chatgpt.com/?hints=search&q=${encodeURIComponent(q)}`;
            } else {
                providerUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`;
            }
            setTimeout(() => window.open(providerUrl, "_blank", "noopener,noreferrer"), 100);
        } catch (error) {
            toast.error("Failed to copy transcript", {
                description: "Please try again or copy the transcript manually.",
            });
        }
    }, [currentMeeting, transcripts, formatTranscriptForChatGPT, meetingId, chatgptPrompt]);

    const handleSendToChatGPT = useCallback(() => {
        handleOpenInProvider("chatgpt");
    }, [handleOpenInProvider]);

    const handleChatgptPromptBlur = useCallback(() => {
        const trimmed = editedChatgptPrompt.trim();
        if (trimmed && trimmed !== chatgptPrompt) {
            setChatgptPrompt(trimmed);
            setCookie("vexa-chatgpt-prompt", trimmed);
        }
    }, [editedChatgptPrompt, chatgptPrompt]);

    const isEarlyState =
        currentMeeting?.status === "requested" ||
        currentMeeting?.status === "joining" ||
        currentMeeting?.status === "awaiting_admission";
    const isStoppingState = currentMeeting?.status === "stopping";
    const shouldUseWebSocket =
        currentMeeting?.status === "active" || isEarlyState || isStoppingState;

    const {
        isConnecting: wsConnecting,
        isConnected: wsConnected,
        connectionError: wsError,
        reconnectAttempts,
    } = useLiveTranscripts({
        platform: currentMeeting?.platform ?? "google_meet",
        nativeId: currentMeeting?.platform_specific_id ?? "",
        meetingId: meetingId,
        isActive: shouldUseWebSocket,
        onStatusChange: handleStatusChange,
    });

    useEffect(() => {
        if (meetingId) {
            setForcePostMeetingMode(false);
            fetchMeeting(meetingId);
        }

        return () => {
            clearCurrentMeeting();
            hasLoadedRef.current = false;
        };
    }, [meetingId, fetchMeeting, clearCurrentMeeting]);

    useEffect(() => {
        if (currentMeeting && !hasLoadedRef.current) {
            hasLoadedRef.current = true;
        }
    }, [currentMeeting]);

    const validLangCodes = useMemo(
        () => new Set(WHISPER_LANGUAGE_CODES),
        []
    );
    useEffect(() => {
        if (!currentMeeting) return;
        const fromData = currentMeeting.data?.languages?.[0];
        if (fromData && fromData !== "auto") {
            setCurrentLanguage(fromData);
            return;
        }
        const fromSegment = transcripts.find(
            (t) => t.language && t.language !== "unknown" && validLangCodes.has(t.language)
        )?.language;
        setCurrentLanguage(fromSegment || "auto");
    }, [currentMeeting, transcripts, validLangCodes]);

    const meetingPlatform = currentMeeting?.platform;
    const meetingNativeId = currentMeeting?.platform_specific_id;
    const meetingStatus = currentMeeting?.status;

    useEffect(() => {
        if ((meetingStatus === "stopping" || meetingStatus === "completed") && meetingPlatform && meetingNativeId) {
            fetchTranscripts(meetingPlatform, meetingNativeId);
            fetchChatMessages(meetingPlatform, meetingNativeId);
            return;
        }

        if (!shouldUseWebSocket && meetingPlatform && meetingNativeId) {
            fetchTranscripts(meetingPlatform, meetingNativeId);
            fetchChatMessages(meetingPlatform, meetingNativeId);
        }
    }, [meetingStatus, shouldUseWebSocket, meetingPlatform, meetingNativeId, fetchTranscripts, fetchChatMessages]);

    useEffect(() => {
        if (shouldUseWebSocket && meetingPlatform && meetingNativeId) {
            fetchChatMessages(meetingPlatform, meetingNativeId);
        }
    }, [shouldUseWebSocket, meetingPlatform, meetingNativeId, fetchChatMessages]);

    const handleNotesBlur = useCallback(async () => {
        if (!currentMeeting || isSavingNotes) return;

        const originalNotes = currentMeeting.data?.notes || "";
        const trimmedNotes = editedNotes.trim();

        if (trimmedNotes === originalNotes) {
            setIsEditingNotes(false);
            return;
        }

        setIsSavingNotes(true);
        try {
            await updateMeetingData(currentMeeting.platform, currentMeeting.platform_specific_id, {
                notes: trimmedNotes,
            });
            setIsEditingNotes(false);
        } catch (err) {
            toast.error("Failed to save notes");
        } finally {
            setIsSavingNotes(false);
        }
    }, [currentMeeting, editedNotes, isSavingNotes, updateMeetingData]);

    const handleNotesFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (shouldSetCursorToEnd.current && editedNotes) {
            const textarea = e.currentTarget;
            const length = editedNotes.length;
            setTimeout(() => {
                textarea.setSelectionRange(length, length);
            }, 0);
            shouldSetCursorToEnd.current = false;
        }
    }, [editedNotes]);

    const playbackAbsoluteTime = useMemo((): string | null => {
        if (playbackTime == null || !isPlaybackActive || recordingFragments.length === 0) return null;
        if (recordingFragments.length === 1) {
            const fragStart = new Date(recordingFragments[0].createdAt).getTime();
            return new Date(fragStart + playbackTime * 1000).toISOString();
        }
        let remaining = playbackTime;
        for (let i = 0; i < recordingFragments.length; i++) {
            const fragDur = recordingFragments[i].duration || 0;
            if (remaining <= fragDur || i === recordingFragments.length - 1) {
                const fragStart = new Date(recordingFragments[i].createdAt).getTime();
                return new Date(fragStart + remaining * 1000).toISOString();
            }
            remaining -= fragDur;
        }
        return null;
    }, [playbackTime, isPlaybackActive, recordingFragments]);

    if (error) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <ErrorState
                    error={error}
                    onRetry={() => fetchMeeting(meetingId)}
                />
            </div>
        );
    }

    if (isLoadingMeeting || !currentMeeting) {
        return <div className="p-8">Loading meeting details...</div>;
    }

    const platformConfig = PLATFORM_CONFIG[currentMeeting.platform];
    const statusConfig = getDetailedStatus(currentMeeting.status, currentMeeting.data);

    if (!statusConfig) {
        return <div className="p-8">Loading meeting details...</div>;
    }

    const duration =
        currentMeeting.start_time && currentMeeting.end_time
            ? Math.round(
                (new Date(currentMeeting.end_time).getTime() -
                    new Date(currentMeeting.start_time).getTime()) /
                60000
            )
            : null;
    const isPostMeetingFlow =
        forcePostMeetingMode ||
        currentMeeting.status === "stopping" || currentMeeting.status === "completed";
    const recordingExplicitlyDisabled = currentMeeting.data?.recording_enabled === false;
    const hasRecordingEntries = recordings.length > 0;
    const noAudioRecordingForMeeting =
        recordingExplicitlyDisabled ||
        (currentMeeting.status === "completed" && !hasRecordingEntries);
    const canUseSegmentPlayback = isPostMeetingFlow && !noAudioRecordingForMeeting;
    const recordingTopBar = isPostMeetingFlow ? (
        hasRecordingAudio ? (
            <AudioPlayer
                ref={audioPlayerRef}
                fragments={recordingFragments}
                onTimeUpdate={handlePlaybackTimeUpdate}
                onFragmentChange={handleFragmentChange}
                compact
            />
        ) : noAudioRecordingForMeeting ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border text-sm text-muted-foreground">
                No audio recording for this meeting.
            </div>
        ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording is processing...
            </div>
        )
    ) : null;

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    return (
        <div className="space-y-2 lg:space-y-6 h-[calc(100vh-100px)] flex flex-col">
            {/* Desktop Header */}
            <div className="hidden lg:flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 px-2 text-muted-foreground hover:text-foreground">
                        <Link href="/dashboard/meetings/all">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>

                    {isEditingTitle ? (
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="flex items-center gap-2 flex-1">
                                <Input
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    className="text-xl font-bold h-9"
                                    placeholder="Meeting title..."
                                    autoFocus
                                    disabled={isSavingTitle}
                                    onKeyDown={async (e) => {
                                        if (e.key === "Enter" && editedTitle.trim()) {
                                            setIsSavingTitle(true);
                                            try {
                                                await updateMeetingData(currentMeeting.platform, currentMeeting.platform_specific_id, {
                                                    name: editedTitle.trim(),
                                                });
                                                setIsEditingTitle(false);
                                                toast.success("Title updated");
                                            } catch (err) {
                                                toast.error("Failed to update title");
                                            } finally {
                                                setIsSavingTitle(false);
                                            }
                                        } else if (e.key === "Escape") {
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                />
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-green-600"
                                        disabled={isSavingTitle || !editedTitle.trim()}
                                        onClick={async () => {
                                            if (!editedTitle.trim()) return;
                                            setIsSavingTitle(true);
                                            try {
                                                await updateMeetingData(currentMeeting.platform, currentMeeting.platform_specific_id, {
                                                    name: editedTitle.trim(),
                                                });
                                                setIsEditingTitle(false);
                                                toast.success("Title updated");
                                            } catch (err) {
                                                toast.error("Failed to update title");
                                            } finally {
                                                setIsSavingTitle(false);
                                            }
                                        }}
                                    >
                                        {isSavingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground"
                                        disabled={isSavingTitle}
                                        onClick={() => setIsEditingTitle(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center gap-2 group min-w-0">
                                <h1 className="text-xl font-bold tracking-tight truncate">
                                    {currentMeeting.data?.name || currentMeeting.data?.title || currentMeeting.platform_specific_id}
                                </h1>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    onClick={() => {
                                        setEditedTitle(currentMeeting.data?.name || currentMeeting.data?.title || "");
                                        setIsEditingTitle(true);
                                    }}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <Badge className={cn("shrink-0", statusConfig.bgColor, statusConfig.color)}>
                                {statusConfig.label}
                            </Badge>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {(currentMeeting.status === "active" || currentMeeting.status === "completed") && transcripts.length > 0 && (
                        <div className="flex items-center gap-2">
                            <AIChatPanel
                                meeting={currentMeeting}
                                transcripts={transcripts}
                                trigger={
                                    <Button className="gap-2 h-9">
                                        <Sparkles className="h-4 w-4" />
                                        Ask AI
                                    </Button>
                                }
                            />

                            <div className="flex items-center gap-2">
                                <DropdownMenu>
                                    <div className="flex items-center border rounded-md overflow-hidden bg-background shadow-sm h-9">
                                        <Button
                                            variant="ghost"
                                            className="gap-2 rounded-r-none border-r-0 hover:bg-muted h-full"
                                            onClick={handleSendToChatGPT}
                                            title="Connect AI"
                                        >
                                            <Image
                                                src="/icons/icons8-chatgpt-100.png"
                                                alt="AI"
                                                width={18}
                                                height={18}
                                                className="object-contain invert dark:invert-0"
                                            />
                                            <span>Connect AI</span>
                                        </Button>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="w-9 rounded-l-none border-l hover:bg-muted h-full"
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </div>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleOpenInProvider("chatgpt")}>
                                            <Image src="/icons/icons8-chatgpt-100.png" alt="ChatGPT" width={16} height={16} className="object-contain mr-2 invert dark:invert-0" />
                                            Open in ChatGPT
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleExport("txt")}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            Download .txt
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport("json")}>
                                            <FileJson className="h-4 w-4 mr-2" />
                                            Download .json
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    )}
                    {currentMeeting.status === "active" && (
                        <div className="flex items-center">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 h-9"
                                        disabled={isStoppingBot}
                                    >
                                        {isStoppingBot ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <StopCircle className="h-4 w-4" />
                                        )}
                                        Stop
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Stop Transcription?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will disconnect the bot from the meeting and stop the live transcription. You can still access the transcript after stopping.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleStopBot}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Stop Transcription
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    )}
                </div>
            </div>

            {/* Main content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Transcript or Status Indicator */}
                <div className="lg:col-span-2 order-2 lg:order-1 flex flex-col min-h-0 flex-1">
                    {/* Show bot status for early states */}
                    {(currentMeeting.status === "requested" ||
                        currentMeeting.status === "joining" ||
                        currentMeeting.status === "awaiting_admission") && (
                            <BotStatusIndicator
                                status={currentMeeting.status}
                                platform={currentMeeting.platform}
                                meetingId={currentMeeting.platform_specific_id}
                                createdAt={currentMeeting.created_at}
                                updatedAt={currentMeeting.updated_at}
                                onStopped={() => {
                                    fetchMeeting(meetingId);
                                }}
                            />
                        )}

                    {/* Show failed indicator */}
                    {currentMeeting.status === "failed" && (
                        <BotFailedIndicator
                            status={currentMeeting.status}
                            errorMessage={currentMeeting.data?.error || currentMeeting.data?.failure_reason || currentMeeting.data?.status_message}
                            errorCode={currentMeeting.data?.error_code}
                        />
                    )}

                    {/* Keep transcript visible through stopping -> completed transition */}
                    {(currentMeeting.status === "active" ||
                        currentMeeting.status === "stopping" ||
                        currentMeeting.status === "completed") && (
                            <TranscriptViewer
                                meeting={currentMeeting}
                                segments={transcripts}
                                chatMessages={chatMessages}
                                isLoading={isLoadingTranscripts}
                                isLive={currentMeeting.status === "active"}
                                wsConnecting={wsConnecting}
                                wsConnected={wsConnected}
                                wsError={wsError}
                                wsReconnectAttempts={reconnectAttempts}
                                topBarContent={recordingTopBar}
                                playbackTime={playbackTime}
                                playbackAbsoluteTime={playbackAbsoluteTime}
                                isPlaybackActive={isPlaybackActive}
                                onSegmentClick={canUseSegmentPlayback ? handleSegmentClick : undefined}
                            />
                        )}
                </div>

                {/* Sidebar - sticky on desktop, hidden on mobile */}
                <div className="hidden lg:block order-1 lg:order-2">
                    <div className="lg:sticky lg:top-6 space-y-6">
                        {/* Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Status with description */}
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Status</span>
                                    <div className="text-right">
                                        <span className={cn("font-medium", statusConfig.color)}>
                                            {statusConfig.label}
                                        </span>
                                        {statusConfig.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {statusConfig.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Speakers</span>
                                    <span className="font-medium">
                                        {new Set(transcripts.map((t) => t.speaker)).size}
                                    </span>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Words</span>
                                    <span className="font-medium">
                                        {transcripts.reduce(
                                            (acc, t) => acc + t.text.split(/\s+/).length,
                                            0
                                        )}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Notes
                                        </CardTitle>
                                    </div>
                                    {isSavingNotes && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Saving...
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isEditingNotes ? (
                                    <Textarea
                                        ref={notesTextareaRef}
                                        value={editedNotes}
                                        onChange={(e) => setEditedNotes(e.target.value)}
                                        onFocus={handleNotesFocus}
                                        onBlur={handleNotesBlur}
                                        placeholder="Add notes about this meeting..."
                                        className="min-h-[120px] resize-none"
                                        disabled={isSavingNotes}
                                        autoFocus
                                    />
                                ) : currentMeeting.data?.notes ? (
                                    <p
                                        className="text-sm text-muted-foreground whitespace-pre-wrap cursor-text hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors"
                                        onClick={() => {
                                            setEditedNotes(currentMeeting.data?.notes || "");
                                            shouldSetCursorToEnd.current = true;
                                            setIsEditingNotes(true);
                                        }}
                                    >
                                        {currentMeeting.data.notes}
                                    </p>
                                ) : (
                                    <div
                                        className="text-sm text-muted-foreground italic cursor-text hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors min-h-[120px] flex items-center"
                                        onClick={() => {
                                            setEditedNotes("");
                                            shouldSetCursorToEnd.current = false;
                                            setIsEditingNotes(true);
                                        }}
                                    >
                                        Click here to add notes...
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {(currentMeeting.status === "completed" || currentMeeting.status === "failed") && (
                            <Card className="border-destructive/30">
                                <CardContent className="pt-6">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                className="w-full gap-2"
                                                disabled={isDeletingMeeting}
                                                onClick={() => setDeleteConfirmText("")}
                                            >
                                                {isDeletingMeeting ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                                Delete meeting
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the meeting
                                                    overview, notes, and the full transcript from our servers. Wait a bit if you are still taking notes.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <div className="my-4 space-y-2">
                                                <label className="text-sm font-medium">
                                                    Type <span className="font-bold text-destructive">DELETE</span> to confirm
                                                </label>
                                                <Input
                                                    value={deleteConfirmText}
                                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                                    placeholder="DELETE"
                                                    className="border-destructive/50"
                                                />
                                            </div>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={handleDeleteMeeting}
                                                    disabled={deleteConfirmText !== "DELETE"}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                                                >
                                                    Delete Transcript
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
