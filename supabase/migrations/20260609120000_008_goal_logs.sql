-- Goal logs for personal goal tracking

CREATE TABLE IF NOT EXISTS goal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_logged date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean DEFAULT false,
  value numeric DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (goal_id, date_logged)
);

ALTER TABLE goal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own goal logs"
  ON goal_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goal logs"
  ON goal_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goal logs"
  ON goal_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goal logs"
  ON goal_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goal_logs_goal_id ON goal_logs(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_logs_user_id ON goal_logs(user_id);
