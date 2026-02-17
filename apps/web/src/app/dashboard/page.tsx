'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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
    const [activeNav, setActiveNav] = useState('meetings');
    const [creatingMeeting, setCreatingMeeting] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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

    useEffect(() => {
        loadMeetings();
    }, [loadMeetings]);

    const handleCreateMeeting = async () => {
        setCreatingMeeting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('meetings')
            .insert({
                user_id: user.id,
                title: 'Untitled Meeting',
                summary: '',
                speakers: [],
                tags: [],
                scheduled_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (!error && data) {
            router.push(`/notes/${data.id}`);
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
                    onClick={handleCreateMeeting}
                    disabled={creatingMeeting}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    {creatingMeeting ? 'Creating...' : 'Start Amebo'}
                </button>

                <nav className={styles.sidebarNav}>
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
                    <button className={styles.referBtn}>
                        <span className={styles.onlineDot} />
                        Refer &amp; earn
                    </button>
                    <div className={styles.planRow}>
                        <span className={styles.planBadge}>Free Plan</span>
                        <button className={styles.upgradeBtn}>Upgrade</button>
                    </div>
                    <button className={styles.signOutBtn} onClick={handleSignOut}>
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={styles.main}>
                {/* Top navigation bar */}
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
                        <div className={styles.emptyIcon}>⚡</div>
                        <h2>No meetings yet</h2>
                        <p>Start your first meeting to capture notes and insights</p>
                        <button className="btn-primary" onClick={handleCreateMeeting}>
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
                                            href={`/notes/${meeting.id}`}
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

                {/* Ask AI FAB */}
                <button className={styles.askAiFab}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    Ask AI
                </button>
            </main>
        </div>
    );
}
