ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS idea_instructions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS script_instructions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS character_description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_instructions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_instructions TEXT DEFAULT '';
