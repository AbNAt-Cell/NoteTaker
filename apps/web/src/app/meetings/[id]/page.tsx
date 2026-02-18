'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './meeting.module.css';

type TabId = 'summary' | 'transcript' | 'tasks' | 'scratchpad';

interface TranscriptSegment {
    speaker: string;
    text: string;
    start: number;
    end: number;
}

interface TaskItem {
    id: string;
    text: string;
    done: boolean;
}

interface MeetingPageProps {
    params: Promise<{ id: string }>;
}

export default function MeetingPage({ params }: MeetingPageProps) {
    const { id: meetingId } = use(params);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('summary');
    const [title, setTitle] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(0);
    const [speakers, setSpeakers] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [summary, setSummary] = useState('');
    const [segments, setSegments] = useState<TranscriptSegment[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [scratchpad, setScratchpad] = useState('');
    const [saving, setSaving] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [showTagInput, setShowTagInput] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');

    const router = useRouter();
    const supabase = createClient();

    // ── Load meeting data ─────────────────────────────────
    useEffect(() => {
        const loadMeeting = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            console.log('Fetching meeting data for id:', meetingId);
            const { data: meeting, error } = await supabase
                .from('meetings')
                .select('*')
                .eq('id', meetingId)
                .eq('user_id', user.id)
                .single();

            if (error || !meeting) {
                console.error('Error fetching meeting:', error);
                router.push('/dashboard');
                return;
            }

            console.log('Meeting data fetched:', meeting);
            setTitle(meeting.title || 'Untitled Meeting');
            setScheduledAt(meeting.scheduled_at || '');
            setDurationMinutes(meeting.duration_minutes || 0);
            setSpeakers(meeting.speakers || []);
            setTags(meeting.tags || []);
            setScratchpad(meeting.scratchpad_notes || '');

            // Load transcript
            console.log('Fetching transcript for meeting_id:', meetingId);
            const { data: transcript, error: transError } = await supabase
                .from('transcripts')
                .select('*')
                .eq('meeting_id', meetingId)
                .single();

            if (transError) {
                console.warn('Transcript fetch error (might not exist yet):', transError);
            }

            if (transcript) {
                console.log('Transcript data fetched:', transcript);
                setSummary(transcript.summary || transcript.cleaned_text || transcript.raw_text || '');

                // Parse diarized segments from action_items JSONB
                const segs = transcript.action_items;
                if (Array.isArray(segs)) {
                    setSegments(segs as TranscriptSegment[]);
                } else if (typeof segs === 'string') {
                    try {
                        const parsed = JSON.parse(segs);
                        if (Array.isArray(parsed)) setSegments(parsed);
                    } catch { /* ignore */ }
                }
            }

            setLoading(false);
        };

        loadMeeting();
    }, [meetingId, supabase, router]);

    // ── Auto-save scratchpad ──────────────────────────────
    useEffect(() => {
        if (loading) return;
        const timeout = setTimeout(async () => {
            await supabase
                .from('meetings')
                .update({ scratchpad_notes: scratchpad })
                .eq('id', meetingId);
        }, 1500);
        return () => clearTimeout(timeout);
    }, [scratchpad, loading, meetingId, supabase]);

    // ── Save title ────────────────────────────────────────
    const saveTitle = useCallback(async (newTitle: string) => {
        setTitle(newTitle);
        setSaving(true);
        await supabase
            .from('meetings')
            .update({ title: newTitle })
            .eq('id', meetingId);
        setSaving(false);
    }, [meetingId, supabase]);

    useEffect(() => {
        if (loading || !title) return;
        const timeout = setTimeout(() => {
            supabase.from('meetings').update({ title }).eq('id', meetingId);
        }, 1500);
        return () => clearTimeout(timeout);
    }, [title, loading, meetingId, supabase]);

    // ── Add tag ───────────────────────────────────────────
    const addTag = async () => {
        if (!newTag.trim()) return;
        const updated = [...tags, newTag.trim()];
        setTags(updated);
        setNewTag('');
        setShowTagInput(false);
        await supabase.from('meetings').update({ tags: updated }).eq('id', meetingId);
    };

    const removeTag = async (index: number) => {
        const updated = tags.filter((_, i) => i !== index);
        setTags(updated);
        await supabase.from('meetings').update({ tags: updated }).eq('id', meetingId);
    };

    // ── Tasks ─────────────────────────────────────────────
    const addTask = () => {
        if (!newTaskText.trim()) return;
        setTasks([...tasks, { id: Date.now().toString(), text: newTaskText.trim(), done: false }]);
        setNewTaskText('');
    };

    const toggleTask = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    const deleteTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    // ── Format helpers ────────────────────────────────────
    const formatTime = (isoStr: string) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();

        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const endTime = new Date(d.getTime() + durationMinutes * 60000)
            .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        return `${isToday ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time} - ${endTime}`;
    };

    const formatTimestamp = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // ── Loading ───────────────────────────────────────────
    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <p>Loading meeting...</p>
                </div>
            </div>
        );
    }

    // ── Tab content renderers ─────────────────────────────
    const renderSummary = () => (
        <div className={styles.tabContent}>
            <div className={styles.templateBar}>
                <button className={styles.templateBtn}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                    Template
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                <button className={styles.copyBtn}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    Copy summary
                </button>
            </div>

            {summary ? (
                <div className={styles.summaryContent}>
                    <h3>Executive Summary</h3>
                    <div className={styles.summaryText}>
                        {summary.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={styles.emptyTab}>
                    <p>No summary available yet. Record a meeting to generate a summary.</p>
                </div>
            )}
        </div>
    );

    const renderTranscript = () => (
        <div className={styles.tabContent}>
            <button className={styles.copyBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                Copy transcript
            </button>

            {segments.length > 0 ? (
                <div className={styles.transcriptList}>
                    {segments.map((seg, i) => (
                        <div key={i} className={styles.transcriptBlock}>
                            <h4 className={styles.speakerName}>{seg.speaker}</h4>
                            <span className={styles.timestamp}>
                                {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                            </span>
                            <p className={styles.transcriptText}>{seg.text}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.emptyTab}>
                    <p>No transcript available yet. Record a meeting to generate a transcript.</p>
                </div>
            )}
        </div>
    );

    const renderTasks = () => (
        <div className={styles.tabContent}>
            <div className={styles.tasksHeader}>
                <h3>Tasks</h3>
                <div className={styles.tasksActions}>
                    <button className={styles.addTaskBtn} onClick={() => document.getElementById('newTaskInput')?.focus()}>
                        + Add Task
                    </button>
                </div>
            </div>

            <div className={styles.newTaskRow}>
                <input
                    id="newTaskInput"
                    className={styles.newTaskInput}
                    value={newTaskText}
                    onChange={e => setNewTaskText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="Type a task and press Enter..."
                />
            </div>

            {tasks.length > 0 ? (
                <div className={styles.tasksList}>
                    {tasks.map(task => (
                        <div key={task.id} className={`${styles.taskItem} ${task.done ? styles.taskDone : ''}`}>
                            <input
                                type="checkbox"
                                checked={task.done}
                                onChange={() => toggleTask(task.id)}
                                className={styles.taskCheckbox}
                            />
                            <span className={styles.taskText}>{task.text}</span>
                            <button className={styles.taskDelete} onClick={() => deleteTask(task.id)}>✕</button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.emptyTab}>
                    <div className={styles.emptyIcon}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                    </div>
                    <h4>No tasks</h4>
                    <p>You can add tasks manually.</p>
                </div>
            )}
        </div>
    );

    const renderScratchpad = () => (
        <div className={styles.tabContent}>
            <textarea
                className={styles.scratchpadArea}
                value={scratchpad}
                onChange={e => setScratchpad(e.target.value)}
                placeholder="Write private notes..."
            />
        </div>
    );

    const tabContent: Record<TabId, () => React.ReactNode> = {
        summary: renderSummary,
        transcript: renderTranscript,
        tasks: renderTasks,
        scratchpad: renderScratchpad,
    };

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.topBar}>
                <div className={styles.breadcrumb}>
                    <Link href="/dashboard" className={styles.breadcrumbLink}>Meetings</Link>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    <span className={styles.breadcrumbCurrent}>{title}</span>
                </div>
                <div className={styles.topActions}>
                    <button className={styles.shareBtn}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                        Share
                    </button>
                    <button className={styles.linkBtn}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    </button>
                    <button className={styles.moreBtn}>⋯</button>
                </div>
            </div>

            {/* Main content */}
            <div className={styles.content}>
                {/* Title */}
                <input
                    className={styles.meetingTitle}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={e => saveTitle(e.target.value)}
                />

                {/* Metadata */}
                <div className={styles.metadata}>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Time</span>
                        <span className={styles.metaValue}>{formatTime(scheduledAt)}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Speakers</span>
                        <span className={styles.metaValue}>
                            {speakers.length > 0 ? (
                                speakers.map((s, i) => <span key={i} className={styles.speakerChip}>{s}</span>)
                            ) : (
                                <button className={styles.identifyBtn}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                                    Identify speakers
                                </button>
                            )}
                        </span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Tags</span>
                        <span className={styles.metaValue}>
                            {tags.map((tag, i) => (
                                <span key={i} className={styles.tagChip}>
                                    {tag}
                                    <button className={styles.tagRemove} onClick={() => removeTag(i)}>✕</button>
                                </span>
                            ))}
                            {showTagInput ? (
                                <input
                                    className={styles.tagInput}
                                    value={newTag}
                                    onChange={e => setNewTag(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addTag()}
                                    onBlur={addTag}
                                    placeholder="Tag name..."
                                    autoFocus
                                />
                            ) : (
                                <button className={styles.addTagBtn} onClick={() => setShowTagInput(true)}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                    Add tag
                                </button>
                            )}
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    {(['summary', 'transcript', 'tasks', 'scratchpad'] as TabId[]).map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                {tabContent[activeTab]()}
            </div>

            {saving && <div className={styles.savingIndicator}>Saving...</div>}
        </div>
    );
}
