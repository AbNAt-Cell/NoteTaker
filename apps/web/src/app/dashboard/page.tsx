'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './dashboard.module.css';

interface NoteItem {
    id: string;
    title: string;
    folder: string;
    tags: string[];
    updated_at: string;
    content: Record<string, unknown>;
}

export default function DashboardPage() {
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [creatingNote, setCreatingNote] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const loadNotes = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }

        setUserName(user.user_metadata?.full_name || user.email || '');

        const { data, error } = await supabase
            .from('notes')
            .select('id, title, folder, tags, updated_at, content')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (!error && data) {
            setNotes(data);
        }
        setLoading(false);
    }, [supabase, router]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const handleCreateNote = async () => {
        setCreatingNote(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('notes')
            .insert({
                user_id: user.id,
                title: 'Untitled',
                content: {},
                folder: '',
                tags: [],
            })
            .select('id')
            .single();

        if (!error && data) {
            router.push(`/notes/${data.id}`);
        }
        setCreatingNote(false);
    };

    const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Delete this note?')) return;

        await supabase.from('notes').delete().eq('id', noteId);
        setNotes(notes.filter(n => n.id !== noteId));
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getPreviewText = (content: Record<string, unknown>): string => {
        if (!content || !content.content) return 'Empty note';
        try {
            const blocks = content.content as Array<{ content?: Array<{ text?: string }> }>;
            for (const block of blocks) {
                if (block.content) {
                    for (const inline of block.content) {
                        if (inline.text) return inline.text.substring(0, 120);
                    }
                }
            }
        } catch {
            // ignore
        }
        return 'Empty note';
    };

    return (
        <div className={styles.dashboard}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Link href="/" className={styles.logo}>
                        <span>📝</span>
                        <span className="gradient-text">NoteTaker</span>
                    </Link>
                </div>

                <button
                    className={`btn-primary ${styles.newNoteBtn}`}
                    onClick={handleCreateNote}
                    disabled={creatingNote}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {creatingNote ? 'Creating...' : 'New Note'}
                </button>

                <nav className={styles.sidebarNav}>
                    <div className={styles.navItem + ' ' + styles.navItemActive}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        All Notes
                        <span className={styles.navBadge}>{notes.length}</span>
                    </div>
                    <div className={styles.navItem}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        Folders
                    </div>
                    <div className={styles.navItem}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="9" x2="20" y2="9" />
                            <line x1="4" y1="15" x2="20" y2="15" />
                            <line x1="10" y1="3" x2="8" y2="21" />
                            <line x1="16" y1="3" x2="14" y2="21" />
                        </svg>
                        Tags
                    </div>
                </nav>

                <div className={styles.sidebarFooter}>
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                            {userName ? userName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className={styles.userName}>{userName || 'User'}</span>
                    </div>
                    <button className={styles.signOutBtn} onClick={handleSignOut}>
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={styles.main}>
                <div className={styles.topBar}>
                    <h1 className={styles.pageTitle}>All Notes</h1>
                    <div className={styles.searchWrapper}>
                        <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className={`input-field ${styles.searchInput}`}
                            placeholder="Search notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner} />
                        <p>Loading your notes...</p>
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📝</div>
                        <h2>No notes yet</h2>
                        <p>Create your first note and start capturing ideas</p>
                        <button className="btn-primary" onClick={handleCreateNote}>
                            Create Your First Note
                        </button>
                    </div>
                ) : (
                    <div className={styles.notesGrid}>
                        {filteredNotes.map((note, index) => (
                            <Link
                                key={note.id}
                                href={`/notes/${note.id}`}
                                className={`${styles.noteCard} glass`}
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className={styles.noteCardHeader}>
                                    <h3 className={styles.noteTitle}>{note.title || 'Untitled'}</h3>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={(e) => handleDeleteNote(note.id, e)}
                                        title="Delete note"
                                    >
                                        ×
                                    </button>
                                </div>
                                <p className={styles.notePreview}>{getPreviewText(note.content)}</p>
                                <div className={styles.noteFooter}>
                                    <span className={styles.noteDate}>{formatDate(note.updated_at)}</span>
                                    {note.tags.length > 0 && (
                                        <div className={styles.noteTags}>
                                            {note.tags.slice(0, 3).map(tag => (
                                                <span key={tag} className={styles.noteTag}>#{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
