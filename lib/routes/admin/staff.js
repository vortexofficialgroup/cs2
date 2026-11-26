const handler = require('../../http');
const { requireAdmin } = require('../../auth');
const staffStore = require('../../staff-store');

const ALLOWED_PERMISSIONS = new Set(staffStore.PERMISSIONS);
const { normalize: normalizeCapabilities } = require('../../ai-capabilities');

module.exports = handler({
  async GET(req, res) {
    if (!await requireAdmin(req, res)) return;
    try {
      res.json({ staff: await staffStore.list() });
    } catch (err) {
      console.error('[staff list]', err);
      res.status(503).json({ error: 'Could not load staff accounts right now.' });
    }
  },

  async POST(req, res) {
    if (!await requireAdmin(req, res)) return;
    const { username, displayName, title, password, permissions, aiActions, linkedProfessor } = req.body || {};
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

    let staff;
    try {
      staff = await staffStore.create({
        username, displayName, title, password,
        linkedProfessor: typeof linkedProfessor === 'string' ? linkedProfessor : '',
        // The administrator makes the choice here, so staff are not prompted again.
        setupComplete: true,
        permissions: [...new Set(permissions)],
        aiActions: normalizeCapabilities(aiActions),
      });
    } catch (err) {
      console.error('[staff create]', err);
      return res.status(503).json({ error: 'Could not save the staff account right now.' });
    }
    if (!staff) return res.status(409).json({ error: 'That username is already in use.' });
    res.status(201).json({ staff });
  },

  async PUT(req, res) {
    if (!await requireAdmin(req, res)) return;
    const { id, permissions, aiActions, linkedProfessor } = req.body || {};
    if (typeof id !== 'string' ||
        !Array.isArray(permissions) || permissions.some(permission => !ALLOWED_PERMISSIONS.has(permission)))
      return res.status(400).json({ error: 'A valid staff ID and permissions are required.' });
    let staff;
    try {
      staff = await staffStore.update(id, {
        setupComplete: true,
        permissions: [...new Set(permissions)],
        aiActions: normalizeCapabilities(aiActions),
        linkedProfessor: typeof linkedProfessor === 'string' ? linkedProfessor : undefined,
      });
    } catch (err) {
      console.error('[staff update]', err);
      return res.status(503).json({ error: 'Could not save the staff account right now.' });
    }
    if (!staff) return res.status(404).json({ error: 'Staff account not found.' });
    res.json({ staff });
  },

  async DELETE(req, res) {
    if (!await requireAdmin(req, res)) return;
    if (typeof req.query.id !== 'string') return res.status(404).json({ error: 'Staff account not found.' });
    try {
      if (!await staffStore.remove(req.query.id))
        return res.status(404).json({ error: 'Staff account not found.' });
    } catch (err) {
      console.error('[staff delete]', err);
      return res.status(503).json({ error: 'Could not remove the staff account right now.' });
    }
    res.json({ deleted: true });
  },
});
