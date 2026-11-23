// lib/staff-chat-config.js — admin-configured capabilities of the staff chatbot.
// The allowlist lives in shared portal state (settings.ps.staffChatActions), so
// it is saved by the admin Settings tab and read server-side on every request.

const agent = require('./routes/ai/agent');

const DEFAULT_ACTIONS = ['query', 'find_substitute', 'check_capacity'];
const CACHE_MS = 30 * 1000;

let cached = null;
let cachedAt = 0;

function supabaseConfig() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return { url: SUPABASE_URL.replace(/\/+$/, ''), key: SUPABASE_SERVICE_ROLE_KEY };
}

async function getAllowedActions() {
  const config = supabaseConfig();
  if (!config) return DEFAULT_ACTIONS;
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;

  const response = await fetch(
    `${config.url}/rest/v1/portal_state?id=eq.main&select=data`,
    { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` } },
  );
  if (!response.ok) throw new Error(`Could not load chatbot settings (${response.status}).`);
  const rows = await response.json();
  const configured = rows[0]?.data?.ps?.staffChatActions;
  cached = Array.isArray(configured)
    ? [...new Set(configured.filter(action => agent.VALID_ACTIONS.has(action) && action !== 'none'))]
    : DEFAULT_ACTIONS;
  cachedAt = Date.now();
  return cached;
}

module.exports = { DEFAULT_ACTIONS, getAllowedActions };
