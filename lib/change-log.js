// lib/change-log.js — append-only record of changes made by staff accounts.
// Stored in Supabase when configured, with a local JSON fallback for dev.
// Shown to administrators in Settings → Staff → Staff Change Log.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { config, request } = require('./supabase-state');

const STORE_FILE = process.env.CHANGE_LOG_FILE || path.join(os.homedir(), '.ue-portal', 'change-log.json');
const MAX_LOCAL = 500;

// Only actions that actually change shared data are recorded.
const CHANGE_ACTIONS = new Set([
  'create_entry', 'update_entry', 'delete_entry', 'delete_multiple',
  'create_room', 'update_room', 'delete_room',
  'create_professor', 'update_professor', 'delete_professor',
  'create_announcement', 'delete_announcement',
]);

function configured() { return !!config(); }
function isChange(action) { return CHANGE_ACTIONS.has(action); }

function readLocal() {
  try {
    const rows = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function writeLocal(rows) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true, mode: 0o700 });
  const temp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(rows.slice(0, MAX_LOCAL), null, 2), { mode: 0o600 });
  fs.renameSync(temp, STORE_FILE);
}

function normalize(entry) {
  return {
    id: entry.id || crypto.randomUUID(),
    at: entry.at || new Date().toISOString(),
    actorType: String(entry.actorType || 'staff').slice(0, 32),
    actor: String(entry.actor || '').slice(0, 120),
    email: String(entry.email || '').toLowerCase().slice(0, 200),
    action: String(entry.action || '').slice(0, 60),
    target: String(entry.target || '').slice(0, 200),
    detail: String(entry.detail || '').slice(0, 1200),
    ok: !!entry.ok,
    ip: String(entry.ip || '').slice(0, 80),
  };
}

async function append(entry) {
  const row = normalize(entry);
  if (configured()) {
    try {
      await request('change_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: row.id,
          at: row.at,
          actor_type: row.actorType,
          actor: row.actor,
          email: row.email,
          action: row.action,
          target: row.target,
          detail: row.detail,
          ok: row.ok,
          ip: row.ip,
        }),
      });
    } catch (err) {
      console.error('[change-log append]', err.message);
    }
    return;
  }
  const rows = readLocal();
  rows.unshift(row);
  writeLocal(rows);
}

async function list(limit = 100) {
  const max = Math.max(1, Math.min(500, Number(limit) || 100));
  if (configured()) {
    try {
      const res = await request(`change_log?select=*&order=at.desc&limit=${max}`, {
        headers: { Accept: 'application/json' },
      });
      const rows = await res.json();
      return rows.map(r => ({
        id: r.id, at: r.at, actorType: r.actor_type, actor: r.actor || '',
        email: r.email || '', action: r.action || '', target: r.target || '',
        detail: r.detail || '', ok: !!r.ok, ip: r.ip || '',
      }));
    } catch (err) {
      console.error('[change-log list]', err.message);
      return [];
    }
  }
  return readLocal().slice(0, max);
}

module.exports = { append, list, configured, isChange, CHANGE_ACTIONS };
