// PUT /api/auth/account — staff photo / name / status.
const handler = require('../../http');
const { getUser, sign, isSecureRequest } = require('../../auth');
const staffStore = require('../../staff-store');
const ssoStaff = require('../../sso-staff-store');
const { validate } = require('../../profile-fields');

function publicUser(user) {
  return {
    role: user.role,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    title: user.title,
    permissions: user.permissions || [],
    aiActions: user.aiActions || [],
    linkedProfessor: user.linkedProfessor || '',
    setupComplete: !!user.setupComplete,
    photo: user.photo || '',
    status: user.status || '',
    sso: !!user.sso,
  };
}

module.exports = handler({
  async PUT(req, res) {
    const user = getUser(req, res);
    if (!user) return;
    if (user.role === 'admin')
      return res.status(400).json({ error: 'Administrator details are managed in Settings.' });

    const { errors, values } = validate(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0] });

    let updated;
    try {
      if (user.sso) {
        updated = await ssoStaff.updateProfile(user.email || user.username, {
          displayName: values.name,
          status: values.status,
          photo: values.photo,
        });
      } else {
        updated = staffStore.update(user.id, {
          displayName: values.name,
          status: values.status,
          photo: values.photo,
        });
      }
    } catch (err) {
      console.error('[staff account update]', err);
      return res.status(503).json({ error: 'Could not save your account right now.' });
    }
    if (!updated) return res.status(404).json({ error: 'Account not found.' });

    const next = {
      ...user,
      displayName: updated.displayName,
      title: updated.title || user.title,
      permissions: updated.permissions || user.permissions || [],
      aiActions: updated.aiActions || user.aiActions || [],
      linkedProfessor: updated.linkedProfessor || user.linkedProfessor || '',
      setupComplete: !!(updated.setupComplete || user.setupComplete),
      photo: updated.photo || '',
      status: updated.status || '',
      sso: !!user.sso,
    };
    const token = sign(next);
    const secure = isSecureRequest(req) ? '; Secure' : '';
    res.setHeader('Set-Cookie', `adminToken=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
    res.json({ user: publicUser(next) });
  },
});
