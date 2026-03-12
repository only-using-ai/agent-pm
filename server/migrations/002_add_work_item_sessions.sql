-- Work item sessions: track when an agent started and finished working on an item.
-- Used to show "how long it took" on kanban cards.
CREATE TABLE IF NOT EXISTS work_item_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  is_cancelled BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS work_item_sessions_work_item_id_idx ON work_item_sessions(work_item_id);
CREATE INDEX IF NOT EXISTS work_item_sessions_end_time_idx ON work_item_sessions(work_item_id, end_time) WHERE end_time IS NOT NULL;
