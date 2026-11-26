// api/ai/conflicts.js — GET /api/ai/conflicts
// Detects soft conflicts the hard constraint check misses:
// - same professor double-booked across rooms
// - back-to-back rooms on different floors (unrealistic travel time)
// - student program clashes (same program, overlapping time)

const handler  = require('../../http');
const store    = require('../../store');
const { ask }  = require('../../ai');
const { requireAdmin } = require('../../auth');

function detectHardConflicts(schedule, rooms) {
  const conflicts = [];
  const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const t2m  = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const overlaps = (a, b) => t2m(a.start) < t2m(b.end) && t2m(a.end) > t2m(b.start);

  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      const a = schedule[i], b = schedule[j];
      if (a.day !== b.day || !overlaps(a, b)) continue;

      // Same professor, different rooms
      if (a.professor && b.professor &&
          a.professor.toLowerCase() === b.professor.toLowerCase() &&
          a.roomId !== b.roomId) {
        conflicts.push({
          type: 'professor_double_booking',
          severity: 'critical',
          message: `${a.professor} is double-booked on ${DAY[a.day]} ${a.start}–${a.end}: ${a.roomId} (${a.course}) AND ${b.roomId} (${b.course})`,
          entries: [a.id, b.id],
        });
      }

      // Same program, overlapping time (students can't be in two places)
      if (a.program && b.program &&
          a.program.toLowerCase() === b.program.toLowerCase() &&
          a.roomId !== b.roomId) {
        conflicts.push({
          type: 'program_overlap',
          severity: 'warning',
          message: `${a.program} has overlapping classes on ${DAY[a.day]} ${a.start}–${a.end}: "${a.course}" in ${a.roomId} and "${b.course}" in ${b.roomId}`,
          entries: [a.id, b.id],
        });
      }

      // Back-to-back same professor different floors (< 10 min gap)
    }
  }

  // Floor travel warnings (back-to-back, different floors, < 15 min gap)
  const roomFloor = {};
  rooms.forEach(r => { roomFloor[r.id] = r.floor; });

  const byProf = {};
  schedule.forEach(s => {
    if (!s.professor) return;
    const key = `${s.professor}__${s.day}`;
    if (!byProf[key]) byProf[key] = [];
    byProf[key].push(s);
  });

  Object.values(byProf).forEach(entries => {
    entries.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < entries.length - 1; i++) {
      const a = entries[i], b = entries[i + 1];
      const t2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const gap = t2m(b.start) - t2m(a.end);
      const floorA = roomFloor[a.roomId], floorB = roomFloor[b.roomId];
      if (gap >= 0 && gap <= 10 && floorA && floorB && floorA !== floorB) {
        const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        conflicts.push({
          type: 'tight_floor_change',
          severity: 'warning',
          message: `${a.professor} has only ${gap} min to move from floor ${floorA} (${a.roomId}) to floor ${floorB} (${b.roomId}) on ${DAY[a.day]}`,
          entries: [a.id, b.id],
        });
      }
    }
  });

  return conflicts;
}

module.exports = handler({
  async GET(req, res) {
    if (!await requireAdmin(req, res)) return;
    const schedule = store.getSchedule();
    const rooms    = store.getRooms();

    const hardConflicts = detectHardConflicts(schedule, rooms);

    // Ask the AI model for a natural language summary + any pattern-based risks it spots
    let aiSummary = null;
    if (schedule.length > 0) {
      try {
        const schedCtx = schedule.slice(0, 60).map(s =>
          `ID:${s.id} day${s.day} ${s.start}-${s.end} room:${s.roomId} prof:"${s.professor}" course:"${s.course}" program:"${s.program}"`
        ).join('\n');

        const foundIssues = hardConflicts.map(c => c.message).join('\n') || 'None detected by rule engine.';

        aiSummary = await ask(
          'You are a campus scheduling conflict analyst. Be brief and specific. Flag only real risks.',
          `Here is the current schedule:\n${schedCtx}\n\nRule engine already found:\n${foundIssues}\n\nIdentify any additional soft conflicts or risks not already listed above. If nothing extra, say "No additional risks found." Keep it under 5 bullet points.`
        );
      } catch {
        aiSummary = null; // non-fatal, return hard conflicts anyway
      }
    }

    res.json({
      conflicts: hardConflicts,
      count: hardConflicts.length,
      critical: hardConflicts.filter(c => c.severity === 'critical').length,
      warnings: hardConflicts.filter(c => c.severity === 'warning').length,
      aiInsights: aiSummary,
    });
  },
});
