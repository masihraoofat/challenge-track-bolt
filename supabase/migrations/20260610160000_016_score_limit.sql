-- Optional daily limit for cumulative_low competitions.
-- When set, each logged day earns max(0, score_limit - value) points.

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS score_limit numeric;

ALTER TABLE competitions
  DROP CONSTRAINT IF EXISTS competitions_score_limit_check;

ALTER TABLE competitions
  ADD CONSTRAINT competitions_score_limit_check
  CHECK (score_limit IS NULL OR score_limit > 0);

-- Demo screen-time challenge: 2 hr daily limit
UPDATE competitions
SET score_limit = 2
WHERE scoring_mode = 'cumulative_low'
  AND unit_label = 'hr'
  AND score_limit IS NULL;
