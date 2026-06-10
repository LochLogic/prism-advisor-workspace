// Prism — Supabase data access layer. All DB queries live here.
// Every function checks window.__sb first and returns null on failure so
// callers can fall back to mock data transparently.

const _sb = () => window.__sb;

const isUUID = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

/* ─── Audit-action → human label (single source of truth) ─────────────
   Referenced by bare name from the firm-admin audit feed and the printed
   compliance report (store.jsx). Keep new audit actions registered here so
   they read consistently everywhere. */
const AUDIT_ACTION_LABELS = {
  'client.create': 'Client created', 'client.update': 'Client updated',
  'client.archive': 'Client archived', 'client.notes': 'Notes updated',
  'client.invite': 'Client invited', 'client.claim': 'Portal access claimed',
  'account.create': 'Account added', 'account.update': 'Account updated',
  'account.archive': 'Account archived', 'meeting.create': 'Meeting logged',
  'meeting.archive': 'Meeting archived', 'profile.save': 'Profile saved',
  'auth.signin': 'Signed in', 'auth.signout': 'Signed out',
  'mfa.enroll': '2FA enabled', 'mfa.unenroll': '2FA disabled',
  'message.create': 'Message sent', 'message.send': 'Message sent', 'task.create': 'Task created',
  'task.complete': 'Task completed', 'task.reopen': 'Task reopened', 'task.delete': 'Task deleted',
  'firm.brand': 'Branding updated', 'ai.assist': 'AI assist',
  'document.request': 'Document requested', 'document.request_done': 'Document request fulfilled',
};

/* ─── Audit trail (SEC 17a-3 / FINRA) ────────────────────────────────
   Append-only. dbAudit() is fire-and-forget: callers never await it and
   a failure never blocks the user action.

   Writes go through the px_audit() SECURITY DEFINER RPC (migration 028), which
   stamps actor_id / actor_role / actor_email / firm_id from the SESSION — never
   from the browser — and drops any client_id outside the caller's firm. The old
   direct insert let a client forge those columns (incl. another firm's id); the
   RPC closes that. window.__pxAuthActor is still used only to skip in demo. */
async function dbAudit(action, opts = {}) {
  const sb = _sb();
  const actor = window.__pxAuthActor;
  if (!sb || !actor?.id) return; // demo mode / no session — nothing to record
  try {
    await sb.rpc('px_audit', {
      p_action:      action,
      p_entity_type: opts.entityType || null,
      p_entity_id:   opts.entityId != null ? String(opts.entityId) : null,
      p_client_id:   isUUID(opts.clientId) ? opts.clientId : null,
      p_summary:     opts.summary || null,
      p_metadata:    opts.metadata || {},
      p_user_agent:  typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
    });
  } catch (e) { console.warn('[db] audit:', e.message); }
}

