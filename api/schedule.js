// api/schedule.js — GET /api/schedule?day=1-5
const handler = require('../lib/http');
const { requireSession } = require('../lib/auth');
const store   = require('../lib/store');

module.exports = handler({
  GET(req, res) {
    if (!requireSession(req, res)) return;
    const day = req.query.day ? parseInt(req.query.day) : null;
    if (day !== null && (isNaN(day) || day < 1 || day > 5))
      return res.status(400).json({ error: 'day must be 1–5' });
    res.json({ schedule: store.getSchedule(day) });
  },
});
