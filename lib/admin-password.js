const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashPassword, verifyPassword } = require('./password-hash');
const { config: sharedConfig, request } = require('./supabase-state');

const STORE_FILE = process.env.ADMIN_PASSWORD_STORE_FILE || path.join(os.homedir(), '.ue-portal', 'admin-password.json');
const INITIAL_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';
const initialRecord = { ...hashPassword(INITIAL_PASSWORD), updatedAt: 0 };
const SHARED_KEY = 'adminPassword';

// The override used to live only in a local file. Vercel's filesystem is
// read-only, so the shared Supabase state is used when it is configured.
// The file remains as a local development fallback.
function usesSharedStore() {
  return !!sharedConfig();
}

function validRecord(record) {
  return record &&
    typeof record.salt === 'string' &&
    typeof record.passwordHash === 'string' &&
    Number.isFinite(record.updatedAt);
}

function readOverride() {
  try {
    const record = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if (!validRecord(record))
      throw new Error('Administrator password data is invalid.');
    return record;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readSharedOverride() {
  const response = await request('portal_state?id=eq.main&select=data', {
    headers: { Accept: 'application/json' },
  });
  if (!response) return null;
  const rows = await response.json();
  const record = rows.length && rows[0].data ? rows[0].data[SHARED_KEY] : null;
  return validRecord(record) ? record : null;
}

async function readRecord() {
  return usesSharedStore() ? readSharedOverride() : readOverride();
}

async function verify(password) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const record = (await readRecord()) || initialRecord;
  return verifyPassword(password, record.salt, record.passwordHash);
}

async function update(password) {
  const record = { ...hashPassword(password), updatedAt: Date.now() };
  if (usesSharedStore()) {
    await request('rpc/merge_portal_state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_patch: { [SHARED_KEY]: record } }),
    });
  } else {
    const dir = path.dirname(STORE_FILE);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tempFile = `${STORE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(record), { mode: 0o600 });
    fs.renameSync(tempFile, STORE_FILE);
  }
  return record.updatedAt;
}

async function changedAt() {
  const record = await readRecord();
  return record ? record.updatedAt : 0;
}

module.exports = { changedAt, update, verify };
