const handler = require('../../http');
const { requireAdmin } = require('../../auth');
const staffStore = require('../../staff-store');

const ALLOWED_PERMISSIONS = new Set(staffStore.PERMISSIONS);
const { normalize: normalizeCapabilities } = require('../../ai-capabilities');

module.exports = handler({
  GET(req, res) {
    if (!requireAdmin(req, res)) return;
    res.json({ staff: staffStore.list() });
  },

  POST(req, res) {
    if (!requireAdmin(req, res)) return;
    const { username, displayName, title, password, permissions, aiActions } = req.body || {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9._-]{3,32}$/.test(username.trim()))
      return res.status(400).json({ error: 'Username must be 3–32 letters, numbers, dots, underscores or hyphens.' });
    if (typeof displayName !== 'string' || displayName.trim().length < 2)
      return res.status(400).json({ error: 'Enter the staff member’s name.' });
    if (typeof title !== 'string' || title.trim().length < 2)
      return res.status(400).json({ error: 'Enter the staff member’s role or title.' });
    if (typeof password !== 'string' || password.length < 10 || password.length > 128)
      return res.status(400).json({ error: 'Password must be 10–128 characters.' });
    if (!Array.isArray(permissions) || permissions.length === 0 || permissions.some(permission => !ALLOWED_PERMISSIONS.has(permission)))
      return res.status(400).json({ error: 'Select at least one valid permission.' });

    const staff = staffStore.create({
      username, displayName, title, password,
      permissions: [...new Set(permissions)],
      aiActions: normalizeCapabilities(aiActions),
    });
    if (!staff) return res.status(409).json({ error: 'That username is already in use.' });
    res.status(201).json({ staff });
  },

  PUT(req, res) {
    if (!requireAdmin(req, res)) return;
    const { id, permissions, aiActions } = req.body || {};
    if (typeof id !== 'string' ||
        !Array.isArray(permissions) || permissions.some(permission => !ALLOWED_PERMISSIONS.has(permission)))
      return res.status(400).json({ error: 'A valid staff ID and permissions are required.' });
    const staff = staffStore.update(id, {
      permissions: [...new Set(permissions)],
      aiActions: normalizeCapabilities(aiActions),
    });
    if (!staff) return res.status(404).json({ error: 'Staff account not found.' });
    res.json({ staff });
  },

  DELETE(req, res) {
    if (!requireAdmin(req, res)) return;
    if (typeof req.query.id !== 'string' || !staffStore.remove(req.query.id))
      return res.status(404).json({ error: 'Staff account not found.' });
    res.json({ deleted: true });
  },
});
