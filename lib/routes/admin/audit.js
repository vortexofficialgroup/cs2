// Shared helper: record changes made through the admin API by staff accounts.
const { getUser } = require('../../auth');
const changeLog = require('../../change-log');
const rateLimit = require('../../rate-limit');

async function record(req, action, target, detail) {
  const user = getUser(req, null, { silent: true });
  if (!user || user.role !== 'staff') return;
  try {
    await changeLog.append({
      actorType: 'staff',
      actor: user.displayName || user.username || '',
      email: user.email || user.username || '',
      action,
      target: String(target || ''),
      detail: JSON.stringify(detail || {}),
      ok: true,
      ip: rateLimit.ip(req),
    });
  } catch (err) {
    console.error('[staff change log]', err);
  }
}

module.exports = { record };
