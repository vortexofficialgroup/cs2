// api/admin/[action].js — single serverless function serving /api/admin/*
// (login, logout, password, staff, rooms, professors, schedule, announcements).
// Handlers live in lib/routes/admin/ so the project stays under the Vercel
// Hobby plan's 12-function limit. Modules load lazily, so login.js's
// production env check only runs for login requests.
const routes = {
  login:         () => require('../../lib/routes/admin/login'),
  logout:        () => require('../../lib/routes/admin/logout'),
  password:      () => require('../../lib/routes/admin/password'),
  staff:         () => require('../../lib/routes/admin/staff'),
  'sso-staff':   () => require('../../lib/routes/admin/sso-staff'),
  'access-log':  () => require('../../lib/routes/admin/access-log'),
  rooms:         () => require('../../lib/routes/admin/rooms'),
  professors:    () => require('../../lib/routes/admin/professors'),
  schedule:      () => require('../../lib/routes/admin/schedule'),
  announcements: () => require('../../lib/routes/admin/announcements'),
};

module.exports = function (req, res) {
  const load = Object.prototype.hasOwnProperty.call(routes, req.query.action) && routes[req.query.action];
  if (!load) return res.status(404).json({ error: 'Not found' });
  return load()(req, res);
};
