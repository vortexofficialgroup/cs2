-- Run in Supabase SQL Editor if your tables already exist.
-- Adds student sign-in, SSO staff, linked_professor and self-service profile fields.

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
GRANT SELECT, INSERT, UPDATE ON TABLE public.student_users TO service_role;

ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.sso_staff (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  ai_actions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.sso_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sso_staff FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sso_staff TO service_role;

ALTER TABLE public.sso_staff ADD COLUMN IF NOT EXISTS linked_professor TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sso_staff ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sso_staff ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '';
