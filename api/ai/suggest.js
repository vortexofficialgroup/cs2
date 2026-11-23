// api/ai/suggest.js — POST /api/ai/suggest
// Natural language → available room slot suggestions
// Body: { query: "find me a lab Thursday afternoon for 20 students" }

const handler    = require('../../lib/http');
const store      = require('../../lib/store');
const { askJSON } = require('../../lib/gemini');

const DAYS = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5,
               mon:1, tue:2, wed:3, thu:4, fri:5 };

module.exports = handler({
  async POST(req, res) {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length < 3)
      return res.status(400).json({ error: 'query is required' });

    const rooms    = store.getRooms();
    const schedule = store.getSchedule();

    // Build a compact context for Gemini
    const roomCtx = rooms.map(r =>
      `${r.id}: ${r.name}, ${r.type}, capacity ${r.capacity}, floor ${r.floor}, features: ${(r.features||[]).join(', ')}`
    ).join('\n');

    const schedCtx = schedule.map(s =>
      `${s.roomId} day${s.day} ${s.start}-${s.end}: ${s.course} (${s.code})`
    ).join('\n');

    const system = `You are a smart campus scheduling assistant for UE Dubai.
You receive a natural language room request and return slot suggestions in JSON.
Rooms available:\n${roomCtx}

Current bookings (day 1=Mon … 5=Fri):\n${schedCtx || 'No bookings yet.'}

Rules:
- Working hours: 08:00–20:00
- Slots are typically 1–3 hours
- Do NOT suggest a room+day+time that is already booked
- Return JSON only, no prose

Output format:
{
  "understood": "one sentence of what you understood the request to be",
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
  "tips": "optional short scheduling tip"
}`;

    try {
      const result = await askJSON(system, query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
});
