-- Soft leave: participants can leave without losing scores/logs for rejoin

ALTER TABLE participants ADD COLUMN IF NOT EXISTS left_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_active
  ON participants (competition_id, user_id)
  WHERE left_at IS NULL;

CREATE OR REPLACE FUNCTION join_competition(comp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM competitions WHERE id = comp_id) THEN
    RAISE EXCEPTION 'competition not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM competitions
    WHERE id = comp_id AND end_date < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'competition has ended';
  END IF;

  IF EXISTS (
    SELECT 1 FROM participants
    WHERE competition_id = comp_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already joined';
  END IF;

  IF EXISTS (
    SELECT 1 FROM participants
    WHERE competition_id = comp_id AND user_id = auth.uid()
  ) THEN
    UPDATE participants
    SET left_at = NULL
    WHERE competition_id = comp_id AND user_id = auth.uid();
    RETURN;
  END IF;

  INSERT INTO participants (competition_id, user_id, score)
  VALUES (comp_id, auth.uid(), 0);
END;
$$;

CREATE OR REPLACE FUNCTION leave_competition(comp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM participants
    WHERE competition_id = comp_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  UPDATE participants
  SET left_at = now()
  WHERE competition_id = comp_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION join_competition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_competition(uuid) TO authenticated;
