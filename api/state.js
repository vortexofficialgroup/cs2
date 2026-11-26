// api/state.js — GET / PUT shared portal state
const handler = require('../lib/http');
const { requireAdmin, requirePermission, getUser } = require('../lib/auth');
const changeLog = require('../lib/change-log');
const rateLimit = require('../lib/rate-limit');

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

function summarize(body) {
  const out = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (Array.isArray(value))
      out[key] = { count: value.length, ids: value.slice(0, 20).map(item => item && (item.id ?? item.code ?? item.name ?? '')) };
    else out[key] = Object.keys(value || {});
  }
  return out;
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
    const user = await getUser(req, null, { silent: true });
    if (user && user.role === 'admin') return res.json({ state, updatedAt });
    const publicState = state && typeof state === 'object' ? { ...state } : null;
    if (publicState) {
      // Private settings and staff password hashes must never be public.
      delete publicState.ps;
      delete publicState.staffUsers;
      delete publicState.adminPassword;
    }
    return res.json({ state: publicState, updatedAt });
  },

  async PUT(req, res) {
    const config = storageConfig(res);
    if (!config) return;

    const section = SECTIONS[req.query.section];
    if (!section) return res.status(400).json({ error: 'A valid state section is required.' });
    if (section.adminOnly ? !await requireAdmin(req, res) : !await requirePermission(req, res, section.permission)) return;

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

    // Staff edits made in the admin tabs are recorded for the administrator.
    const user = await getUser(req, null, { silent: true });
    if (user && user.role === 'staff') {
      try {
        await changeLog.append({
          actorType: 'staff',
          actor: user.displayName || user.username || '',
          email: user.email || user.username || '',
          action: 'edit_' + String(req.query.section || 'state'),
          target: String(req.query.section || ''),
          detail: JSON.stringify(summarize(body)),
          ok: true,
          ip: rateLimit.ip(req),
        });
      } catch (err) {
        console.error('[staff change log]', err);
      }
    }
    res.json({ saved: true });
  },
});
