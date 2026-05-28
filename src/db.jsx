// Prism — Supabase data access layer. All DB queries live here.
// Every function checks window.__sb first and returns null on failure so
// callers can fall back to mock data transparently.

const _sb = () => window.__sb;

const isUUID = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

/* ─── Time helper ────────────────────────────────────────────────── */
const timeAgo = (iso) => {
  if (!iso) return '?';
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 60)  return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
};

/* ─── Client roster ──────────────────────────────────────────────── */
const CLIENT_COLS = 'id, household_name, short_name, household_tag, current_phase, notes, active, updated_at, aum, uninvested_cash';

async function dbGetClients(advisorId) {
  if (!_sb() || !isUUID(advisorId)) return null;
  try {
    const { data, error } = await _sb()
      .from('clients')
      .select(CLIENT_COLS)
      .eq('advisor_id', advisorId)
      .eq('active', true)
      .order('household_name');
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getClients:', e.message); return null; }
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
    recent:         (Date.now() - new Date(c.updated_at)) < 86400000,
    uninvestedCash: Number(c.uninvested_cash) || 0,
    monthlyOutflow: 0,
    accentHue:      (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 19) % 360,
    notes:          c.notes || '',
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
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await _sb()
      .from('clients')
      .update(allowed)
      .eq('id', clientId)
      .select(CLIENT_COLS)
      .single();
    if (error) throw error;
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
      .select('id, client_id, type, custodian, name, balance, cash, as_of, updated_at')
      .eq('client_id', clientId)
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
    return data;
  } catch (e) { console.warn('[db] upsertAccount:', e.message); return null; }
}

async function dbDeleteAccount(id) {
  if (!_sb() || !isUUID(id)) return;
  try {
    const { error } = await _sb().from('accounts').delete().eq('id', id);
    if (error) throw error;
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
  } catch (e) { console.warn('[db] saveProfile:', e.message); }
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

async function dbFlagQuestion(clientId, advisorId, phaseId, taskId, flag) {
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
          .update({ status: 'open', resolved_at: null })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await _sb()
          .from('flagged_questions')
          .insert({ client_id: clientId, advisor_id: advisorId,
                    phase_id: Number(phaseId), task_id: taskId, status: 'open' });
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
    // Bump client updated_at to keep activity indicator current
    await _sb()
      .from('clients')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', clientId);
    return data;
  } catch (e) { console.warn('[db] logMeeting:', e.message); return null; }
}

async function dbDeleteMeeting(id) {
  if (!_sb() || !isUUID(id)) return;
  try {
    const { error } = await _sb().from('meetings').delete().eq('id', id);
    if (error) throw error;
  } catch (e) { console.warn('[db] deleteMeeting:', e.message); }
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
  getAlerts:           dbGetAlerts,
  mapAlert,
  snoozeAlert:         dbSnoozeAlert,
  getMeetings:         dbGetMeetings,
  logMeeting:          dbLogMeeting,
  deleteMeeting:       dbDeleteMeeting,
  isUUID,
  timeAgo,
};
