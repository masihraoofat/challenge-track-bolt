-- join_code generation, score RPC hardening, schema constraints, signup collision fix

-- 1. join_code column + generator
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS join_code text;

CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION set_competition_join_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  IF NEW.join_code IS NOT NULL AND NEW.join_code <> '' THEN
    RETURN NEW;
  END IF;

  LOOP
    new_code := generate_join_code();
    IF NOT EXISTS (SELECT 1 FROM competitions WHERE join_code = new_code) THEN
      NEW.join_code := new_code;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts >= 10 THEN
      RAISE EXCEPTION 'could not generate unique join_code';
    END IF;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS competitions_set_join_code ON competitions;
CREATE TRIGGER competitions_set_join_code
  BEFORE INSERT ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION set_competition_join_code();

-- Backfill existing rows (retry on collision)
DO $$
DECLARE
  r record;
  new_code text;
  attempts int;
  updated boolean;
BEGIN
  FOR r IN SELECT id FROM competitions WHERE join_code IS NULL OR join_code = '' LOOP
    updated := false;
    attempts := 0;
    WHILE NOT updated AND attempts < 20 LOOP
      new_code := generate_join_code();
      BEGIN
        UPDATE competitions SET join_code = new_code WHERE id = r.id;
        updated := true;
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
      END;
    END LOOP;
    IF NOT updated THEN
      RAISE EXCEPTION 'could not backfill join_code for competition %', r.id;
    END IF;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_competitions_join_code ON competitions(join_code);

-- 2. Secure increment_score RPC
CREATE OR REPLACE FUNCTION increment_score(comp_id uuid, uid uuid, amount numeric DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE participants
  SET score = score + amount
  WHERE competition_id = comp_id AND user_id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_score(uuid, uuid, numeric) TO authenticated;

DROP POLICY IF EXISTS "Users can update own participant score" ON participants;

-- 3. Schema hardening
UPDATE competitions
SET scoring_mode = 'cumulative_high'
WHERE competition_type = 'custom' AND scoring_mode = 'daily';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitions_scoring_mode_check'
  ) THEN
    ALTER TABLE competitions
      ADD CONSTRAINT competitions_scoring_mode_check
      CHECK (scoring_mode IN ('daily', 'cumulative_high', 'cumulative_low'));
  END IF;
END;
$$;

-- 4. handle_new_user username collision fix
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
BEGIN
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;

  BEGIN
    INSERT INTO public.users (id, username)
    VALUES (NEW.id, final_username);
  EXCEPTION WHEN unique_violation THEN
    final_username := base_username || '_' || left(NEW.id::text, 8);
    INSERT INTO public.users (id, username)
    VALUES (NEW.id, final_username);
  END;

  RETURN NEW;
END;
$$;
