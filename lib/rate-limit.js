// lib/rate-limit.js — lightweight in-memory rate limiter.
// Best-effort for serverless; protects dev and adds friction in prod.

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
  const xf = req.headers && req.headers['x-forwarded-for'];
  const raw = typeof xf === 'string' ? xf.split(',')[0] : (req.socket?.remoteAddress || 'unknown');
  return String(raw).trim().slice(0, 80) || 'unknown';
}

function enforce(req, res, name, options) {
  const key = `${name}:${ip(req)}`;
  const result = check(key, options);
  if (!result.ok) {
    res.setHeader('Retry-After', String(result.retryAfter || 60));
    res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
    return false;
  }
  return true;
}

module.exports = { check, enforce, ip };
