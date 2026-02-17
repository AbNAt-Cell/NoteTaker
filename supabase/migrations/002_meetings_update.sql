-- ============================================================
-- Amebo — Meetings Table Update
-- Adds fields needed for the meeting dashboard
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add user-facing fields to meetings
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Meeting',
  ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS speakers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Make columns optional for simple meeting creation
ALTER TABLE meetings ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE meetings ALTER COLUMN meeting_link DROP NOT NULL;
ALTER TABLE meetings ALTER COLUMN meeting_link SET DEFAULT '';

-- Add RLS policy for user's own meetings
CREATE POLICY "Users can CRUD own meetings"
  ON meetings FOR ALL USING (auth.uid() = user_id);

-- Auto-update trigger for meetings
CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add updated_at column to meetings
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
