-- 003: Add scratchpad_notes to meetings
-- Run this in the Supabase SQL Editor

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS scratchpad_notes TEXT DEFAULT '';
