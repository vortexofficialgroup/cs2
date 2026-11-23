// api/ai/[action].js — single serverless function serving /api/ai/*
// (suggest, analyze, conflicts, agent, status). Handlers live in lib/routes/ai/
// so the project stays under the Vercel Hobby plan's 12-function limit.
const routes = {
  suggest:   () => require('../../lib/routes/ai/suggest'),
  analyze:   () => require('../../lib/routes/ai/analyze'),
  conflicts: () => require('../../lib/routes/ai/conflicts'),
  agent:     () => require('../../lib/routes/ai/agent'),
  'staff-agent': () => require('../../lib/routes/ai/staff-agent'),
  status:    () => require('../../lib/routes/ai/status'),
};

module.exports = function (req, res) {
  const load = Object.prototype.hasOwnProperty.call(routes, req.query.action) && routes[req.query.action];
  if (!load) return res.status(404).json({ error: 'Not found' });
  return load()(req, res);
};
