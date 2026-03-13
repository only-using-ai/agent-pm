-- Add completed_at to projects (distinct from archived: complete = done, archive = hidden).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
