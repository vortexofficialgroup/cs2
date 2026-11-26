// api/admin/announcements.js — POST / DELETE /api/admin/announcements
const handler           = require('../../http');
const { validate }      = require('../../http');
const store             = require('../../store');
const { requirePermission } = require('../../auth');
const audit = require('./audit');

const RULES = {
  title:   { required: true, min: 3 },
  msg:     { required: true, min: 5 },
  type:    { required: true, in: ['info', 'warning', 'urgent'] },
  expires: { required: true },
};

module.exports = handler({
  // GET /api/admin/announcements — all announcements (active + expired)
  async GET(req, res) {
    if (!await requirePermission(req, res, 'announcements')) return;
    res.json({ announcements: store.getAnnouncements() });
  },

  // POST /api/admin/announcements — create an announcement
  async POST(req, res) {
    if (!await requirePermission(req, res, 'announcements')) return;
    const errors = validate(req.body, RULES);
    if (errors) return res.status(400).json({ errors });

    const today = new Date().toISOString().split('T')[0];
    if (req.body.expires < today)
      return res.status(400).json({ error: 'Expiry date must be today or in the future.' });

    const ann = store.addAnnouncement({
      title:   String(req.body.title),
      msg:     String(req.body.msg),
      type:    String(req.body.type),
      expires: String(req.body.expires),
    });
    await audit.record(req, 'create_announcement', ann && ann.id, req.body);
    res.status(201).json({ announcement: ann });
  },

  // DELETE /api/admin/announcements?id=1 — remove an announcement
  async DELETE(req, res) {
    if (!await requirePermission(req, res, 'announcements')) return;
    const id = parseInt(req.query.id);
    if (!id) return res.status(400).json({ error: 'id query param required' });
    const ok = store.deleteAnnouncement(id);
    if (!ok) return res.status(404).json({ error: 'Announcement not found' });
    await audit.record(req, 'delete_announcement', id, req.query);
    res.json({ deleted: true, id });
  },
});
