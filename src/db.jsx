// Prism — Supabase data access layer. All DB queries live here.
// Every function checks window.__sb first and returns null on failure so
// callers can fall back to mock data transparently.

const _sb = () => window.__sb;

const isUUID = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

/* ─── Audit trail (SEC 17a-3 / FINRA) ────────────────────────────────
   Append-only. dbAudit() is fire-and-forget: callers never await it and
   a failure never blocks the user action. Actor identity comes from
   window.__pxAuthActor, set by auth.jsx after role detection. */
async function dbAudit(action, opts = {}) {
  const sb = _sb();
  const actor = window.__pxAuthActor;
  if (!sb || !actor?.id) return; // demo mode / no session — nothing to record
  try {
    await sb.from('audit_log').insert({
      actor_id:    actor.id,
      actor_role:  actor.role  || null,
      actor_email: actor.email || null,
      firm_id:     actor.firm_id || null,
      action,
      entity_type: opts.entityType || null,
      entity_id:   opts.entityId != null ? String(opts.entityId) : null,
      client_id:   isUUID(opts.clientId) ? opts.clientId : null,
      summary:     opts.summary || null,
      metadata:    opts.metadata || {},
      user_agent:  typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
    });
  } catch (e) { console.warn('[db] audit:', e.message); }
}

async function dbGetAuditLog({ limit = 100, clientId = null } = {}) {
  if (!_sb()) return null;
  try {
    let q = _sb()
      .from('audit_log')
      .select('id, occurred_at, actor_email, actor_role, action, entity_type, entity_id, client_id, summary')
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (isUUID(clientId)) q = q.eq('client_id', clientId);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getAuditLog:', e.message); return null; }
}

/* ─── Time helper ────────────────────────────────────────────────── */
const timeAgo = (iso) => {
  if (!iso) return '?';
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 60)  return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
};

/* ─── Client roster ──────────────────────────────────────────────── */
const CLIENT_COLS = 'id, household_name, short_name, household_tag, current_phase, notes, active, updated_at, last_meeting_at, aum, uninvested_cash, pipeline_stage';

async function dbGetClients(advisorId, { page = 0, pageSize = 50 } = {}) {
  if (!_sb() || !isUUID(advisorId)) return null;
  try {
    const from = page * pageSize;
    const to   = from + pageSize - 1;
    const { data, error, count } = await _sb()
      .from('clients')
      .select(CLIENT_COLS, { count: 'exact' })
      .eq('advisor_id', advisorId)
      .eq('active', true)
      .order('household_name')
      .range(from, to);
    if (error) throw error;
    return { rows: data, total: count ?? 0 };
  } catch (e) { console.warn('[db] getClients:', e.message); return null; }
}

// For firm admins: all advisors in the caller's firm (RLS filters automatically)
async function dbGetAdvisors() {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb()
      .from('advisors')
      .select('id, full_name, email, role, credentials, active, created_at, auth_user_id')
      .eq('active', true)
      .order('full_name');
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getAdvisors:', e.message); return null; }
}

// For firm admins: all active clients in the firm (RLS policy clients_select_firm_admin)
async function dbGetFirmClients() {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb()
      .from('clients')
      .select('id, advisor_id, aum, current_phase')
      .eq('active', true);
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getFirmClients:', e.message); return null; }
}

// Map a DB clients row to the shape the UI components expect
function mapClient(c) {
  const name = c.household_name || 'Unknown';
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return {
    id:             c.id,
    name,
    shortName:      c.short_name || name,
    tag:            c.household_tag || '—',
    initials,
    aum:            Number(c.aum) || 0,
    phase:          c.current_phase || 0,
    phaseProgress:  0,
    lastActivity:   timeAgo(c.updated_at),
    lastReview:     c.last_meeting_at ? timeAgo(c.last_meeting_at) : null,
    updatedAt:      c.updated_at || null,
    recent:         (Date.now() - new Date(c.updated_at)) < 86400000,
    uninvestedCash: Number(c.uninvested_cash) || 0,
    monthlyOutflow: 0,
    accentHue:      (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 19) % 360,
    notes:          c.notes || '',
    pipelineStage:  c.pipeline_stage || 'active',
  };
}

