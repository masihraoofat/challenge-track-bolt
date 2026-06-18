-- Test ended competition for p@gmail.com (ended competition flow)
-- Join code: END001
-- Safe to re-run: deletes prior test data first

DO $$
DECLARE
  v_comp_id uuid := '22222222-2222-4222-8222-222222222299';
  v_p_user uuid := 'cff05a11-b56d-4878-bd09-f3aa811702b1';
  v_alphonse uuid := '11111111-1111-4111-8111-111111111101';
  v_bert uuid := '11111111-1111-4111-8111-111111111102';
  v_carla uuid := '11111111-1111-4111-8111-111111111103';
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
    'Hydration Sprint (Test Ended)',
    CURRENT_DATE - 14,
    CURRENT_DATE - 2,
    v_p_user,
    'daily',
    NULL,
    'Test challenge for the ended-competition results flow. Tap to see top 3!',
    'END001',
    'droplet',
    'teal',
    NULL
  );

  INSERT INTO participants (competition_id, user_id, score, results_viewed_at)
  VALUES
    (v_comp_id, v_alphonse, 12, NULL),
    (v_comp_id, v_bert, 10, NULL),
    (v_comp_id, v_p_user, 8, NULL),
    (v_comp_id, v_carla, 6, NULL);

  -- Alphonse: 12 days (1st place)
  INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
  SELECT v_comp_id, v_alphonse, (CURRENT_DATE - 14 + day_offset)::date, true, NULL
  FROM generate_series(0, 13) AS day_offset;

  -- Bert: 10 days (2nd place)
  INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
  SELECT v_comp_id, v_bert, (CURRENT_DATE - 14 + day_offset)::date, true, NULL
  FROM generate_series(0, 9) AS day_offset;

  -- p@gmail.com: 8 days (3rd place)
  INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
  SELECT v_comp_id, v_p_user, (CURRENT_DATE - 14 + day_offset)::date, true, NULL
  FROM generate_series(0, 7) AS day_offset;

  -- Carla: 6 days (4th place)
  INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
  SELECT v_comp_id, v_carla, (CURRENT_DATE - 14 + day_offset)::date, true, NULL
  FROM generate_series(0, 5) AS day_offset;

  PERFORM finalize_competition_internal(v_comp_id);
END;
$$;
