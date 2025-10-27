import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'learner' | 'tutor';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  class_info?: string;
  subject_info?: string;
  created_at: string;
  updated_at: string;
}

export interface Paper {
  id: string;
  learner_id: string;
  tutor_id?: string;
  title: string;
  answer_sheet_url: string;
  question_paper_url?: string;
  checked_sheet_url?: string;
  status: 'pending' | 'accepted' | 'checked' | 'rejected';
  marks?: number;
  grade?: string;
  feedback?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  paper_id?: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
