// api/student/[action].js — /api/student/register | login | me | microsoft
const route = require('../../lib/routes/student/auth');
const microsoft = require('../../lib/routes/student/microsoft');

module.exports = function (req, res) {
  const action = req.query.action;
  if (action === 'microsoft') return microsoft(req, res);
  if (!['register', 'login', 'me'].includes(action))
    return res.status(404).json({ error: 'Not found' });
  return route(req, res);
};
