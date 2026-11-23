// lib/http.js — Vercel serverless route wrapper
module.exports = function handler(methods) {
  return async function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-token,x-student-token');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const fn = methods[req.method];
    if (!fn) return res.status(405).json({ error: `Method ${req.method} not allowed` });

    try {
      await fn(req, res);
    } catch (err) {
      console.error('[API Error]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Lightweight validation
module.exports.validate = function (body, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    if (rule.required && !body[field]) errors[field] = 'Required';
    if (rule.min && String(body[field]).length < rule.min) errors[field] = `Min ${rule.min} chars`;
    if (rule.in && !rule.in.includes(body[field])) errors[field] = `Must be one of: ${rule.in.join(', ')}`;
  }
  return Object.keys(errors).length ? errors : null;
};
