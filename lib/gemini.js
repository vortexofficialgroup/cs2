// lib/gemini.js — Gemini API wrapper (no SDK, plain fetch)
// Set GEMINI_API_KEY in your .env

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const MODEL      = 'gemini-2.5-flash';
const ENDPOINT   = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/**
 * Call Gemini with a single system+user prompt.
 * Returns the text response string.
 */
async function ask(systemPrompt, userPrompt) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  };

  const res = await fetch(`${ENDPOINT}?key=${GEMINI_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Ask Gemini and parse the response as JSON.
 * Strips markdown code fences if present.
 */
async function askJSON(systemPrompt, userPrompt) {
  const raw = await ask(systemPrompt, userPrompt);
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

module.exports = { ask, askJSON };