async function dbCreateClient(advisorId, firmId, fields) {
  if (!_sb() || !isUUID(advisorId) || !isUUID(firmId)) return null;
  try {
    const { data, error } = await _sb()
      .from('clients')
      .insert({
        advisor_id:     advisorId,
        firm_id:        firmId,
        household_name: fields.household_name,
        short_name:     fields.short_name || fields.household_name,
        household_tag:  fields.household_tag || '',
        current_phase:  Number(fields.current_phase) || 0,
        active:         true,
      })
      .select(CLIENT_COLS)
      .single();
    if (error) throw error;
    dbAudit('client.create', { entityType: 'client', entityId: data.id, clientId: data.id,
      summary: `Created client ${data.household_name}` });
    return data;
  } catch (e) { console.warn('[db] createClient:', e.message); return null; }
}

async function dbUpdateClient(clientId, fields) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const allowed = {};
    if (fields.household_name !== undefined) allowed.household_name = fields.household_name;
    if (fields.short_name     !== undefined) allowed.short_name     = fields.short_name;
    if (fields.household_tag  !== undefined) allowed.household_tag  = fields.household_tag;
    if (fields.current_phase  !== undefined) allowed.current_phase  = Number(fields.current_phase);
    if (fields.notes          !== undefined) allowed.notes          = fields.notes;
    if (fields.pipeline_stage !== undefined) allowed.pipeline_stage = fields.pipeline_stage;
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await _sb()
      .from('clients')
      .update(allowed)
      .eq('id', clientId)
      .select(CLIENT_COLS)
      .single();
    if (error) throw error;
    dbAudit('client.update', { entityType: 'client', entityId: clientId, clientId,
      summary: `Updated client ${data.household_name}`, metadata: { fields: Object.keys(allowed) } });
    return data;
  } catch (e) { console.warn('[db] updateClient:', e.message); return null; }
}

async function dbArchiveClient(clientId) {
  if (!_sb() || !isUUID(clientId)) return;
  try {
    const { error } = await _sb()
      .from('clients')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', clientId);
    if (error) throw error;
    dbAudit('client.archive', { entityType: 'client', entityId: clientId, clientId,
      summary: 'Archived client (removed from active roster)' });
  } catch (e) { console.warn('[db] archiveClient:', e.message); }
}

async function dbUpdateClientNotes(clientId, notes) {
  if (!_sb() || !isUUID(clientId)) return;
  try {
    const { error } = await _sb()
      .from('clients')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', clientId);
    if (error) throw error;
    dbAudit('client.notes', { entityType: 'client', entityId: clientId, clientId,
      summary: 'Updated advisor notes' });
  } catch (e) { console.warn('[db] updateClientNotes:', e.message); }
}

/* ─── Accounts ───────────────────────────────────────────────────── */
const ACCOUNT_TYPE_LABELS = {
  taxable:       'Taxable Brokerage',
  ira_traditional: 'Traditional IRA',
  ira_roth:      'Roth IRA',
  hsa:           'HSA',
  '401k':        '401(k) / 403(b)',
  other:         'Other',
};

async function dbGetAccounts(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('accounts')
      .select('id, client_id, type, custodian, name, balance, cash, as_of, updated_at, source, external_id')
      .eq('client_id', clientId)
      .is('archived_at', null)
      .order('type');
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getAccounts:', e.message); return null; }
}

async function dbUpsertAccount(account) {
  if (!_sb() || !isUUID(account.client_id)) return null;
  try {
    const payload = {
      client_id:  account.client_id,
      type:       account.type || 'other',
      custodian:  account.custodian || null,
      name:       account.name || null,
      balance:    Number(account.balance) || 0,
      cash:       Number(account.cash) || 0,
      as_of:      account.as_of || new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    };
    if (isUUID(account.id)) payload.id = account.id;

    const { data, error } = await _sb()
      .from('accounts')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    dbAudit(isUUID(account.id) ? 'account.update' : 'account.create', {
      entityType: 'account', entityId: data.id, clientId: account.client_id,
      summary: `${isUUID(account.id) ? 'Updated' : 'Added'} ${payload.type} account`,
      metadata: { balance: payload.balance, cash: payload.cash, custodian: payload.custodian } });
    return data;
  } catch (e) { console.warn('[db] upsertAccount:', e.message); return null; }
}

