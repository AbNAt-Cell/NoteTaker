-- Add audio_url to meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS audio_url TEXT;
