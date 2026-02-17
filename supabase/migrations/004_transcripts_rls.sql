-- 004: Add RLS policies for transcripts
-- Run this in the Supabase SQL Editor

ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own transcripts" ON transcripts;
CREATE POLICY "Users can manage own transcripts"
  ON transcripts FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = transcripts.meeting_id
      AND meetings.user_id = auth.uid()
    )
  );
