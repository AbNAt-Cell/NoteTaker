'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import RecordingWidget from './RecordingWidget';
import AskAI from './AskAI';
import MicDetector from './MicDetector';
import { transcribeAudio, WhisperResult } from '@/lib/services/whisper';
import styles from './dashboard.module.css';

interface MeetingItem {
    id: string;
    title: string;
    summary: string;
    speakers: string[];
    tags: string[];
    scheduled_at: string;
    duration_minutes: number;
    created_at: string;
}

interface DateGroup {
    label: string;
    meetings: MeetingItem[];
}

export default function DashboardPage() {
    const [meetings, setMeetings] = useState<MeetingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeNav, setActiveNav] = useState('getting_started');
    const [creatingMeeting, setCreatingMeeting] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [showRecorder, setShowRecorder] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionStatus, setTranscriptionStatus] = useState('');
    const [calendarConnected, setCalendarConnected] = useState(false);
    const [calendarEmail, setCalendarEmail] = useState('');
    const [calendarSyncing, setCalendarSyncing] = useState(false);
    const [showPromo, setShowPromo] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    const loadMeetings = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }

        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');

        const { data, error } = await supabase
            .from('meetings')
            .select('id, title, summary, speakers, tags, scheduled_at, duration_minutes, created_at')
            .eq('user_id', user.id)
            .order('scheduled_at', { ascending: false });

        if (!error && data) {
            setMeetings(data);
        }
        setLoading(false);
    }, [supabase, router]);

    // Check calendar connection status
    useEffect(() => {
        const checkCalendar = async () => {
            try {
                const res = await fetch('/api/calendar/status');
                if (res.ok) {
                    const data = await res.json();
                    setCalendarConnected(data.connected);
                    if (data.connection?.calendar_email) {
                        setCalendarEmail(data.connection.calendar_email);
                    }
                }
            } catch (err) {
                console.warn('Calendar status check failed:', err);
            }
        };
        checkCalendar();

        // Handle OAuth callback redirect
        const params = new URLSearchParams(window.location.search);
        if (params.get('calendar') === 'connected') {
            setCalendarConnected(true);
            checkCalendar(); // Refresh to get email
            // Clean URL
            window.history.replaceState({}, '', '/dashboard');
            // Auto-sync after connecting
            fetch('/api/calendar/sync', { method: 'POST' }).catch(() => { });
        } else if (params.get('calendar') === 'error') {
            console.error('Calendar connection error:', params.get('reason'));
            window.history.replaceState({}, '', '/dashboard');
        }
    }, []);

    useEffect(() => {
        loadMeetings();
    }, [loadMeetings]);

    const handleCalendarSync = async () => {
        setCalendarSyncing(true);
        try {
            const res = await fetch('/api/calendar/sync', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                console.log('Calendar sync result:', data);
                // Reload meetings to show synced events
                loadMeetings();
            } else {
                console.error('Calendar sync failed');
            }
        } catch (err) {
            console.error('Calendar sync error:', err);
        }
        setCalendarSyncing(false);
    };

    const handleCalendarDisconnect = async () => {
        try {
            const res = await fetch('/api/calendar/status', { method: 'DELETE' });
            if (res.ok) {
                setCalendarConnected(false);
                setCalendarEmail('');
            }
        } catch (err) {
            console.error('Calendar disconnect error:', err);
        }
    };

    const handleStartRecording = () => {
        setShowRecorder(true);
    };

    const handleRecordingSave = async (data: {
        audioBlob: Blob | null;
        title: string;
        notes: string;
        duration: number;
        transcript: { speaker: string; text: string; start: number; end: number }[];
    }) => {
        setShowRecorder(false);
        setCreatingMeeting(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Create meeting in Supabase
        const { data: meetingData, error } = await supabase
            .from('meetings')
            .insert({
                user_id: user.id,
                title: data.title || 'Untitled Meeting',
                summary: '',
                speakers: [],
                tags: [],
                scheduled_at: new Date().toISOString(),
                duration_minutes: Math.ceil(data.duration / 60),
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error creating meeting:', error);
            alert(`Failed to create meeting: ${error.message} (${error.code})\nDetail: ${error.details}\nHint: ${error.hint}`);
            setCreatingMeeting(false);
            return;
        }

        if (meetingData && data.audioBlob) {
            // Start transcription via OpenAI
            setIsTranscribing(true);

            try {
                setTranscriptionStatus('Preparing audio...');
                const result: WhisperResult = await transcribeAudio(
                    data.audioBlob,
                    (status) => {
                        console.log('Transcription status:', status);
                        setTranscriptionStatus(status);
                    },
                );

                console.log('Transcription result:', { textLength: result.text.length, segments: result.segments.length });

                // Extract unique speakers from diarization
                const speakers = [...new Set(result.segments.map(s => s.speaker))];

                // Generate AI summary
                setTranscriptionStatus('Generating summary...');
                let aiSummary = result.text.slice(0, 500); // fallback
                try {
                    const summaryRes = await fetch('/api/summarize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: result.text,
                            segments: result.segments,
                        }),
                    });
                    if (summaryRes.ok) {
                        const summaryData = await summaryRes.json();
                        aiSummary = summaryData.summary || aiSummary;
                        console.log('AI summary generated:', aiSummary.length, 'chars');
                    } else {
                        console.warn('Summary generation failed, using raw text fallback');
                    }
                } catch (sumErr) {
                    console.warn('Summary generation error:', sumErr);
                }

                // Update meeting with AI summary
                const { error: updateError } = await supabase
                    .from('meetings')
                    .update({
                        summary: aiSummary,
                        speakers,
                        transcript_status: 'completed',
                    })
                    .eq('id', meetingData.id);

                if (updateError) {
                    console.error('Error updating meeting summary:', updateError);
                }

                // Store transcript segments
                const { error: transError } = await supabase
                    .from('transcripts')
                    .insert({
                        meeting_id: meetingData.id,
                        raw_text: result.text,
                        cleaned_text: result.text,
                        summary: aiSummary,
                        action_items: JSON.stringify(
                            result.segments.map(s => ({
                                speaker: s.speaker,
                                text: s.text,
                                start: s.start,
                                end: s.end,
                            })),
                        ),
                    });

                if (transError) {
                    console.error('Error inserting transcript:', transError);
                } else {
                    console.log('Transcription saved successfully');
                }
            } catch (err: any) {
                console.error('Transcription error:', err);
                alert(`Transcription failed: ${err.message || 'Unknown error'}`);
            }
            setIsTranscribing(false);
        }


        // Refresh meetings list and navigate
        if (meetingData) {
            await loadMeetings();
            setActiveNav('meetings');
        }
        setCreatingMeeting(false);
    };

    const handleDeleteMeeting = async (meetingId: string) => {
        if (!confirm('Delete this meeting?')) return;
        await supabase.from('meetings').delete().eq('id', meetingId);
        setMeetings(meetings.filter(m => m.id !== meetingId));
        setOpenMenuId(null);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const filteredMeetings = meetings.filter(meeting =>
        meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.speakers.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Group meetings by date
    const groupMeetingsByDate = (meetings: MeetingItem[]): DateGroup[] => {
        const groups: Record<string, MeetingItem[]> = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        meetings.forEach(meeting => {
            const meetingDate = new Date(meeting.scheduled_at);
            meetingDate.setHours(0, 0, 0, 0);

            let label: string;
            if (meetingDate.getTime() === today.getTime()) {
                label = 'Today';
            } else if (meetingDate.getTime() === yesterday.getTime()) {
                label = 'Yesterday';
            } else {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                label = `${monthNames[meetingDate.getMonth()]} ${meetingDate.getDate()} / ${dayNames[meetingDate.getDay()]}`;
            }

            if (!groups[label]) groups[label] = [];
            groups[label].push(meeting);
        });

        return Object.entries(groups).map(([label, meetings]) => ({ label, meetings }));
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const formatSpeakers = (speakers: string[]) => {
        if (speakers.length === 0) return '';
        if (speakers.length <= 3) return speakers.join(', ');
        return `${speakers.slice(0, 3).join(', ')} and ${speakers.length - 3} unknown speakers`;
    };

    const dateGroups = groupMeetingsByDate(filteredMeetings);

    // Get unique tags from all meetings
    const allTags = [...new Set(meetings.flatMap(m => m.tags))];

    const renderMainContent = () => {
        if (activeNav === 'getting_started') {
            return (
                <div className={styles.gettingStarted}>
                    <div className={styles.pageHeader}>
                        <div className={styles.pageHeaderLeft}>
                            <span>Getting started</span>
                        </div>
                    </div>
                    <div className={styles.gsHero}>
                        <h1 className={styles.gsTitle}>Getting Started with Amebo</h1>
                        <p className={styles.gsSubtitle}>Learn how Amebo works in a few simple steps.</p>

                        <div className={styles.gsTutorialCard}>
                            <div className={styles.gsTutorialInfo}>
                                <h2>See how Amebo works</h2>
                                <p>Amebo runs seamlessly in the background on your device, writing notes while you focus on the conversation. After the meeting, you get structured notes with clear decisions and action items. No bot joins the call, and your data stays safe.</p>
                                <button className={styles.gsWatchBtn}>Watch Tutorial</button>
                            </div>
                            <div className={styles.gsTutorialVideo}>
                                <div className={styles.gsPlayBtn}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className={styles.gsStepsHeader}>
                            <span>Getting Started</span>
                            <span className={styles.gsProgress}>1/4</span>
                        </div>

                        <div className={styles.gsSteps}>
                            <div
                                className={`${styles.gsStep} ${calendarConnected ? styles.gsStepCompleted : ''}`}
                                onClick={() => { if (!calendarConnected) window.location.href = '/api/auth/google'; }}
                                style={{ cursor: calendarConnected ? 'default' : 'pointer' }}
                            >
                                <div className={styles.gsStepCheck}>
                                    {calendarConnected && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>
                                <div className={styles.gsStepInfo}>
                                    <h3>Connect your calendar</h3>
                                    <p>{calendarConnected ? `Connected as ${calendarEmail || 'Google Calendar'}` : 'Sync Google or Outlook so Amebo can join your upcoming meetings.'}</p>
                                </div>
                                {!calendarConnected && (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.gsStepArrow}>
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                )}
                            </div>
                            <div className={`${styles.gsStep} ${styles.gsStepCompleted}`}>
                                <div className={styles.gsStepCheck}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <div className={styles.gsStepInfo}>
                                    <h3>Install the desktop app</h3>
                                    <p>Get Amebo on your computer for one-click meeting recording.</p>
                                </div>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.gsStepArrow}>
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </div>
                            <div className={styles.gsStep}>
                                <div className={styles.gsStepCheck}></div>
                                <div className={styles.gsStepInfo}>
                                    <h3>Create a tag</h3>
                                    <p>Organize your meetings with custom tags for easy filtering.</p>
                                </div>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.gsStepArrow}>
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </div>
                            <div className={styles.gsStep}>
                                <div className={styles.gsStepCheck}></div>
                                <div className={styles.gsStepInfo}>
                                    <h3>Try a test recording</h3>
                                    <p>Start a quick session to see how notes and transcripts work.</p>
                                </div>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.gsStepArrow}>
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeNav === 'tasks') {
            return (
                <div className={styles.tasksView}>
                    <div className={styles.pageHeader}>
                        <div className={styles.pageHeaderLeft}>
                            <span>Tasks</span>
                        </div>
                    </div>
                    <div className={styles.tasksContent}>
                        <div className={styles.tasksEmpty}>
                            <div className={styles.tasksEmptyIcon}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="8" y1="6" x2="21" y2="6" />
                                    <line x1="8" y1="12" x2="21" y2="12" />
                                    <line x1="8" y1="18" x2="21" y2="18" />
                                    <line x1="3" y1="6" x2="3.01" y2="6" />
                                    <line x1="3" y1="12" x2="3.01" y2="12" />
                                    <line x1="3" y1="18" x2="3.01" y2="18" />
                                </svg>
                            </div>
                            <h2 className={styles.tasksEmptyTitle}>No tasks yet</h2>
                            <p className={styles.tasksEmptySubtitle}>Your meeting tasks will appear here</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeNav === 'people') {
            return (
                <div className={styles.tasksView}>
                    <div className={styles.pageHeader}>
                        <div className={styles.pageHeaderLeft}>
                            <span>People</span>
                        </div>
                    </div>
                    <div className={styles.tasksContent}>
                        <div className={styles.tasksEmpty}>
                            <div className={styles.tasksEmptyIcon}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <h2 className={styles.tasksEmptyTitle}>No people yet</h2>
                            <p className={styles.tasksEmptySubtitle}>People you meet with will appear here</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeNav === 'shared') {
            return (
                <div className={styles.tasksView}>
                    <div className={styles.pageHeader}>
                        <div className={styles.pageHeaderLeft}>
                            <span>Shared with me</span>
                        </div>
                    </div>
                    <div className={styles.tasksContent}>
                        <div className={styles.tasksEmpty}>
                            <div className={styles.tasksEmptyIcon}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                    <polyline points="16 6 12 2 8 6" />
                                    <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                            </div>
                            <h2 className={styles.tasksEmptyTitle}>No shared items</h2>
                            <p className={styles.tasksEmptySubtitle}>Meetings shared with you will appear here</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={styles.meetingsView}>
                {/* Page header */}
                <div className={styles.pageHeader}>
                    <div className={styles.pageHeaderLeft}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>Meetings</span>
                    </div>
                    <button className={styles.displayBtn}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        Display
                    </button>
                </div>

                {/* Page title */}
                <h1 className={styles.pageTitle}>Meetings</h1>

                {/* Tags filter bar */}
                <div className={styles.filterBar}>
                    <button className={styles.filterBtn}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                        Tags
                    </button>
                    <div style={{ flex: 1 }} />
                    <button className={styles.filterBtn}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Scroll to
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                </div>

                {/* Meeting list */}
                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner} />
                        <p>Loading your meetings...</p>
                    </div>
                ) : dateGroups.length === 0 ? (
                    <div className={styles.emptyState}>
                        <img src="/logo.svg" alt="Amebo Logo" width={48} height={48} className={styles.emptyIcon} />
                        <h2>No meetings yet</h2>
                        <p>Start your first meeting to capture notes and insights</p>
                        <button className="btn-primary" onClick={handleStartRecording}>
                            Start Your First Meeting
                        </button>
                    </div>
                ) : (
                    <div className={styles.meetingList}>
                        {dateGroups.map(group => (
                            <div key={group.label} className={styles.dateGroup}>
                                <div className={styles.dateLabel}>{group.label}</div>
                                <div className={styles.dateCards}>
                                    {group.meetings.map(meeting => (
                                        <Link
                                            key={meeting.id}
                                            href={`/meetings/${meeting.id}`}
                                            className={styles.meetingCard}
                                        >
                                            <div className={styles.meetingContent}>
                                                <h3 className={styles.meetingTitle}>{meeting.title || 'Untitled Meeting'}</h3>
                                                <span className={styles.meetingTime}>{formatTime(meeting.scheduled_at)}</span>
                                                {meeting.summary && (
                                                    <p className={styles.meetingSummary}>{meeting.summary}</p>
                                                )}
                                                {meeting.speakers.length > 0 && (
                                                    <p className={styles.meetingSpeakers}>{formatSpeakers(meeting.speakers)}</p>
                                                )}
                                            </div>
                                            <div className={styles.meetingActions}>
                                                <button
                                                    className={styles.moreBtn}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === meeting.id ? null : meeting.id);
                                                    }}
                                                >
                                                    ⋯
                                                </button>
                                                {openMenuId === meeting.id && (
                                                    <div className={styles.contextMenu}>
                                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMeeting(meeting.id); }}>
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={styles.dashboard}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.userProfile}>
                        <div className={styles.avatar}>
                            {userName ? userName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className={styles.userName}>{userName || 'User'}</span>
                        <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                </div>

                <button
                    className={styles.startBtn}
                    onClick={handleStartRecording}
                    disabled={creatingMeeting || showRecorder}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    {creatingMeeting ? 'Saving...' : isTranscribing ? 'Transcribing...' : 'Start Amebo'}
                </button>

                <nav className={styles.sidebarNav}>
                    <button
                        className={`${styles.navItem} ${activeNav === 'getting_started' ? styles.navItemActive : ''}`}
                        onClick={() => setActiveNav('getting_started')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 20v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
                            <path d="M5 20v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
                            <path d="M3 10l9-7 9 7" />
                        </svg>
                        Getting started
                        {activeNav !== 'getting_started' && <span className={styles.navProgress}>1/4</span>}
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'meetings' ? styles.navItemActive : ''}`}
                        onClick={() => setActiveNav('meetings')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Meetings
                        {activeNav !== 'meetings' && meetings.length > 0 && <span className={styles.navBadge}>{meetings.length}</span>}
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'tasks' ? styles.navItemActive : ''}`}
                        onClick={() => setActiveNav('tasks')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 11l3 3L22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                        Tasks
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'people' ? styles.navItemActive : ''}`}
                        onClick={() => setActiveNav('people')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        People
                    </button>
                    <button
                        className={`${styles.navItem} ${activeNav === 'shared' ? styles.navItemActive : ''}`}
                        onClick={() => setActiveNav('shared')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        Shared with me
                    </button>
                </nav>

                {/* Tags section */}
                <div className={styles.tagsSection}>
                    <div className={styles.tagsSectionTitle}>Tags</div>
                    {allTags.map(tag => (
                        <div key={tag} className={styles.tagItem}>
                            <span className={styles.tagDot} />
                            {tag}
                        </div>
                    ))}
                    <button className={styles.addTagBtn}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New tag
                    </button>
                </div>

                {/* Sidebar footer */}
                <div className={styles.sidebarFooter}>
                    {showPromo && (
                        <div className={styles.promoCard}>
                            <div className={styles.promoHeader}>
                                <span>{calendarConnected ? '✅ Calendar Connected' : 'Unlock the power of Amebo'}</span>
                                <button className={styles.promoClose} onClick={() => setShowPromo(false)}>×</button>
                            </div>
                            {calendarConnected ? (
                                <>
                                    <p>Connected as {calendarEmail || 'Google Calendar'}</p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            className={styles.promoBtn}
                                            onClick={handleCalendarSync}
                                            disabled={calendarSyncing}
                                            style={{ flex: 1 }}
                                        >
                                            {calendarSyncing ? 'Syncing...' : '🔄 Sync Now'}
                                        </button>
                                        <button
                                            className={styles.promoBtn}
                                            onClick={handleCalendarDisconnect}
                                            style={{ flex: 1, color: '#ef4444' }}
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p>Connect your Google Calendar or Outlook to unlock meeting title sync and improved speaker identification.</p>
                                    <button
                                        className={styles.promoBtn}
                                        onClick={() => window.location.href = '/api/auth/google'}
                                    >
                                        Connect Calendar
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={styles.main}>
                {/* Top navigation bar (common for all views) */}
                <div className={styles.topNav}>
                    <div className={styles.topNavLeft}>
                        <button className={styles.navArrow} title="Back">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                        <button className={styles.navArrow} title="Forward">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </div>
                    <div className={styles.searchWrapper}>
                        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder={`Search ${userName}'s Workspace`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className={styles.helpBtn} title="Help">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </button>
                </div>

                <div className={styles.scrollArea}>
                    {renderMainContent()}
                </div>

                {/* Ask AI Chat Panel */}
                <AskAI meetingContext={meetings.map(m => `Meeting: ${m.title} (${m.scheduled_at || 'undated'})\nSummary: ${m.summary || 'No summary'}\nSpeakers: ${(m.speakers || []).join(', ') || 'Unknown'}`).join('\n\n---\n\n')} />
            </main>

            {/* Mic Activity Detector */}
            <MicDetector
                onStartRecording={() => setShowRecorder(true)}
                isRecording={showRecorder || isTranscribing}
            />

            {/* Recording Widget */}
            {showRecorder && (
                <RecordingWidget
                    onClose={() => setShowRecorder(false)}
                    onSave={handleRecordingSave}
                />
            )}

            {/* Transcription Overlay */}
            {isTranscribing && (
                <div className={styles.transcribingOverlay}>
                    <div className={styles.transcribingCard}>
                        <div className={styles.spinner}></div>
                        <p>Amebo is transcribing your meeting...</p>
                        <p className={styles.transcriptionProgress}>{transcriptionStatus}</p>
                        <p className={styles.transcribingNote}>This may take a minute for longer recordings.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
