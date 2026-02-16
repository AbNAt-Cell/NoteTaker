// ============================================================
// NoteTaker — Shared Types
// ============================================================

// ---------- User / Auth ----------
export interface User {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role: 'owner' | 'admin' | 'member';
    created_at: string;
}

export interface AuthSession {
    access_token: string;
    refresh_token: string;
    user: User;
}

// ---------- Organization ----------
export interface Organization {
    id: string;
    name: string;
    owner_id: string;
    subscription_plan: 'free' | 'pro' | 'team' | 'enterprise';
    created_at: string;
}

// ---------- Note ----------
export interface Note {
    id: string;
    user_id: string;
    organization_id?: string;
    title: string;
    content: Record<string, unknown>; // TipTap JSON
    folder?: string;
    tags: string[];
    created_at: string;
    updated_at: string;
}

export interface NoteListItem {
    id: string;
    title: string;
    folder?: string;
    tags: string[];
    updated_at: string;
}

// ---------- Meeting ----------
export interface Meeting {
    id: string;
    organization_id: string;
    meeting_link: string;
    bot_status: 'idle' | 'joining' | 'recording' | 'completed' | 'failed';
    transcript_status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
}

// ---------- Transcript ----------
export interface Transcript {
    id: string;
    meeting_id: string;
    raw_text: string;
    cleaned_text?: string;
    summary?: string;
    action_items: ActionItem[];
    created_at: string;
}

export interface ActionItem {
    text: string;
    assignee?: string;
    completed: boolean;
}

// ---------- File Attachment ----------
export interface FileAttachment {
    id: string;
    note_id: string;
    file_url: string;
    file_type: string;
}

// ---------- Socket.io Events ----------
export interface ServerToClientEvents {
    'note:updated': (payload: { noteId: string; content: Record<string, unknown>; userId: string }) => void;
    'note:saved': (payload: { noteId: string; updatedAt: string }) => void;
    'presence:update': (payload: { noteId: string; users: string[] }) => void;
}

export interface ClientToServerEvents {
    'note:join': (noteId: string) => void;
    'note:leave': (noteId: string) => void;
    'note:update': (payload: { noteId: string; content: Record<string, unknown> }) => void;
    'note:save': (payload: { noteId: string; content: Record<string, unknown>; title: string }) => void;
}
