/*
  # Add increment_score function

  1. New Functions
    - `increment_score(comp_id uuid, uid uuid)` - Atomically increments a participant's score by 1
      - Takes competition_id and user_id as parameters
      - Updates the score in the participants table
      - Returns void

  2. Security
    - The function is SECURITY DEFINER so it can update scores
    - Only operates on the participant's own row (WHERE user_id = uid)

  3. Important Notes
    - This function is called from the app after a daily check-in
    - It increments the score by exactly 1 point per check-in
*/

CREATE OR REPLACE FUNCTION increment_score(comp_id uuid, uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE participants
  SET score = score + 1
  WHERE competition_id = comp_id AND user_id = uid;
END;
$$;
