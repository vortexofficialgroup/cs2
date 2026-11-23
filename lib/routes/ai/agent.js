// api/ai/agent.js — POST /api/ai/agent
// CampuSyncer action agent: interprets natural language commands and executes them
// Body: { message, history, operational_state, pending_action? }

const handler     = require('../../http');
const store       = require('../../store');
const { askJSON, getModel, publicErrorMessage } = require('../../ai');
const { requireAdmin } = require('../../auth');

const VALID_ACTIONS = new Set([
  'create_entry', 'update_entry', 'delete_entry', 'delete_multiple',
  'create_room', 'update_room', 'delete_room',
  'create_professor', 'update_professor', 'delete_professor',
  'create_announcement', 'delete_announcement',
  'duplicate_schedule',
  'query', 'find_substitute', 'check_capacity', 'none',
]);
const CONFIRM_ACTIONS = new Set([
  'update_entry', 'delete_entry', 'delete_multiple',
  'update_room', 'delete_room',
  'update_professor', 'delete_professor',
  'create_announcement', 'delete_announcement',
  'duplicate_schedule',
]);

const DAY_NAMES = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5,
                    mon:1, tue:2, wed:3, thu:4, fri:5,
                    1:'Monday', 2:'Tuesday', 3:'Wednesday', 4:'Thursday', 5:'Friday' };

function getContext() {
  const rooms    = store.getRooms();
  const schedule = store.getSchedule();
  const profs    = store.getProfessors();
  const announcements = store.getAnnouncements();

  const roomCtx  = rooms.map(r =>
    `${r.id}: ${r.name}, ${r.type}, cap ${r.capacity}, floor ${r.floor}, features:${(r.features || []).join(', ')}, maintenance:${!!r.maintenance}`
  ).join('\n');

  const schedCtx = schedule.map(s =>
    `ID:${s.id} day${s.day}(${DAY_NAMES[s.day]}) ${s.start}-${s.end} room:${s.roomId} course:"${s.course}" code:${s.code} prof:"${s.professor}" program:"${s.program}"`
  ).join('\n') || 'No schedule entries.';

  const profCtx  = profs.map(p =>
    `ID:${p.id} "${p.name}"${p.dept ? ' dept:'+p.dept : ''}`
  ).join('\n') || 'No professors.';

  const announcementCtx = announcements.map(a =>
    `ID:${a.id} "${a.title}" (${a.type}, expires ${a.expires}): ${a.msg}`
  ).join('\n') || 'No announcements.';

  return { roomCtx, schedCtx, profCtx, announcementCtx, rooms, schedule, professors: profs, announcements };
}

function normalizePersonName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function resolveProfessor(name, professors) {
  const needle = normalizePersonName(name);
  if (!needle) return null;
  const exact = professors.find(p => normalizePersonName(p.name) === needle);
  if (exact) return exact;
  const partial = professors.filter(p => {
    const candidate = normalizePersonName(p.name);
    return candidate.includes(needle) || needle.includes(candidate);
  });
  return partial.length === 1 ? partial[0] : null;
}

function enforceOwnScheduleAction(action, payload, linkedProfessorName, schedule) {
  const own = normalizePersonName(linkedProfessorName);
  if (!own) return 'Your account is not linked to a professor profile. Ask the administrator to link it before changing schedule.';
  const ownName = String(linkedProfessorName).trim();

  if (action === 'create_entry') {
    const prof = normalizePersonName(payload?.professor);
    if (!prof) return `You can only create classes for yourself (${ownName}).`;
    if (prof !== own) return `You can only create classes for yourself (${ownName}), not for another professor.`;
    return null;
  }
  if (action === 'update_entry') {
    const entry = schedule.find(s => s.id === Number(payload?.id));
    if (!entry) return `Schedule entry ${payload?.id} was not found.`;
    if (normalizePersonName(entry.professor) !== own) return `You can only change your own classes (${ownName}).`;
    if (payload.professor && normalizePersonName(payload.professor) !== own) return `You cannot reassign a class to another professor.`;
    return null;
  }
  if (action === 'delete_entry') {
    const entry = schedule.find(s => s.id === Number(payload?.id));
    if (!entry) return `Schedule entry ${payload?.id} was not found.`;
    if (normalizePersonName(entry.professor) !== own) return `You can only delete your own classes (${ownName}).`;
    return null;
  }
  if (action === 'delete_multiple') {
    const ids = Array.isArray(payload?.ids) ? payload.ids : [];
    if (!ids.length) return 'Select the class IDs to delete.';
    const entries = ids.map(id => schedule.find(s => s.id === Number(id))).filter(Boolean);
    if (entries.length !== ids.length) return 'One or more selected classes were not found.';
    if (entries.some(entry => normalizePersonName(entry.professor) !== own)) return `You can only delete your own classes (${ownName}).`;
    return null;
  }
  if (action === 'find_substitute') {
    const requested = String(payload?.professor || ownName).trim();
    if (normalizePersonName(requested) !== own) return `You can only request substitutes for your own classes (${ownName}).`;
    return null;
  }
  return null;
}

