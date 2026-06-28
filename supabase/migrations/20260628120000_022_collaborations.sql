/*
  # Collaborations

  Cooperative groups with optional periodic or overall goals.
*/

CREATE TABLE collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  unit_label text,
  icon text NOT NULL DEFAULT 'users',
  color text NOT NULL DEFAULT 'teal',
  join_code text,
  goal_mode text NOT NULL DEFAULT 'periodic'
    CHECK (goal_mode IN ('overall', 'periodic')),
  overall_target_value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX idx_collaborations_join_code ON collaborations(join_code);

CREATE TABLE collaboration_goal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'yearly')),
  target_value numeric,
  UNIQUE (collaboration_id, period_type)
);

CREATE INDEX idx_collaboration_goal_periods_collab
  ON collaboration_goal_periods (collaboration_id);

CREATE TABLE collaboration_members (
  collaboration_id uuid NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (collaboration_id, user_id)
);

CREATE INDEX idx_collaboration_members_active
  ON collaboration_members (collaboration_id, user_id)
  WHERE left_at IS NULL;

CREATE TABLE collaboration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_logged date NOT NULL,
  completed boolean NOT NULL DEFAULT true,
  value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collaboration_id, user_id, date_logged)
);

CREATE INDEX idx_collaboration_logs_collab_date
  ON collaboration_logs (collaboration_id, date_logged);

CREATE TABLE collaboration_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collaboration_id, invitee_id)
);

CREATE INDEX idx_collaboration_invitations_invitee_pending
  ON collaboration_invitations (invitee_id)
  WHERE status = 'pending';

-- Join code generation (unique across competitions and collaborations)
CREATE OR REPLACE FUNCTION set_collaboration_join_code()
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
    IF NOT EXISTS (SELECT 1 FROM competitions WHERE join_code = new_code)
       AND NOT EXISTS (SELECT 1 FROM collaborations WHERE join_code = new_code) THEN
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

CREATE TRIGGER collaborations_set_join_code
  BEFORE INSERT ON collaborations
  FOR EACH ROW
  EXECUTE FUNCTION set_collaboration_join_code();

-- RLS
ALTER TABLE collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_goal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read collaborations"
  ON collaborations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create collaborations"
  ON collaborations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update collaborations"
  ON collaborations FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Authenticated users can read collaboration goal periods"
  ON collaboration_goal_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Creators can insert collaboration goal periods"
  ON collaboration_goal_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collaborations
      WHERE id = collaboration_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can read collaboration members"
  ON collaboration_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join collaborations"
  ON collaboration_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read collaboration logs"
  ON collaboration_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Members can insert own collaboration logs"
  ON collaboration_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM collaboration_members
      WHERE collaboration_id = collaboration_logs.collaboration_id
        AND user_id = auth.uid()
        AND left_at IS NULL
    )
  );

CREATE POLICY "Members can update own collaboration logs"
  ON collaboration_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own collaboration invitations"
  ON collaboration_invitations FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- RPCs
CREATE OR REPLACE FUNCTION join_collaboration(collab_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM collaborations WHERE id = collab_id) THEN
    RAISE EXCEPTION 'collaboration not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM collaborations
    WHERE id = collab_id
      AND end_date IS NOT NULL
      AND end_date < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'collaboration has ended';
  END IF;

  IF EXISTS (
    SELECT 1 FROM collaboration_members
    WHERE collaboration_id = collab_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already joined';
  END IF;

  IF EXISTS (
    SELECT 1 FROM collaboration_members
    WHERE collaboration_id = collab_id AND user_id = auth.uid()
  ) THEN
    UPDATE collaboration_members
    SET left_at = NULL
    WHERE collaboration_id = collab_id AND user_id = auth.uid();
    RETURN;
  END IF;

  INSERT INTO collaboration_members (collaboration_id, user_id)
  VALUES (collab_id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION leave_collaboration(collab_id uuid)
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
    SELECT 1 FROM collaboration_members
    WHERE collaboration_id = collab_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  UPDATE collaboration_members
  SET left_at = now()
  WHERE collaboration_id = collab_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION delete_collaboration(collab_id uuid)
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
    SELECT 1 FROM collaborations
    WHERE id = collab_id AND creator_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM collaborations WHERE id = collab_id;
END;
$$;

CREATE OR REPLACE FUNCTION invite_friend_to_collaboration(collab_id uuid, friend_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM collaborations
    WHERE id = collab_id AND creator_id = uid
  ) THEN
    RAISE EXCEPTION 'not the creator';
  END IF;

  IF EXISTS (
    SELECT 1 FROM collaborations
    WHERE id = collab_id
      AND end_date IS NOT NULL
      AND end_date < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'collaboration has ended';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = uid AND addressee_id = friend_id)
        OR (requester_id = friend_id AND addressee_id = uid)
      )
  ) THEN
    RAISE EXCEPTION 'not friends';
  END IF;

  IF EXISTS (
    SELECT 1 FROM collaboration_members
    WHERE collaboration_id = collab_id
      AND user_id = friend_id
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already joined';
  END IF;

  INSERT INTO collaboration_invitations (collaboration_id, inviter_id, invitee_id, status)
  VALUES (collab_id, uid, friend_id, 'pending')
  ON CONFLICT (collaboration_id, invitee_id)
  DO UPDATE SET status = 'pending', inviter_id = uid, created_at = now()
  WHERE collaboration_invitations.status = 'declined';
END;
$$;

CREATE OR REPLACE FUNCTION respond_collaboration_invitation(invitation_id uuid, accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  collab_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT collaboration_id INTO collab_id
  FROM collaboration_invitations
  WHERE id = invitation_id
    AND invitee_id = uid
    AND status = 'pending';

  IF collab_id IS NULL THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF accept THEN
    PERFORM join_collaboration(collab_id);
    UPDATE collaboration_invitations
    SET status = 'accepted'
    WHERE id = invitation_id;
  ELSE
    UPDATE collaboration_invitations
    SET status = 'declined'
    WHERE id = invitation_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION join_collaboration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_collaboration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_collaboration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_friend_to_collaboration(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_collaboration_invitation(uuid, boolean) TO authenticated;
