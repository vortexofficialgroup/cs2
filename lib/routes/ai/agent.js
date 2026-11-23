// api/ai/agent.js — POST /api/ai/agent
// CampuSyncer action agent: interprets natural language commands and executes them
// Body: { message: string, history: [{role, content}] }

const handler     = require('../../http');
const store       = require('../../store');
const { askJSON } = require('../../gemini');
const { requirePermission } = require('../../auth');

const DAY_NAMES = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5,
                    mon:1, tue:2, wed:3, thu:4, fri:5,
                    1:'Monday', 2:'Tuesday', 3:'Wednesday', 4:'Thursday', 5:'Friday' };

function getContext() {
  const rooms    = store.getRooms();
  const schedule = store.getSchedule();
  const profs    = store.getProfessors();

  const roomCtx  = rooms.map(r =>
    `${r.id}: ${r.name}, ${r.type}, cap ${r.capacity}, floor ${r.floor}`
  ).join('\n');

  const schedCtx = schedule.map(s =>
    `ID:${s.id} day${s.day}(${DAY_NAMES[s.day]}) ${s.start}-${s.end} room:${s.roomId} course:"${s.course}" code:${s.code} prof:"${s.professor}" program:"${s.program}"`
  ).join('\n') || 'No schedule entries.';

  const profCtx  = profs.map(p =>
    `"${p.name}"${p.department ? ' dept:'+p.department : ''}${p.email ? ' email:'+p.email : ''}`
  ).join('\n') || 'No professors.';

  return { roomCtx, schedCtx, profCtx, rooms, schedule, profs };
}

const SYSTEM = (ctx) => `You are CampuSyncer, the AI scheduling agent for UE Dubai campus admin portal.
You can READ and WRITE campus scheduling data. You are helpful, concise, and confirm before destructive actions.

CURRENT CAMPUS DATA:
Rooms:
${ctx.roomCtx}

Schedule (day 1=Mon…5=Fri):
${ctx.schedCtx}

Professors:
${ctx.profCtx}

AVAILABLE ACTIONS (return as JSON):
You must always respond with this exact JSON structure:

{
  "reply": "conversational response to show the user",
  "action": null | "create_entry" | "update_entry" | "delete_entry" | "delete_multiple" | "query" | "find_substitute" | "check_capacity" | "none",
  "confirm_required": true | false,
  "confirm_message": "if confirm_required, what to show user before executing",
  "payload": { ... action-specific data ... }
}

ACTION PAYLOADS:

create_entry:
{ "day": 1-5, "start": "HH:MM", "end": "HH:MM", "roomId": "R101", "course": "Course Name", "code": "CSCODE", "professor": "Prof Name", "program": "Program Name", "semester": "Fall 2026" }

update_entry:
{ "id": 123, "day": 1-5, "start": "HH:MM", "end": "HH:MM", "roomId": "R101", "course": "...", "code": "...", "professor": "...", "program": "..." }

delete_entry:
{ "id": 123, "description": "what is being deleted" }

delete_multiple:
{ "ids": [1,2,3], "description": "e.g. all Thursday classes" }

query:
{ "result": "text answer to the query, formatted nicely" }

find_substitute:
{ "day": 1-5, "start": "HH:MM", "end": "HH:MM", "course": "...", "suggestions": ["Prof A", "Prof B"] }

check_capacity:
{ "violations": [ { "entryId": 1, "roomId": "R101", "roomCapacity": 30, "course": "...", "note": "..." } ] }

none:
{ } (for greetings or when no action is needed)

RULES:
- Always confirm before delete_entry, delete_multiple, or update_entry
- For create_entry: check for conflicts first; if conflict exists, say so and suggest alternatives
- If a room or professor name is ambiguous, ask for clarification
- Day numbers: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5
- Times must be "HH:MM" 24h format
- If the user says "yes" or "confirm" after a confirm_required response, set confirm_required: false and execute
- Be concise in reply field — 1-2 sentences max
- For queries, answer directly in the reply field`;