async function dbGetAuditLog({ limit = 100, clientId = null, since = null } = {}) {
  if (!_sb()) return null;
  try {
    let q = _sb()
      .from('audit_log')
      .select('id, occurred_at, actor_email, actor_role, action, entity_type, entity_id, client_id, summary')
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (isUUID(clientId)) q = q.eq('client_id', clientId);
    if (since) q = q.gte('occurred_at', new Date(since).toISOString());
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
const CLIENT_COLS = 'id, household_name, short_name, household_tag, current_phase, notes, active, updated_at, last_meeting_at, aum, uninvested_cash, pipeline_stage, fee_schedule_id, auth_user_id, invited_at, claimed_at';

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

// Book-wide KPI totals for the advisor (AUM, cash drag, counts) computed across
// ALL active clients — not just the paginated first roster page, which would
// under-count the headline KPIs for books > one page. Two small numeric columns
// per row; RLS scopes to the advisor's own book.
async function dbGetBookTotals(advisorId) {
  if (!_sb() || !isUUID(advisorId)) return null;
  try {
    const { data, error } = await _sb()
      .from('clients')
      .select('aum, uninvested_cash, current_phase')
      .eq('advisor_id', advisorId)
      .eq('active', true);
    if (error) throw error;
    const rows = data || [];
    return {
      totalAUM:      rows.reduce((s, c) => s + (Number(c.aum) || 0), 0),
      totalCashDrag: rows.reduce((s, c) => s + (Number(c.uninvested_cash) || 0), 0),
      activeCount:   rows.length,
      inLateHorizon: rows.filter(c => (Number(c.current_phase) || 0) >= 5).length,
    };
  } catch (e) { console.warn('[db] getBookTotals:', e.message); return null; }
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
      .select('id, advisor_id, aum, current_phase, fee_schedule_id, household_name, short_name')
      .eq('active', true);
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getFirmClients:', e.message); return null; }
}

/* ─── Advisory-fee billing (fee schedules + invoices) ────────────── */
async function dbGetFeeSchedules() {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb()
      .from('fee_schedules')
      .select('id, name, frequency, basis, tiers, active')
      .eq('active', true)
      .order('name');
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getFeeSchedules:', e.message); return null; }
}

async function dbCreateFeeSchedule(firmId, fields) {
  if (!_sb() || !isUUID(firmId) || !fields.name?.trim()) return null;
  try {
    const { data, error } = await _sb()
      .from('fee_schedules')
      .insert({
        firm_id: firmId,
        name: fields.name.trim(),
        frequency: fields.frequency || 'quarterly',
        basis: fields.basis || 'avg_daily',
        tiers: fields.tiers || [],
      })
      .select('id, name, frequency, basis, tiers, active')
      .single();
    if (error) throw error;
    dbAudit('feeschedule.create', { entityType: 'fee_schedule', entityId: data.id, summary: `Created fee schedule: ${data.name}` });
    return data;
  } catch (e) { console.warn('[db] createFeeSchedule:', e.message); return null; }
}

async function dbGetInvoices({ clientId = null, limit = 200 } = {}) {
  if (!_sb()) return null;
  try {
    let q = _sb()
      .from('invoices')
      .select('id, client_id, period_start, period_end, basis_amount, fee_amount, status, created_at, clients(short_name, household_name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (isUUID(clientId)) q = q.eq('client_id', clientId);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getInvoices:', e.message); return null; }
}

async function dbUpdateInvoiceStatus(id, status, clientId) {
  if (!_sb() || !isUUID(id)) return null;
  try {
    const patch = { status };
    if (status === 'approved') { patch.approved_at = new Date().toISOString(); patch.approved_by = window.__pxAuthActor?.id || null; }
    const { data, error } = await _sb()
      .from('invoices').update(patch).eq('id', id)
      .select('id, client_id, period_start, period_end, basis_amount, fee_amount, status, created_at')
      .single();
    if (error) throw error;
    dbAudit(`invoice.${status}`, { entityType: 'invoice', entityId: id, clientId,
      summary: `Invoice ${status} (${fmtMoney(data.fee_amount)})` });
    return data;
  } catch (e) { console.warn('[db] updateInvoiceStatus:', e.message); return null; }
}
const fmtMoney = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

/* ─── Acknowledgements / e-sign (migration 017) ──────────────────── */
const ACK_COLS = 'id, client_id, advisor_id, title, body, status, requested_at, acknowledged_at, signer_name, document_id, provider, envelope_id, envelope_status, sent_at';

async function dbGetAcknowledgements(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('acknowledgements').select(ACK_COLS)
      .eq('client_id', clientId)
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getAcknowledgements:', e.message); return null; }
}

// Firm-wide acknowledgement inventory for the exam packet — every disclosure /
// e-sign request across the firm with its signature state. RLS scopes the read to
// the caller's firm (admins see the whole firm; advisors their own book).
async function dbGetFirmAcknowledgements({ limit = 500 } = {}) {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb()
      .from('acknowledgements')
      .select(`${ACK_COLS}, clients ( household_name, short_name )`)
      .order('requested_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getFirmAcknowledgements:', e.message); return null; }
}

async function dbCreateAcknowledgement(clientId, firmId, advisorId, { title, body, documentId }) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('acknowledgements')
      .insert({ client_id: clientId, firm_id: firmId, advisor_id: advisorId, title, body: body || null,
                document_id: documentId || null })
      .select(ACK_COLS).single();
    if (error) throw error;
    dbAudit('ack.request', { entityType: 'acknowledgement', entityId: data.id, clientId,
      summary: `Requested acknowledgement: ${title}` });
    return data;
  } catch (e) { console.warn('[db] createAcknowledgement:', e.message); return null; }
}

async function dbSignAcknowledgement(id, signerName) {
  if (!_sb() || !isUUID(id)) return null;
  try {
    const { data, error } = await _sb().rpc('px_sign_acknowledgement', { p_id: id, p_signer_name: signerName });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) dbAudit('ack.sign', { entityType: 'acknowledgement', entityId: id, clientId: row.client_id,
      summary: `Acknowledged: ${row.title}` });
    return row;
  } catch (e) { console.warn('[db] signAcknowledgement:', e.message); return null; }
}

