// POST /api/auth/microsoft — exchange a verified Supabase (Microsoft) token
// for a staff/admin session. The email domain allowlist is stored in shared
// settings and edited by the administrator in Settings → Staff Access.

const handler = require('../../http');
const { sign, isSecureRequest } = require('../../auth');
const { allowedByDomain, verifyAccessToken, loadRules } = require('../../microsoft-identity');
const ssoStaff = require('../../sso-staff-store');
const { DEFAULT_CAPABILITIES, normalize: normalizeCapabilities } = require('../../ai-capabilities');
const { PERMISSIONS } = require('../../staff-store');

const DEFAULT_PERMISSIONS = ['chatbot'];

module.exports = handler({
  async POST(req, res) {
    const accessToken = req.body && req.body.accessToken;
    if (typeof accessToken !== 'string' || !accessToken)
      return res.status(400).json({ error: 'A Microsoft access token is required.' });

    let identity, rules;
    try {
      identity = await verifyAccessToken(accessToken);
      rules = await loadRules();
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message });
    }

    if (!allowedByDomain(identity.email, rules.domains))
      return res.status(403).json({ error: 'Your email domain is not allowed. Ask the administrator to add it.' });

    const email = identity.email.toLowerCase();
    let staff = await ssoStaff.findByEmail(email);
    if (!staff) {
      const meta = identity.user_metadata || {};
      const displayName = meta.full_name || meta.name || email.split('@')[0].replace(/[._-]+/g, ' ');
      const permissions = (rules.defaultPermissions || DEFAULT_PERMISSIONS)
        .filter(permission => PERMISSIONS.includes(permission));
      const aiActions = normalizeCapabilities(
        rules.defaultCapabilities && rules.defaultCapabilities.length
          ? rules.defaultCapabilities
          : DEFAULT_CAPABILITIES,
      );
      try {
        staff = await ssoStaff.save({
          email,
          displayName,
          title: meta.job_title || 'Staff',
          permissions,
          aiActions,
        });
      } catch (err) {
        console.error('[microsoft staff create]', err);
        return res.status(503).json({ error: 'Could not create your staff profile. Contact the administrator.' });
      }
    }

    const user = {
      role: 'staff',
      sso: true,
      id: staff.email,
      username: staff.email,
      displayName: staff.displayName,
      title: staff.title,
      permissions: staff.permissions || [],
      aiActions: staff.aiActions || [],
      source: 'microsoft',
    };
    const token = sign(user);
    const secure = isSecureRequest(req) ? '; Secure' : '';
    res.setHeader('Set-Cookie', `adminToken=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
    res.json({ user, expiresIn: 28800 });
  },
});
