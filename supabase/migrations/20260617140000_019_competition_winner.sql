-- Track challenge winners and per-user win counts

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS challenges_won integer NOT NULL DEFAULT 0;

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS winner_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_competitions_winner_id ON competitions(winner_id);

CREATE OR REPLACE FUNCTION finalize_competition_internal(comp_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp competitions%ROWTYPE;
  v_winner_id uuid;
  v_sort_asc boolean;
BEGIN
  SELECT * INTO v_comp FROM competitions WHERE id = comp_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_comp.winner_id IS NOT NULL THEN
    RETURN v_comp.winner_id;
  END IF;

  IF v_comp.end_date >= CURRENT_DATE THEN
    RETURN NULL;
  END IF;

  v_sort_asc := (v_comp.scoring_mode = 'cumulative_low' AND v_comp.score_limit IS NULL);

  WITH participant_scores AS (
    SELECT
      p.user_id,
      p.joined_at,
      COALESCE(p.score, 0)::numeric AS stored_score,
      COALESCE(lc.cnt, 0) AS log_count,
      COALESCE(lc.total, 0) AS log_total
    FROM participants p
    LEFT JOIN (
      SELECT
        dl.user_id,
        COUNT(*) AS cnt,
        SUM(
          CASE
            WHEN v_comp.scoring_mode = 'cumulative_low' AND v_comp.score_limit IS NOT NULL THEN
              GREATEST(0, v_comp.score_limit - COALESCE(dl.value, 0)::numeric)
            WHEN v_comp.scoring_mode = 'daily' THEN 0
            ELSE COALESCE(dl.value, 0)::numeric
          END
        ) AS total
      FROM daily_logs dl
      WHERE dl.competition_id = comp_id AND dl.completed = true
      GROUP BY dl.user_id
    ) lc ON lc.user_id = p.user_id
    WHERE p.competition_id = comp_id AND p.left_at IS NULL
  ),
  ranked AS (
    SELECT
      user_id,
      CASE
        WHEN v_comp.scoring_mode = 'daily' THEN
          CASE WHEN log_count > 0 THEN log_count::numeric ELSE stored_score END
        WHEN log_count > 0 THEN log_total
        ELSE stored_score
      END AS resolved_score,
      (log_count > 0 OR stored_score > 0) AS has_logged,
      joined_at
    FROM participant_scores
  ),
  winner AS (
    SELECT user_id
    FROM ranked
    WHERE has_logged
    ORDER BY
      CASE WHEN v_sort_asc THEN resolved_score ELSE -resolved_score END,
      joined_at ASC
    LIMIT 1
  )
  SELECT user_id INTO v_winner_id FROM winner;

  IF v_winner_id IS NOT NULL THEN
    UPDATE competitions SET winner_id = v_winner_id WHERE id = comp_id;
    UPDATE users SET challenges_won = challenges_won + 1 WHERE id = v_winner_id;
  END IF;

  RETURN v_winner_id;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_competition(comp_id uuid)
RETURNS uuid
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

  RETURN finalize_competition_internal(comp_id);
END;
$$;

GRANT EXECUTE ON FUNCTION finalize_competition(uuid) TO authenticated;

-- Backfill winners for already-ended competitions
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM competitions
    WHERE end_date < CURRENT_DATE AND winner_id IS NULL
  LOOP
    PERFORM finalize_competition_internal(r.id);
  END LOOP;
END;
$$;
