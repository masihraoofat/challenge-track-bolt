-- Custom icon and color for personal goals.
ALTER TABLE goals ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'target';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'primary';

UPDATE goals
SET
  icon = CASE goal_type
    WHEN 'streak' THEN 'flame'
    WHEN 'amount' THEN 'target'
    WHEN 'time' THEN 'clock'
    WHEN 'checkin' THEN 'activity'
    ELSE 'target'
  END,
  color = CASE goal_type
    WHEN 'amount' THEN 'blue'
    WHEN 'time' THEN 'teal'
    WHEN 'checkin' THEN 'success'
    ELSE 'primary'
  END
WHERE icon = 'target' AND color = 'primary';
