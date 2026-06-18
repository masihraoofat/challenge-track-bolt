/*
  # Friends system

  1. Tables
    - `friendships` — friend requests and accepted friendships
    - `competition_invitations` — invite friends to challenges you run

  2. RPCs
    - send_friend_request, accept/decline/cancel/remove
    - invite_friend_to_competition, respond_competition_invitation
*/

CREATE TABLE friendships (
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_addressee_pending
  ON friendships (addressee_id)
  WHERE status = 'pending';

CREATE INDEX idx_friendships_requester_accepted
  ON friendships (requester_id)
  WHERE status = 'accepted';

CREATE INDEX idx_friendships_addressee_accepted
  ON friendships (addressee_id)
  WHERE status = 'accepted';

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE TABLE competition_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, invitee_id)
);

CREATE INDEX idx_competition_invitations_invitee_pending
  ON competition_invitations (invitee_id)
  WHERE status = 'pending';

ALTER TABLE competition_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own competition invitations"
  ON competition_invitations FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

CREATE OR REPLACE FUNCTION send_friend_request(target_id uuid)
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

  IF target_id = uid THEN
    RAISE EXCEPTION 'cannot friend yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = target_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = uid AND addressee_id = target_id)
        OR (requester_id = target_id AND addressee_id = uid)
      )
  ) THEN
    RAISE EXCEPTION 'already friends';
  END IF;

  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE requester_id = target_id AND addressee_id = uid AND status = 'pending'
  ) THEN
    UPDATE friendships
    SET status = 'accepted', updated_at = now()
    WHERE requester_id = target_id AND addressee_id = uid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE requester_id = uid AND addressee_id = target_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'request already sent';
  END IF;

  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE requester_id = uid AND addressee_id = target_id
  ) THEN
    UPDATE friendships
    SET status = 'pending', updated_at = now()
    WHERE requester_id = uid AND addressee_id = target_id;
    RETURN;
  END IF;

  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (uid, target_id, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION accept_friend_request(requester_id uuid)
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

  UPDATE friendships
  SET status = 'accepted', updated_at = now()
  WHERE friendships.requester_id = accept_friend_request.requester_id
    AND addressee_id = uid
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION decline_friend_request(requester_id uuid)
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

  UPDATE friendships
  SET status = 'declined', updated_at = now()
  WHERE friendships.requester_id = decline_friend_request.requester_id
    AND addressee_id = uid
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_friend_request(addressee_id uuid)
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

  DELETE FROM friendships
  WHERE requester_id = uid
    AND friendships.addressee_id = cancel_friend_request.addressee_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION remove_friend(friend_id uuid)
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

  DELETE FROM friendships
  WHERE status = 'accepted'
    AND (
      (requester_id = uid AND addressee_id = friend_id)
      OR (requester_id = friend_id AND addressee_id = uid)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not friends';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION invite_friend_to_competition(comp_id uuid, friend_id uuid)
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
    SELECT 1 FROM competitions
    WHERE id = comp_id AND creator_id = uid
  ) THEN
    RAISE EXCEPTION 'not the creator';
  END IF;

  IF EXISTS (
    SELECT 1 FROM competitions
    WHERE id = comp_id AND end_date < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'competition has ended';
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
    SELECT 1 FROM participants
    WHERE competition_id = comp_id
      AND user_id = friend_id
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already joined';
  END IF;

  INSERT INTO competition_invitations (competition_id, inviter_id, invitee_id, status)
  VALUES (comp_id, uid, friend_id, 'pending')
  ON CONFLICT (competition_id, invitee_id)
  DO UPDATE SET status = 'pending', inviter_id = uid, created_at = now()
  WHERE competition_invitations.status = 'declined';
END;
$$;

CREATE OR REPLACE FUNCTION respond_competition_invitation(invitation_id uuid, accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  comp_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT competition_id INTO comp_id
  FROM competition_invitations
  WHERE id = invitation_id
    AND invitee_id = uid
    AND status = 'pending';

  IF comp_id IS NULL THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF accept THEN
    PERFORM join_competition(comp_id);
    UPDATE competition_invitations
    SET status = 'accepted'
    WHERE id = invitation_id;
  ELSE
    UPDATE competition_invitations
    SET status = 'declined'
    WHERE id = invitation_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_friend_to_competition(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_competition_invitation(uuid, boolean) TO authenticated;