const SYSTEM = (ctx) => `You are CampuSyncer, the AI scheduling agent for UE Dubai campus admin portal.
You can read and manage campus operational data: the schedule, rooms, professors, and announcements.
You are helpful and concise. Only use the actions listed below; never claim an action succeeded unless its result confirms success.
Staff accounts, passwords, security settings, and professor contact details must be managed directly in their protected admin screens, not by this assistant.

CURRENT CAMPUS DATA:
Rooms:
${ctx.roomCtx || 'No rooms.'}

Schedule (day 1=Mon…5=Fri):
${ctx.schedCtx}

Professors:
${ctx.profCtx}

Announcements:
${ctx.announcementCtx}

AVAILABLE ACTIONS (return as JSON):
You must always respond with this exact JSON structure:

{
  "reply": "conversational response to show the user",
  "action": null | "create_entry" | "update_entry" | "delete_entry" | "delete_multiple" | "create_room" | "update_room" | "delete_room" | "create_professor" | "update_professor" | "delete_professor" | "create_announcement" | "delete_announcement" | "duplicate_schedule" | "query" | "find_substitute" | "check_capacity" | "none",
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

create_room:
{ "id": "R101", "name": "Room name", "floor": 1, "type": "Classroom", "capacity": 30, "features": [], "maintenance": false }

update_room:
{ "id": "R101", "name": "...", "floor": 1, "type": "...", "capacity": 30, "features": [], "maintenance": false }

delete_room:
{ "id": "R101", "description": "what is being deleted" }

create_professor:
{ "name": "Professor name", "dept": "Department" }

update_professor:
{ "id": 123, "name": "...", "dept": "..." }

delete_professor:
{ "id": 123, "description": "what is being deleted" }

create_announcement:
{ "title": "...", "msg": "...", "type": "info|warning|urgent|exam", "expires": "YYYY-MM-DD" }

duplicate_schedule:
{ "sourceDays": [1,2,3,4,5], "weekOffset": 1, "label": "next week" }

delete_announcement:
{ "id": 123, "description": "what is being deleted" }

none:
{ } (for greetings or when no action is needed)

RULES:
- Always confirm before deletes, updates, or publishing an announcement
- For create_entry: check for conflicts first; if conflict exists, say so and suggest alternatives
- duplicate_schedule copies existing schedule entries to another week by repeating the same weekday pattern; it does not create calendar-dated events, it adds schedule entries
- Never delete a room that is still used by a schedule entry or a professor who is assigned to classes
- If a room or professor name is ambiguous, ask for clarification
- Day numbers: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5
- Times must be "HH:MM" 24h format
- If the user says "yes" or "confirm" after a confirm_required response, set confirm_required: false and execute
- Be concise in reply field — 1-2 sentences max
- For queries, answer directly in the reply field`;

