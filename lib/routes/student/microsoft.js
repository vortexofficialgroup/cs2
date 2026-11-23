// POST /api/student/microsoft — exchange a verified Supabase (Microsoft) token
// for a student portal session. Uses the same shared email-domain allowlist as
// the staff Microsoft sign-in.

const handler = require('../../http');
const { sign } = require('../../auth');
const students = require('../../student-store');
const { allowedByDomain, verifyAccessToken, loadRules } = require('../../microsoft-identity');

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
      return res.status(err.status || 401).json({ error: err.message });
    }

    if (!allowedByDomain(identity.email, rules.domains))
      return res.status(403).json({ error: 'Your school email domain is not allowed. Ask the administrator to add it.' });

    const email = identity.email.toLowerCase();
    const meta = identity.user_metadata || {};
    const name = meta.full_name || meta.name || email.split('@')[0].replace(/[._-]+/g, ' ');

    let user;
    try {
      user = await students.upsertSso({ email, name });
    } catch (err) {
      console.error('[student microsoft sign-in]', err);
      return res.status(503).json({ error: 'Could not complete your Microsoft sign-in right now.' });
    }

    const token = sign({ role: 'student', id: user.id, email: user.email, name: user.name, sso: true });
    res.json({ user, token });
  },
});
