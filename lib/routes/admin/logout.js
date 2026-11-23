const handler = require('../../http');
const { isSecureRequest } = require('../../auth');

module.exports = handler({
  POST(req, res) {
    const secure = isSecureRequest(req) ? '; Secure' : '';
    res.setHeader('Set-Cookie', `adminToken=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
    res.json({ loggedOut: true });
  },
});
