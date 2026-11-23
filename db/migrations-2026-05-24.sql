-- Run in Supabase SQL Editor if your tables already exist.
-- Adds student sign-in table and linked_professor for SSO staff.

CREATE TABLE IF NOT EXISTS public.student_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.student_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.student_users TO service_role;

ALTER TABLE public.sso_staff ADD COLUMN IF NOT EXISTS linked_professor TEXT NOT NULL DEFAULT '';
