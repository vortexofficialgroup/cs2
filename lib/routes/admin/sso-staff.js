// Admin management for Microsoft-signed-in staff/professors.

const handler = require('../../http');
const { requireAdmin } = require('../../auth');
const ssoStaff = require('../../sso-staff-store');
const { PERMISSIONS } = require('../../staff-store');
const { normalize: normalizeCapabilities } = require('../../ai-capabilities');

function validList(value, allowed) {
  return Array.isArray(value) && value.every(item => allowed.includes(item));
}

module.exports = handler({
  async GET(req, res) {
    if (!await requireAdmin(req, res)) return;
    try {
      res.json({ staff: await ssoStaff.list(), configured: ssoStaff.configured() });
    } catch (err) {
      console.error('[sso staff list]', err);
      res.status(503).json({ error: 'Could not load Microsoft staff accounts.' });
    }
  },

  async PUT(req, res) {
    if (!await requireAdmin(req, res)) return;
    const { email, displayName, title, permissions, aiActions, linkedProfessor } = req.body || {};
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return res.status(400).json({ error: 'A valid Microsoft email is required.' });
    if (typeof displayName !== 'string' || displayName.trim().length < 2)
      return res.status(400).json({ error: 'Enter the staff member’s name.' });
    if (!validList(permissions, PERMISSIONS))
      return res.status(400).json({ error: 'Select valid staff permissions.' });
    try {
      const staff = await ssoStaff.save({
        email,
        displayName,
        title: typeof title === 'string' && title.trim() ? title : 'Staff',
        linkedProfessor: typeof linkedProfessor === 'string' ? linkedProfessor : '',
        // Admin made the choice, so no first-login prompt is needed.
        setupComplete: true,
        permissions,
        aiActions: normalizeCapabilities(aiActions),
      });
      res.json({ staff });
    } catch (err) {
      console.error('[sso staff save]', err);
      res.status(503).json({ error: 'Could not save the Microsoft staff account.' });
    }
  },

  async DELETE(req, res) {
    if (!await requireAdmin(req, res)) return;
    if (typeof req.query.email !== 'string')
      return res.status(400).json({ error: 'An email is required.' });
    try {
      await ssoStaff.remove(req.query.email);
      res.json({ deleted: true });
    } catch (err) {
      console.error('[sso staff delete]', err);
      res.status(503).json({ error: 'Could not remove the Microsoft staff account.' });
    }
  },
});
