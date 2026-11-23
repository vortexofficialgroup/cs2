// lib/deepseek.js — DeepSeek API wrapper (no SDK, plain fetch)
// Set DEEPSEEK_API_KEY in your .env. DeepSeek is a paid (prepaid balance) API.

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
const AVAILABLE_MODELS = [
  'deepseek-flash',
  'deepseek-v4-pro',
];

if (process.env.DEEPSEEK_MODEL && !AVAILABLE_MODELS.includes(process.env.DEEPSEEK_MODEL)) {
  AVAILABLE_MODELS.unshift(process.env.DEEPSEEK_MODEL);
}

function getModel(model) {
  return typeof model === 'string' && AVAILABLE_MODELS.includes(model)
    ? model
    : DEFAULT_MODEL;
}

function apiError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.provider = 'deepseek';
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

  if (status === 402 || /insufficient balance|balance/i.test(detail)) {
    return `DeepSeek has no usable balance: ${detail}. Top up at https://platform.deepseek.com/top_up or use a free Gemini key instead.`;
  }
  return `DeepSeek API error ${status}: ${detail}`;
}

/**
 * Call DeepSeek with a single system+user prompt.
 * Returns the text response string.
 */
async function ask(systemPrompt, userPrompt, { temperature = 0.2, responseMimeType, model, timeoutMs = 8000 } = {}) {
  if (!DEEPSEEK_KEY) {
    throw apiError(401, 'DEEPSEEK_API_KEY is not set.');
  }
  const selectedModel = getModel(model);
  const endpoint = 'https://api.deepseek.com/chat/completions';

  const body = {
    model: selectedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: 1024,
    stream: false,
    // Thinking is on by default and too slow for the 10s serverless budget.
    thinking: { type: 'disabled' },
    ...(responseMimeType === 'application/json'
      ? { response_format: { type: 'json_object' } }
      : {}),
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body:    JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw apiError(504, `DeepSeek request failed: ${err.message}`);
  }

  if (!res.ok) {
    const raw = await res.text();
    throw apiError(res.status, describeHttpError(res.status, raw));
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw apiError(502, `DeepSeek returned an unreadable response: ${err.message}`);
  }

  const text = json.choices?.[0]?.message?.content || '';
  if (!text) {
    throw apiError(502, `DeepSeek returned no text (finish reason: ${json.choices?.[0]?.finish_reason || 'unknown'}).`);
  }
  return text;
}

/**
 * Ask DeepSeek and parse the response as JSON.
 * Strips markdown code fences if present.
 */
async function askJSON(systemPrompt, userPrompt, options) {
  const raw = await ask(
    `${systemPrompt}\n\nRespond with a single valid JSON object only. Do not use markdown or add any explanation.`,
    userPrompt,
    { ...options, responseMimeType: 'application/json' },
  );
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw apiError(502, `DeepSeek returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

module.exports = { ask, askJSON, AVAILABLE_MODELS, DEFAULT_MODEL, getModel };
