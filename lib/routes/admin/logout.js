const handler = require('../../http');
const { sessionCookie } = require('../../auth');

module.exports = handler({
  POST(req, res) {
    sessionCookie(res, 'adminToken', '', 0, req);
    res.json({ loggedOut: true });
  },
});
