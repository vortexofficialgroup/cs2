// lib/supabase-state.js — server-side helpers for the shared Supabase state.
// Uses only Node's built-in fetch so no extra packages are needed on Vercel.

function config() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return { url: SUPABASE_URL.replace(/\/+$/, ''), key: SUPABASE_SERVICE_ROLE_KEY };
}

async function request(path, options = {}) {
  const cfg = config();
  if (!cfg) return null;
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }
  return response;
}

async function getPortalState() {
  const response = await request('portal_state?id=eq.main&select=data,updated_at', {
    headers: { Accept: 'application/json' },
  });
  if (!response) return null;
  const rows = await response.json();
  return rows.length ? rows[0].data : null;
}

// Microsoft sign-in rules are kept in shared settings so the admin can edit
// them in Settings → Staff Access without touching environment variables.
function microsoftRules(state) {
  const rules = (state && state.ps && state.ps.microsoftLogin) || {};
  return {
    enabled: rules.enabled !== false,
    domains: Array.isArray(rules.domains) ? rules.domains : [],
    defaultPermissions: Array.isArray(rules.defaultPermissions) ? rules.defaultPermissions : [],
    defaultCapabilities: Array.isArray(rules.defaultCapabilities) ? rules.defaultCapabilities : [],
  };
}

module.exports = { config, request, getPortalState, microsoftRules };
