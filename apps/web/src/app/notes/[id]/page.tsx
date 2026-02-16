'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import styles from './editor.module.css';

interface NotePageProps {
    params: Promise<{ id: string }>;
}

export default function NotePage({ params }: NotePageProps) {
    const { id: noteId } = use(params);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder: 'Start writing your note...',
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Underline,
        ],
        editorProps: {
            attributes: {
                class: styles.proseMirror,
            },
        },
        onUpdate: () => {
            // Auto-save is handled by the debounced effect below
        },
    });

    // Load note data
    useEffect(() => {
        const loadNote = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('id', noteId)
                .eq('user_id', user.id)
                .single();

            if (error || !data) {
                router.push('/dashboard');
                return;
            }

            setTitle(data.title || 'Untitled');
            if (editor && data.content && Object.keys(data.content).length > 0) {
                editor.commands.setContent(data.content);
            }
            setLoading(false);
        };

        if (editor) {
            loadNote();
        }
    }, [editor, noteId, supabase, router]);

    // Auto-save with debounce
    const saveNote = useCallback(async () => {
        if (!editor) return;
        setSaving(true);

        const content = editor.getJSON();
        await supabase
            .from('notes')
            .update({ title, content })
            .eq('id', noteId);

        setLastSaved(new Date().toLocaleTimeString());
        setSaving(false);
    }, [editor, title, noteId, supabase]);

    // Debounced auto-save on content change
    useEffect(() => {
        if (!editor || loading) return;

        const handler = () => {
            const timeout = setTimeout(saveNote, 1500);
            return () => clearTimeout(timeout);
        };

        editor.on('update', handler);
        return () => {
            editor.off('update', handler);
        };
    }, [editor, saveNote, loading]);

    // Save on title change with debounce
    useEffect(() => {
        if (loading) return;
        const timeout = setTimeout(saveNote, 1500);
        return () => clearTimeout(timeout);
    }, [title, saveNote, loading]);

    if (!editor) return null;

    return (
        <div className={styles.editorPage}>
            {/* Top bar */}
            <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                    <Link href="/dashboard" className={styles.backBtn}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Dashboard
                    </Link>
                </div>
                <div className={styles.topBarRight}>
                    <span className={styles.saveStatus}>
                        {saving ? 'Saving...' : lastSaved ? `Saved at ${lastSaved}` : ''}
                    </span>
                    <button className="btn-primary" onClick={saveNote} style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
                        Save
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.toolbarGroup}>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('heading', { level: 1 }) ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        title="Heading 1"
                    >
                        H1
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('heading', { level: 2 }) ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        title="Heading 2"
                    >
                        H2
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('heading', { level: 3 }) ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        title="Heading 3"
                    >
                        H3
                    </button>
                </div>
                <div className={styles.toolbarDivider} />
                <div className={styles.toolbarGroup}>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('bold') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        title="Bold"
                    >
                        <strong>B</strong>
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('italic') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        title="Italic"
                    >
                        <em>I</em>
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('underline') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        title="Underline"
                    >
                        <u>U</u>
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('strike') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        title="Strikethrough"
                    >
                        <s>S</s>
                    </button>
                </div>
                <div className={styles.toolbarDivider} />
                <div className={styles.toolbarGroup}>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('bulletList') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="Bullet List"
                    >
                        •≡
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('orderedList') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        title="Ordered List"
                    >
                        1.
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('taskList') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        title="Task List"
                    >
                        ☑
                    </button>
                </div>
                <div className={styles.toolbarDivider} />
                <div className={styles.toolbarGroup}>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('blockquote') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        title="Blockquote"
                    >
                        "
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('code') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        title="Inline Code"
                    >
                        {'</>'}
                    </button>
                    <button
                        className={`${styles.toolBtn} ${editor.isActive('codeBlock') ? styles.toolBtnActive : ''}`}
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        title="Code Block"
                    >
                        {'{ }'}
                    </button>
                </div>
                <div className={styles.toolbarDivider} />
                <div className={styles.toolbarGroup}>
                    <button
                        className={styles.toolBtn}
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="Horizontal Rule"
                    >
                        ―
                    </button>
                    <button
                        className={styles.toolBtn}
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Undo"
                    >
                        ↶
                    </button>
                    <button
                        className={styles.toolBtn}
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Redo"
                    >
                        ↷
                    </button>
                </div>
            </div>

            {/* Editor Content */}
            <div className={styles.editorContainer}>
                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner} />
                        <p>Loading note...</p>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            className={styles.titleInput}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Note title"
                        />
                        <EditorContent editor={editor} className={styles.editorContent} />
                    </>
                )}
            </div>
        </div>
    );
}
