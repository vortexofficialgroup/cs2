// lib/ai.js — Gemini-only AI wrapper used by all AI routes.
// Uses free-tier Gemini models and falls back to another free model on failure.

const gemini = require('./gemini');

const GEMINI_MODELS = gemini.AVAILABLE_MODELS;
const MODELS = GEMINI_MODELS;
const DEFAULT_MODEL = gemini.getModel(process.env.GEMINI_MODEL || gemini.DEFAULT_MODEL);

function getModel(model) {
  if (typeof model === 'string' && MODELS.includes(model)) return model;
  if (typeof model === 'string' && gemini.getModel(model) !== DEFAULT_MODEL) return gemini.getModel(model);
  return DEFAULT_MODEL;
}

async function callWithFallback(kind, systemPrompt, userPrompt, options = {}) {
  const selected = getModel(options.model);
  const candidates = [selected, ...GEMINI_MODELS.filter(m => m !== selected)];
  const timeoutMs = options.timeoutMs || (candidates.length > 1 ? 5000 : 8000);
  const errors = [];
  let lastStatus = 503;

  for (const model of candidates) {
    try {
      const invoke = gemini[kind];
      return await invoke(systemPrompt, userPrompt, { ...options, model, timeoutMs });
    } catch (err) {
      errors.push(`${model}: ${err.message}`);
      lastStatus = err.status || 503;
      console.warn(`[ai] ${model} failed: ${err.message}`);
    }
  }

  const final = new Error(errors.join(' | '));
  final.status = lastStatus;
  final.retryable = true;
  final.provider = 'gemini';
  throw final;
}

function ask(systemPrompt, userPrompt, options) {
  return callWithFallback('ask', systemPrompt, userPrompt, options);
}

function askJSON(systemPrompt, userPrompt, options) {
  return callWithFallback('askJSON', systemPrompt, userPrompt, options);
}

// Never expose provider details (keys, quotas, model names) to clients.
// Use /api/ai/status for administrator diagnostics instead.
function publicErrorMessage() {
  return 'Please wait 10 seconds before trying again.';
}

module.exports = {
  ask,
  askJSON,
  getModel,
  publicErrorMessage,
  DEFAULT_MODEL,
  MODELS,
  GEMINI_MODELS,
  providers: { gemini },
};
