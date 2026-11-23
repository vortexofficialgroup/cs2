// GET /api/admin/access-log — admin-only sign-in/audit log.
const handler = require('../../http');
const { requireAdmin } = require('../../auth');
const accessLog = require('../../access-log');

module.exports = handler({
  async GET(req, res) {
    if (!requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    const rows = await accessLog.list(limit);
    res.json({ rows, configured: accessLog.configured() });
  },
});
