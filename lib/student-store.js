// lib/student-store.js — student accounts for the public portal.
// Uses Supabase when configured, with a local JSON fallback for development.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashPassword, verifyPassword } = require('./password-hash');
const { config, request } = require('./supabase-state');

const STORE_FILE = process.env.STUDENT_STORE_FILE || path.join(os.homedir(), '.ue-portal', 'student-users.json');

function configured() { return !!config(); }

function readLocal() {
  try {
    const users = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return Array.isArray(users) ? users : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function writeLocal(users) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true, mode: 0o700 });
  const temp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(temp, STORE_FILE);
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

function fromRow(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    salt: row.salt,
    passwordHash: row.password_hash,
  };
}

async function register({ name, email, password }) {
  const normalized = email.trim().toLowerCase();
  const record = { id: crypto.randomUUID(), email: normalized, name: name.trim(), ...hashPassword(password) };

  if (configured()) {
    const response = await request('student_users?on_conflict=email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore,return=representation' },
      body: JSON.stringify({
        id: record.id, email: record.email, name: record.name,
        salt: record.salt, password_hash: record.passwordHash,
      }),
    });
    const rows = await response.json();
    return rows.length ? publicUser(fromRow(rows[0])) : null;
  }

  const users = readLocal();
  if (users.some(user => user.email === normalized)) return null;
  users.push(record);
  writeLocal(users);
  return publicUser(record);
}

async function authenticate(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  let user;
  if (configured()) {
    const response = await request(`student_users?email=eq.${encodeURIComponent(normalized)}&select=*`, {
      headers: { Accept: 'application/json' },
    });
    const rows = await response.json();
    user = rows.length ? fromRow(rows[0]) : null;
  } else {
    user = readLocal().find(item => item.email === normalized) || null;
  }
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) return null;
  return publicUser(user);
}

async function findById(id) {
  if (typeof id !== 'string') return null;
  let user;
  if (configured()) {
    const response = await request(`student_users?id=eq.${encodeURIComponent(id)}&select=*`, {
      headers: { Accept: 'application/json' },
    });
    const rows = await response.json();
    user = rows.length ? fromRow(rows[0]) : null;
  } else {
    user = readLocal().find(item => item.id === id) || null;
  }
  return user ? publicUser(user) : null;
}

async function findByEmail(email) {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (configured()) {
    const response = await request(`student_users?email=eq.${encodeURIComponent(normalized)}&select=*`, {
      headers: { Accept: 'application/json' },
    });
    const rows = await response.json();
    return rows.length ? publicUser(fromRow(rows[0])) : null;
  }
  const user = readLocal().find(item => item.email === normalized);
  return user ? publicUser(user) : null;
}

// Microsoft/SSO students have no portal password. Store a random password hash
// so the account cannot be taken over through the normal password login.
async function upsertSso({ email, name }) {
  const normalized = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))
    throw new Error('Enter a valid email address.');

  const record = {
    id: crypto.randomUUID(),
    email: normalized,
    name: String(name || normalized.split('@')[0]).trim(),
    ...hashPassword(crypto.randomBytes(32).toString('hex')),
  };

  if (configured()) {
    const response = await request('student_users?on_conflict=email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore,return=representation' },
      body: JSON.stringify({
        id: record.id, email: record.email, name: record.name,
        salt: record.salt, password_hash: record.passwordHash,
      }),
    });
    const rows = await response.json();
    if (rows.length) return publicUser(fromRow(rows[0]));
    return findByEmail(normalized) || publicUser(record);
  }

  const users = readLocal();
  const existing = users.find(user => user.email === normalized);
  if (existing) {
    if (record.name && existing.name !== record.name) {
      existing.name = record.name;
      writeLocal(users);
    }
    return publicUser(existing);
  }
  users.push(record);
  writeLocal(users);
  return publicUser(record);
}

module.exports = { configured, register, authenticate, findById, findByEmail, upsertSso };
