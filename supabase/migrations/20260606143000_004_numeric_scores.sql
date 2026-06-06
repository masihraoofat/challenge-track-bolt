/*
  # Numeric scores for fractional km / hours

  1. Schema changes
    - `participants.score` is widened from `integer` to `numeric` so we can
      accumulate fractional values (e.g. 5.7 km, 2.5 hrs of screen time)
      without losing precision.

  2. Function changes
    - `increment_score(comp_id uuid, uid uuid, amount numeric DEFAULT 1)`
      replaces the previous integer-amount version. The previous integer
      overload is dropped explicitly so the RPC dispatches unambiguously.
*/

ALTER TABLE participants
  ALTER COLUMN score TYPE numeric USING score::numeric;

ALTER TABLE participants
  ALTER COLUMN score SET DEFAULT 0;

DROP FUNCTION IF EXISTS increment_score(uuid, uuid, integer);
DROP FUNCTION IF EXISTS increment_score(uuid, uuid);

CREATE OR REPLACE FUNCTION increment_score(comp_id uuid, uid uuid, amount numeric DEFAULT 1)
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
