-- Allow competition creators to delete their challenges

CREATE POLICY "Creators can delete own competitions"
  ON competitions FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);
