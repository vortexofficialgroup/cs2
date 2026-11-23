// lib/microsoft-identity.js — shared helpers for Microsoft/Supabase sign-in.

const { config, getPortalState, microsoftRules } = require('./supabase-state');

function apiError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function allowedByDomain(email, domains) {
  const normalized = String(email).trim().toLowerCase();
  return (Array.isArray(domains) ? domains : []).some(domain => {
    const d = String(domain).trim().toLowerCase().replace(/^@/, '');
    return !!d && (normalized.endsWith(`@${d}`) || normalized === d);
  });
}

async function verifyAccessToken(accessToken) {
  const cfg = config();
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!cfg || !anonKey)
    throw apiError(503, 'Microsoft sign-in is not configured on the server.');

  let response;
  try {
    response = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.error('[microsoft verify]', err);
    throw apiError(503, 'Could not verify the Microsoft sign-in right now.');
  }

  if (!response.ok)
    throw apiError(401, 'Microsoft session expired. Please try again.');

  const identity = await response.json();
  if (!identity.app_metadata || identity.app_metadata.provider !== 'azure')
    throw apiError(403, 'Please sign in with your university Microsoft account.');
  if (!identity.email || (!identity.email_confirmed_at && !identity.confirmed_at))
    throw apiError(403, 'A verified university email is required.');

  return identity;
}

async function loadRules() {
  let rules;
  try {
    rules = microsoftRules(await getPortalState());
  } catch (err) {
    console.error('[microsoft settings]', err);
    throw apiError(503, 'Could not load sign-in settings.');
  }
  if (!rules.enabled)
    throw apiError(403, 'Microsoft sign-in is turned off by the administrator.');
  return rules;
}

module.exports = { allowedByDomain, verifyAccessToken, loadRules };
