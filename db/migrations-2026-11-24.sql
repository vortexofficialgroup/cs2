-- Run in Supabase SQL Editor if your database was set up with an earlier migration.
-- 1) Remembers the one-time "what do you teach" staff choice (empty = None).
-- 2) Records every change made through the staff AI assistant for admin review.

ALTER TABLE public.sso_staff ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Older databases were created with fix-student-users.sql, which predates
-- these columns. Without them a student's program is silently dropped.
ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS program TEXT NOT NULL DEFAULT '';
ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.change_log (
  id         TEXT PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL DEFAULT 'staff',
  actor      TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL DEFAULT '',
  target     TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  ok         BOOLEAN NOT NULL DEFAULT FALSE,
  ip         TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_change_log_at ON public.change_log(at DESC);

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.change_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.change_log TO service_role;
