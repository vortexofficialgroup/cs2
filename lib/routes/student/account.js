// PUT /api/student/account — student photo / name / status.
const handler = require('../../http');
const { sign, verify, sessionCookie } = require('../../auth');
const students = require('../../student-store');
const { validate } = require('../../profile-fields');

function sessionStudent(req) {
  const payload = verify(req.cookies?.studentToken);
  return payload && payload.role === 'student' ? payload : null;
}

module.exports = handler({
  async PUT(req, res) {
    const session = sessionStudent(req);
    if (!session) return res.status(401).json({ error: 'Not signed in.' });

    const { errors, values } = validate(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0] });
    if (typeof req.body.program === 'string') values.program = req.body.program.trim();

    try {
      const user = await students.updateProfile(session.id, values);
      if (!user) return res.status(404).json({ error: 'Account not found.' });
      const persistent = !!session.persistent;
      const token = sign({
        role: 'student', id: user.id, email: user.email, name: user.name,
        sso: !!session.sso, program: user.program || '', persistent,
      });
      sessionCookie(res, 'studentToken', token, persistent ? 2592000 : undefined, req);
      res.json({ user, persistent });
    } catch (err) {
      console.error('[student account update]', err);
      res.status(503).json({ error: 'Could not save your account right now.' });
    }
  },
});