module.exports = handler({
  async POST(req, res) {
    if (!requirePermission(req, res, 'schedule')) return;

    const { message, history = [], pending_action } = req.body || {};
    if (!message || typeof message !== 'string')
      return res.status(400).json({ error: 'message is required' });

    const ctx = getContext();

    // Build conversation history for context
    const historyCtx = history.slice(-6).map(h =>
      `${h.role === 'user' ? 'Admin' : 'CampuSyncer'}: ${h.content}`
    ).join('\n');

    const userPrompt = historyCtx
      ? `Previous conversation:\n${historyCtx}\n\nAdmin: ${message}`
      : `Admin: ${message}`;

    let parsed;
    try {
      parsed = await askJSON(SYSTEM(ctx), userPrompt);
    } catch (err) {
      console.error('[AI agent request failed]', err);
      return res.status(503).json({ error: 'The AI assistant is temporarily busy. Please try again in a moment.' });
    }

    // If user confirmed a pending action, execute it
    const isConfirm = /^(yes|confirm|do it|go ahead|ok|sure|yep|yeah)$/i.test(message.trim());

    // Execute action if no confirmation needed, or user just confirmed
    let executionResult = null;
    const actionToRun = pending_action || (parsed.confirm_required ? null : parsed.action);

    if (actionToRun && !parsed.confirm_required) {
      const payload = pending_action ? pending_action.payload : parsed.payload;
      const action  = pending_action ? pending_action.action  : parsed.action;

      try {
        executionResult = await executeAction(action, payload, ctx);
        if (executionResult.error) {
          parsed.reply = `⚠️ ${executionResult.error}`;
        } else {
          parsed.reply = executionResult.message || parsed.reply;
        }
      } catch (e) {
        parsed.reply = `⚠️ Failed to execute: ${e.message}`;
      }
    }

    res.json({
      reply: parsed.reply || 'Done.',
      action: parsed.action || 'none',
      confirm_required: parsed.confirm_required || false,
      confirm_message: parsed.confirm_message || null,
      pending_action: parsed.confirm_required ? { action: parsed.action, payload: parsed.payload } : null,
      executed: !!executionResult && !executionResult?.error,
      result: executionResult,
    });
  },
});

async function executeAction(action, payload, ctx) {
  const t2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  switch (action) {
    case 'create_entry': {
      const { day, start, end, roomId, course, code, professor, program, semester } = payload;
      if (!day || !start || !end || !roomId || !course || !code || !professor || !program)
        return { error: 'Missing required fields to create entry.' };
      if (store.hasConflict(roomId, day, start, end))
        return { error: `Room ${roomId} already has a booking at that time.` };
      const entry = store.addEntry({ day: parseInt(day), start, end, roomId, course, code, professor, program, semester: semester || 'Fall 2026' });
      return { message: `✅ Created: ${course} in ${roomId} on ${DAY_NAMES[day]} ${start}–${end}`, entry };
    }

    case 'update_entry': {
      const { id, ...rest } = payload;
      if (!id) return { error: 'Entry ID required.' };
      if (rest.roomId && rest.day && rest.start && rest.end) {
        if (store.hasConflict(rest.roomId, parseInt(rest.day), rest.start, rest.end, parseInt(id)))
          return { error: `Room ${rest.roomId} has a conflict at that time.` };
      }
      const updated = store.updateEntry(parseInt(id), { ...rest, day: rest.day ? parseInt(rest.day) : undefined });
      if (!updated) return { error: `Entry ${id} not found.` };
      return { message: `✅ Updated entry ${id}: ${updated.course}`, entry: updated };
    }

    case 'delete_entry': {
      const { id, description } = payload;
      if (!id) return { error: 'Entry ID required.' };
      const ok = store.deleteEntry(parseInt(id));
      if (!ok) return { error: `Entry ${id} not found.` };
      return { message: `🗑️ Deleted: ${description || `entry ${id}`}` };
    }

    case 'delete_multiple': {
      const { ids, description } = payload;
      if (!ids || !ids.length) return { error: 'No IDs provided.' };
      let deleted = 0;
      ids.forEach(id => { if (store.deleteEntry(parseInt(id))) deleted++; });
      return { message: `🗑️ Deleted ${deleted} entries (${description || ''})` };
    }

    case 'query':
      return { message: payload.result || 'Query complete.' };

    case 'find_substitute':
      return { message: `Found substitute suggestions.`, suggestions: payload.suggestions };

    case 'check_capacity':
      return { message: `Capacity check complete.`, violations: payload.violations };

    default:
      return { message: 'Done.' };
  }
}
