-- Unified scoring model: daily streak, cumulative highest, cumulative lowest
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS scoring_mode text NOT NULL DEFAULT 'daily';
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS unit_label text DEFAULT NULL;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;

-- Backfill existing preset competitions
UPDATE competitions SET scoring_mode = 'daily', unit_label = NULL
  WHERE competition_type = 'reading';

UPDATE competitions SET scoring_mode = 'cumulative_high', unit_label = 'km'
  WHERE competition_type = 'running';

UPDATE competitions SET scoring_mode = 'cumulative_low', unit_label = 'hr'
  WHERE competition_type = 'screen_time';
