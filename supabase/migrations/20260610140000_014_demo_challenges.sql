-- Demo challenges for graph preview (join codes: MED001, RUN001, SCR001)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111101',
    'authenticated',
    'authenticated',
    'alphonse@demo.local',
    extensions.crypt('demo123456', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"Alphonse"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111102',
    'authenticated',
    'authenticated',
    'bert@demo.local',
    extensions.crypt('demo123456', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"Bert"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111103',
    'authenticated',
    'authenticated',
    'carla@demo.local',
    extensions.crypt('demo123456', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"Carla"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111104',
    'authenticated',
    'authenticated',
    'diane@demo.local',
    extensions.crypt('demo123456', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"Diane"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111105',
    'authenticated',
    'authenticated',
    'edward@demo.local',
    extensions.crypt('demo123456', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"Edward"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    '11111111-1111-4111-8111-111111111101',
    '11111111-1111-4111-8111-111111111101',
    '{"sub":"11111111-1111-4111-8111-111111111101","email":"alphonse@demo.local"}'::jsonb,
    'email',
    '11111111-1111-4111-8111-111111111101',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    '11111111-1111-4111-8111-111111111102',
    '{"sub":"11111111-1111-4111-8111-111111111102","email":"bert@demo.local"}'::jsonb,
    'email',
    '11111111-1111-4111-8111-111111111102',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    '11111111-1111-4111-8111-111111111103',
    '11111111-1111-4111-8111-111111111103',
    '{"sub":"11111111-1111-4111-8111-111111111103","email":"carla@demo.local"}'::jsonb,
    'email',
    '11111111-1111-4111-8111-111111111103',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    '11111111-1111-4111-8111-111111111104',
    '11111111-1111-4111-8111-111111111104',
    '{"sub":"11111111-1111-4111-8111-111111111104","email":"diane@demo.local"}'::jsonb,
    'email',
    '11111111-1111-4111-8111-111111111104',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    '11111111-1111-4111-8111-111111111105',
    '11111111-1111-4111-8111-111111111105',
    '{"sub":"11111111-1111-4111-8111-111111111105","email":"edward@demo.local"}'::jsonb,
    'email',
    '11111111-1111-4111-8111-111111111105',
    NOW(),
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'Alphonse'),
  ('11111111-1111-4111-8111-111111111102', 'Bert'),
  ('11111111-1111-4111-8111-111111111103', 'Carla'),
  ('11111111-1111-4111-8111-111111111104', 'Diane'),
  ('11111111-1111-4111-8111-111111111105', 'Edward')
ON CONFLICT (id) DO NOTHING;

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
  color
)
VALUES
  (
    '22222222-2222-4222-8222-222222222201',
    'Morning Meditation',
    CURRENT_DATE - 27,
    CURRENT_DATE + 3,
    '11111111-1111-4111-8111-111111111101',
    'daily',
    NULL,
    'Daily yes/no check-in — most days logged wins.',
    'MED001',
    'moon',
    'purple'
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    'Summer Kilometers',
    CURRENT_DATE - 20,
    CURRENT_DATE + 7,
    '11111111-1111-4111-8111-111111111101',
    'cumulative_high',
    'km',
    'Log your daily distance — highest total wins.',
    'RUN001',
    'activity',
    'teal'
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    'Screen Time Reset',
    CURRENT_DATE - 13,
    CURRENT_DATE + 7,
    '11111111-1111-4111-8111-111111111101',
    'cumulative_low',
    'hr',
    'Track daily screen time — lowest total wins.',
    'SCR001',
    'smartphone',
    'blue'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO participants (competition_id, user_id, score)
SELECT c.id, u.id, 0
FROM competitions c
CROSS JOIN public.users u
WHERE c.id IN (
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222203'
)
AND u.id IN (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111104',
  '11111111-1111-4111-8111-111111111105'
)
ON CONFLICT (competition_id, user_id) DO NOTHING;

INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
SELECT
  '22222222-2222-4222-8222-222222222201',
  u.user_id,
  (CURRENT_DATE - day_offset)::date,
  true,
  NULL
FROM generate_series(0, 27) AS day_offset
CROSS JOIN (
  VALUES
    ('11111111-1111-4111-8111-111111111101'::uuid, 'alphonse'),
    ('11111111-1111-4111-8111-111111111102'::uuid, 'bert'),
    ('11111111-1111-4111-8111-111111111103'::uuid, 'carla'),
    ('11111111-1111-4111-8111-111111111104'::uuid, 'diane'),
    ('11111111-1111-4111-8111-111111111105'::uuid, 'edward')
) AS u(user_id, persona)
WHERE CASE persona
  WHEN 'alphonse' THEN day_offset NOT IN (22, 12)
  WHEN 'bert' THEN day_offset % 3 <> 0
  WHEN 'carla' THEN day_offset % 5 <> 4
  WHEN 'diane' THEN day_offset >= 10 OR day_offset % 9 = 0
  WHEN 'edward' THEN day_offset <= 16 AND (day_offset % 2 = 0 OR day_offset % 5 = 0)
  ELSE false
END
ON CONFLICT (competition_id, user_id, date_logged) DO NOTHING;

INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
SELECT
  '22222222-2222-4222-8222-222222222202',
  u.user_id,
  (CURRENT_DATE - day_offset)::date,
  true,
  CASE persona
    WHEN 'alphonse' THEN 4.5 + (day_offset % 4) * 0.75
    WHEN 'bert' THEN 2.0 + (day_offset % 5) * 0.6
    WHEN 'carla' THEN 3.0 + (day_offset % 3) * 0.5
    WHEN 'diane' THEN 2.5 + GREATEST(0, day_offset - 8) * 0.35
    WHEN 'edward' THEN 6.0 - LEAST(day_offset, 10) * 0.25
    ELSE 0
  END
FROM generate_series(0, 20) AS day_offset
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
  WHEN 'carla' THEN day_offset % 4 <> 3
  WHEN 'diane' THEN day_offset >= 6
  WHEN 'edward' THEN day_offset <= 14
  ELSE false
END
ON CONFLICT (competition_id, user_id, date_logged) DO NOTHING;

INSERT INTO daily_logs (competition_id, user_id, date_logged, completed, value)
SELECT
  '22222222-2222-4222-8222-222222222203',
  u.user_id,
  (CURRENT_DATE - day_offset)::date,
  true,
  CASE persona
    WHEN 'alphonse' THEN 1.0 + (day_offset % 3) * 0.25
    WHEN 'bert' THEN 2.0 + (day_offset % 4) * 0.5
    WHEN 'carla' THEN 1.5 + (day_offset % 5) * 0.2
    WHEN 'diane' THEN 3.5 - LEAST(day_offset, 9) * 0.25
    WHEN 'edward' THEN 3.0 - LEAST(day_offset, 8) * 0.2
    ELSE 0
  END
FROM generate_series(0, 13) AS day_offset
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
  WHEN 'bert' THEN day_offset % 2 = 0
  WHEN 'carla' THEN true
  WHEN 'diane' THEN day_offset >= 2
  WHEN 'edward' THEN day_offset <= 11
  ELSE false
END
ON CONFLICT (competition_id, user_id, date_logged) DO NOTHING;

UPDATE participants p
SET score = stats.total
FROM (
  SELECT
    dl.competition_id,
    dl.user_id,
    CASE c.scoring_mode
      WHEN 'daily' THEN COUNT(*)::numeric
      ELSE COALESCE(SUM(dl.value), 0)
    END AS total
  FROM daily_logs dl
  JOIN competitions c ON c.id = dl.competition_id
  WHERE dl.completed = true
    AND dl.competition_id IN (
      '22222222-2222-4222-8222-222222222201',
      '22222222-2222-4222-8222-222222222202',
      '22222222-2222-4222-8222-222222222203'
    )
  GROUP BY dl.competition_id, dl.user_id, c.scoring_mode
) AS stats
WHERE p.competition_id = stats.competition_id
  AND p.user_id = stats.user_id;
