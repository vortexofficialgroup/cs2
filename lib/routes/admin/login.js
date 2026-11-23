const handler = require('../../http');
const { sign, isSecureRequest } = require('../../auth');
const staffStore = require('../../staff-store');
const adminPassword = require('../../admin-password');

if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD)
  throw new Error('ADMIN_PASSWORD must be set in production.');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

module.exports = handler({
  POST(req, res) {
    const { username, password, loginType = 'admin' } = req.body || {};
    let user;

    if (loginType === 'admin' && username === ADMIN_USERNAME && adminPassword.verify(password)) {
      user = { role: 'admin', username: ADMIN_USERNAME, displayName: 'Administrator', permissions: [] };
    } else if (loginType === 'staff') {
      const staff = staffStore.authenticate(username, password);
      if (staff) user = { ...staff, role: 'staff' };
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const token = sign({ ...user, ...(user.role === 'admin' ? { passwordChangedAt: adminPassword.changedAt() } : {}) });
    const secure = isSecureRequest(req) ? '; Secure' : '';
    res.setHeader('Set-Cookie', `adminToken=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
    res.json({
      user: {
        role: user.role,
        username: user.username,
        displayName: user.displayName,
        title: user.title,
        permissions: user.permissions,
      },
      expiresIn: 28800,
    });
  },
});
