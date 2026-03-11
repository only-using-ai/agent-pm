-- Add color and icon to projects table (for existing DBs created before these columns existed).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS icon TEXT;
