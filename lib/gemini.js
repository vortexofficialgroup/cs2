// lib/gemini.js — Gemini API wrapper (no SDK, plain fetch)
// Set GEMINI_API_KEY in your .env / Vercel environment variables.
// Models listed here are available on Google's free tier (rate limited).

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const REQUESTED_DEFAULT = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const AVAILABLE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-4-hydrogen',
];

// Old model names saved in localStorage or env should not break the assistant.
const MODEL_ALIASES = {
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-3.8-flash',
  'gemini-flash-latest': 'gemini-3.8-flash',
};

if (!AVAILABLE_MODELS.includes(REQUESTED_DEFAULT) && !MODEL_ALIASES[REQUESTED_DEFAULT]) {
  AVAILABLE_MODELS.unshift(REQUESTED_DEFAULT);
}

const DEFAULT_MODEL = MODEL_ALIASES[REQUESTED_DEFAULT] ||
  (AVAILABLE_MODELS.includes(REQUESTED_DEFAULT) ? REQUESTED_DEFAULT : 'gemini-3.5-flash-lite');

function getModel(model) {
  if (typeof model !== 'string') return DEFAULT_MODEL;
  const normalized = MODEL_ALIASES[model] || model;
  return AVAILABLE_MODELS.includes(normalized) ? normalized : DEFAULT_MODEL;
}

function apiError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.provider = 'gemini';
  err.retryable = status === 429 || status >= 500;
  return err;
}

function describeHttpError(status, raw) {
  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    detail = parsed.error?.message || parsed.message || raw;
  } catch (_) { /* keep raw text */ }
  detail = String(detail).slice(0, 300);

  if (status === 400 || status === 403 || status === 404) {
    return `Gemini rejected the request (${status}): ${detail}. Check that GEMINI_API_KEY is valid and the model is available on your key.`;
  }
  if (status === 429) {
    return `Gemini rate limit reached: ${detail}. Wait a moment or use a different model.`;
  }
  return `Gemini API error ${status}: ${detail}`;
}

/**
 * Call Gemini with a single system+user prompt.
 * Returns the text response string.
 */
async function ask(systemPrompt, userPrompt, { temperature = 0.2, responseMimeType, model, timeoutMs = 8000 } = {}) {
  if (!GEMINI_KEY) {
    throw apiError(401, 'GEMINI_API_KEY is not set. Add it to your environment variables (free key: https://aistudio.google.com/api-keys).');
  }

  const selectedModel = getModel(model);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 1024,
      ...(responseMimeType ? { responseMimeType } : {}),
    },
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY,
      },
      body:    JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw apiError(504, `Gemini request failed: ${err.message}`);
  }

  if (!res.ok) {
    const raw = await res.text();
    throw apiError(res.status, describeHttpError(res.status, raw));
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw apiError(502, `Gemini returned an unreadable response: ${err.message}`);
  }

  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) {
    const reason = json.candidates?.[0]?.finishReason || json.promptFeedback?.blockReason || 'unknown';
    throw apiError(502, `Gemini returned no text (reason: ${reason}).`);
  }
  return text;
}

/**
 * Ask Gemini and parse the response as JSON.
 */
async function askJSON(systemPrompt, userPrompt, options) {
  const raw = await ask(systemPrompt, userPrompt, {
    ...options,
    responseMimeType: 'application/json',
  });
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw apiError(502, `Gemini returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

module.exports = { ask, askJSON, AVAILABLE_MODELS, DEFAULT_MODEL, getModel };