const agentHandler = handler({
  async POST(req, res) {
    if (!requireAdmin(req, res)) return;

    const { message, history = [], pending_action, operational_state, model } = req.body || {};
    if (!message || typeof message !== 'string')
      return res.status(400).json({ error: 'message is required' });
    if (!operational_state || typeof operational_state !== 'object')
      return res.status(400).json({ error: 'Current admin data is required.' });
    try {
      store.setOperationalData(operational_state);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const ctx = getContext();

    if (pending_action) {
      if (message.trim().toLowerCase() !== 'confirmed' ||
          !VALID_ACTIONS.has(pending_action.action) ||
          !pending_action.payload || typeof pending_action.payload !== 'object' ||
          Array.isArray(pending_action.payload))
        return res.status(400).json({ error: 'The confirmed action is invalid.' });

      let result;
      try {
        result = await executeAction(pending_action.action, pending_action.payload, ctx);
      } catch (err) {
        console.error('[AI agent action failed]', err);
        result = { error: 'The action could not be completed.' };
      }
      return res.json({
        reply: result.error ? `⚠️ ${result.error}` : result.message || 'Done.',
        action: pending_action.action,
        confirm_required: false,
        confirm_message: null,
        pending_action: null,
        executed: !result.error,
        result,
        operational_state: store.getOperationalData(),
      });
    }

    if (!Array.isArray(history))
      return res.status(400).json({ error: 'history must be an array.' });

    // Build conversation history for context
    const historyCtx = history.slice(-6).map(h =>
      `${h.role === 'user' ? 'Admin' : 'CampuSyncer'}: ${h.content}`
    ).join('\n');

    const userPrompt = historyCtx
      ? `Previous conversation:\n${historyCtx}\n\nAdmin: ${message}`
      : `Admin: ${message}`;

    let parsed;
    try {
      parsed = await askJSON(SYSTEM(ctx), userPrompt, { model: getModel(model) });
    } catch (err) {
      console.error('[AI agent request failed]', err);
      return res.status(503).json({ error: publicErrorMessage(err) });
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return res.status(502).json({ error: 'The AI assistant returned an invalid response.' });

    let executionResult = null;
    const action = parsed.action == null ? 'none' : parsed.action;
    if (!VALID_ACTIONS.has(action))
      return res.status(502).json({ error: 'The AI assistant returned an unsupported action.' });
    const confirmRequired = parsed.confirm_required === true || CONFIRM_ACTIONS.has(action);
    if (confirmRequired && (!parsed.payload || typeof parsed.payload !== 'object' || Array.isArray(parsed.payload)))
      return res.status(502).json({ error: 'The AI assistant returned incomplete action details.' });
    if (typeof parsed.reply !== 'string') parsed.reply = '';

    if (action !== 'none' && action !== 'query' && !confirmRequired) {
      try {
        executionResult = await executeAction(action, parsed.payload, ctx);
        if (executionResult.error) {
          parsed.reply = `⚠️ ${executionResult.error}`;
        } else {
          parsed.reply = executionResult.message || parsed.reply;
        }
      } catch (e) {
        console.error('[AI agent action failed]', e);
        parsed.reply = '⚠️ The action could not be completed.';
      }
    }

    res.json({
      reply: parsed.reply || 'Done.',
      action,
      confirm_required: confirmRequired,
      confirm_message: confirmRequired ? parsed.confirm_message || 'This action changes campus data. Do you want to continue?' : null,
      pending_action: confirmRequired ? { action, payload: parsed.payload } : null,
      executed: !!executionResult && !executionResult?.error,
      result: executionResult,
      operational_state: store.getOperationalData(),
    });
  },
});

async function executeAction(action, payload, ctx) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return { error: 'Invalid action details.' };

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
      if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isSafeInteger(Number(id)) || Number(id) <= 0))
        return { error: 'Valid entry IDs are required.' };
      let deleted = 0;
      ids.forEach(id => { if (store.deleteEntry(parseInt(id))) deleted++; });
      return { message: `🗑️ Deleted ${deleted} entries (${description || ''})` };
    }

    case 'create_room': {
      const { id, name, floor, type, capacity, features = [], maintenance = false } = payload;
      if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || name.trim().length < 2 ||
          !Number.isInteger(Number(floor)) || !Number.isInteger(Number(capacity)) || Number(capacity) < 1 ||
          typeof type !== 'string' || !type.trim() || !Array.isArray(features) ||
          features.some(feature => typeof feature !== 'string') || typeof maintenance !== 'boolean')
        return { error: 'Room ID, name, floor, type, and positive capacity are required.' };
      const roomId = id.trim().toUpperCase();
      if (store.getRoom(roomId)) return { error: `Room ${roomId} already exists.` };
      const room = store.addRoom({
        id: roomId, name: name.trim(), floor: Number(floor), type: type.trim(),
        capacity: Number(capacity), features, maintenance,
      });
      return { message: `✅ Added room ${room.id} (${room.name}).`, room };
    }

    case 'update_room': {
      const { id, ...fields } = payload;
      if (typeof id !== 'string' || !id.trim()) return { error: 'Room ID is required.' };
      const roomId = id.trim().toUpperCase();
      const patch = {};
      for (const field of ['name', 'type']) {
        if (fields[field] !== undefined) {
          if (typeof fields[field] !== 'string' || !fields[field].trim())
            return { error: `${field} must be a non-empty string.` };
          patch[field] = fields[field].trim();
        }
      }
      for (const field of ['floor', 'capacity']) {
        if (fields[field] !== undefined) {
          if (!Number.isInteger(Number(fields[field])) || (field === 'capacity' && Number(fields[field]) < 1))
            return { error: `${field} must be a valid integer.` };
          patch[field] = Number(fields[field]);
        }
      }
      if (fields.features !== undefined) {
        if (!Array.isArray(fields.features) || fields.features.some(feature => typeof feature !== 'string'))
          return { error: 'features must be a list of strings.' };
        patch.features = fields.features;
      }
      if (fields.maintenance !== undefined) {
        if (typeof fields.maintenance !== 'boolean') return { error: 'maintenance must be true or false.' };
        patch.maintenance = fields.maintenance;
      }
      if (!Object.keys(patch).length) return { error: 'No valid room changes were provided.' };
      const room = store.updateRoom(roomId, patch);
      if (!room) return { error: `Room ${roomId} not found.` };
      return { message: `✅ Updated room ${roomId}.`, room };
    }

    case 'delete_room': {
      if (typeof payload.id !== 'string' || !payload.id.trim()) return { error: 'Room ID is required.' };
      const roomId = payload.id.trim().toUpperCase();
      if (store.getSchedule().some(entry => entry.roomId === roomId))
        return { error: `Room ${roomId} is still assigned to schedule entries. Move or remove those entries first.` };
      if (!store.deleteRoom(roomId)) return { error: `Room ${roomId} not found.` };
      return { message: `🗑️ Deleted room ${payload.description || roomId}.` };
    }

    case 'create_professor': {
      const { name, dept = '' } = payload;
      if (typeof name !== 'string' || name.trim().length < 2 || typeof dept !== 'string')
        return { error: 'A professor name is required; department must be text.' };
      if (store.getProfessors().some(prof => prof.name.toLowerCase() === name.trim().toLowerCase()))
        return { error: `Professor ${name.trim()} already exists.` };
      const professor = store.addProfessor({ name: name.trim(), dept: dept.trim(), email: '', phone: '' });
      return { message: `✅ Added professor ${professor.name}.`, professor };
    }

    case 'update_professor': {
      const id = Number(payload.id);
      if (!Number.isSafeInteger(id) || id <= 0) return { error: 'A valid professor ID is required.' };
      const professor = store.getProfessors().find(prof => prof.id === id);
      if (!professor) return { error: `Professor ${id} not found.` };
      const patch = {};
      for (const field of ['name', 'dept']) {
        if (payload[field] !== undefined) {
          if (typeof payload[field] !== 'string' || (field === 'name' && payload[field].trim().length < 2))
            return { error: `${field} must be valid text.` };
          patch[field] = payload[field].trim();
        }
      }
      if (!Object.keys(patch).length) return { error: 'No valid professor changes were provided.' };
      if (patch.name && store.getProfessors().some(prof => prof.id !== id && prof.name.toLowerCase() === patch.name.toLowerCase()))
        return { error: `Professor ${patch.name} already exists.` };
      if (patch.name && patch.name !== professor.name) {
        store.getSchedule().filter(entry => entry.professor === professor.name)
          .forEach(entry => store.updateEntry(entry.id, { professor: patch.name }));
      }
      const updated = store.updateProfessor(id, patch);
      return { message: `✅ Updated professor ${updated.name}.`, professor: updated };
    }

    case 'delete_professor': {
      const id = Number(payload.id);
      if (!Number.isSafeInteger(id) || id <= 0) return { error: 'A valid professor ID is required.' };
      const professor = store.getProfessors().find(prof => prof.id === id);
      if (!professor) return { error: `Professor ${id} not found.` };
      if (store.getSchedule().some(entry => entry.professor === professor.name))
        return { error: `${professor.name} is still assigned to schedule entries. Reassign or remove those entries first.` };
      if (!store.deleteProfessor(id)) return { error: `Professor ${id} not found.` };
      return { message: `🗑️ Deleted professor ${payload.description || professor.name}.` };
    }

    case 'create_announcement': {
      const { title, msg, type, expires } = payload;
      if (typeof title !== 'string' || title.trim().length < 3 || typeof msg !== 'string' || msg.trim().length < 5 ||
          !['info', 'warning', 'urgent', 'exam'].includes(type) ||
          typeof expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expires))
        return { error: 'A title, message, valid announcement type (info/warning/urgent/exam), and expiry date are required.' };
      const today = new Date().toISOString().slice(0, 10);
      const expiryDate = new Date(`${expires}T00:00:00.000Z`);
      if (Number.isNaN(expiryDate.getTime()) || expiryDate.toISOString().slice(0, 10) !== expires)
        return { error: 'Expiry date must be a valid calendar date.' };
      if (expires < today) return { error: 'Expiry date must be today or in the future.' };
      const announcement = store.addAnnouncement({ title: title.trim(), msg: msg.trim(), type, expires });
      return { message: `✅ Published announcement "${announcement.title}".`, announcement };
    }

    case 'delete_announcement': {
      const id = Number(payload.id);
      if (!Number.isSafeInteger(id) || id <= 0) return { error: 'A valid announcement ID is required.' };
      if (!store.deleteAnnouncement(id)) return { error: `Announcement ${id} not found.` };
      return { message: `🗑️ Deleted announcement ${payload.description || id}.` };
    }

    case 'query':
      return { message: payload.result || 'Query complete.' };

    case 'find_substitute':
      return { message: `Found substitute suggestions.`, suggestions: payload.suggestions };

    case 'duplicate_schedule': {
      const sourceDays = Array.isArray(payload.sourceDays) && payload.sourceDays.length
        ? [...new Set(payload.sourceDays.map(Number).filter(d => [1,2,3,4,5].includes(d)))]
        : [1,2,3,4,5];
      const weekOffset = Number(payload.weekOffset || 1);
      if (!Number.isInteger(weekOffset) || weekOffset < 1 || weekOffset > 12)
        return { error: 'weekOffset must be an integer between 1 and 12.' };
      if (!sourceDays.length) return { error: 'Select at least one weekday to duplicate.' };

      const source = store.getSchedule().filter(s => sourceDays.includes(Number(s.day)));
      if (!source.length) return { error: 'No classes found on the selected days to duplicate.' };

      const created = [];
      const conflicts = [];
      for (const entry of source) {
        const candidate = {
          day: entry.day,
          start: entry.start,
          end: entry.end,
          roomId: entry.roomId,
          course: entry.course,
          code: entry.code,
          professor: entry.professor,
          program: entry.program,
          semester: entry.semester || 'Fall 2026',
        };
        if (store.hasConflict(candidate.roomId, candidate.day, candidate.start, candidate.end)) {
          conflicts.push(`${DAY_NAMES[candidate.day]} ${candidate.start}-${candidate.end} ${candidate.roomId} ${candidate.course}`);
          continue;
        }
        created.push(store.addEntry(candidate));
      }

      const label = payload.label ? String(payload.label) : `next ${weekOffset === 1 ? 'week' : weekOffset + ' weeks'}`;
      const msg = conflicts.length
        ? `⚠️ Duplicated ${created.length} class(es) for ${label}. Skipped ${conflicts.length} due to conflicts: ${conflicts.slice(0, 5).join('; ')}${conflicts.length > 5 ? '…' : ''}`
        : `✅ Duplicated ${created.length} class(es) for ${label}.`;
      return { message: msg, created: created.length, conflicts };
    }

    case 'check_capacity':
      return { message: `Capacity check complete.`, violations: payload.violations };

    default:
      return { error: 'Unsupported action.' };
  }
}

// Exported so the staff/professor chatbot can reuse the same action engine.
module.exports = agentHandler;
module.exports.VALID_ACTIONS = VALID_ACTIONS;
module.exports.CONFIRM_ACTIONS = CONFIRM_ACTIONS;
module.exports.getContext = getContext;
module.exports.SYSTEM = SYSTEM;
module.exports.executeAction = executeAction;
module.exports.resolveProfessor = resolveProfessor;
module.exports.enforceOwnScheduleAction = enforceOwnScheduleAction;
