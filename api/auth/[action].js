// api/auth/[action].js — single serverless function for /api/auth/*
// Keeps the project under Vercel's function limit.
const routes = {
  config: () => require('../../lib/routes/auth/config'),
  microsoft: () => require('../../lib/routes/auth/microsoft'),
  session: () => require('../../lib/routes/auth/session'),
  account: () => require('../../lib/routes/auth/account'),
  setup:   () => require('../../lib/routes/auth/setup'),
};

module.exports = function (req, res) {
  const load = Object.prototype.hasOwnProperty.call(routes, req.query.action) && routes[req.query.action];
  if (!load) return res.status(404).json({ error: 'Not found' });
  return load()(req, res);
};
