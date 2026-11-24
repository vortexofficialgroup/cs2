// api/announcements.js — GET /api/announcements
const handler = require('../lib/http');
const { requireSession } = require('../lib/auth');
const store   = require('../lib/store');

module.exports = handler({
  GET(req, res) {
    if (!requireSession(req, res)) return;
    const today = new Date().toISOString().split('T')[0];
    const all   = store.getAnnouncements();
    // Optionally filter to only active (not expired) via ?active=1
    const active = req.query.active === '1'
      ? all.filter(a => a.expires >= today)
      : all;
    res.json({ announcements: active });
  },
});
