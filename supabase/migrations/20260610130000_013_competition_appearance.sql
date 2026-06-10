-- Custom icon and color for each challenge.
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'trophy';
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'primary';
