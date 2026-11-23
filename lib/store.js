// lib/store.js — In-memory store (replace with DB adapter in production)
// Supabase: npm install @supabase/supabase-js
// Neon:    npm install @neondatabase/serverless

const data = require('../data-server.js');

let _rooms         = data.ROOMS;
let _schedule      = data.SCHEDULE;
let _announcements = data.ANNOUNCEMENTS;
let _professors    = data.PROFESSORS;

function replaceContents(target, next) {
  target.splice(0, target.length, ...next);
}

// ─── Rooms ───────────────────────────────────────────────────────────────
module.exports = {
  setOperationalData: ({ rooms, schedule, announcements, professors }) => {
    if (![rooms, schedule, announcements, professors].every(Array.isArray))
      throw new TypeError('Operational data must include rooms, schedule, announcements, and professors arrays.');
    replaceContents(_rooms, rooms);
    replaceContents(_schedule, schedule);
    replaceContents(_announcements, announcements);
    replaceContents(_professors, professors);
  },
  getOperationalData: () => ({
    rooms: _rooms,
    schedule: _schedule,
    announcements: _announcements,
    professors: _professors,
  }),

  getRooms:  () => _rooms,
  getRoom:   (id) => _rooms.find(r => r.id === id),
  addRoom:   (room) => { _rooms.push(room); return room; },
  updateRoom: (id, patch) => {
    const idx = _rooms.findIndex(r => r.id === id);
    if (idx < 0) return null;
    _rooms[idx] = { ..._rooms[idx], ...patch };
    return _rooms[idx];
  },
  deleteRoom: (id) => {
    const idx = _rooms.findIndex(r => r.id === id);
    if (idx < 0) return false;
    _rooms.splice(idx, 1);
    return true;
  },

  // ─── Schedule ──────────────────────────────────────────────────────────
  getSchedule: (day) => day ? _schedule.filter(s => s.day === day) : _schedule,
  getEntry:    (id) => _schedule.find(s => s.id === id),
  addEntry: (entry) => {
    const newEntry = { id: Date.now(), ...entry };
    _schedule.push(newEntry);
    return newEntry;
  },
  updateEntry: (id, patch) => {
    const idx = _schedule.findIndex(s => s.id === id);
    if (idx < 0) return null;
    _schedule[idx] = { ..._schedule[idx], ...patch };
    return _schedule[idx];
  },
  deleteEntry: (id) => {
    const idx = _schedule.findIndex(s => s.id === id);
    if (idx < 0) return false;
    _schedule.splice(idx, 1);
    return true;
  },
  hasConflict: (roomId, day, start, end, excludeId) => {
    const t2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return _schedule.some(s =>
      s.roomId === roomId &&
      s.day    === day    &&
      t2m(s.start) < t2m(end)   &&
      t2m(s.end)   > t2m(start) &&
      s.id !== excludeId
    );
  },

  // ─── Announcements ─────────────────────────────────────────────────────
  getAnnouncements: () => _announcements,
  addAnnouncement: (ann) => {
    const a = { id: Date.now(), created: new Date().toISOString().split('T')[0], ...ann };
    _announcements.push(a);
    return a;
  },
  deleteAnnouncement: (id) => {
    const idx = _announcements.findIndex(a => a.id === id);
    if (idx < 0) return false;
    _announcements.splice(idx, 1);
    return true;
  },

  // ─── Professors ────────────────────────────────────────────────────────
  getProfessors: () => _professors,
  addProfessor: (prof) => {
    const p = { id: Date.now(), ...prof };
    _professors.push(p);
    return p;
  },
  updateProfessor: (id, patch) => {
    const idx = _professors.findIndex(p => p.id === id);
    if (idx < 0) return null;
    _professors[idx] = { ..._professors[idx], ...patch };
    return _professors[idx];
  },
  deleteProfessor: (id) => {
    const idx = _professors.findIndex(p => p.id === id);
    if (idx < 0) return false;
    _professors.splice(idx, 1);
    return true;
  },
};
