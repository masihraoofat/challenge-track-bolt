-- Track when a participant has viewed competition results

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS results_viewed_at timestamptz DEFAULT NULL;

CREATE OR REPLACE FUNCTION mark_competition_results_viewed(comp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE participants
  SET results_viewed_at = now()
  WHERE competition_id = comp_id
    AND user_id = auth.uid()
    AND left_at IS NULL
    AND results_viewed_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_competition_results_viewed(uuid) TO authenticated;

-- Backfill: existing ended competitions skip the gold-trim reveal flow
UPDATE participants p
SET results_viewed_at = now()
FROM competitions c
WHERE p.competition_id = c.id
  AND c.end_date < CURRENT_DATE
  AND p.left_at IS NULL
  AND p.results_viewed_at IS NULL;
