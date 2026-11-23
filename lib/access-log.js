// lib/access-log.js — append-only student/staff sign-in log in Supabase.
// Falls back to local JSON for dev when Supabase is not configured.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { config, request } = require('./supabase-state');

const STORE_FILE = process.env.ACCESS_LOG_FILE || path.join(os.homedir(), '.ue-portal', 'access-log.json');
const MAX_LOCAL = 500;

function configured() { return !!config(); }

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
    actorType: String(entry.actorType || 'student').slice(0, 32),
    email: String(entry.email || '').toLowerCase().slice(0, 200),
    name: String(entry.name || '').slice(0, 120),
    method: String(entry.method || '').slice(0, 40),
    ok: !!entry.ok,
    reason: String(entry.reason || '').slice(0, 300),
    ip: String(entry.ip || '').slice(0, 80),
  };
}

async function append(entry) {
  const row = normalize(entry);
  if (configured()) {
    try {
      await request('access_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: row.id,
          at: row.at,
          actor_type: row.actorType,
          email: row.email,
          name: row.name,
          method: row.method,
          ok: row.ok,
          reason: row.reason,
          ip: row.ip,
        }),
      });
    } catch (err) {
      console.error('[access-log append]', err.message);
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
      const res = await request(`access_log?select=*&order=at.desc&limit=${max}`, {
        headers: { Accept: 'application/json' },
      });
      const rows = await res.json();
      return rows.map(r => ({
        id: r.id, at: r.at, actorType: r.actor_type, email: r.email,
        name: r.name, method: r.method, ok: !!r.ok, reason: r.reason || '', ip: r.ip || '',
      }));
    } catch (err) {
      console.error('[access-log list]', err.message);
      return [];
    }
  }
  return readLocal().slice(0, max);
}

module.exports = { append, list, configured };
