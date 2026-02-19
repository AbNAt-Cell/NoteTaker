-- Calendar Connections
-- Stores OAuth tokens for Google Calendar / Outlook integrations
-- Run this in your Supabase SQL Editor

-- Create the calendar_connections table
CREATE TABLE IF NOT EXISTS public.calendar_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'google', -- 'google' or 'outlook'
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    calendar_email TEXT,
    connected_at TIMESTAMPTZ DEFAULT now(),
    last_synced_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, provider)
);

-- Enable Row Level Security
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own connections
CREATE POLICY "Users can view own connections"
    ON public.calendar_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
    ON public.calendar_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
    ON public.calendar_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
    ON public.calendar_connections FOR DELETE
    USING (auth.uid() = user_id);

-- Add google_event_id column to meetings table for calendar sync deduplication
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;
CREATE INDEX IF NOT EXISTS idx_meetings_google_event_id ON public.meetings(google_event_id);
