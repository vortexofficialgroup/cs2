#!/usr/bin/env node
// scripts/dev-server.js — Local development server
// Serves static files from the project root and routes /api/* to handler modules.
// Usage: node scripts/dev-server.js  (or: npm run dev)

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');

require('../lib/load-env')();

const ROOT   = path.join(__dirname, '..');
const PORT   = process.env.PORT || 3000;

// ─── Route table (mirrors vercel.json rewrites) ───────────────────────────
const ROUTES = {
  'GET /api/rooms':                   require('../api/rooms'),
  'GET /api/schedule':                require('../api/schedule'),
  'GET /api/announcements':           require('../api/announcements'),
  'GET /api/state':                   require('../api/state'),
  'PUT /api/state':                   require('../api/state'),
  'GET /api/auth/config':             require('../lib/routes/auth/config'),
  'GET /api/auth/session':            require('../lib/routes/auth/session'),
  'PUT /api/auth/account':            require('../lib/routes/auth/account'),
  'POST /api/auth/microsoft':         require('../lib/routes/auth/microsoft'),
  'GET /api/student/me':              require('../lib/routes/student/auth'),
  'PUT /api/student/account':         require('../lib/routes/student/account'),
  'POST /api/student/login':          require('../lib/routes/student/auth'),
  'POST /api/student/register':       require('../lib/routes/student/auth'),
  'POST /api/student/microsoft':      require('../lib/routes/student/microsoft'),
  'POST /api/admin/login':            require('../lib/routes/admin/login'),
  'POST /api/admin/logout':           require('../lib/routes/admin/logout'),
  'POST /api/admin/password':         require('../lib/routes/admin/password'),
  'GET /api/admin/staff':             require('../lib/routes/admin/staff'),
  'POST /api/admin/staff':            require('../lib/routes/admin/staff'),
  'PUT /api/admin/staff':             require('../lib/routes/admin/staff'),
  'DELETE /api/admin/staff':          require('../lib/routes/admin/staff'),
  'GET /api/admin/sso-staff':         require('../lib/routes/admin/sso-staff'),
  'PUT /api/admin/sso-staff':         require('../lib/routes/admin/sso-staff'),
  'DELETE /api/admin/sso-staff':      require('../lib/routes/admin/sso-staff'),
  'GET /api/admin/rooms':             require('../lib/routes/admin/rooms'),
  'GET /api/admin/professors':        require('../lib/routes/admin/professors'),
  'PUT /api/admin/professors':        require('../lib/routes/admin/professors'),
  'POST /api/admin/schedule':         require('../lib/routes/admin/schedule'),
  'PUT /api/admin/schedule':          require('../lib/routes/admin/schedule'),
  'DELETE /api/admin/schedule':       require('../lib/routes/admin/schedule'),
  'POST /api/admin/rooms':            require('../lib/routes/admin/rooms'),
  'PUT /api/admin/rooms':             require('../lib/routes/admin/rooms'),
  'DELETE /api/admin/rooms':          require('../lib/routes/admin/rooms'),
  'POST /api/admin/professors':       require('../lib/routes/admin/professors'),
  'DELETE /api/admin/professors':     require('../lib/routes/admin/professors'),
  'GET /api/admin/announcements':     require('../lib/routes/admin/announcements'),
  'POST /api/admin/announcements':    require('../lib/routes/admin/announcements'),
  'DELETE /api/admin/announcements':  require('../lib/routes/admin/announcements'),
  // ── AI endpoints ──
  'POST /api/ai/suggest':             require('../lib/routes/ai/suggest'),
  'GET /api/ai/analyze':              require('../lib/routes/ai/analyze'),
  'GET /api/ai/conflicts':            require('../lib/routes/ai/conflicts'),
  'POST /api/ai/agent':               require('../lib/routes/ai/agent'),
  'POST /api/ai/staff-agent':         require('../lib/routes/ai/staff-agent'),
  'GET /api/ai/status':               require('../lib/routes/ai/status'),
};

// ─── MIME types ───────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain',
};

// ─── Minimal req/res shim to match Vercel's serverless interface ──────────
function buildReq(nodeReq, parsedUrl, body) {
  nodeReq.query  = Object.fromEntries(parsedUrl.searchParams);
  nodeReq.body   = body;
  nodeReq.cookies = parseCookies(nodeReq.headers.cookie || '');
  return nodeReq;
}

function buildRes(nodeRes) {
  const headers = {};
  const nativeSetHeader = nodeRes.setHeader.bind(nodeRes);
  nodeRes.status = (code) => { nodeRes.statusCode = code; return nodeRes; };
  nodeRes.json   = (data) => {
    if (!nodeRes.headersSent) {
      nativeSetHeader('Content-Type', 'application/json');
      Object.entries(headers).forEach(([k, v]) => nativeSetHeader(k, v));
    }
    nodeRes.end(JSON.stringify(data));
  };
  nodeRes.setHeader = (k, v) => { headers[k] = v; nativeSetHeader(k, v); return nodeRes; };
  nodeRes.end = nodeRes.end.bind(nodeRes);
  return nodeRes;
}

function parseCookies(str) {
  return str.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return acc;
    acc[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    return acc;
  }, {});
}

// ─── Read full request body ───────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

// ─── Serve a static file ─────────────────────────────────────────────────
function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ─── Main server ─────────────────────────────────────────────────────────
const server = http.createServer(async (nodeReq, nodeRes) => {
  const parsedUrl = new URL(nodeReq.url, `http://localhost:${PORT}`);
  const pathname  = parsedUrl.pathname;

  // ── API routes ──
  if (pathname.startsWith('/api/')) {
    const body    = await readBody(nodeReq);
    const req     = buildReq(nodeReq, parsedUrl, body);
    const res     = buildRes(nodeRes);
    const handler = ROUTES[`${nodeReq.method} ${pathname}`];
    if (handler) return handler(req, res);
    nodeRes.writeHead(404);
    return nodeRes.end(JSON.stringify({ error: `No handler for ${nodeReq.method} ${pathname}` }));
  }

  // ── Static files ──
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) { nodeRes.writeHead(403); nodeRes.end(); return; }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath)) return serveFile(nodeRes, filePath);

  // Fall back to index.html for SPA-style navigation (optional)
  serveFile(nodeRes, path.join(ROOT, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`\n  🏫  UE Dubai Room Portal — dev server`);
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  http://localhost:${PORT}/admin.html\n`);
});
