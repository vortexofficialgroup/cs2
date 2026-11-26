// PUT /api/auth/setup — one-time staff choice of the professor they teach.
// Choosing an empty professor ("None") is valid and is remembered, so the
// choice is never asked again on later sign-ins.

const handler = require('../../http');
const { getUser, sign, sessionCookie } = require('../../auth');
const staffStore = require('../../staff-store');
const ssoStaff = require('../../sso-staff-store');

function cleanProfessor(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function publicUser(user) {
  return {
    role: 'staff',
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    title: user.title,
    linkedProfessor: user.linkedProfessor || '',
    setupComplete: !!user.setupComplete,
    permissions: user.permissions || [],
    aiActions: user.aiActions || [],
    photo: user.photo || '',
    status: user.status || '',
    sso: !!user.sso,
  };
}

module.exports = handler({
  async PUT(req, res) {
    const user = await getUser(req, res);
    if (!user) return;
    if (user.role !== 'staff')
      return res.status(400).json({ error: 'Only staff accounts use this setup.' });

    const linkedProfessor = cleanProfessor(req.body && req.body.linkedProfessor);
    if (linkedProfessor === null)
      return res.status(400).json({ error: 'Choose a professor or None.' });

    let updated;
    try {
      if (user.sso) {
        if (!ssoStaff.configured())
          return res.status(503).json({ error: 'Shared storage is not configured.' });
        const email = user.email || user.username;
        const current = (await ssoStaff.findByEmail(email)) || user;
        updated = await ssoStaff.save({
          email,
          displayName: current.displayName || user.displayName,
          title: current.title || user.title,
          permissions: current.permissions || user.permissions || [],
          aiActions: current.aiActions || user.aiActions || [],
          linkedProfessor,
          setupComplete: true,
          photo: current.photo || '',
          status: current.status || '',
        });
      } else {
        updated = await staffStore.update(user.id, { linkedProfessor, setupComplete: true });
      }
    } catch (err) {
      console.error('[staff setup]', err);
      return res.status(503).json({ error: 'Could not save your choice right now.' });
    }
    if (!updated) return res.status(404).json({ error: 'Account not found.' });

    const next = {
      ...user,
      linkedProfessor: updated.linkedProfessor || '',
      setupComplete: true,
      sso: !!user.sso,
    };
    const token = sign(next);
    sessionCookie(res, 'adminToken', token, 28800, req);
    res.json({ user: publicUser(next) });
  },
});