// Escalate a pending acknowledgement to a legally-binding DocuSign envelope.
// The edge function creates + sends the envelope and stamps the row with the
// envelope id/status; the docusign-connect webhook completes it on signing.
async function dbSendDocusignEnvelope(ackId) {
  if (!window.__sb || !isUUID(ackId)) return null;
  try {
    const { data, error } = await window.__sb.functions.invoke('docusign-envelope',
      { body: { acknowledgementId: ackId } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data; // { ok, envelopeId, acknowledgement }
  } catch (e) { console.warn('[db] sendDocusignEnvelope:', e.message); return { error: e.message }; }
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
    feeScheduleId:  c.fee_schedule_id || '',
    // Portal-connection state (C3 invite flow): connected once the client claims.
    connected:      !!c.auth_user_id,
    invitedAt:      c.invited_at || null,
    claimedAt:      c.claimed_at || null,
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
    if (fields.fee_schedule_id !== undefined) allowed.fee_schedule_id = fields.fee_schedule_id || null;
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

/* ─── Client portal invite / claim (C3) ──────────────────────────────
   The advisor generates a single-use claim code (px_create_client_invite);
   the client redeems it on first sign-in (px_claim_client) to bind their
   auth user to the household. See migration 024. */
async function dbCreateClientInvite(clientId, email = null) {
  if (!_sb() || !isUUID(clientId)) return { code: null, error: 'No active session.' };
  try {
    const { data, error } = await _sb().rpc('px_create_client_invite',
      { p_client_id: clientId, p_email: email || null });
    if (error) throw error;
    return { code: data, error: null };
  } catch (e) {
    console.warn('[db] createClientInvite:', e.message);
    return { code: null, error: e.message || 'Could not create invite.' };
  }
}

async function dbClaimClient(code) {
  if (!_sb() || !code) return { clientId: null, error: 'Missing invite code.' };
  try {
    const { data, error } = await _sb().rpc('px_claim_client', { p_code: String(code).trim() });
    if (error) throw error;
    return { clientId: data, error: null };
  } catch (e) {
    console.warn('[db] claimClient:', e.message);
    return { clientId: null, error: e.message || 'Could not redeem this invite.' };
  }
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
    // Append an immutable version snapshot (15e), but only if it changed since
    // the last one — avoids bloat from debounced autosaves. Never blocks the save.
    try {
      const { data: last } = await _sb()
        .from('profile_versions').select('data')
        .eq('client_id', clientId).order('version', { ascending: false }).limit(1).maybeSingle();
      if (!last || JSON.stringify(last.data) !== JSON.stringify(profileData)) {
        await _sb().from('profile_versions').insert({
          client_id: clientId, data: profileData, saved_by: window.__pxAuthActor?.id || null });
      }
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
    _dbId:    q.id,   // the FlaggedQuestion reply thread loads/sends keyed on this
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
  if (!_sb() || !isUUID(id)) return;
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
  cash_drag: 'Deploy cash', roth_window: 'Open Roth modeler', tlh: 'Add to agenda',
  drift: 'Review plan', schedule_call: 'Add to agenda', fx_exposure: 'Add to agenda',
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
  if (!_sb() || !isUUID(id)) return;
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
      .select('id, client_id, advisor_id, met_at, duration_min, notes, status')
      .eq('client_id', clientId)
      .is('archived_at', null)
      .order('met_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getMeetings:', e.message); return null; }
}

async function dbLogMeeting(clientId, advisorId, fields) {
  if (!_sb() || !isUUID(clientId) || !isUUID(advisorId)) return null;
  try {
    const status = fields.status || 'logged';
    const { data, error } = await _sb()
      .from('meetings')
      .insert({
        client_id:    clientId,
        advisor_id:   advisorId,
        met_at:       fields.met_at || new Date().toISOString(),
        duration_min: Number(fields.duration_min) || null,
        notes:        fields.notes || null,
        status,
      })
      .select()
      .single();
    if (error) throw error;
    // Only logged (past) meetings advance the activity / last-review markers
    if (status === 'logged') {
      await _sb().from('clients')
        .update({ updated_at: new Date().toISOString(), last_meeting_at: data.met_at })
        .eq('id', clientId);
    }
    dbAudit(status === 'confirmed' ? 'meeting.schedule' : 'meeting.create',
      { entityType: 'meeting', entityId: data.id, clientId,
        summary: status === 'confirmed' ? `Scheduled meeting for ${new Date(data.met_at).toLocaleString()}`
          : `Logged meeting${data.duration_min ? ` (${data.duration_min} min)` : ''}` });
    return data;
  } catch (e) { console.warn('[db] logMeeting:', e.message); return null; }
}

// Client-initiated meeting request (RLS: client may insert status='requested')
async function dbRequestMeeting(clientId, advisorId, fields) {
  if (!_sb() || !isUUID(clientId) || !isUUID(advisorId)) return null;
  try {
    const { data, error } = await _sb()
      .from('meetings')
      .insert({
        client_id: clientId, advisor_id: advisorId,
        met_at: fields.met_at || new Date().toISOString(),
        notes: fields.notes || null, status: 'requested',
      })
      .select('id, met_at, notes, status')
      .single();
    if (error) throw error;
    dbAudit('meeting.request', { entityType: 'meeting', entityId: data.id, clientId,
      summary: 'Client requested a meeting' });
    return data;
  } catch (e) { console.warn('[db] requestMeeting:', e.message); return null; }
}

async function dbUpdateMeetingStatus(id, status, clientId) {
  if (!_sb() || !isUUID(id)) return null;
  try {
    const { data, error } = await _sb()
      .from('meetings').update({ status }).eq('id', id)
      .select('id, met_at, notes, status, duration_min').single();
    if (error) throw error;
    dbAudit(`meeting.${status}`, { entityType: 'meeting', entityId: id, clientId,
      summary: `Meeting ${status}` });
    return data;
  } catch (e) { console.warn('[db] updateMeetingStatus:', e.message); return null; }
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

// Book-wide balance history (RLS scopes rows to the advisor's own clients) —
// powers the Book AUM trend sparkline. Bounded to ~13 months.
async function dbGetBookBalanceHistory({ days = 400 } = {}) {
  if (!_sb()) return null;
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data, error } = await _sb()
      .from('balance_history')
      .select('account_id, as_of, balance')
      .gte('as_of', since)
      .order('as_of');
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getBookBalanceHistory:', e.message); return null; }
}

/* ─── Cash flows (for time-weighted return) ──────────────────────── */
async function dbGetCashFlows(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('cash_flows')
      .select('id, account_id, flow_date, amount, kind, note')
      .eq('client_id', clientId)
      .order('flow_date', { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getCashFlows:', e.message); return null; }
}

async function dbAddCashFlow(clientId, fields) {
  if (!_sb() || !isUUID(clientId) || !fields.amount) return null;
  try {
    const { data, error } = await _sb()
      .from('cash_flows')
      .insert({
        client_id: clientId,
        account_id: isUUID(fields.account_id) ? fields.account_id : null,
        flow_date: fields.flow_date || new Date().toISOString().slice(0, 10),
        amount: Number(fields.amount),
        kind: fields.kind || 'contribution',
        note: fields.note || null,
      })
      .select('id, account_id, flow_date, amount, kind, note')
      .single();
    if (error) throw error;
    dbAudit('cashflow.create', { entityType: 'cash_flow', entityId: data.id, clientId,
      summary: `Logged ${data.kind} of ${data.amount}` });
    return data;
  } catch (e) { console.warn('[db] addCashFlow:', e.message); return null; }
}

// ── Deletion policy (17a-4 note) ─────────────────────────────────────────────
// Three tables hard-delete (`cash_flows`, `crm_tasks`, `documents`) while client
// records archive/soft-delete. This is deliberate, not drift: the hard-deleted
// rows are working data (ledger corrections, to-dos, vault files), and every
// deletion still writes an append-only audit_log entry — so the *fact and actor*
// of the deletion is retained forever even though the payload is not. Books-and-
// records artifacts (clients, acknowledgements, audit_log, profile versions,
// invoices) are never hard-deleted. If a partner's compliance review wants
// payload-level retention on these working tables too, move them to soft-delete
// + the WORM export (see ROADMAP, partner-gated).
async function dbDeleteCashFlow(id, clientId) {
  if (!_sb() || !isUUID(id)) return;
  try {
    const { error } = await _sb().from('cash_flows').delete().eq('id', id);
    if (error) throw error;
    dbAudit('cashflow.delete', { entityType: 'cash_flow', entityId: id, clientId, summary: 'Deleted cash flow' });
  } catch (e) { console.warn('[db] deleteCashFlow:', e.message); }
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
      .select('id, client_id, title, detail, priority, status, due_at, created_at, completed_at, assigned_to, clients(short_name, household_name)')
      .or(`advisor_id.eq.${advisorId},assigned_to.eq.${advisorId}`)
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
    assignedTo: t.assigned_to || null,
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
        assigned_to: isUUID(fields.assigned_to) ? fields.assigned_to : null,
      })
      .select('id, client_id, title, detail, priority, status, due_at, created_at, completed_at, assigned_to')
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
    if (fields.assigned_to !== undefined) patch.assigned_to = isUUID(fields.assigned_to) ? fields.assigned_to : null;
    const { data, error } = await _sb()
      .from('crm_tasks').update(patch).eq('id', id)
      .select('id, client_id, title, detail, priority, status, due_at, created_at, completed_at, assigned_to')
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

/* ─── Messaging (migration 019) ──────────────────────────────────── */
const MSG_COLS = 'id, client_id, author_id, author_role, body, context, created_at, read_by_advisor';

async function dbGetMessages(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('messages').select(MSG_COLS)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getMessages:', e.message); return null; }
}

async function dbSendMessage(clientId, { body, authorRole, authorId, context, firmId }) {
  if (!_sb() || !isUUID(clientId) || !body?.trim()) return null;
  try {
    const { data, error } = await _sb()
      .from('messages')
      .insert({ client_id: clientId, author_role: authorRole, author_id: authorId || null,
                body: body.trim(), context: context || null, firm_id: firmId || null,
                read_by_advisor: authorRole === 'advisor' })
      .select(MSG_COLS).single();
    if (error) throw error;
    dbAudit('message.send', { entityType: 'message', entityId: data.id, clientId,
      summary: `${authorRole === 'advisor' ? 'Advisor' : 'Client'} sent a message` });
    return data;
  } catch (e) { console.warn('[db] sendMessage:', e.message); return null; }
}

// Advisor marks the client's messages read (clears the unread badge).
async function dbMarkMessagesRead(clientId) {
  if (!_sb() || !isUUID(clientId)) return;
  try {
    await _sb().from('messages').update({ read_by_advisor: true })
      .eq('client_id', clientId).eq('author_role', 'client').eq('read_by_advisor', false);
  } catch (e) { console.warn('[db] markMessagesRead:', e.message); }
}

// Client ids with unread client→advisor messages (RLS scopes to the advisor's book).
async function dbGetUnreadMessageClients() {
  if (!_sb()) return [];
  try {
    const { data, error } = await _sb().from('messages')
      .select('client_id').eq('author_role', 'client').eq('read_by_advisor', false);
    if (error) throw error;
    return [...new Set((data || []).map(r => r.client_id))];
  } catch (e) { console.warn('[db] getUnreadMessageClients:', e.message); return []; }
}

// Subscribe to new messages for a client; returns an unsubscribe fn.
function subscribeMessages(clientId, onInsert) {
  const sb = _sb();
  if (!sb || !isUUID(clientId)) return () => {};
  const ch = sb.channel(`messages:${clientId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
      (payload) => onInsert && onInsert(payload.new))
    .subscribe();
  return () => { try { sb.removeChannel(ch); } catch {} };
}

// Passive realtime (W4): subscribe to ALL new messages the caller may see. RLS scopes
// the stream to the advisor's own book, so no client-side tenant filtering is needed.
// Used at the dashboard level so the roster unread dot lights up without a modal open.
function subscribeAllMessages(onInsert) {
  const sb = _sb();
  if (!sb) return () => {};
  const ch = sb.channel('messages:all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => onInsert && onInsert(payload.new))
    .subscribe();
  return () => { try { sb.removeChannel(ch); } catch {} };
}

/* ─── Document vault (migration 020) ─────────────────────────────── */
const DOC_BUCKET = 'client-documents';
const DOC_COLS = 'id, client_id, advisor_id, category, title, file_name, storage_path, mime_type, size_bytes, uploaded_by_role, uploaded_at';

async function dbGetDocuments(clientId) {
  if (!_sb() || !isUUID(clientId)) return null;
  try {
    const { data, error } = await _sb()
      .from('documents').select(DOC_COLS)
      .eq('client_id', clientId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getDocuments:', e.message); return null; }
}

// Upload a file: store the binary under <client_id>/<uuid>-<name>, then write the
// metadata row. `uploadedByRole` is 'advisor' (default) or 'client' — a client
// uploading for their advisor; RLS (migration 025) scopes each role to its own
// rows. Returns the row (or null on failure).
async function dbUploadDocument(clientId, firmId, advisorId, file, { title, category, uploadedByRole = 'advisor' } = {}) {
  if (!_sb() || !isUUID(clientId) || !file) return null;
  const byRole = uploadedByRole === 'client' ? 'client' : 'advisor';
  try {
    const safeName = String(file.name || 'document').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const uid = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const path = `${clientId}/${uid}-${safeName}`;
    const up = await _sb().storage.from(DOC_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (up.error) throw up.error;
    const { data, error } = await _sb()
      .from('documents')
      .insert({ client_id: clientId, firm_id: firmId || null, advisor_id: advisorId || null,
                category: category || 'other', title: (title || safeName).slice(0, 200),
                file_name: file.name || safeName, storage_path: path,
                mime_type: file.type || null, size_bytes: file.size || null,
                uploaded_by_role: byRole })
      .select(DOC_COLS).single();
    if (error) {
      // Roll back the orphaned object so storage doesn't drift from metadata.
      try { await _sb().storage.from(DOC_BUCKET).remove([path]); } catch {}
      throw error;
    }
    dbAudit('document.upload', { entityType: 'document', entityId: data.id, clientId,
      summary: `Uploaded document: ${data.title}` });
    return data;
  } catch (e) { console.warn('[db] uploadDocument:', e.message); return null; }
}

// Short-lived signed URL for download (default 60s). Bucket is private.
async function dbGetDocumentUrl(storagePath, expiresIn = 60) {
  if (!_sb() || !storagePath) return null;
  try {
    const { data, error } = await _sb().storage.from(DOC_BUCKET).createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data?.signedUrl || null;
  } catch (e) { console.warn('[db] getDocumentUrl:', e.message); return null; }
}

async function dbDeleteDocument(id, storagePath, clientId) {
  if (!_sb() || !isUUID(id)) return false;
  try {
    if (storagePath) { try { await _sb().storage.from(DOC_BUCKET).remove([storagePath]); } catch {} }
    const { error } = await _sb().from('documents').delete().eq('id', id);
    if (error) throw error;
    dbAudit('document.delete', { entityType: 'document', entityId: id, clientId,
      summary: 'Deleted a document' });
    return true;
  } catch (e) { console.warn('[db] deleteDocument:', e.message); return false; }
}

/* ─── Document requests (rides on messages — no new table) ──────────
   Advisors chase statements/trust docs constantly; the vault only took
   unprompted uploads. A request is an advisor message whose context is
   'doc-request:<category>' and whose body is the asked-for document name; a
   resolution is any later message with context 'doc-request-done:<request id>'
   (sent by the client when their upload lands, or by the advisor to close it
   manually). Pending = request without a resolution. Messages already grant
   clients read+insert under RLS (migration 019), so the whole flow ships with
   zero schema change and shows up in the conversation thread for free. */
const DOC_REQ_PREFIX  = 'doc-request:';
const DOC_REQ_DONE    = 'doc-request-done:';

// Pure derivation over a message list → request objects (newest first).
function deriveDocRequests(messages) {
  const done = new Map();
  for (const m of messages || []) {
    if (typeof m.context === 'string' && m.context.startsWith(DOC_REQ_DONE)) {
      done.set(m.context.slice(DOC_REQ_DONE.length), m);
    }
  }
  return (messages || [])
    .filter(m => typeof m.context === 'string' && m.context.startsWith(DOC_REQ_PREFIX))
    .map(m => {
      const d = done.get(String(m.id));
      return {
        id: m.id, title: m.body, category: m.context.slice(DOC_REQ_PREFIX.length) || 'other',
        requestedAt: m.created_at, resolved: !!d, resolvedAt: d?.created_at || null,
        resolvedByRole: d?.author_role || null,
      };
    })
    .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
}

async function dbGetDocumentRequests(clientId) {
  const rows = await dbGetMessages(clientId);
  return rows ? deriveDocRequests(rows) : null;
}

// Advisor asks the client for a named document. `title` is what they should
// upload ("2025 Form 1040"); `category` keys into the vault categories.
async function dbRequestDocument(clientId, { title, category = 'other', advisorId, firmId } = {}) {
  if (!title?.trim()) return null;
  const row = await dbSendMessage(clientId, {
    body: title.trim().slice(0, 200), authorRole: 'advisor', authorId: advisorId || null,
    context: `${DOC_REQ_PREFIX}${category}`, firmId,
  });
  if (row) {
    dbAudit('document.request', { entityType: 'message', entityId: row.id, clientId,
      summary: `Requested document: ${row.body}` });
  }
  return row;
}

// Close a request — by the client (their upload landed) or the advisor
// (received out of band / no longer needed). `note` is the human-readable line
// that appears in the thread.
async function dbResolveDocumentRequest(clientId, requestId, { byRole = 'advisor', authorId, firmId, note } = {}) {
  if (!requestId) return null;
  const row = await dbSendMessage(clientId, {
    body: (note || 'Document request closed').slice(0, 200),
    authorRole: byRole === 'client' ? 'client' : 'advisor', authorId: authorId || null,
    context: `${DOC_REQ_DONE}${requestId}`, firmId,
  });
  if (row) {
    dbAudit('document.request_done', { entityType: 'message', entityId: row.id, clientId,
      summary: `Document request fulfilled: ${row.body}` });
  }
  return row;
}

/* ─── Firm branding (white-label) ───────────────────────────────────
   The signed-in user's firm brand (RLS scopes firms to the caller's own), plus
   an anon-callable slug lookup so {slug}.prismaw.com paints the firm brand
   before sign-in (px_brand_for_slug, migration 032). */
const BRAND_COLS = 'id, name, slug, brand_color, logo_url, show_powered_by';

async function dbGetFirmBrand() {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb().from('firms').select(BRAND_COLS).maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[db] getFirmBrand:', e.message); return null; }
}

async function dbUpdateFirmBrand(firmId, patch) {
  if (!_sb() || !isUUID(firmId)) return null;
  try {
    const allowed = {};
    for (const k of ['brand_color', 'logo_url', 'show_powered_by']) {
      if (k in patch) allowed[k] = patch[k];
    }
    const { data, error } = await _sb().from('firms').update(allowed).eq('id', firmId).select(BRAND_COLS).single();
    if (error) throw error;
    dbAudit('firm.brand', { entityType: 'firm', entityId: firmId, summary: 'Firm branding updated' });
    return data;
  } catch (e) { console.warn('[db] updateFirmBrand:', e.message); return null; }
}

async function dbGetBrandForSlug(slug) {
  if (!_sb() || !slug) return null;
  try {
    const { data, error } = await _sb().rpc('px_brand_for_slug', { p_slug: slug });
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  } catch (e) { console.warn('[db] getBrandForSlug:', e.message); return null; }
}

/* ─── AI relationship assistant (Gemini, server-side) ────────────────
   The key never reaches the browser: the ai-assist edge function validates the
   advisor JWT, builds the prompt, and calls Gemini. `action` is one of
   draft_reply | household_summary | talking_points | attention | w2_extract.
   `file` (optional): { data: base64, mimeType } — used by w2_extract to send an
   uploaded form image/PDF to Gemini server-side, outside the 24 KB context cap. */
async function dbAiAssist(action, context = {}, file = null) {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb().functions.invoke('ai-assist', { body: { action, context, ...(file ? { file } : {}) } });
    if (error || data?.error) throw new Error(error?.message || data?.error);
    return data?.text || null;
  } catch (e) { console.warn('[db] aiAssist:', e.message); return null; }
}

/* ─── Calendar sync (Google / Microsoft, server-side tokens) ─────────
   OAuth tokens never reach the browser: calendar-oauth handles the consent
   handshake + connection lifecycle, calendar-events reads/writes the
   connected calendars. Both are JWT-verified edge functions. */
async function _calInvoke(fn, body) {
  if (!_sb()) return null;
  try {
    const { data, error } = await _sb().functions.invoke(fn, { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (e) {
    // "not connected" is an expected state, not a fault worth console noise.
    if (!/not_connected/.test(e.message)) console.warn(`[db] ${fn}:`, e.message);
    return { error: e.message };
  }
}

// → [{provider, email, connected_at}] | null (demo / unavailable)
async function dbGetCalendarStatus() {
  const r = await _calInvoke('calendar-oauth', { action: 'status' });
  return r && !r.error ? r.connections : null;
}

// Kick off the consent flow: store a CSRF state, get the provider URL, go.
async function dbConnectCalendar(provider) {
  const state = crypto.randomUUID();
  try { sessionStorage.setItem('px_cal_oauth_state', state); } catch {}
  const r = await _calInvoke('calendar-oauth', { action: 'auth_url', provider, state });
  if (!r || r.error || !r.url) return { error: r?.error || 'Calendar connect unavailable.' };
  window.location.assign(r.url);
  return { ok: true };
}

async function dbDisconnectCalendar(provider) {
  return await _calInvoke('calendar-oauth', { action: 'disconnect', provider });
}

// → { events: [{provider,title,start,end,allDay,location,link}] } | { error }
async function dbGetCalendarEvents(days = 7) {
  return await _calInvoke('calendar-events', { action: 'upcoming', days });
}

// Push an event (e.g. a scheduled client meeting) to the connected calendar(s).
async function dbCreateCalendarEvent({ title, start, end, description, location, provider }) {
  return await _calInvoke('calendar-events', { action: 'create', title, start, end, description, location, provider });
}

/* ─── Bulk client import (px_bulk_create_clients, migration 034) ─────
   One transactional round-trip per batch instead of N sequential inserts.
   Returns the created client rows, or null if the RPC isn't available yet
   (migration unapplied) — the caller falls back to the per-row path. */
async function dbBulkCreateClients(rows) {
  if (!_sb() || !Array.isArray(rows) || !rows.length) return null;
  try {
    const out = [];
    for (let i = 0; i < rows.length; i += 200) {
      const { data, error } = await _sb().rpc('px_bulk_create_clients', { p_rows: rows.slice(i, i + 200) });
      if (error) throw error;
      out.push(...(data || []));
    }
    return out;
  } catch (e) { console.warn('[db] bulkCreateClients:', e.message); return null; }
}

window.db = {
  getClients:          dbGetClients,
  getBookTotals:       dbGetBookTotals,
  mapClient,
  createClient:        dbCreateClient,
  updateClient:        dbUpdateClient,
  archiveClient:       dbArchiveClient,
  updateClientNotes:   dbUpdateClientNotes,
  createClientInvite:  dbCreateClientInvite,
  claimClient:         dbClaimClient,
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
  requestMeeting:      dbRequestMeeting,
  updateMeetingStatus: dbUpdateMeetingStatus,
  deleteMeeting:       dbDeleteMeeting,
  getAdvisors:         dbGetAdvisors,
  getFirmClients:      dbGetFirmClients,
  getFeeSchedules:     dbGetFeeSchedules,
  createFeeSchedule:   dbCreateFeeSchedule,
  getInvoices:         dbGetInvoices,
  updateInvoiceStatus: dbUpdateInvoiceStatus,
  getAcknowledgements:   dbGetAcknowledgements,
  getFirmAcknowledgements: dbGetFirmAcknowledgements,
  createAcknowledgement: dbCreateAcknowledgement,
  signAcknowledgement:   dbSignAcknowledgement,
  sendDocusignEnvelope:  dbSendDocusignEnvelope,
  getMessages:         dbGetMessages,
  sendMessage:         dbSendMessage,
  markMessagesRead:    dbMarkMessagesRead,
  getUnreadMessageClients: dbGetUnreadMessageClients,
  subscribeMessages,
  subscribeAllMessages,
  getDocuments:        dbGetDocuments,
  uploadDocument:      dbUploadDocument,
  getDocumentUrl:      dbGetDocumentUrl,
  deleteDocument:      dbDeleteDocument,
  getDocumentRequests: dbGetDocumentRequests,
  requestDocument:     dbRequestDocument,
  resolveDocumentRequest: dbResolveDocumentRequest,
  getPhases:           dbGetPhases,
  audit:               dbAudit,
  getAuditLog:         dbGetAuditLog,
  getProfileVersions:  dbGetProfileVersions,
  getBalanceHistory:   dbGetBalanceHistory,
  getBookBalanceHistory: dbGetBookBalanceHistory,
  getCashFlows:        dbGetCashFlows,
  addCashFlow:         dbAddCashFlow,
  deleteCashFlow:      dbDeleteCashFlow,
  getSubscription:     dbGetSubscription,
  getFirmBrand:        dbGetFirmBrand,
  updateFirmBrand:     dbUpdateFirmBrand,
  getBrandForSlug:     dbGetBrandForSlug,
  aiAssist:            dbAiAssist,
  getCalendarStatus:   dbGetCalendarStatus,
  connectCalendar:     dbConnectCalendar,
  disconnectCalendar:  dbDisconnectCalendar,
  getCalendarEvents:   dbGetCalendarEvents,
  createCalendarEvent: dbCreateCalendarEvent,
  bulkCreateClients:   dbBulkCreateClients,
  getTasks:            dbGetTasks,
  mapTask,
  createTask:          dbCreateTask,
  updateTask:          dbUpdateTask,
  deleteTask:          dbDeleteTask,
  isUUID,
  timeAgo,
};
