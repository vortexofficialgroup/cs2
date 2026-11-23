// lib/deepseek.js — DeepSeek API wrapper (no SDK, plain fetch)
// Set DEEPSEEK_API_KEY in your .env

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

/**
 * Call DeepSeek with a single system+user prompt.
 * Returns the text response string.
 */
async function ask(systemPrompt, userPrompt, { temperature = 0.2, responseMimeType, model } = {}) {
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not set');
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

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body:    JSON.stringify(body),
    signal: AbortSignal.timeout(8500),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
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
    throw new Error(`DeepSeek returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

module.exports = { ask, askJSON, AVAILABLE_MODELS, DEFAULT_MODEL, getModel };
