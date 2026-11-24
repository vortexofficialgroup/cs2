-- Run in Supabase → SQL Editor → New query → Run.
-- Creates the missing table used by student sign-up and Microsoft student login.

CREATE TABLE IF NOT EXISTS public.student_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  program TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS program TEXT NOT NULL DEFAULT '';
ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '';

ALTER TABLE public.student_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.student_users TO service_role;
