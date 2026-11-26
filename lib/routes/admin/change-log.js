// GET /api/admin/change-log — admin-only record of staff changes.
const handler = require('../../http');
const { requireAdmin } = require('../../auth');
const changeLog = require('../../change-log');

module.exports = handler({
  async GET(req, res) {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    const rows = await changeLog.list(limit);
    res.json({ rows, configured: changeLog.configured() });
  },
});
