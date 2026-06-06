-- Add competition_type column
ALTER TABLE competitions ADD COLUMN competition_type text NOT NULL DEFAULT 'reading';

-- Add value column to daily_logs for logging km or hours
ALTER TABLE daily_logs ADD COLUMN value numeric DEFAULT NULL;

-- Update increment_score to accept an optional amount
CREATE OR REPLACE FUNCTION increment_score(comp_id uuid, uid uuid, amount integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE participants
  SET score = score + amount
  WHERE competition_id = comp_id AND user_id = uid;
END;
$$;