// Soft delete (SEC 17a-4): mark archived rather than erase the record.
async function dbDeleteAccount(id, clientId) {
  if (!_sb() || !isUUID(id)) return;
  try {
    const { error } = await _sb().from('accounts')
      .update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    dbAudit('account.archive', { entityType: 'account', entityId: id, clientId,
      summary: 'Archived account (record retained per 17a-4)' });
  } catch (e) { console.warn('[db] deleteAccount:', e.message); }
}

// Recompute AUM/cash from accounts and write back to the client row
async function dbSyncClientTotals(clientId) {
  if (!_sb() || !isUUID(clientId)) return;
  try {
    const accts = await dbGetAccounts(clientId);
    if (!accts) return;
    const aum            = accts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const uninvested_cash = accts.reduce((s, a) => s + (Number(a.cash)    || 0), 0);
    await _sb().from('clients').update({ aum, uninvested_cash, updated_at: new Date().toISOString() }).eq('id', clientId);
    return { aum, uninvested_cash };
  } catch (e) { console.warn('[db] syncClientTotals:', e.message); }
}

/* ─── Profile ────────────────────────────────────────────────────── */
async function dbGetProfile(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('profiles')
      .select('data')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error) throw error;
    return data?.data || null;
  } catch (e) { console.warn('[db] getProfile:', e.message); return null; }
}

async function dbSaveProfile(clientId, profileData) {
  if (!_sb() || !isUUID(clientId)) return;
  try {
    const { error } = await _sb()
      .from('profiles')
      .upsert({ client_id: clientId, data: profileData, updated_at: new Date().toISOString() },
               { onConflict: 'client_id' });
    if (error) throw error;
    // Append an immutable version snapshot (15e) — failure must not block the save
    try {
      await _sb().from('profile_versions').insert({
        client_id: clientId, data: profileData, saved_by: window.__pxAuthActor?.id || null });
    } catch (ve) { console.warn('[db] profileVersion:', ve.message); }
    dbAudit('profile.save', { entityType: 'profile', entityId: clientId, clientId,
      summary: 'Saved household financial profile' });
  } catch (e) { console.warn('[db] saveProfile:', e.message); }
}

async function dbGetProfileVersions(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('profile_versions')
      .select('id, version, saved_at, saved_by')
      .eq('client_id', clientId)
      .order('version', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getProfileVersions:', e.message); return null; }
}

/* ─── Task states ────────────────────────────────────────────────── */
async function dbGetTaskStates(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('task_states')
      .select('phase_id, task_id, done')
      .eq('client_id', clientId);
    if (error) throw error;
    const result = {};
    for (const row of data || []) {
      if (!result[row.phase_id]) result[row.phase_id] = {};
      result[row.phase_id][row.task_id] = row.done;
    }
    return result;
  } catch (e) { console.warn('[db] getTaskStates:', e.message); return null; }
}

async function dbUpsertTask(clientId, phaseId, taskId, done) {
  if (!_sb() || !isUUID(clientId)) return;
  try {
    const { error } = await _sb()
      .from('task_states')
      .upsert(
        { client_id: clientId, phase_id: Number(phaseId), task_id: taskId, done,
          ...(done ? { done_at: new Date().toISOString() } : {}) },
        { onConflict: 'client_id,phase_id,task_id' }
      );
    if (error) throw error;
  } catch (e) { console.warn('[db] upsertTask:', e.message); }
}

