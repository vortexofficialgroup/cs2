const handler = require('../../http');
const adminPassword = require('../../admin-password');
const { sessionCookie, requireAdmin } = require('../../auth');

module.exports = handler({
  async POST(req, res) {
    if (!await requireAdmin(req, res)) return;
    const { currentPassword, newPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128)
      return res.status(400).json({ error: 'New password must be 10–128 characters.' });

    let currentOk;
    try {
      currentOk = await adminPassword.verify(currentPassword);
    } catch (err) {
      console.error('[admin password verify]', err);
      return res.status(503).json({ error: 'Could not check the current password right now.' });
    }
    if (!currentOk)
      return res.status(400).json({ error: 'Current password is incorrect.' });

    try {
      await adminPassword.update(newPassword);
    } catch (err) {
      console.error('[admin password update]', err);
      return res.status(503).json({ error: 'Could not save the new password right now.' });
    }
    sessionCookie(res, 'adminToken', '', 0, req);
    res.json({ updated: true });
  },
});
