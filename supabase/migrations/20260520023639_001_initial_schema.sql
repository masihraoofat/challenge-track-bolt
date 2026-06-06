/*
  # Habitrak Initial Schema

  1. New Tables
    - `users` - User profiles with username
      - `id` (uuid, primary key, references auth.users)
      - `username` (text, unique, not null)
      - `created_at` (timestamptz, default now())
    - `competitions` - Reading competitions
      - `id` (uuid, primary key, default gen_random_uuid())
      - `title` (text, not null)
      - `start_date` (date, not null)
      - `end_date` (date, not null)
      - `creator_id` (uuid, references users, not null)
      - `created_at` (timestamptz, default now())
    - `participants` - Junction table linking users to competitions with scores
      - `competition_id` (uuid, references competitions, not null)
      - `user_id` (uuid, references users, not null)
      - `score` (integer, default 0)
      - `joined_at` (timestamptz, default now())
      - Primary key on (competition_id, user_id)
    - `daily_logs` - Honor system daily check-ins
      - `id` (uuid, primary key, default gen_random_uuid())
      - `competition_id` (uuid, references competitions, not null)
      - `user_id` (uuid, references users, not null)
      - `date_logged` (date, not null)
      - `completed` (boolean, default false)
      - Unique constraint on (competition_id, user_id, date_logged)
      - `created_at` (timestamptz, default now())
    - `analytics_events` - Append-only event log
      - `id` (uuid, primary key, default gen_random_uuid())
      - `user_id` (uuid, references users, not null)
      - `event_type` (text, not null)
      - `event_data` (jsonb, default '{}')
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Users can read/update their own profile
    - Authenticated users can read competitions; creators can insert
    - Participants: authenticated users can read; users can insert themselves
    - Daily logs: users can read their own and insert their own; one log per user per competition per day
    - Analytics events: service role only (inserted via edge functions or direct inserts)

  3. Important Notes
    - The `users` table id references auth.users(id) with ON DELETE CASCADE
    - A trigger automatically creates a users profile on auth signup
    - daily_logs has a unique constraint to prevent duplicate check-ins
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read other users for leaderboard"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  creator_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read competitions"
  ON competitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create competitions"
  ON competitions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  score integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (competition_id, user_id)
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read participants"
  ON participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join competitions"
  ON participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participant score"
  ON participants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Daily logs table
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date_logged date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (competition_id, user_id, date_logged)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily logs"
  ON daily_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read logs for competitions they participate in"
  ON daily_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.competition_id = daily_logs.competition_id
      AND participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own daily logs"
  ON daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily logs"
  ON daily_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert analytics events"
  ON analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_participants_competition_score ON participants(competition_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_competition_user_date ON daily_logs(competition_id, user_id, date_logged);
