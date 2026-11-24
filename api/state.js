// api/state.js — GET / PUT shared portal state
const handler = require('../lib/http');
const { requireAdmin, requirePermission, getUser, requireSession } = require('../lib/auth');

const SECTIONS = {
  rooms: { keys: ['rm', 'ro', 'rp', 'rooms'], permission: 'rooms' },
  schedule: { keys: ['sc', 'su', 'ni'], permission: 'schedule' },
  announcements: { keys: ['an', 'ni'], permission: 'announcements' },
  professors: { keys: ['pr', 'ni'], permission: 'professors' },
  settings: { keys: ['ps'], adminOnly: true },
  all: { keys: ['rm', 'ro', 'rp', 'rooms', 'sc', 'an', 'pr', 'su', 'ps', 'ni'], adminOnly: true },
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidValue(key, value) {
  if (key === 'ni') return Number.isInteger(value) && value >= 0;
  if (['rm', 'ro', 'rp', 'ps'].includes(key)) return isObject(value);
  return Array.isArray(value);
}

function storageConfig(res) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ error: 'Shared storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
    return null;
  }
  return {
    url: SUPABASE_URL.replace(/\/+$/, ''),
    key: SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabaseRequest(config, path, options) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      ...(options && options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }
  return response;
}

module.exports = handler({
  async GET(req, res) {
    // Campus data is for signed-in members only (student, staff or admin).
    const session = requireSession(req, res);
    if (!session) return;
    const config = storageConfig(res);
    if (!config) return;
    const query = new URLSearchParams({ id: 'eq.main', select: 'data,updated_at' });
    if (req.query.since) query.set('updated_at', `gt.${req.query.since}`);
    const response = await supabaseRequest(config, `portal_state?${query}`, {
      headers: { Accept: 'application/json' },
    });
    const rows = await response.json();
    res.setHeader('Cache-Control', 'no-store');
    if (!rows.length && req.query.since) return res.json({ notModified: true });
    const state = rows.length ? rows[0].data : null;
    const updatedAt = rows.length ? rows[0].updated_at : null;

    // Public portal only needs operational data. Admin settings stay admin-only.
    if (session.role === 'admin') return res.json({ state, updatedAt });
    const publicState = state && typeof state === 'object' ? { ...state } : null;
    if (publicState && Object.prototype.hasOwnProperty.call(publicState, 'ps')) delete publicState.ps;
    // Students only need professor names/departments, never personal contact details.
    if (publicState && session.role === 'student' && Array.isArray(publicState.pr)) {
      publicState.pr = publicState.pr.map(p => ({ id: p.id, name: p.name, dept: p.dept }));
    }
    return res.json({ state: publicState, updatedAt });
  },

  async PUT(req, res) {
    const config = storageConfig(res);
    if (!config) return;

    const section = SECTIONS[req.query.section];
    if (!section) return res.status(400).json({ error: 'A valid state section is required.' });
    if (section.adminOnly ? !requireAdmin(req, res) : !requirePermission(req, res, section.permission)) return;

    const body = isObject(req.body) ? req.body : {};
    const patch = {};
    for (const key of section.keys) {
      if (!Object.prototype.hasOwnProperty.call(body, key) || !isValidValue(key, body[key])) {
        return res.status(400).json({ error: `Invalid shared state field: ${key}` });
      }
      patch[key] = body[key];
    }

    await supabaseRequest(config, 'rpc/merge_portal_state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_patch: patch }),
    });
    res.json({ saved: true });
  },
});
