// GET /api/auth/config — public settings needed by the Microsoft login button.
// Only the Supabase URL and publishable (anon) key are exposed — both are safe
// for browser code. The service-role key is never sent to the client.

const handler = require('../../http');
const { getPortalState, microsoftRules } = require('../../supabase-state');

module.exports = handler({
  async GET(req, res) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return res.json({
        enabled: false,
        reason: 'Set SUPABASE_URL and SUPABASE_ANON_KEY to enable Microsoft sign-in.',
      });
    }
    let rules;
    try {
      rules = microsoftRules(await getPortalState());
    } catch (err) {
      console.error('[microsoft config]', err);
      rules = { enabled: false, reason: 'Could not load sign-in settings.' };
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      enabled: rules.enabled,
      url: url.replace(/\/+$/, ''),
      anonKey,
    });
  },
});
