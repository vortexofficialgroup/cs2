const handler = require('../../http');
const validate = require('../../http').validate;
const store = require('../../store');
const { requirePermission } = require('../../auth');
const audit = require('./audit');

const RULES = {
  day:       { required: true, in: [1,2,3,4,5] },
  start:     { required: true },
  end:       { required: true },
  roomId:    { required: true },
  course:    { required: true, min: 3 },
  code:      { required: true, min: 3 },
  professor: { required: true },
  program:   { required: true },
};

module.exports = handler({
  async POST(req, res) {
    if (!requirePermission(req, res, 'schedule')) return;
    const errors = validate(req.body, RULES);
    if (errors) return res.status(400).json({ errors });

    const { day, start, end, roomId, course, code, professor, program, semester } = req.body;
    if (store.hasConflict(roomId, day, start, end))
      return res.status(409).json({ error: `Room ${roomId} has a scheduling conflict at that time.` });

    const entry = store.addEntry({ day, start, end, roomId, course, code, professor, program, semester });
    await audit.record(req, 'create_entry', entry && entry.id, req.body);
    res.status(201).json({ entry });
  },

  async PUT(req, res) {
    if (!requirePermission(req, res, 'schedule')) return;
    const id = parseInt(req.query.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const errors = validate(req.body, RULES);
    if (errors) return res.status(400).json({ errors });

    const { day, start, end, roomId } = req.body;
    if (store.hasConflict(roomId, day, start, end, id))
      return res.status(409).json({ error: `Room ${roomId} has a scheduling conflict.` });

    const updated = store.updateEntry(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    await audit.record(req, 'update_entry', id, req.body);
    res.json({ entry: updated });
  },

  async DELETE(req, res) {
    if (!requirePermission(req, res, 'schedule')) return;
    const id = parseInt(req.query.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const ok = store.deleteEntry(id);
    if (!ok) return res.status(404).json({ error: 'Entry not found' });
    await audit.record(req, 'delete_entry', id, req.query);
    res.json({ deleted: true });
  },
});