/* ─── Flagged questions ──────────────────────────────────────────── */
async function dbGetFlaggedQuestions(advisorId) {
  if (!_sb() || !isUUID(advisorId)) return null;
  try {
    const { data, error } = await _sb()
      .from('flagged_questions')
      .select('id, client_id, phase_id, task_id, question_text, status, created_at, clients(household_name, short_name)')
      .eq('advisor_id', advisorId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getFlaggedQuestions:', e.message); return null; }
}

function mapFlaggedQuestion(q) {
  const phase = phasesData.find(p => p.id === q.phase_id);
  const task  = phase?.tasks.find(t => t.id === q.task_id);
  return {
    id:       q.id,
    clientId: q.client_id,
    timeAgo:  timeAgo(q.created_at),
    quote:    q.question_text || '(question flagged)',
    context:  `Flagged on · Phase ${phase?.num || '??'} · ${task?.label || q.task_id}`,
    _clientName: q.clients?.short_name || q.clients?.household_name || 'Client',
  };
}

async function dbFlagQuestion(clientId, advisorId, phaseId, taskId, flag, questionText = '') {
  if (!_sb() || !isUUID(clientId) || !isUUID(advisorId)) return;
  try {
    if (flag) {
      // Reopen an existing resolved row rather than inserting a duplicate
      const { data: existing } = await _sb()
        .from('flagged_questions')
        .select('id')
        .eq('client_id', clientId)
        .eq('advisor_id', advisorId)
        .eq('phase_id', Number(phaseId))
        .eq('task_id', taskId)
        .eq('status', 'resolved')
        .maybeSingle();

      if (existing) {
        const { error } = await _sb()
          .from('flagged_questions')
          .update({ status: 'open', resolved_at: null,
                    ...(questionText ? { question_text: questionText } : {}) })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await _sb()
          .from('flagged_questions')
          .insert({ client_id: clientId, advisor_id: advisorId,
                    phase_id: Number(phaseId), task_id: taskId, status: 'open',
                    question_text: questionText || null });
        if (error) throw error;
      }
    } else {
      const { error } = await _sb()
        .from('flagged_questions')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .eq('phase_id', Number(phaseId))
        .eq('task_id', taskId)
        .eq('status', 'open');
      if (error) throw error;
    }
  } catch (e) { console.warn('[db] flagQuestion:', e.message); }
}

async function dbResolveQuestion(id) {
  if (!_sb()) return;
  try {
    const { error } = await _sb()
      .from('flagged_questions')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  } catch (e) { console.warn('[db] resolveQuestion:', e.message); }
}

/* ─── Flag message threads ───────────────────────────────────────── */
async function dbGetFlagMessages(questionId) {
  if (!_sb() || !isUUID(questionId)) return null;
  try {
    const { data, error } = await _sb()
      .from('flag_messages')
      .select('id, author_role, body, created_at')
      .eq('question_id', questionId)
      .order('created_at');
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getFlagMessages:', e.message); return null; }
}

async function dbAddFlagMessage(questionId, authorId, authorRole, body) {
  if (!_sb() || !isUUID(questionId) || !isUUID(authorId) || !body?.trim()) return null;
  try {
    const { data, error } = await _sb()
      .from('flag_messages')
      .insert({ question_id: questionId, author_id: authorId,
                author_role: authorRole, body: body.trim() })
      .select('id, author_role, body, created_at')
      .single();
    if (error) throw error;
    dbAudit('message.create', { entityType: 'message', entityId: data.id,
      summary: `${authorRole === 'advisor' ? 'Advisor' : 'Client'} replied on a flagged question`,
      metadata: { question_id: questionId, role: authorRole } });
    return data;
  } catch (e) { console.warn('[db] addFlagMessage:', e.message); return null; }
}

/* ─── Alerts ─────────────────────────────────────────────────────── */
const ALERT_ICON = {
  cash_drag: 'Dollar', roth_window: 'Calendar', tlh: 'TrendDown',
  drift: 'AlertCircle', schedule_call: 'Phone', fx_exposure: 'Building',
};
const ALERT_CTA = {
  cash_drag: 'Deploy cash', roth_window: 'Open modeler', tlh: 'Run harvester',
  drift: 'Review plan', schedule_call: 'Schedule call', fx_exposure: 'Add agenda item',
};

async function dbGetAlerts(advisorId) {
  if (!_sb() || !isUUID(advisorId)) return null;
  try {
    const { data, error } = await _sb()
      .from('alerts')
      .select('id, client_id, priority, category, headline, body, status, created_at')
      .eq('advisor_id', advisorId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getAlerts:', e.message); return null; }
}

function mapAlert(a) {
  return {
    id:       a.id,
    priority: a.priority,
    clientId: a.client_id,
    icon:     ALERT_ICON[a.category] || 'Bell',
    headline: a.headline,
    body:     a.body || '',
    timeAgo:  timeAgo(a.created_at),
    cta:      ALERT_CTA[a.category] || 'Review',
    _dbId:    a.id,
  };
}

async function dbSnoozeAlert(id) {
  if (!_sb()) return;
  try {
    const { error } = await _sb()
      .from('alerts')
      .update({ status: 'snoozed' })
      .eq('id', id);
    if (error) throw error;
  } catch (e) { console.warn('[db] snoozeAlert:', e.message); }
}

/* ─── Meetings ────────────────────────────────────────────────────── */
async function dbGetMeetings(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('meetings')
      .select('id, client_id, advisor_id, met_at, duration_min, notes')
      .eq('client_id', clientId)
      .is('archived_at', null)
      .order('met_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getMeetings:', e.message); return null; }
}

async function dbLogMeeting(clientId, advisorId, fields) {
  if (!_sb() || !isUUID(clientId) || !isUUID(advisorId)) return null;
  try {
    const { data, error } = await _sb()
      .from('meetings')
      .insert({
        client_id:    clientId,
        advisor_id:   advisorId,
        met_at:       fields.met_at || new Date().toISOString(),
        duration_min: Number(fields.duration_min) || null,
        notes:        fields.notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    // Bump client updated_at and last_meeting_at (belt-and-suspenders alongside trigger)
    const metAt = data.met_at;
    await _sb()
      .from('clients')
      .update({ updated_at: new Date().toISOString(), last_meeting_at: metAt })
      .eq('id', clientId);
    dbAudit('meeting.create', { entityType: 'meeting', entityId: data.id, clientId,
      summary: `Logged meeting${data.duration_min ? ` (${data.duration_min} min)` : ''}` });
    return data;
  } catch (e) { console.warn('[db] logMeeting:', e.message); return null; }
}

/* ─── Phase library ──────────────────────────────────────────────── */
async function dbGetPhases() {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb()
      .from('phase_library_resolved')
      .select('*');
    if (error) throw error;
    return data && data.length ? data : null;
  } catch (e) { console.warn('[db] getPhases:', e.message); return null; }
}

// Soft delete (SEC 17a-4): mark archived rather than erase the record.
async function dbDeleteMeeting(id, clientId) {
  if (!_sb() || !isUUID(id)) return;
  try {
    const { error } = await _sb().from('meetings')
      .update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    dbAudit('meeting.archive', { entityType: 'meeting', entityId: id, clientId,
      summary: 'Archived meeting (record retained per 17a-4)' });
  } catch (e) { console.warn('[db] deleteMeeting:', e.message); }
}

/* ─── Balance history (aggregation time-series, Theme B/D) ────────── */
async function dbGetBalanceHistory(clientId, { days = 365 } = {}) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data, error } = await _sb()
      .from('balance_history')
      .select('account_id, as_of, balance, cash')
      .eq('client_id', clientId)
      .gte('as_of', since)
      .order('as_of');
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getBalanceHistory:', e.message); return null; }
}

/* ─── Billing (Stripe subscription, per firm) ────────────────────── */
async function dbGetSubscription() {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb()
      .from('subscriptions')
      .select('plan, status, current_period_end, stripe_customer_id')
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getSubscription:', e.message); return null; }
}

/* ─── CRM tasks (workflow engine) ────────────────────────────────── */
async function dbGetTasks(advisorId, { clientId = null, includeDone = false } = {}) {
  if (!_sb() || !isUUID(advisorId)) return null;
  try {
    let q = _sb()
      .from('crm_tasks')
      .select('id, client_id, title, detail, priority, status, due_at, created_at, completed_at, clients(short_name, household_name)')
      .eq('advisor_id', advisorId)
      .order('due_at', { ascending: true, nullsFirst: false });
    if (isUUID(clientId)) q = q.eq('client_id', clientId);
    if (!includeDone)     q = q.eq('status', 'open');
    const { data, error } = await q;
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getTasks:', e.message); return null; }
}

function mapTask(t) {
  return {
    id: t.id, clientId: t.client_id, title: t.title, detail: t.detail || '',
    priority: t.priority || 'normal', status: t.status || 'open',
    dueAt: t.due_at, createdAt: t.created_at, completedAt: t.completed_at,
    clientName: t.clients?.short_name || t.clients?.household_name || null,
  };
}

async function dbCreateTask(advisorId, firmId, fields) {
  if (!_sb() || !isUUID(advisorId) || !fields.title?.trim()) return null;
  try {
    const { data, error } = await _sb()
      .from('crm_tasks')
      .insert({
        advisor_id: advisorId,
        firm_id:    isUUID(firmId) ? firmId : null,
        client_id:  isUUID(fields.client_id) ? fields.client_id : null,
        title:      fields.title.trim(),
        detail:     fields.detail || null,
        priority:   fields.priority || 'normal',
        due_at:     fields.due_at || null,
      })
      .select('id, client_id, title, detail, priority, status, due_at, created_at, completed_at')
      .single();
    if (error) throw error;
    dbAudit('task.create', { entityType: 'task', entityId: data.id, clientId: data.client_id,
      summary: `Created task: ${data.title}` });
    return data;
  } catch (e) { console.warn('[db] createTask:', e.message); return null; }
}

async function dbUpdateTask(id, fields, clientId) {
  if (!_sb() || !isUUID(id)) return null;
  try {
    const patch = {};
    if (fields.status   !== undefined) {
      patch.status = fields.status;
      patch.completed_at = fields.status === 'done' ? new Date().toISOString() : null;
    }
    if (fields.title    !== undefined) patch.title    = fields.title;
    if (fields.detail   !== undefined) patch.detail   = fields.detail;
    if (fields.priority !== undefined) patch.priority = fields.priority;
    if (fields.due_at   !== undefined) patch.due_at   = fields.due_at;
    const { data, error } = await _sb()
      .from('crm_tasks').update(patch).eq('id', id)
      .select('id, client_id, title, detail, priority, status, due_at, created_at, completed_at')
      .single();
    if (error) throw error;
    if (fields.status) {
      dbAudit(fields.status === 'done' ? 'task.complete' : 'task.reopen',
        { entityType: 'task', entityId: id, clientId,
          summary: `${fields.status === 'done' ? 'Completed' : 'Reopened'} task: ${data.title}` });
    }
    return data;
  } catch (e) { console.warn('[db] updateTask:', e.message); return null; }
}

async function dbDeleteTask(id, clientId) {
  if (!_sb() || !isUUID(id)) return;
  try {
    const { error } = await _sb().from('crm_tasks').delete().eq('id', id);
    if (error) throw error;
    dbAudit('task.delete', { entityType: 'task', entityId: id, clientId, summary: 'Deleted task' });
  } catch (e) { console.warn('[db] deleteTask:', e.message); }
}

window.db = {
  getClients:          dbGetClients,
  mapClient,
  createClient:        dbCreateClient,
  updateClient:        dbUpdateClient,
  archiveClient:       dbArchiveClient,
  updateClientNotes:   dbUpdateClientNotes,
  getAccounts:         dbGetAccounts,
  upsertAccount:       dbUpsertAccount,
  deleteAccount:       dbDeleteAccount,
  syncClientTotals:    dbSyncClientTotals,
  ACCOUNT_TYPE_LABELS,
  getProfile:          dbGetProfile,
  saveProfile:         dbSaveProfile,
  getTaskStates:       dbGetTaskStates,
  upsertTask:          dbUpsertTask,
  getFlaggedQuestions: dbGetFlaggedQuestions,
  mapFlaggedQuestion,
  flagQuestion:        dbFlagQuestion,
  resolveQuestion:     dbResolveQuestion,
  getFlagMessages:     dbGetFlagMessages,
  addFlagMessage:      dbAddFlagMessage,
  getAlerts:           dbGetAlerts,
  mapAlert,
  snoozeAlert:         dbSnoozeAlert,
  getMeetings:         dbGetMeetings,
  logMeeting:          dbLogMeeting,
  deleteMeeting:       dbDeleteMeeting,
  getAdvisors:         dbGetAdvisors,
  getFirmClients:      dbGetFirmClients,
  getPhases:           dbGetPhases,
  audit:               dbAudit,
  getAuditLog:         dbGetAuditLog,
  getProfileVersions:  dbGetProfileVersions,
  getBalanceHistory:   dbGetBalanceHistory,
  getSubscription:     dbGetSubscription,
  getTasks:            dbGetTasks,
  mapTask,
  createTask:          dbCreateTask,
  updateTask:          dbUpdateTask,
  deleteTask:          dbDeleteTask,
  isUUID,
  timeAgo,
};
