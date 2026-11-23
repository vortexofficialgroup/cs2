// GET /api/auth/session — returns the admin/staff session from the secure cookie.
const handler = require('../../http');
const { getUser } = require('../../auth');

module.exports = handler({
  GET(req, res) {
    const user = getUser(req, res);
    if (!user) return;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ user: {
      role: user.role,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      title: user.title,
      linkedProfessor: user.linkedProfessor || '',
      permissions: user.permissions || [],
      aiActions: user.aiActions || [],
      photo: user.photo || '',
      status: user.status || '',
    } });
  },
});
