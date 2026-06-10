-- Secure competition delete that bypasses child-table RLS for cascades

CREATE OR REPLACE FUNCTION delete_competition(comp_id uuid)
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
    SELECT 1 FROM competitions
    WHERE id = comp_id AND creator_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM competitions WHERE id = comp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_competition(uuid) TO authenticated;
