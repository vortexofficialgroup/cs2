// lib/ai-capabilities.js — per-staff AI chatbot capabilities.
// Each capability unlocks a set of CampuSyncer agent actions. The admin agent
// is not limited by this list; only the staff/professor chatbot is.

const CAPABILITIES = {
  read_data: {
    label: 'Read campus data',
    hint: 'Answer questions about classes, rooms and professors',
    actions: ['query'],
  },
  substitutes: {
    label: 'Find a substitute professor',
    hint: 'e.g. "I am sick — who can cover my class?"',
    actions: ['find_substitute'],
  },
  capacity: {
    label: 'Check room capacity',
    hint: 'Find classes assigned to rooms that are too small',
    actions: ['check_capacity'],
  },
  schedule: {
    label: 'Change your own schedule',
    hint: 'Add, move or delete only your own classes',
    actions: ['create_entry', 'update_entry', 'delete_entry', 'delete_multiple'],
  },
  rooms: {
    label: 'Manage rooms',
    hint: 'Add, edit or remove rooms',
    actions: ['create_room', 'update_room', 'delete_room'],
  },
  professors: {
    label: 'Manage professors',
    hint: 'Add, edit or remove professors',
    actions: ['create_professor', 'update_professor', 'delete_professor'],
  },
  announcements: {
    label: 'Publish announcements',
    hint: 'Post or remove campus announcements',
    actions: ['create_announcement', 'delete_announcement'],
  },
};

const DEFAULT_CAPABILITIES = ['read_data', 'substitutes', 'capacity'];

function normalize(capabilities) {
  if (!Array.isArray(capabilities)) return [];
  return [...new Set(capabilities.filter(cap => Object.prototype.hasOwnProperty.call(CAPABILITIES, cap)))];
}

function actionsFor(capabilities) {
  return [...new Set(normalize(capabilities).flatMap(cap => CAPABILITIES[cap].actions))];
}

module.exports = { CAPABILITIES, DEFAULT_CAPABILITIES, normalize, actionsFor };
