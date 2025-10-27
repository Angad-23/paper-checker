/*
  # CheckMyPaper Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, not null)
      - `full_name` (text, not null)
      - `role` (text, not null) - 'learner' or 'tutor'
      - `class_info` (text) - for learners
      - `subject_info` (text) - for tutors
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `papers`
      - `id` (uuid, primary key)
      - `learner_id` (uuid, references profiles)
      - `tutor_id` (uuid, references profiles, nullable)
      - `title` (text, not null)
      - `answer_sheet_url` (text, not null)
      - `question_paper_url` (text, nullable)
      - `checked_sheet_url` (text, nullable)
      - `status` (text, not null) - 'pending', 'accepted', 'checked', 'rejected'
      - `marks` (integer, nullable)
      - `grade` (text, nullable)
      - `feedback` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `paper_id` (uuid, references papers)
      - `message` (text, not null)
      - `is_read` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own data
    - Add policies for tutors to access assigned papers
    - Add policies for learners to access their own papers

  3. Important Notes
    - All timestamps use `now()` as default
    - Foreign keys maintain referential integrity
    - Indexes added for performance on frequently queried columns
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('learner', 'tutor')),
  class_info text,
  subject_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create papers table
CREATE TABLE IF NOT EXISTS papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tutor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  answer_sheet_url text NOT NULL,
  question_paper_url text,
  checked_sheet_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'checked', 'rejected')),
  marks integer,
  grade text,
  feedback text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paper_id uuid REFERENCES papers(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Papers policies for learners
CREATE POLICY "Learners can view own papers"
  ON papers FOR SELECT
  TO authenticated
  USING (learner_id = auth.uid());

CREATE POLICY "Learners can insert own papers"
  ON papers FOR INSERT
  TO authenticated
  WITH CHECK (learner_id = auth.uid());

CREATE POLICY "Learners can update own papers"
  ON papers FOR UPDATE
  TO authenticated
  USING (learner_id = auth.uid())
  WITH CHECK (learner_id = auth.uid());

-- Papers policies for tutors
CREATE POLICY "Tutors can view all pending papers"
  ON papers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    )
  );

CREATE POLICY "Tutors can update assigned papers"
  ON papers FOR UPDATE
  TO authenticated
  USING (
    tutor_id = auth.uid() OR
    (tutor_id IS NULL AND status = 'pending' AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    ))
  )
  WITH CHECK (
    tutor_id = auth.uid() OR
    (tutor_id = auth.uid() AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'tutor'
    ))
  );

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_papers_learner_id ON papers(learner_id);
CREATE INDEX IF NOT EXISTS idx_papers_tutor_id ON papers(tutor_id);
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);