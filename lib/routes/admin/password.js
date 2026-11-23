const handler = require('../../http');
const adminPassword = require('../../admin-password');
const { isSecureRequest, requireAdmin } = require('../../auth');

module.exports = handler({
  POST(req, res) {
    if (!requireAdmin(req, res)) return;
    const { currentPassword, newPassword } = req.body || {};
    if (!adminPassword.verify(currentPassword))
      return res.status(400).json({ error: 'Current password is incorrect.' });
    if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128)
      return res.status(400).json({ error: 'New password must be 10–128 characters.' });

    adminPassword.update(newPassword);
    const secure = isSecureRequest(req) ? '; Secure' : '';
    res.setHeader('Set-Cookie', `adminToken=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
    res.json({ updated: true });
  },
});
