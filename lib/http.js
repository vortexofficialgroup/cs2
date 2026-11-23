// lib/http.js — Vercel serverless route wrapper
const DEFAULT_ORIGINS = [
  'https://uedubai.campusyncer.com',
  'https://www.uedubai.campusyncer.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function allowedOrigin(req) {
  const origin = String(req.headers?.origin || '');
  if (!origin) return '';
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const allowed = configured.length ? configured : DEFAULT_ORIGINS;
  if (allowed.includes(origin)) return origin;
  // Allow Vercel preview URLs for this project only when explicitly enabled.
  if (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return origin;
  return '';
}

function parseCookies(req) {
  if (req.cookies) return;
  req.cookies = {};
  const header = req.headers && req.headers.cookie;
  if (typeof header !== 'string') return;
  header.split(';').forEach(part => {
    const index = part.indexOf('=');
    if (index === -1) return;
    const name = part.slice(0, index).trim();
    if (!name) return;
    const value = part.slice(index + 1).trim();
    try { req.cookies[name] = decodeURIComponent(value); }
    catch { req.cookies[name] = value; }
  });
}

module.exports = function handler(methods) {
  return async function (req, res) {
    parseCookies(req);
    const origin = allowedOrigin(req);
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-token,x-student-token');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const fn = methods[req.method];
    if (!fn) return res.status(405).json({ error: `Method ${req.method} not allowed` });

    try {
      await fn(req, res);
    } catch (err) {
      console.error('[API Error]', err && err.message ? err.message : err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Lightweight validation
module.exports.validate = function (body, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    if (rule.required && !body[field]) errors[field] = 'Required';
    if (rule.min && String(body[field]).length < rule.min) errors[field] = `Min ${rule.min} chars`;
    if (rule.in && !rule.in.includes(body[field])) errors[field] = `Must be one of: ${rule.in.join(', ')}`;
  }
  return Object.keys(errors).length ? errors : null;
};
