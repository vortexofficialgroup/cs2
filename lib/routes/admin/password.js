const handler = require('../../http');
const adminPassword = require('../../admin-password');
const { sessionCookie, requireAdmin } = require('../../auth');

module.exports = handler({
  POST(req, res) {
    if (!requireAdmin(req, res)) return;
    const { currentPassword, newPassword } = req.body || {};
    if (!adminPassword.verify(currentPassword))
      return res.status(400).json({ error: 'Current password is incorrect.' });
    if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128)
      return res.status(400).json({ error: 'New password must be 10–128 characters.' });

    adminPassword.update(newPassword);
    sessionCookie(res, 'adminToken', '', 0, req);
    res.json({ updated: true });
  },
});
