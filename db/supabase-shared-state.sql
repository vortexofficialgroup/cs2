CREATE TABLE IF NOT EXISTS public.portal_state (
  id TEXT PRIMARY KEY CHECK (id = 'main'),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.portal_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.merge_portal_state(p_patch JSONB)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.portal_state (id, data, updated_at)
  VALUES ('main', p_patch, NOW())
  ON CONFLICT (id) DO UPDATE
  SET data = public.portal_state.data || EXCLUDED.data,
      updated_at = NOW();
$$;

REVOKE ALL ON TABLE public.portal_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_portal_state(JSONB) FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.portal_state TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_portal_state(JSONB) TO service_role;

-- Microsoft (SSO) staff accounts. Created on first sign-in, managed by admin.
CREATE TABLE IF NOT EXISTS public.sso_staff (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Staff',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  ai_actions TEXT[] NOT NULL DEFAULT '{}',
  photo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sso_staff ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sso_staff ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sso_staff ADD COLUMN IF NOT EXISTS linked_professor TEXT NOT NULL DEFAULT '';

ALTER TABLE public.sso_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sso_staff FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sso_staff TO service_role;

-- Student accounts for the public portal sign-up/login gate.
CREATE TABLE IF NOT EXISTS public.student_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  photo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '';
ALTER TABLE public.student_users ADD COLUMN IF NOT EXISTS program TEXT NOT NULL DEFAULT '';

ALTER TABLE public.student_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.student_users TO service_role;

-- Sign-in / audit log for student access attempts.
CREATE TABLE IF NOT EXISTS public.access_log (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL DEFAULT 'student',
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.access_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.access_log TO service_role;
