// api/ai/suggest.js — POST /api/ai/suggest
// Natural language → available room slot suggestions
// Body: { query: "find me a lab Thursday afternoon for 20 students" }

const handler    = require('../../http');
const store      = require('../../store');
const { askJSON, publicErrorMessage } = require('../../ai');

const DAYS = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5,
               mon:1, tue:2, wed:3, thu:4, fri:5 };

module.exports = handler({
  async POST(req, res) {
    const { query, history } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim())
      return res.status(400).json({ error: 'query is required' });

    const rooms    = store.getRooms();
    const schedule = store.getSchedule();

    // Build a compact context for the AI model
    const roomCtx = rooms.map(r =>
      `${r.id}: ${r.name}, ${r.type}, capacity ${r.capacity}, floor ${r.floor}, features: ${(r.features||[]).join(', ')}`
    ).join('\n');

    const schedCtx = schedule.map(s =>
      `${s.roomId} day${s.day} ${s.start}-${s.end}: ${s.course} (${s.code}) professor:${s.professor || ''} program:${s.program || ''}`
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

    const studentProgram = String(chatCtx?.program || '').trim();
    const studentName = String(chatCtx?.studentName || '').trim();
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const currentDayName = dayNames[chatCtx?.currentDay] || 'unknown';
    const norm = s => String(s || '').toLowerCase().trim();
    const progCat = p => {
      const s = norm(p);
      if (!s) return '';
      if (s.includes('mba')) return 'mba';
      if (s.startsWith('ma ') || s.startsWith('msc') || s.includes('master')) return 'master';
      if (s.startsWith('ba ') || s.startsWith('bsc') || s.includes('bachelor')) return 'bachelor';
      return s;
    };
    const studentCat = progCat(studentProgram);
    const allPrograms = new Set(schedule.map(s => norm(s.program)).filter(p => p && p !== 'all programs'));
    const exactCourse = allPrograms.has(norm(studentProgram));
    const showAll = !studentCat || studentCat === 'other';
    const matchesProgram = entryProgram => {
      const ep = norm(entryProgram);
      if (!ep || ep === 'all programs') return true;
      if (showAll) return false;
      if (exactCourse) return ep === norm(studentProgram);
      return progCat(ep) === studentCat;
    };
    const mySchedule = (!showAll ? schedule.filter(s => matchesProgram(s.program)) : schedule)
      .slice(0, 120)
      .map(s => `day${s.day}(${dayNames[s.day] || s.day}) ${s.start}-${s.end} room:${s.roomId} course:"${s.course}" code:${s.code} professor:${s.professor || 'TBA'} program:"${s.program || ''}"`)
      .join('\n');
    const todayMine = (!showAll ? schedule.filter(s => s.day === chatCtx?.currentDay && matchesProgram(s.program)) : [])
      .sort((a, b) => String(a.start).localeCompare(String(b.start)))
      .map(s => `${s.start}-${s.end} | ${s.course} (${s.code}) | Room ${s.roomId} | Professor: ${s.professor || 'TBA'}`)
      .join('\n');

    const system = `You are CampuSyncer, the AI assistant for UE Dubai campus room portal.
${isChatbot ? `You are warm, personable, and conversational. Never pretend to be human.
Answer from the campus data provided below. Never invent rooms, classes, professors, or times.

SIGNED-IN STUDENT CONTEXT (already known - do not ask them to repeat it):
- Name: ${studentName || 'Visitor'}
- Program/Degree: ${studentProgram || 'not set'}
- Current day: ${currentDayName} (index ${chatCtx?.currentDay || 'unknown'})
- Current time: ${chatCtx?.currentTime || 'unknown'}

PERSONALIZATION RULES (very important):
- If the student asks for "my next class", "my schedule", "my professor", "who teaches me", "my first class", "what do I have today/tomorrow", answer directly using their Program/Degree and the schedule below. DO NOT ask for course code, course name, or degree if their program is already known.
- Use "Today's classes for this student" first when asking about today/next/first class/professor today.
- If program is known, only use classes matching that program (or "All Programs"). You may say "Based on the ${studentProgram} schedule..." but still answer clearly.
- If a specific class is found, always include: course name, code, time, room, and professor.
- If asking for "my professor" generally, give the professor(s) for their upcoming/today classes in their program; if multiple, list them clearly.
- Only ask a follow-up question if the answer is genuinely ambiguous after checking the provided schedule (e.g., no classes found for that day). Never ask them to provide course code as a default.
- If program is not set, politely ask them to set your course once by clicking your profile icon, and meanwhile you can show all programs' classes if they ask.
` : ''}
Rooms available:
${roomCtx}

Current bookings (day 1=Mon … 5=Fri), all programs:
${schedCtx || 'No bookings yet.'}

${isChatbot ? `Schedule relevant to signed-in student's program (${studentProgram || 'not set'}):
${mySchedule || 'No matching program classes found in schedule data.'}

Today's classes for this student (${currentDayName}):
${todayMine || 'No classes found for this student today in the schedule data.'}
` : ''}
Rules:
- Working hours: 08:00–20:00
- Slots are typically 1–3 hours
- Do NOT suggest a room+day+time that is already booked
- Return JSON only, no prose
- For greetings/small talk/general campus questions, answer in "understood" and leave "suggestions" empty.
- For room-finding requests, provide "suggestions".

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
      const result = await askJSON(system, userPrompt, { temperature: 0.4 });
      if (result && typeof result === 'object' && !result.understood && typeof result.answer === 'string') {
        result.understood = result.answer;
      }
      res.json(result);
    } catch (err) {
      console.error('[AI suggestion failed]', err);
      res.status(503).json({ error: publicErrorMessage(err) });
    }
  },
});
