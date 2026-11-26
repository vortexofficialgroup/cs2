// api/ai/staff-agent.js — POST /api/ai/staff-agent
// Staff/professor chatbot. Uses the same action engine as the admin agent, but
// every action is checked against that staff member's admin-configured AI capabilities.

const handler        = require('../../http');
const store          = require('../../store');
const { askJSON, getModel, publicErrorMessage } = require('../../ai');
const { requirePermission, getUser } = require('../../auth');
const agent          = require('./agent');
const { actionsFor } = require('../../ai-capabilities');
const ssoStaff       = require('../../sso-staff-store');
const { persistAction } = require('../../shared-state-writer');
const changeLog      = require('../../change-log');
const rateLimit      = require('../../rate-limit');

// Every successful staff change is recorded for the administrator.
async function recordChange(req, viewer, action, payload) {
  if (!changeLog.isChange(action)) return;
  try {
    const p = payload && typeof payload === 'object' ? payload : {};
    const target = p.id !== undefined ? p.id
      : Array.isArray(p.ids) ? p.ids.join(',')
      : p.name || p.course || p.email || p.title || '';
    await changeLog.append({
      actorType: 'staff',
      actor: viewer.displayName || viewer.username || '',
      email: viewer.email || viewer.username || '',
      action,
      target: String(target),
      detail: JSON.stringify(p),
      ok: true,
      ip: rateLimit.ip(req),
    });
  } catch (err) {
    console.error('[staff change log]', err);
  }
}

