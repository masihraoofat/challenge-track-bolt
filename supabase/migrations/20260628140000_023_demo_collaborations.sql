-- Demo collaborations with backdated logs (join codes: TRNC01, READ01, CLN001)
-- Existing app users are auto-joined as members.

INSERT INTO public.users (id, username)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'Alphonse'),
  ('11111111-1111-4111-8111-111111111102', 'Bert'),
  ('11111111-1111-4111-8111-111111111103', 'Carla'),
  ('11111111-1111-4111-8111-111111111104', 'Diane'),
  ('11111111-1111-4111-8111-111111111105', 'Edward')
ON CONFLICT (id) DO NOTHING;

INSERT INTO collaborations (
  id,
  title,
  description,
  creator_id,
  start_date,
  end_date,
  unit_label,
  join_code,
  icon,
  color,
  goal_mode,
  overall_target_value
)
VALUES
  (
    '33333333-3333-4333-8333-333333333301',
    'Trail Run Crew',
    'Continuous group mileage — stack your weekly km with the crew.',
    '11111111-1111-4111-8111-111111111101',
    CURRENT_DATE - 22,
    NULL,
    'km',
    'TRNC01',
    'activity',
    'teal',
    'periodic',
    NULL
  ),
  (
    '33333333-3333-4333-8333-333333333302',
    'Pages Together',
    'Read daily and contribute pages toward our weekly book goal.',
    '11111111-1111-4111-8111-111111111102',
    CURRENT_DATE - 18,
    NULL,
    'pages',
    'READ01',
    'book',
    'purple',
    'periodic',
    NULL
  ),
  (
    '33333333-3333-4333-8333-333333333303',
    'Spring Cleanup Drive',
    'Volunteer hours for the neighborhood — one overall goal for the season.',
    '11111111-1111-4111-8111-111111111103',
    CURRENT_DATE - 25,
    CURRENT_DATE + 35,
    'hr',
    'CLN001',
    'leaf',
    'success',
    'overall',
    200
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO collaboration_goal_periods (collaboration_id, period_type, target_value)
VALUES
  ('33333333-3333-4333-8333-333333333301', 'weekly', 120),
  ('33333333-3333-4333-8333-333333333301', 'monthly', 500),
  ('33333333-3333-4333-8333-333333333302', 'weekly', 400)
ON CONFLICT (collaboration_id, period_type) DO NOTHING;

-- Demo personas + every other registered user
INSERT INTO collaboration_members (collaboration_id, user_id)
SELECT c.id, u.id
FROM collaborations c
CROSS JOIN public.users u
WHERE c.id IN (
  '33333333-3333-4333-8333-333333333301',
  '33333333-3333-4333-8333-333333333302',
  '33333333-3333-4333-8333-333333333303'
)
ON CONFLICT (collaboration_id, user_id) DO NOTHING;

-- Trail Run Crew: ~22 days of km logs (weeks 1–3 complete, week 4 in progress)
INSERT INTO collaboration_logs (collaboration_id, user_id, date_logged, completed, value)
SELECT
  '33333333-3333-4333-8333-333333333301',
  u.user_id,
  (CURRENT_DATE - day_offset)::date,
  true,
  CASE persona
    WHEN 'alphonse' THEN 5.0 + (day_offset % 4) * 0.8
    WHEN 'bert' THEN 3.5 + (day_offset % 3) * 0.5
    WHEN 'carla' THEN 4.0 + (day_offset % 5) * 0.4
    WHEN 'diane' THEN 2.5 + GREATEST(0, day_offset - 5) * 0.3
    WHEN 'edward' THEN 6.5 - LEAST(day_offset, 8) * 0.2
    ELSE 2.0 + (day_offset % 3) * 0.6
  END
FROM generate_series(0, 21) AS day_offset
CROSS JOIN (
  VALUES
    ('11111111-1111-4111-8111-111111111101'::uuid, 'alphonse'),
    ('11111111-1111-4111-8111-111111111102'::uuid, 'bert'),
    ('11111111-1111-4111-8111-111111111103'::uuid, 'carla'),
    ('11111111-1111-4111-8111-111111111104'::uuid, 'diane'),
    ('11111111-1111-4111-8111-111111111105'::uuid, 'edward')
) AS u(user_id, persona)
WHERE CASE persona
  WHEN 'alphonse' THEN true
  WHEN 'bert' THEN day_offset % 3 <> 0
  WHEN 'carla' THEN day_offset % 4 <> 2
  WHEN 'diane' THEN day_offset >= 3
  WHEN 'edward' THEN day_offset <= 17
  ELSE false
END
ON CONFLICT (collaboration_id, user_id, date_logged) DO NOTHING;

-- Real users get lighter trail logs so their bar shows on charts
INSERT INTO collaboration_logs (collaboration_id, user_id, date_logged, completed, value)
SELECT
  '33333333-3333-4333-8333-333333333301',
  u.id,
  (CURRENT_DATE - day_offset)::date,
  true,
  2.5 + (day_offset % 3) * 0.5
FROM generate_series(0, 14) AS day_offset
CROSS JOIN public.users u
WHERE u.id NOT IN (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111104',
  '11111111-1111-4111-8111-111111111105'
)
AND day_offset % 2 = 0
ON CONFLICT (collaboration_id, user_id, date_logged) DO NOTHING;

-- Pages Together: 18 days of reading
INSERT INTO collaboration_logs (collaboration_id, user_id, date_logged, completed, value)
SELECT
  '33333333-3333-4333-8333-333333333302',
  u.user_id,
  (CURRENT_DATE - day_offset)::date,
  true,
  CASE persona
    WHEN 'alphonse' THEN 18 + (day_offset % 4) * 3
    WHEN 'bert' THEN 25 + (day_offset % 5) * 2
    WHEN 'carla' THEN 15 + (day_offset % 3) * 4
    WHEN 'diane' THEN 12 + GREATEST(0, day_offset - 4) * 2
    WHEN 'edward' THEN 30 - LEAST(day_offset, 10)
    ELSE 10 + (day_offset % 4) * 2
  END
FROM generate_series(0, 17) AS day_offset
CROSS JOIN (
  VALUES
    ('11111111-1111-4111-8111-111111111101'::uuid, 'alphonse'),
    ('11111111-1111-4111-8111-111111111102'::uuid, 'bert'),
    ('11111111-1111-4111-8111-111111111103'::uuid, 'carla'),
    ('11111111-1111-4111-8111-111111111104'::uuid, 'diane'),
    ('11111111-1111-4111-8111-111111111105'::uuid, 'edward')
) AS u(user_id, persona)
WHERE CASE persona
  WHEN 'alphonse' THEN day_offset % 2 = 0
  WHEN 'bert' THEN true
  WHEN 'carla' THEN day_offset % 3 <> 1
  WHEN 'diane' THEN day_offset >= 2
  WHEN 'edward' THEN day_offset <= 12
  ELSE false
END
ON CONFLICT (collaboration_id, user_id, date_logged) DO NOTHING;

INSERT INTO collaboration_logs (collaboration_id, user_id, date_logged, completed, value)
SELECT
  '33333333-3333-4333-8333-333333333302',
  u.id,
  (CURRENT_DATE - day_offset)::date,
  true,
  12 + (day_offset % 3) * 2
FROM generate_series(0, 10) AS day_offset
CROSS JOIN public.users u
WHERE u.id NOT IN (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111104',
  '11111111-1111-4111-8111-111111111105'
)
AND day_offset % 2 = 1
ON CONFLICT (collaboration_id, user_id, date_logged) DO NOTHING;

-- Spring Cleanup: volunteer hours over 25 days
INSERT INTO collaboration_logs (collaboration_id, user_id, date_logged, completed, value)
SELECT
  '33333333-3333-4333-8333-333333333303',
  u.user_id,
  (CURRENT_DATE - day_offset)::date,
  true,
  CASE persona
    WHEN 'alphonse' THEN 0.5 + (day_offset % 3) * 0.25
    WHEN 'bert' THEN 1.0 + (day_offset % 4) * 0.2
    WHEN 'carla' THEN 0.75 + (day_offset % 2) * 0.3
    WHEN 'diane' THEN 1.5 - LEAST(day_offset, 5) * 0.1
    WHEN 'edward' THEN 2.0 - LEAST(day_offset, 8) * 0.15
    ELSE 0.5 + (day_offset % 2) * 0.25
  END
FROM generate_series(0, 24) AS day_offset
CROSS JOIN (
  VALUES
    ('11111111-1111-4111-8111-111111111101'::uuid, 'alphonse'),
    ('11111111-1111-4111-8111-111111111102'::uuid, 'bert'),
    ('11111111-1111-4111-8111-111111111103'::uuid, 'carla'),
    ('11111111-1111-4111-8111-111111111104'::uuid, 'diane'),
    ('11111111-1111-4111-8111-111111111105'::uuid, 'edward')
) AS u(user_id, persona)
WHERE CASE persona
  WHEN 'alphonse' THEN day_offset % 2 = 0
  WHEN 'bert' THEN day_offset % 3 <> 0
  WHEN 'carla' THEN true
  WHEN 'diane' THEN day_offset >= 5
  WHEN 'edward' THEN day_offset <= 18
  ELSE false
END
ON CONFLICT (collaboration_id, user_id, date_logged) DO NOTHING;

INSERT INTO collaboration_logs (collaboration_id, user_id, date_logged, completed, value)
SELECT
  '33333333-3333-4333-8333-333333333303',
  u.id,
  (CURRENT_DATE - day_offset)::date,
  true,
  0.75 + (day_offset % 3) * 0.2
FROM generate_series(0, 12) AS day_offset
CROSS JOIN public.users u
WHERE u.id NOT IN (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111104',
  '11111111-1111-4111-8111-111111111105'
)
AND day_offset % 3 = 0
ON CONFLICT (collaboration_id, user_id, date_logged) DO NOTHING;
