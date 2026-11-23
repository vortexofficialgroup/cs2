// lib/ai.js — AI provider router.
// Tries free-tier Gemini first, then falls back to DeepSeek if configured.
// Routes should import ask/askJSON/getModel from here, not from a single provider.

const gemini = require('./gemini');
const deepseek = require('./deepseek');

const hasGeminiKey = !!process.env.GEMINI_API_KEY;
const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;

const GEMINI_MODELS = gemini.AVAILABLE_MODELS;
const DEEPSEEK_MODELS = deepseek.AVAILABLE_MODELS;
const MODELS = [...GEMINI_MODELS, ...DEEPSEEK_MODELS];

const DEFAULT_MODEL = (() => {
  if (process.env.AI_MODEL && MODELS.includes(process.env.AI_MODEL)) return process.env.AI_MODEL;
  if (hasGeminiKey) return gemini.getModel(process.env.GEMINI_MODEL || gemini.DEFAULT_MODEL);
  return deepseek.getModel(process.env.DEEPSEEK_MODEL || deepseek.DEFAULT_MODEL);
})();

function getModel(model) {
  if (typeof model === 'string' && MODELS.includes(model)) return model;
  return DEFAULT_MODEL;
}

function providerFor(model) {
  return GEMINI_MODELS.includes(model) ? gemini : deepseek;
}

function candidatesFor(model) {
  const selected = getModel(model);
  const primary = { provider: providerFor(selected), model: selected };
  const fallbacks = [];

  if (primary.provider === gemini) {
    // Another free Gemini model may be available even if this one is not.
    for (const alt of GEMINI_MODELS) {
      if (alt !== selected) fallbacks.push({ provider: gemini, model: alt });
    }
    if (hasDeepSeekKey) fallbacks.push({ provider: deepseek, model: deepseek.DEFAULT_MODEL });
  } else {
    if (hasGeminiKey) fallbacks.push({ provider: gemini, model: gemini.DEFAULT_MODEL });
    for (const alt of DEEPSEEK_MODELS) {
      if (alt !== selected) fallbacks.push({ provider: deepseek, model: alt });
    }
  }

  return [primary, ...fallbacks];
}

async function callWithFallback(kind, systemPrompt, userPrompt, options = {}) {
  const candidates = candidatesFor(options.model);
  const timeoutMs = options.timeoutMs || (candidates.length > 1 ? 5000 : 8000);
  const errors = [];
  let lastStatus = 503;

  for (const { provider, model } of candidates) {
    try {
      const invoke = provider[kind];
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
  final.provider = 'all';
  throw final;
}

function ask(systemPrompt, userPrompt, options) {
  return callWithFallback('ask', systemPrompt, userPrompt, options);
}

function askJSON(systemPrompt, userPrompt, options) {
  return callWithFallback('askJSON', systemPrompt, userPrompt, options);
}

// Show actionable configuration/quota problems to the admin while keeping
// unexpected provider details behind a generic message.
function publicErrorMessage(err) {
  const msg = String(err?.message || '');
  if (/API_KEY is not set|no usable balance|rate limit|rejected the request|request failed/i.test(msg)) {
    return `AI setup issue: ${msg.slice(0, 400)}`;
  }
  return 'The AI assistant is temporarily busy. Please try again in a moment.';
}

module.exports = {
  ask,
  askJSON,
  getModel,
  publicErrorMessage,
  DEFAULT_MODEL,
  MODELS,
  GEMINI_MODELS,
  DEEPSEEK_MODELS,
  providers: { gemini, deepseek },
};
