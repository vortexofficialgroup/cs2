// lib/auth.js — HMAC-signed session tokens (no JWT dependency needed)
const crypto = require('crypto');
const staffStore = require('./staff-store');
const adminPassword = require('./admin-password');

if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_SECRET)
  throw new Error('ADMIN_SECRET must be set in production.');
const SECRET = process.env.ADMIN_SECRET || 'dev-secret-change-in-production';
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours for normal sessions
const PERSISTENT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // "Stay signed in"

function isSecureRequest(req) {
  if (req.socket?.encrypted) return true;
  const forwardedProto = req.headers?.['x-forwarded-proto'];
  return typeof forwardedProto === 'string' &&
    forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
}

function sign(payload) {
  const now = Date.now();
  const data = JSON.stringify({
    ...payload,
    iat: now,
    ...(payload.persistent ? { exp: now + PERSISTENT_TTL_MS } : {}),
  });
  const b64  = Buffer.from(data).toString('base64url');
  const sig  = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return null;
    const expected = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
    const suppliedSignature = Buffer.from(sig);
    const expectedSignature = Buffer.from(expected);
    if (suppliedSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(suppliedSignature, expectedSignature)) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    const expiresAt = Number.isFinite(payload.exp) ? payload.exp : payload.iat + TTL_MS;
    if (Date.now() > expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

// Coherent session cookies: Lax keeps the session on normal navigation back to
// the site, and the production domain covers both www and non-www hosts.
function sessionCookie(res, name, token, maxAge, req) {
  const host = String((req && req.headers && req.headers.host) || '').split(':')[0].toLowerCase();
  const domain = host === 'uedubai.campusyncer.com' || host === 'www.uedubai.campusyncer.com'
    ? '; Domain=.uedubai.campusyncer.com'
    : '';
  const secure = isSecureRequest(req) ? '; Secure' : '';
  const age = maxAge === undefined || maxAge === null ? '' : `; Max-Age=${maxAge}`;
  res.setHeader('Set-Cookie', `${name}=${token}; HttpOnly; SameSite=Lax; Path=/${domain}${age}${secure}`);
}

async function getUser(req, res, options = {}) {
  const silent = !!options.silent;
  const token = req.headers['x-admin-token'] || req.cookies?.adminToken;
  const payload = verify(token);
  if (!payload) {
    if (!silent && res) res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (payload.role === 'staff' && payload.sso) return payload;

  try {
    if (payload.role === 'staff') {
      const currentUser = await staffStore.findById(payload.id);
      if (!currentUser) {
        if (!silent && res) res.status(401).json({ error: 'Staff account is no longer active.' });
        return null;
      }
      return { ...payload, ...currentUser, role: 'staff' };
    }
    if (payload.role === 'admin' && payload.passwordChangedAt !== await adminPassword.changedAt()) {
      if (!silent && res) res.status(401).json({ error: 'Administrator password changed. Please sign in again.' });
      return null;
    }
  } catch (err) {
    console.error('[auth store]', err);
    if (!silent && res) res.status(503).json({ error: 'Could not verify your session right now.' });
    return null;
  }
  return payload;
}

async function requireAdmin(req, res) {
  const user = await getUser(req, res);
  if (!user) return false;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required.' });
    return false;
  }
  return true;
}

async function requirePermission(req, res, permission) {
  const user = await getUser(req, res);
  if (!user) return false;
  if (user.role === 'admin' || (user.role === 'staff' && user.permissions.includes(permission))) return true;
  res.status(403).json({ error: 'You do not have permission to perform this action.' });
  return false;
}

module.exports = { sign, verify, getUser, requireAdmin, requirePermission, isSecureRequest, sessionCookie };
