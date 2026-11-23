// api/ai/analyze.js — GET /api/ai/analyze
// Returns AI-generated utilization insights: underused rooms, overloaded profs, peak hours

const handler  = require('../../http');
const store    = require('../../store');
const { ask }  = require('../../gemini');

function buildUtilizationStats(rooms, schedule) {
  const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Count bookings per room
  const roomBookings = {};
  rooms.forEach(r => { roomBookings[r.id] = { room: r, entries: [] }; });
  schedule.forEach(s => {
    if (roomBookings[s.roomId]) roomBookings[s.roomId].entries.push(s);
  });

  // Count bookings per professor
  const profLoad = {};
  schedule.forEach(s => {
    profLoad[s.professor] = (profLoad[s.professor] || 0) + 1;
  });

  // Count bookings per hour slot
  const hourLoad = {};
  schedule.forEach(s => {
    const h = parseInt(s.start);
    const key = `${h}:00–${h+1}:00`;
    hourLoad[key] = (hourLoad[key] || 0) + 1;
  });

  return { roomBookings, profLoad, hourLoad, DAY_NAMES };
}

module.exports = handler({
  async GET(req, res) {
    const rooms    = store.getRooms();
    const schedule = store.getSchedule();

    const { roomBookings, profLoad, hourLoad } = buildUtilizationStats(rooms, schedule);

    // Compact summary for Gemini
    const roomSummary = Object.values(roomBookings).map(({ room, entries }) =>
      `${room.id} (${room.type}, cap ${room.capacity}): ${entries.length} bookings`
    ).join('\n');

    const profSummary = Object.entries(profLoad)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name}: ${count} sessions/week`)
      .join('\n');

    const hourSummary = Object.entries(hourLoad)
      .sort((a, b) => b[1] - a[1])
      .map(([slot, count]) => `${slot}: ${count} bookings`)
      .join('\n');

    const totalSlots = rooms.length * 5 * 6; // rooms × days × avg 6 slots/day

    const prompt = `Analyze this campus scheduling data for UE Dubai and give actionable insights.

ROOM UTILIZATION (bookings this week):
${roomSummary || 'No data'}

PROFESSOR LOAD:
${profSummary || 'No data'}

PEAK HOURS:
${hourSummary || 'No data'}

Total schedule entries: ${schedule.length}
Estimated total possible slots: ${totalSlots}

Give a concise analysis covering:
1. Which rooms are underused and what to do about it
2. Any professor overload risks
3. Peak hour clustering and how to redistribute
4. One concrete recommendation the admin should act on today

Keep it practical, 3–5 bullet points max per section. Plain text, no markdown headers.`;

    try {
      const analysis = await ask(
        'You are a campus operations analyst. Be concise, specific, and actionable. No fluff.',
        prompt
      );

      // Also return raw stats for the frontend to render charts
      const rawStats = {
        roomUtilization: Object.values(roomBookings).map(({ room, entries }) => ({
          id: room.id,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          bookings: entries.length,
        })),
        professorLoad: Object.entries(profLoad).map(([name, count]) => ({ name, count })),
        peakHours: Object.entries(hourLoad).map(([slot, count]) => ({ slot, count })),
        totalEntries: schedule.length,
      };

      res.json({ analysis, stats: rawStats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
});
