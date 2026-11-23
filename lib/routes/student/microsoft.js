// POST /api/student/microsoft — exchange a verified Supabase (Microsoft) token
// for a student portal session. Uses the same shared email-domain allowlist as
// the staff Microsoft sign-in.

const handler = require('../../http');
const { sign } = require('../../auth');
const students = require('../../student-store');
const accessLog = require('../../access-log');
const { allowedByDomain, verifyAccessToken, loadRules } = require('../../microsoft-identity');

function clientIp(req) {
  const xf = req.headers && req.headers['x-forwarded-for'];
  return (typeof xf === 'string' ? xf.split(',')[0] : '') || req.socket?.remoteAddress || '';
}

module.exports = handler({
  async POST(req, res) {
    const accessToken = req.body && req.body.accessToken;
    if (typeof accessToken !== 'string' || !accessToken)
      return res.status(400).json({ error: 'A Microsoft access token is required.' });

    let identity, rules;
    try {
      identity = await verifyAccessToken(accessToken);
      rules = await loadRules();
    } catch (err) {
      await accessLog.append({ actorType: 'student', email: '', name: '', method: 'microsoft', ok: false, reason: err.message, ip: clientIp(req) });
      return res.status(err.status || 401).json({ error: err.message });
    }

    if (!allowedByDomain(identity.email, rules.domains)) {
      await accessLog.append({ actorType: 'student', email: identity.email, name: '', method: 'microsoft', ok: false, reason: 'Domain not allowed', ip: clientIp(req) });
      return res.status(403).json({ error: 'Your school email domain is not allowed. Ask the administrator to add it.' });
    }

    const email = identity.email.toLowerCase();
    const meta = identity.user_metadata || {};
    const name = meta.full_name || meta.name || email.split('@')[0].replace(/[._-]+/g, ' ');

    let user;
    try {
      user = await students.upsertSso({ email, name });
    } catch (err) {
      console.error('[student microsoft sign-in]', err);
      const message = String(err && err.message || '');
      await accessLog.append({ actorType: 'student', email, name, method: 'microsoft', ok: false, reason: message.slice(0, 200), ip: clientIp(req) });
      if (/student_users/i.test(message) && /schema cache|PGRST205|404|relation|does not exist/i.test(message))
        return res.status(503).json({ error: 'Microsoft sign-in is not ready yet. The administrator needs to run the Supabase SQL migration for student_users (db/fix-student-users.sql).' });
      return res.status(503).json({ error: 'Could not complete your Microsoft sign-in right now.' });
    }
    await accessLog.append({ actorType: 'student', email: user.email, name: user.name, method: 'microsoft', ok: true, reason: 'Signed in with Microsoft', ip: clientIp(req) });

    const token = sign({ role: 'student', id: user.id, email: user.email, name: user.name, sso: true });
    res.json({ user, token });
  },
});
