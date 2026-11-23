// Student sign-up / sign-in for the public portal.
const handler = require('../../http');
const { sign, verify } = require('../../auth');
const students = require('../../student-store');
const accessLog = require('../../access-log');

function clientIp(req) {
  const xf = req.headers && req.headers['x-forwarded-for'];
  return (typeof xf === 'string' ? xf.split(',')[0] : '') || req.socket?.remoteAddress || '';
}

function issue(res, user) {
  const token = sign({ role: 'student', id: user.id, email: user.email, name: user.name });
  res.json({ user, token });
}

module.exports = handler({
  async POST(req, res) {
    const action = req.query.action;
    const { name, email, password } = req.body || {};
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return res.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 128)
      return res.status(400).json({ error: 'Password must be 8–128 characters.' });

    if (action === 'register') {
      if (typeof name !== 'string' || name.trim().length < 2)
        return res.status(400).json({ error: 'Enter your name.' });
      try {
        const user = await students.register({ name, email, password });
        if (!user) {
          await accessLog.append({ actorType: 'student', email, name, method: 'register', ok: false, reason: 'Email already exists', ip: clientIp(req) });
          return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
        }
        await accessLog.append({ actorType: 'student', email: user.email, name: user.name, method: 'register', ok: true, reason: 'Account created', ip: clientIp(req) });
        return issue(res, user);
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
        return issue(res, user);
      } catch (err) {
        console.error('[student login]', err);
        await accessLog.append({ actorType: 'student', email, name: '', method: 'password', ok: false, reason: String(err.message || '').slice(0, 200), ip: clientIp(req) });
        return res.status(503).json({ error: 'Could not sign in right now.' });
      }
    }
    return res.status(404).json({ error: 'Not found' });
  },

  async GET(req, res) {
    const token = req.headers['x-student-token'];
    const payload = verify(token);
    if (!payload || payload.role !== 'student') return res.status(401).json({ error: 'Not signed in.' });
    const user = await students.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    res.json({ user });
  },
});
