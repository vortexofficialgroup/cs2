// Student sign-up / sign-in for the public portal.
const handler = require('../../http');
const { sign, verify, isSecureRequest } = require('../../auth');
const students = require('../../student-store');
const accessLog = require('../../access-log');
const rateLimit = require('../../rate-limit');

function clientIp(req) {
  return rateLimit.ip(req);
}

const REMEMBER_SECONDS = 30 * 24 * 60 * 60; // 30 days
function wantsRemember(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}
function issue(req, res, user, remember) {
  const persistent = wantsRemember(remember);
  const token = sign({
    role: 'student', id: user.id, email: user.email, name: user.name,
    program: user.program || '', persistent,
  });
  const secure = isSecureRequest(req) ? '; Secure' : '';
  const maxAge = persistent ? `; Max-Age=${REMEMBER_SECONDS}` : '';
  res.setHeader('Set-Cookie', `studentToken=${token}; HttpOnly; SameSite=Strict; Path=/${maxAge}${secure}`);
  res.json({ user, persistent });
}

module.exports = handler({
  async POST(req, res) {
    const action = req.query.action;
    if (!(await rateLimit.enforce(req, res, `student-${action || 'auth'}`, { limit: 15, windowMs: 10 * 60_000 }))) return;
    const { name, email, password, program, remember } = req.body || {};
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return res.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 128)
      return res.status(400).json({ error: 'Password must be 8–128 characters.' });

    if (action === 'register') {
      if (typeof name !== 'string' || name.trim().length < 2)
        return res.status(400).json({ error: 'Enter your name.' });
      if (typeof program !== 'string' || !program.trim())
        return res.status(400).json({ error: 'Select your program (Bachelor, Master, MBA, etc.).' });
      try {
        const user = await students.register({ name, email, password, program: program.trim() });
        if (!user) {
          await accessLog.append({ actorType: 'student', email, name, method: 'register', ok: false, reason: 'Email already exists', ip: clientIp(req) });
          return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
        }
        await accessLog.append({ actorType: 'student', email: user.email, name: user.name, method: 'register', ok: true, reason: 'Account created', ip: clientIp(req) });
        return issue(req, res, user, remember);
      } catch (err) {
        console.error('[student register]', err);
        const message = String(err && err.message || '');
        await accessLog.append({ actorType: 'student', email, name, method: 'register', ok: false, reason: message.slice(0, 200), ip: clientIp(req) });
        if (/student_users/i.test(message) && /schema cache|PGRST205|404|relation|does not exist/i.test(message))
          return res.status(503).json({ error: 'Student sign-up is not ready yet. The administrator needs to run the Supabase SQL migration for student_users (db/fix-student-users.sql).' });
        return res.status(503).json({ error: 'Could not create your account right now.' });
      }
    }

    if (action === 'login') {
      try {
        const user = await students.authenticate(email, password);
        if (!user) {
          await accessLog.append({ actorType: 'student', email, name: '', method: 'password', ok: false, reason: 'Incorrect email or password', ip: clientIp(req) });
          return res.status(401).json({ error: 'Incorrect email or password.' });
        }
        await accessLog.append({ actorType: 'student', email: user.email, name: user.name, method: 'password', ok: true, reason: 'Signed in', ip: clientIp(req) });
        return issue(req, res, user, remember);
      } catch (err) {
        console.error('[student login]', err);
        await accessLog.append({ actorType: 'student', email, name: '', method: 'password', ok: false, reason: String(err.message || '').slice(0, 200), ip: clientIp(req) });
        return res.status(503).json({ error: 'Could not sign in right now.' });
      }
    }
    return res.status(404).json({ error: 'Not found' });
  },

  async GET(req, res) {
    const token = req.cookies?.studentToken;
    const payload = verify(token);
    if (!payload || payload.role !== 'student') return res.status(401).json({ error: 'Not signed in.' });
    const user = await students.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    res.json({ user });
  },

  async DELETE(req, res) {
    const { isSecureRequest } = require('../../auth');
    const secure = isSecureRequest(req) ? '; Secure' : '';
    res.setHeader('Set-Cookie', `studentToken=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
    res.json({ ok: true });
  },
});
