-- Shared rate limiting for serverless (run once in Supabase SQL Editor).
-- Used by lib/rate-limit.js via POST /rest/v1/rpc/rate_limit_hit.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO service_role;

-- Atomically count one hit. Returns allowed flag, current count and seconds until reset.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER)
RETURNS TABLE (allowed BOOLEAN, hits INTEGER, retry_after INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER;
  v_reset TIMESTAMPTZ;
BEGIN
  INSERT INTO public.rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET count    = CASE WHEN r.reset_at <= v_now THEN 1 ELSE r.count + 1 END,
        reset_at = CASE WHEN r.reset_at <= v_now THEN v_now + make_interval(secs => p_window_seconds) ELSE r.reset_at END
  RETURNING r.count, r.reset_at INTO v_count, v_reset;

  -- Opportunistic cleanup (about 1% of calls) keeps the table small.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE reset_at < v_now - interval '1 hour';
  END IF;

  RETURN QUERY SELECT v_count <= p_limit, v_count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset - v_now)))::INTEGER);
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;
