// lib/auth.js — HMAC-signed session tokens (no JWT dependency needed)
const crypto = require('crypto');
const staffStore = require('./staff-store');
const adminPassword = require('./admin-password');

if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_SECRET)
  throw new Error('ADMIN_SECRET must be set in production.');
const SECRET = process.env.ADMIN_SECRET || 'dev-secret-change-in-production';
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function isSecureRequest(req) {
  if (req.socket?.encrypted) return true;
  const forwardedProto = req.headers?.['x-forwarded-proto'];
  return typeof forwardedProto === 'string' &&
    forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
}

function sign(payload) {
  const data = JSON.stringify({ ...payload, iat: Date.now() });
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
    if (Date.now() - payload.iat > TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function getUser(req, res, options = {}) {
  const silent = !!options.silent;
  const token = req.headers['x-admin-token'] || req.cookies?.adminToken;
  const payload = verify(token);
  if (!payload) {
    if (!silent && res) res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (payload.role === 'staff' && payload.sso) return payload;

  if (payload.role === 'staff') {
    const currentUser = staffStore.findById(payload.id);
    if (!currentUser) {
      if (!silent && res) res.status(401).json({ error: 'Staff account is no longer active.' });
      return null;
    }
    return { ...payload, ...currentUser, role: 'staff' };
  }
  if (payload.role === 'admin' && payload.passwordChangedAt !== adminPassword.changedAt()) {
    if (!silent && res) res.status(401).json({ error: 'Administrator password changed. Please sign in again.' });
    return null;
  }
  return payload;
}

function requireAdmin(req, res) {
  const user = getUser(req, res);
  if (!user) return false;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required.' });
    return false;
  }
  return true;
}

function requirePermission(req, res, permission) {
  const user = getUser(req, res);
  if (!user) return false;
  if (user.role === 'admin' || (user.role === 'staff' && user.permissions.includes(permission))) return true;
  res.status(403).json({ error: 'You do not have permission to perform this action.' });
  return false;
}

// Any signed-in portal user: admin/staff (adminToken) or student (studentToken cookie).
// Returns the session payload or null. Never writes a response.
function getSession(req) {
  const staffOrAdmin = getUser(req, null, { silent: true });
  if (staffOrAdmin) return staffOrAdmin;
  const payload = verify(req.cookies && req.cookies.studentToken);
  return payload && payload.role === 'student' ? payload : null;
}

// Gate for endpoints that serve campus data to signed-in members only.
function requireSession(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'Please sign in with your university account.' });
    return null;
  }
  return session;
}

module.exports = { sign, verify, getUser, getSession, requireSession, requireAdmin, requirePermission, isSecureRequest };
