// lib/sso-staff-store.js — Microsoft (SSO) staff records in Supabase.
// These accounts are created on first sign-in and edited from Staff Access.

const { config, request } = require('./supabase-state');

function configured() {
  return !!config();
}

async function list() {
  if (!configured()) return [];
  const response = await request('sso_staff?select=*&order=display_name', {
    headers: { Accept: 'application/json' },
  });
  if (!response) return [];
  const rows = await response.json();
  return rows.map(row => ({
    id: row.email,
    email: row.email,
    displayName: row.display_name,
    title: row.title,
    permissions: row.permissions || [],
    aiActions: row.ai_actions || [],
    source: 'microsoft',
  }));
}

async function findByEmail(email) {
  if (!configured() || typeof email !== 'string') return null;
  const response = await request(`sso_staff?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`, {
    headers: { Accept: 'application/json' },
  });
  if (!response) return null;
  const rows = await response.json();
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.email,
    email: row.email,
    displayName: row.display_name,
    title: row.title,
    permissions: row.permissions || [],
    aiActions: row.ai_actions || [],
    source: 'microsoft',
  };
}

async function save({ email, displayName, title, permissions, aiActions }) {
  if (!configured()) throw new Error('Shared storage is not configured.');
  const record = {
    email: email.trim().toLowerCase(),
    display_name: displayName.trim(),
    title: title.trim(),
    permissions: [...new Set(permissions)],
    ai_actions: [...new Set(aiActions)],
  };
  await request('sso_staff?on_conflict=email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(record),
  });
  return findByEmail(record.email);
}

async function remove(email) {
  if (!configured()) return false;
  await request(`sso_staff?email=eq.${encodeURIComponent(String(email).toLowerCase())}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  return true;
}

module.exports = { configured, list, findByEmail, save, remove };