module.exports = handler({
  async POST(req, res) {
    if (!await requirePermission(req, res, 'chatbot')) return;

    const { message, history = [], pending_action, operational_state } = req.body || {};
    if (!message || typeof message !== 'string')
      return res.status(400).json({ error: 'message is required' });
    if (!operational_state || typeof operational_state !== 'object')
      return res.status(400).json({ error: 'Current campus data is required.' });
    try {
      store.setOperationalData(operational_state);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!Array.isArray(history))
      return res.status(400).json({ error: 'history must be an array.' });

    // Capabilities are set per staff account by the administrator. For
    // Microsoft accounts, re-read the record so edits take effect immediately.
    const viewer = await getUser(req, res);
    if (!viewer) return;
    let capabilities = Array.isArray(viewer.aiActions) ? viewer.aiActions : [];
    let linkedProfessor = typeof viewer.linkedProfessor === 'string' ? viewer.linkedProfessor : '';
    if (viewer.sso && ssoStaff.configured()) {
      try {
        const current = await ssoStaff.findByEmail(viewer.username);
        if (current) {
          capabilities = current.aiActions;
          linkedProfessor = current.linkedProfessor || '';
        }
      } catch (err) {
        console.error('[staff chatbot capabilities]', err);
      }
    }
    const allowed = new Set(actionsFor(capabilities));

    const ctx = agent.getContext();
    // Only an explicit choice counts as "my classes"; None means general staff.
    const ownProfessor = agent.resolveProfessor(linkedProfessor, ctx.professors);
    const denied = (reason) => ({
      reply: reason || 'I’m not allowed to do that. The administrator controls what this chatbot can do — please ask them to enable that capability.',
      action: 'none',
      confirm_required: false,
      confirm_message: null,
      pending_action: null,
      executed: false,
      result: null,
      operational_state: store.getOperationalData(),
    });
    const enforceOwn = (action, payload) => {
      if (action === 'none' || action === 'query') return null;
      if (action === 'duplicate_schedule') return 'Only administrators can duplicate the schedule. Ask an administrator to use the Admin AI Assistant.';
      if (['create_room','update_room','delete_room','create_professor','update_professor','delete_professor','create_announcement','delete_announcement','check_capacity'].includes(action)) {
        return null; // capability-gated above; admin decides if this staff can do it
      }
      if (!ownProfessor) return null; // General staff: capability-gated and fully logged.
      return agent.enforceOwnScheduleAction(action, payload, ownProfessor.name, ctx.schedule);
    };

    if (pending_action) {
      if (message.trim().toLowerCase() !== 'confirmed' ||
          !agent.VALID_ACTIONS.has(pending_action.action) ||
          !allowed.has(pending_action.action) ||
          !pending_action.payload || typeof pending_action.payload !== 'object' ||
          Array.isArray(pending_action.payload))
        return res.status(400).json({ error: 'That action is not allowed or is invalid.' });

      const ownError = enforceOwn(pending_action.action, pending_action.payload);
      if (ownError) return res.json(denied(ownError));

      let result;
      try {
        result = await agent.executeAction(pending_action.action, pending_action.payload, ctx);
      } catch (err) {
        console.error('[staff chatbot action failed]', err);
        result = { error: 'The action could not be completed.' };
      }
      const saved = !result.error ? await persistAction(pending_action.action, store.getOperationalData()) : null;
      const failedSave = saved && !saved.saved && !saved.skipped;
      if (!result.error && !failedSave)
        await recordChange(req, viewer, pending_action.action, pending_action.payload);
      return res.json({
        reply: result.error ? `⚠️ ${result.error}` : failedSave ? `⚠️ ${saved.error}` : result.message || 'Done.',
        action: pending_action.action,
        confirm_required: false,
        confirm_message: null,
        pending_action: null,
        executed: !result.error && !failedSave,
        result,
        operational_state: store.getOperationalData(),
      });
    }

    const historyCtx = history.slice(-6).map(h =>
      `${h.role === 'user' ? 'Staff member' : 'CampuSyncer'}: ${h.content}`
    ).join('\n');
    const userPrompt = historyCtx
      ? `Previous conversation:\n${historyCtx}\n\nStaff member: ${message}`
      : `Staff member: ${message}`;

    const system = `${agent.SYSTEM(ctx)}

STAFF MODE — IMPORTANT:
You are assisting ${ownProfessor ? ownProfessor.name : (viewer.displayName || viewer.username)}, not an administrator.
You may ONLY use these actions: ${[...allowed].join(', ') || 'none'}.
${ownProfessor ? `Your linked professor profile is "${ownProfessor.name}". You may only modify schedule entries taught by "${ownProfessor.name}". When the user says "I", "my class", or "I'm sick", refer to classes taught by "${ownProfessor.name}" only.` : 'Your account is not linked to a professor profile (None). You may use your allowed capabilities on the campus schedule; every change you make is recorded for the administrator.'}
If the request affects another professor's classes or needs a forbidden action, reply with action "none" and explain why. Never output a forbidden action.`;

    let parsed;
    try {
      parsed = await askJSON(system, userPrompt, { model: getModel() });
    } catch (err) {
      console.error('[staff chatbot request failed]', err);
      return res.status(503).json({ error: publicErrorMessage(err) });
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return res.status(502).json({ error: 'The AI assistant returned an invalid response.' });

    const action = parsed.action == null ? 'none' : parsed.action;
    if (!agent.VALID_ACTIONS.has(action))
      return res.status(502).json({ error: 'The AI assistant returned an unsupported action.' });
    if (action !== 'none' && !allowed.has(action)) return res.json(denied());

    const confirmRequired = parsed.confirm_required === true || agent.CONFIRM_ACTIONS.has(action);
    if (confirmRequired && (!parsed.payload || typeof parsed.payload !== 'object' || Array.isArray(parsed.payload)))
      return res.status(502).json({ error: 'The AI assistant returned incomplete action details.' });
    if (typeof parsed.reply !== 'string') parsed.reply = '';

    const ownError = enforceOwn(action, parsed.payload);
    if (ownError) return res.json(denied(ownError));

    let executionResult = null;
    if (action !== 'none' && action !== 'query' && !confirmRequired) {
      try {
        executionResult = await agent.executeAction(action, parsed.payload, ctx);
        if (executionResult.error) {
          parsed.reply = `⚠️ ${executionResult.error}`;
        } else {
          const saved = await persistAction(action, store.getOperationalData());
          if (saved && !saved.saved && !saved.skipped) {
            parsed.reply = `⚠️ ${saved.error}`;
            executionResult.error = saved.error;
          } else {
            parsed.reply = executionResult.message || parsed.reply;
            await recordChange(req, viewer, action, parsed.payload);
          }
        }
      } catch (e) {
        console.error('[staff chatbot action failed]', e);
        parsed.reply = '⚠️ The action could not be completed.';
      }
    }

    res.json({
      reply: parsed.reply || 'Done.',
      action,
      confirm_required: confirmRequired,
      confirm_message: confirmRequired ? parsed.confirm_message || 'This action changes campus data. Do you want to continue?' : null,
      pending_action: confirmRequired ? { action, payload: parsed.payload } : null,
      executed: !!executionResult && !executionResult.error,
      result: executionResult,
      operational_state: store.getOperationalData(),
    });
  },
});
