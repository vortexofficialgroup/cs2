// api/admin/professors.js — GET / POST / PUT / DELETE /api/admin/professors
const handler           = require('../../http');
const { validate }      = require('../../http');
const store             = require('../../store');
const { requirePermission } = require('../../auth');
const audit = require('./audit');

const RULES = {
  name: { required: true, min: 2 },
};

module.exports = handler({
  // GET /api/admin/professors — list all professors with weekly hours
  GET(req, res) {
    if (!requirePermission(req, res, 'professors')) return;
    const schedule = store.getSchedule();
    const t2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    const professors = store.getProfessors().map(p => {
      const entries  = schedule.filter(s => s.professor === p.name);
      const courses  = [...new Set(entries.map(s => s.code))];
      const hoursWk  = entries.reduce((acc, s) => acc + (t2m(s.end) - t2m(s.start)) / 60, 0);
      return { ...p, courses, hoursPerWeek: Math.round(hoursWk * 10) / 10 };
    });
    res.json({ professors });
  },

  // POST /api/admin/professors — add a professor
  async POST(req, res) {
    if (!requirePermission(req, res, 'professors')) return;
    const errors = validate(req.body, RULES);
    if (errors) return res.status(400).json({ errors });

    const { name, dept, email, phone } = req.body;

    if (store.getProfessors().some(p => p.name.toLowerCase() === String(name).toLowerCase()))
      return res.status(409).json({ error: 'A professor with that name already exists.' });

    const prof = store.addProfessor({ name, dept: dept || '', email: email || '', phone: phone || '' });
    await audit.record(req, 'create_professor', prof && prof.id, req.body);
    res.status(201).json({ professor: prof });
  },

  // PUT /api/admin/professors?id=3 — update a professor
  async PUT(req, res) {
    if (!requirePermission(req, res, 'professors')) return;
    const id = parseInt(req.query.id);
    if (!id) return res.status(400).json({ error: 'id query param required' });

    const patch = {};
    const b = req.body;
    if (b.name  !== undefined) patch.name  = String(b.name);
    if (b.dept  !== undefined) patch.dept  = String(b.dept);
    if (b.email !== undefined) patch.email = String(b.email);
    if (b.phone !== undefined) patch.phone = String(b.phone);

    const updated = store.updateProfessor(id, patch);
    if (!updated) return res.status(404).json({ error: 'Professor not found' });
    await audit.record(req, 'update_professor', id, patch);
    res.json({ professor: updated });
  },

  // DELETE /api/admin/professors?id=3 — remove a professor
  async DELETE(req, res) {
    if (!requirePermission(req, res, 'professors')) return;
    const id = parseInt(req.query.id);
    if (!id) return res.status(400).json({ error: 'id query param required' });
    const ok = store.deleteProfessor(id);
    if (!ok) return res.status(404).json({ error: 'Professor not found' });
    await audit.record(req, 'delete_professor', id, req.query);
    res.json({ deleted: true, id });
  },
});
