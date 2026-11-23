// lib/rate-limit.js — rate limiter.
// Uses a shared Supabase counter (rate_limit_hit RPC, see db/migrations-2026-11-24-rate-limit.sql)
// so limits hold across serverless instances. Falls back to an in-memory
// limiter when Supabase is not configured or the RPC is unavailable.

const { config, request } = require('./supabase-state');

const buckets = new Map();

function prune(now) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function check(key, { limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

function ip(req) {
  const h = (req.headers) || {};
  // Vercel sets x-vercel-forwarded-for / overwrites x-forwarded-for with the real client IP.
  const raw = h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'];
  const first = typeof raw === 'string' ? raw.split(',')[0] : (req.socket?.remoteAddress || 'unknown');
  return String(first).trim().slice(0, 80) || 'unknown';
}

async function checkShared(key, { limit = 10, windowMs = 60_000 } = {}) {
  if (!config()) return null;
  try {
    const response = await request('rpc/rate_limit_hit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)) }),
    });
    if (!response) return null;
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row.allowed !== 'boolean') return null;
    return { ok: row.allowed, retryAfter: row.retry_after || 60 };
  } catch (err) {
    // Function/table not migrated yet or Supabase down: fall back to in-memory.
    console.error('[rate-limit] shared limiter unavailable:', err && err.message ? err.message : err);
    return null;
  }
}

async function enforce(req, res, name, options) {
  const key = `${name}:${ip(req)}`;
  const result = (await checkShared(key, options)) || check(key, options);
  if (!result.ok) {
    res.setHeader('Retry-After', String(result.retryAfter || 60));
    res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
    return false;
  }
  return true;
}

module.exports = { check, enforce, ip };
