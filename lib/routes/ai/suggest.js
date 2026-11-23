// api/ai/suggest.js — POST /api/ai/suggest
// Natural language → available room slot suggestions
// Body: { query: "find me a lab Thursday afternoon for 20 students" }

const handler    = require('../../http');
const store      = require('../../store');
const { askJSON } = require('../../deepseek');

const DAYS = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5,
               mon:1, tue:2, wed:3, thu:4, fri:5 };

module.exports = handler({
  async POST(req, res) {
    const { query, history } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim())
      return res.status(400).json({ error: 'query is required' });

    const rooms    = store.getRooms();
    const schedule = store.getSchedule();

    // Build a compact context for DeepSeek
    const roomCtx = rooms.map(r =>
      `${r.id}: ${r.name}, ${r.type}, capacity ${r.capacity}, floor ${r.floor}, features: ${(r.features||[]).join(', ')}`
    ).join('\n');

    const schedCtx = schedule.map(s =>
      `${s.roomId} day${s.day} ${s.start}-${s.end}: ${s.course} (${s.code})`
    ).join('\n');

    // Check if this is a chatbot general question (not just room search)
    const chatCtx = req.body._context || null;
    const isChatbot = req.body._chatbot_mode === true;
    const recentHistory = isChatbot && Array.isArray(history)
      ? history
        .filter(message =>
          message &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
        )
        .slice(-8)
        .map(message => `${message.role === 'user' ? 'Visitor' : 'CampuSyncer'}: ${message.content.slice(0, 1000)}`)
        .join('\n')
      : '';

    const system = `You are CampuSyncer, the AI assistant for UE Dubai campus room portal.
${isChatbot ? `You are warm, personable, and conversational, like a helpful campus concierge. Respond naturally to greetings and small talk, and vary your wording instead of repeating a canned greeting. Remember the recent conversation and answer follow-up questions in context. You may answer general questions beyond campus topics briefly, then gently offer campus help when relevant. Never pretend to be human.
For greetings and small talk, answer in "understood" and leave "suggestions" empty. Only provide suggestions when the visitor asks to find an available room or time. Never invent campus buildings, facilities, events, or services; use only the room and schedule data below.
You answer general questions about rooms and schedules as well as find available slots.
Current day index: ${chatCtx?.currentDay || 'unknown'} (1=Mon…5=Fri), Current time: ${chatCtx?.currentTime || 'unknown'}
` : ''}
Rooms available:
${roomCtx}

Current bookings (day 1=Mon … 5=Fri):
${schedCtx || 'No bookings yet.'}

Rules:
- Working hours: 08:00–20:00
- Slots are typically 1–3 hours
- Do NOT suggest a room+day+time that is already booked
- Return JSON only, no prose
- For general questions (what's in R101, show schedule, which rooms are free) answer in "understood" field and leave suggestions empty

Output format:
{
  "understood": "answer to the question or one sentence of what you understood",
  "suggestions": [
    {
      "room_id": "R101",
      "room_name": "Room 101",
      "day": 4,
      "day_name": "Thursday",
      "start": "14:00",
      "end": "16:00",
      "reason": "why this slot fits"
    }
  ],
  "tips": "optional short tip"
}`;

    try {
      const userPrompt = recentHistory
        ? `Recent conversation:\n${recentHistory}\n\nVisitor's latest message: ${query}`
        : query;
      const result = await askJSON(system, userPrompt, { temperature: 0.6 });
      res.json(result);
    } catch (err) {
      console.error('[AI suggestion failed]', err);
      res.status(503).json({ error: 'The AI assistant is temporarily busy. Please try again in a moment.' });
    }
  },
});
