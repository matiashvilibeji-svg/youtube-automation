ALTER TABLE scenes ADD COLUMN audio_status text NOT NULL DEFAULT 'pending';
ALTER TABLE scenes ADD COLUMN audio_url text;
