-- Second test ended competition for p@gmail.com (ended competition flow)
-- Join code: END002
-- Safe to re-run: deletes prior test data first

DO $$
DECLARE
  v_comp_id uuid := '22222222-2222-4222-8222-222222222298';
  v_p_user uuid := 'cff05a11-b56d-4878-bd09-f3aa811702b1';
  v_alphonse uuid := '11111111-1111-4111-8111-111111111101';
  v_bert uuid := '11111111-1111-4111-8111-111111111102';
  v_diane uuid := '11111111-1111-4111-8111-111111111104';
BEGIN
  DELETE FROM daily_logs WHERE competition_id = v_comp_id;
  DELETE FROM participants WHERE competition_id = v_comp_id;
  DELETE FROM competitions WHERE id = v_comp_id;

  INSERT INTO competitions (
    id,
    title,
    start_date,
    end_date,
    creator_id,
    scoring_mode,
    unit_label,
    description,
    join_code,
    icon,
    color,
    score_limit
  )
  VALUES (
    v_comp_id,
    'Step Count Showdown (Test Ended)',
    CURRENT_DATE - 10,
    CURRENT_DATE - 2,
    v_p_user,
    'cumulative_high',
    'km',
    'Test challenge for the ended-competition flow. You placed 2nd — tap to see the podium!',
    'END002',
    'footprints',
    'purple',
    NULL
  );

  INSERT INTO participants (competition_id, user_id, score, results_viewed_at)
  VALUES
    (v_comp_id, v_bert, 42.5, NULL),
    (v_comp_id, v_p_user, 38.0, NULL),
    (v_comp_id, v_alphonse, 31.5, NULL),
    (v_comp_id, v_diane, 24.0, NULL);

  -- Bert: 1st — 42.5 km total
  INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
  SELECT v_comp_id, v_bert, (CURRENT_DATE - 10 + day_offset)::date, true, 4.5 + (day_offset % 3) * 0.5
  FROM generate_series(0, 7) AS day_offset;

  -- p@gmail.com: 2nd — 38 km total
  INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
  SELECT v_comp_id, v_p_user, (CURRENT_DATE - 10 + day_offset)::date, true, 4.0 + (day_offset % 4) * 0.75
  FROM generate_series(0, 7) AS day_offset;

  -- Alphonse: 3rd — 31.5 km total
  INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
  SELECT v_comp_id, v_alphonse, (CURRENT_DATE - 10 + day_offset)::date, true, 3.5 + (day_offset % 2) * 0.5
  FROM generate_series(0, 6) AS day_offset;

  -- Diane: 4th — 24 km total
  INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
  SELECT v_comp_id, v_diane, (CURRENT_DATE - 10 + day_offset)::date, true, 3.0 + (day_offset % 3) * 0.25
  FROM generate_series(0, 6) AS day_offset;

  PERFORM finalize_competition_internal(v_comp_id);
END;
$$;
