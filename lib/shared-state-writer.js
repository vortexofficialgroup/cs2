// lib/shared-state-writer.js — persist chatbot changes to the shared Supabase state.
// Mirrors the section keys used by api/state.js so staff-chat actions show up
// for students and admins without needing edit permissions on the data tabs.

const SCHEDULE_ACTIONS = new Set(['create_entry', 'update_entry', 'delete_entry', 'delete_multiple']);
const ROOM_ACTIONS = new Set(['create_room', 'update_room', 'delete_room']);
const PROFESSOR_ACTIONS = new Set(['create_professor', 'update_professor', 'delete_professor']);
const ANNOUNCEMENT_ACTIONS = new Set(['create_announcement', 'delete_announcement']);

function patchFor(action, state) {
  const patch = {};
  if (SCHEDULE_ACTIONS.has(action)) patch.sc = state.schedule;
  if (ROOM_ACTIONS.has(action)) patch.rooms = state.rooms;
  if (PROFESSOR_ACTIONS.has(action)) {
    patch.pr = state.professors;
    // Renaming a professor also rewrites schedule entries.
    if (action === 'update_professor') patch.sc = state.schedule;
  }
  if (ANNOUNCEMENT_ACTIONS.has(action)) patch.an = state.announcements;
  return patch;
}

async function persistAction(action, state) {
  const patch = patchFor(action, state);
  if (!Object.keys(patch).length) return { saved: false, skipped: true };

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return { saved: false, error: 'Shared storage is not configured.' };

  const url = SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(`${url}/rest/v1/rpc/merge_portal_state`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_patch: patch }),
  });
  if (!response.ok)
    return { saved: false, error: `Could not save shared data (${response.status}).` };
  return { saved: true };
}

module.exports = { persistAction, patchFor };
