// lib/routes/ai/status.js — GET /api/ai/status
// Admin-only diagnostic: reports configured keys and tests free Gemini models.
// Never returns key values — only booleans and API error messages.

const handler = require('../../http');
const { requireAdmin } = require('../../auth');
const { providers, DEFAULT_MODEL, GEMINI_MODELS } = require('../../ai');

module.exports = handler({
  async GET(req, res) {
    if (!requireAdmin(req, res)) return;

    const geminiKeyConfigured = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    const deepseekKeyConfigured = !!process.env.DEEPSEEK_API_KEY;
    const models = [DEFAULT_MODEL, ...GEMINI_MODELS.filter(m => m !== DEFAULT_MODEL)];
    const results = [];

    for (const model of models) {
      const started = Date.now();
      try {
        const text = await providers.gemini.ask('Reply with exactly OK.', 'ping', { model, timeoutMs: 2500 });
        results.push({ provider: 'gemini', model, ok: true, ms: Date.now() - started, reply: String(text).slice(0, 40) });
        break; // one working model is enough
      } catch (err) {
        results.push({ provider: 'gemini', model, ok: false, ms: Date.now() - started, error: String(err.message).slice(0, 300) });
      }
    }

    if (!results.some(r => r.ok) && deepseekKeyConfigured) {
      const started = Date.now();
      try {
        const text = await providers.deepseek.ask('Reply with exactly OK.', 'ping', { timeoutMs: 2500 });
        results.push({ provider: 'deepseek', model: 'deepseek-flash', ok: true, ms: Date.now() - started, reply: String(text).slice(0, 40) });
      } catch (err) {
        results.push({ provider: 'deepseek', model: 'deepseek-flash', ok: false, ms: Date.now() - started, error: String(err.message).slice(0, 300) });
      }
    }

    return res.json({
      geminiKeyConfigured,
      deepseekKeyConfigured,
      defaultModel: DEFAULT_MODEL,
      working: results.some(r => r.ok),
      results,
    });
  },
});
