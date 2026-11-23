// Student sign-up / sign-in for the public portal.
const handler = require('../../http');
const { sign, verify } = require('../../auth');
const students = require('../../student-store');

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
        if (!user) return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
        return issue(res, user);
      } catch (err) {
        console.error('[student register]', err);
        return res.status(503).json({ error: 'Could not create your account right now.' });
      }
    }

    if (action === 'login') {
      try {
        const user = await students.authenticate(email, password);
        if (!user) return res.status(401).json({ error: 'Incorrect email or password.' });
        return issue(res, user);
      } catch (err) {
        console.error('[student login]', err);
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
