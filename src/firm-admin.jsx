// Prism - Firm Admin dashboard (extracted from advisor-dashboard.jsx).
// Shares the global bundle scope; references AUDIT_ACTION_LABELS from advisor-dashboard.jsx at render time.

const FirmAdminDashboard = () => {
  const { authUser, setAuthUser } = useAuth();
  const { showToast, setView } = useView();
  const [advisors,     setAdvisors]     = useStateAdv(undefined);
  const [firmClients,  setFirmClients]  = useStateAdv(undefined);
  const [auditLog,     setAuditLog]     = useStateAdv(undefined);
  const [subscription, setSubscription] = useStateAdv(undefined);
  const [checkoutBusy, setCheckoutBusy] = useStateAdv(false);
  const [feeSchedules, setFeeSchedules] = useStateAdv([]);
  const [invoices,     setInvoices]     = useStateAdv([]);
  const [schedForm,    setSchedForm]    = useStateAdv(null);
  const [genBusy,      setGenBusy]      = useStateAdv(false);
  const [brand,        setBrand]        = useStateAdv(null);      // saved row
  const [brandForm,    setBrandForm]    = useStateAdv(null);      // edit buffer
  const [brandSaving,  setBrandSaving]  = useStateAdv(false);
  const [packetBusy,   setPacketBusy]   = useStateAdv(false);
  const [packetDays,   setPacketDays]   = useStateAdv('365');
  // Advisor-approval gate for client ledger edits (migration 036). null =
  // unknown (column not yet migrated / loading) → control hidden.
  const [ledgerGate,   setLedgerGate]   = useStateAdv(null);
  const [auditFilter,  setAuditFilter]  = useStateAdv('');
  const [auditMore,    setAuditMore]    = useStateAdv(false); // expanded beyond first 100
  // Firm-authored CX playbook (migration 045). null = loading → section hidden.
  const [firmPlaybooks, setFirmPlaybooks] = useStateAdv(null);
  const [pbPhase,      setPbPhase]      = useStateAdv(0);
  const [pbForm,       setPbForm]       = useStateAdv(null);
  const [pbSaving,     setPbSaving]     = useStateAdv(false);
  // Public API keys (migration 046). null = loading / unavailable → section hidden
  // (demo, or before the migration + edge fns land). freshKey = the one-time plaintext.
  const [apiKeys,      setApiKeys]      = useStateAdv(null);
  const [newKeyName,   setNewKeyName]   = useStateAdv('');
  const [newKeyWrite,  setNewKeyWrite]  = useStateAdv(true);
  const [keyBusy,      setKeyBusy]      = useStateAdv(false);
  const [freshKey,     setFreshKey]     = useStateAdv(null);

  React.useEffect(() => {
    if (!authUser?.id || !window.db) return;
    window.db.getAdvisors().then(rows => setAdvisors(rows || []));
    window.db.getFirmClients().then(rows => setFirmClients(rows || []));
    window.db.getAuditLog({ limit: 100 }).then(rows => setAuditLog(rows || []));
    window.db.getSubscription().then(setSubscription);
    window.db.getFeeSchedules().then(rows => setFeeSchedules(rows || []));
    window.db.getInvoices({}).then(rows => setInvoices(rows || []));
    window.db.getFirmBrand?.().then(b => { if (b) setBrand(b); });
    window.db.getFirmLedgerGate?.().then(r => {
      if (r && typeof r.ledger_approval_required === 'boolean') setLedgerGate(r.ledger_approval_required);
    });
    window.db.getFirmPlaybooks?.().then(p => setFirmPlaybooks(p || {}));
    window.db.getApiKeys?.().then(setApiKeys); // null (demo / pre-migration) keeps the section hidden
  }, [authUser?.id]);

  // ── Firm CX playbook authoring (advisor playbook phase 2) ──
  // Prefill the editor from the merged current script (default, or the firm's override)
  // whenever the selected phase or the loaded overrides change.
  const pbToForm = (phase, overrides) => {
    const merged = window.mergePlaybook(window.advisorPlaybook?.[phase] || {}, overrides?.[phase]);
    return { questions: (merged.questions || []).join('\n'), expectations: merged.expectations || '',
             gather: (merged.gather || []).join('\n'), cadence: merged.cadence || '' };
  };
  React.useEffect(() => {
    if (firmPlaybooks === null) return;
    setPbForm(pbToForm(pbPhase, firmPlaybooks));
  }, [pbPhase, firmPlaybooks]);

  const pbLines = (s) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const savePlaybook = async () => {
    if (!pbForm) return;
    setPbSaving(true);
    const patch = { questions: pbLines(pbForm.questions), expectations: (pbForm.expectations || '').trim(),
                    gather: pbLines(pbForm.gather), cadence: (pbForm.cadence || '').trim() };
    const row = await window.db.saveFirmPlaybook(authUser.firm_id, pbPhase, patch);
    setPbSaving(false);
    if (row) {
      setFirmPlaybooks(p => ({ ...(p || {}), [pbPhase]: patch }));
      showToast('CX playbook saved - your advisors now see this script');
    } else showToast('Could not save the playbook');
  };
  const resetPlaybook = async () => {
    const ok = await window.db.resetFirmPlaybook(authUser.firm_id, pbPhase);
    if (ok) {
      setFirmPlaybooks(p => { const n = { ...(p || {}) }; delete n[pbPhase]; return n; });
      showToast('Reverted to the Prism default');
    } else showToast('Could not reset the playbook');
  };

  const toggleLedgerGate = async () => {
    const next = !ledgerGate;
    setLedgerGate(next); // optimistic - revert below on failure
    const row = await window.db.setLedgerGate(authUser.firm_id, next);
    if (!row) { setLedgerGate(!next); showToast('Could not update the approval setting'); }
    else showToast(next ? 'Client ledger edits now route to the advisor for approval'
                        : 'Clients save ledger edits directly again');
  };

  // ── Public API keys (Zapier / integrations) ──
  const copyText = (t) => {
    try { navigator.clipboard.writeText(t); showToast('Copied to clipboard'); }
    catch { showToast('Copy failed - select the text and copy manually'); }
  };
  const createApiKey = async () => {
    const name = (newKeyName || '').trim();
    if (!name) { showToast('Name the key first (e.g. "Zapier")'); return; }
    setKeyBusy(true);
    const r = await window.db.createApiKey(name, newKeyWrite ? ['read', 'write'] : ['read']);
    setKeyBusy(false);
    if (r && r.key) {
      setFreshKey(r.key);
      setApiKeys(ks => [r.row, ...(ks || [])]);
      setNewKeyName('');
      showToast('API key created. Copy it now; it is not shown again.');
    } else showToast(r?.error || 'Could not create the key');
  };
  const revokeApiKey = async (id, name) => {
    const r = await window.db.revokeApiKey(id);
    if (r && r.ok) {
      setApiKeys(ks => (ks || []).map(k => k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k));
      showToast(`Revoked "${name}"`);
    } else showToast(r?.error || 'Could not revoke the key');
  };

  // ── White-label branding ──
  const BRAND_LOGO_MAX = 200 * 1024; // data-URI stored in firms.logo_url; CSP img-src allows data:
  const onLogoFile = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) { showToast('Use a PNG, JPEG, WebP, or SVG logo'); return; }
    if (file.size > BRAND_LOGO_MAX) { showToast('Logo must be under 200 KB - try an SVG or a compressed PNG'); return; }
    const r = new FileReader();
    r.onload = () => setBrandForm(f => ({ ...f, logo_url: r.result }));
    r.readAsDataURL(file);
  };
  const saveBrand = async () => {
    if (!brandForm) return;
    if (!brandForm.name?.trim()) { showToast('The firm needs a name'); return; }
    setBrandSaving(true);
    const row = await window.db.updateFirmBrand(authUser.firm_id, brandForm);
    setBrandSaving(false);
    if (row) {
      setBrand(row); setBrandForm(null);
      window.applyFirmBrand?.(row);
      // The header + account chip read authUser.firms.name - mirror the rename
      // into context so it updates without a reload.
      setAuthUser?.(u => (u ? { ...u, firms: { ...(u.firms || {}), name: row.name } } : u));
      showToast('Branding saved - your portal now carries the firm brand');
    } else showToast('Could not save branding - check console');
  };

  // Advisory-fee billing - projected annual revenue + realized fees YTD
  const scheduleById = useMemoAdv(() => Object.fromEntries((feeSchedules || []).map(s => [s.id, s])), [feeSchedules]);
  const projectedRevenue = useMemoAdv(() => (firmClients || []).reduce((sum, c) => {
    const s = c.fee_schedule_id && scheduleById[c.fee_schedule_id];
    return sum + (s ? annualFeeForAum(s.tiers, Number(c.aum) || 0) : 0);
  }, 0), [firmClients, scheduleById]);
  const realizedYTD = useMemoAdv(() => {
    const yr = new Date().getFullYear();
    return (invoices || []).filter(i => ['approved', 'paid'].includes(i.status) && new Date(i.period_start).getFullYear() === yr)
      .reduce((s, i) => s + Number(i.fee_amount || 0), 0);
  }, [invoices]);

  const createSchedule = async () => {
    if (!schedForm?.name?.trim()) { showToast('Name the schedule'); return; }
    const tiers = (schedForm.tiers || []).filter(t => t.annual_bps !== '' && t.annual_bps != null)
      .map(t => ({ up_to: t.up_to === '' || t.up_to == null ? null : Number(t.up_to), annual_bps: Number(t.annual_bps) }));
    if (!tiers.length) { showToast('Add at least one tier with a rate'); return; }
    const row = await window.db.createFeeSchedule(authUser.firm_id, { ...schedForm, tiers });
    if (row) { setFeeSchedules(prev => [...prev, row]); setSchedForm(null); showToast('Fee schedule created'); }
  };

  // Assign (or clear) a client's fee schedule inline - no need to open each client.
  const assignFeeSchedule = async (clientId, scheduleId) => {
    const row = await window.db.updateClient(clientId, { fee_schedule_id: scheduleId || null });
    if (row) {
      setFirmClients(prev => (prev || []).map(c => c.id === clientId ? { ...c, fee_schedule_id: scheduleId || null } : c));
    } else {
      showToast('Could not update assignment');
    }
  };

  const generateInvoices = async () => {
    setGenBusy(true);
    try {
      const { data, error } = await window.__sb.functions.invoke('generate-invoices', { body: {} });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      const rows = await window.db.getInvoices({});
      setInvoices(rows || []);
      showToast(`${data.created} invoice${data.created !== 1 ? 's' : ''} generated${data.skipped ? `, ${data.skipped} skipped` : ''}`);
    } catch (e) { showToast('Invoice run failed - check console'); console.warn(e); }
    finally { setGenBusy(false); }
  };

  const setInvoiceStatus = async (inv, status) => {
    const row = await window.db.updateInvoiceStatus(inv.id, status, inv.client_id);
    if (row) setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: row.status } : i));
  };

  // Surface the Stripe Checkout return state once, then clean the URL
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const b = p.get('billing');
    if (b === 'success') showToast('Subscription active - thank you!');
    else if (b === 'cancel') showToast('Checkout canceled.');
    if (b) {
      p.delete('billing');
      const qs = p.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  const startCheckout = async () => {
    if (!window.__sb) return;
    setCheckoutBusy(true);
    try {
      // The app is served under /app/ (build.mjs routes / → marketing, /app → app).
      // The edge function appends the return path to this origin, so include /app
      // or Stripe sends the advisor back to the marketing page (and the billing
      // toast handler below, which lives in the app, never runs).
      const { data, error } = await window.__sb.functions.invoke('create-checkout-session',
        { body: { origin: window.location.origin + '/app' } });
      if (error || !data?.url) throw new Error(error?.message || 'No checkout URL returned');
      window.location.href = data.url;
    } catch (e) { showToast('Could not start checkout - check console'); console.warn(e); setCheckoutBusy(false); }
  };

  // One-click exam packet - refetch the audit window + firm-wide acknowledgements
  // fresh (the on-screen log is capped at 100), then hand everything already
  // loaded for this view to the pure renderer in store.jsx.
  const AUDIT_CAP = 2000;
  const exportExamPacket = async () => {
    setPacketBusy(true);
    try {
      const days = Number(packetDays) || 0;
      const since = days ? new Date(Date.now() - days * 86400000) : null;
      const [audit, acks] = await Promise.all([
        window.db.getAuditLog({ limit: AUDIT_CAP, since }),
        window.db.getFirmAcknowledgements(),
      ]);
      window.printExamPacket({
        firmName,
        generatedBy: authUser?.email,
        rangeLabel: days ? `audit window: last ${days} days` : 'audit window: full history',
        advisors: advisors || [],
        clients: firmClients || [],
        feeSchedules: feeSchedules || [],
        invoices: invoices || [],
        acknowledgements: acks || [],
        auditEntries: audit || [],
        auditTruncated: (audit || []).length >= AUDIT_CAP,
      });
    } catch (e) { showToast('Could not assemble the exam packet - check console'); console.warn(e); }
    finally { setPacketBusy(false); }
  };

  // CSV companion exports (the exam packet's "next when wanted") - the same
  // books-&-records data in a spreadsheet-friendly form. downloadCSV (store.jsx)
  // neutralizes formula injection; names/notes are user-editable input.
  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportClientsCSV = () => {
    const advisorById = Object.fromEntries((advisors || []).map(a => [a.id, a.full_name]));
    downloadCSV(`clients-${stamp()}.csv`,
      ['Client', 'Advisor', 'AUM', 'Fee schedule'],
      (firmClients || []).map(c => [
        c.short_name || c.household_name || 'Client',
        advisorById[c.advisor_id] || '',
        Number(c.aum) || 0,
        (c.fee_schedule_id && scheduleById[c.fee_schedule_id]?.name) || 'Unassigned',
      ]));
  };
  const exportInvoicesCSV = () => {
    downloadCSV(`invoices-${stamp()}.csv`,
      ['Client', 'Period start', 'Period end', 'Billing basis', 'Fee', 'Status'],
      (invoices || []).map(i => [
        i.clients?.short_name || i.clients?.household_name || 'Client',
        i.period_start, i.period_end,
        Number(i.basis_amount) || 0, Number(i.fee_amount) || 0, i.status,
      ]));
  };
  // Audit CSV honours the same window selector as the exam packet and refetches
  // fresh - the on-screen log is capped.
  const exportAuditCSV = async () => {
    const days = Number(packetDays) || 0;
    const since = days ? new Date(Date.now() - days * 86400000) : null;
    const rows = await window.db.getAuditLog({ limit: AUDIT_CAP, since });
    downloadCSV(`audit-${stamp()}.csv`,
      ['When', 'Actor', 'Role', 'Action', 'Detail'],
      (rows || []).map(e => [e.occurred_at, e.actor_email || '', e.actor_role || '', e.action, e.summary || '']));
  };

  // On-screen audit trail: free-text filter + one-step deepen (100 → 500).
  const loadMoreAudit = async () => {
    setAuditMore(true);
    const rows = await window.db.getAuditLog({ limit: 500 });
    if (rows) setAuditLog(rows);
  };
  const visibleAudit = useMemoAdv(() => {
    const q = auditFilter.trim().toLowerCase();
    if (!q) return auditLog || [];
    return (auditLog || []).filter(e =>
      (e.actor_email || '').toLowerCase().includes(q) ||
      (e.action || '').toLowerCase().includes(q) ||
      (AUDIT_ACTION_LABELS[e.action] || '').toLowerCase().includes(q) ||
      (e.summary || '').toLowerCase().includes(q));
  }, [auditLog, auditFilter]);

  const planActive = subscription && ['active', 'trialing'].includes(subscription.status);

  const firmName = authUser?.firms?.name || 'Your Firm';

  // Per-advisor client count + AUM derived from firm-wide client list
  const advisorStats = useMemoAdv(() => {
    const stats = {};
    (advisors || []).forEach(a => { stats[a.id] = { clientCount: 0, aum: 0 }; });
    (firmClients || []).forEach(c => {
      if (stats[c.advisor_id]) {
        stats[c.advisor_id].clientCount++;
        stats[c.advisor_id].aum += Number(c.aum) || 0;
      }
    });
    return stats;
  }, [advisors, firmClients]);

  // ── CX playbook adherence (advisor playbook phase 3) ──────────────────────────
  // An honest, derived quality read for the firm. The playbook makes four promises
  // per phase (ask / set expectations / gather / cadence); CADENCE is the only one
  // with a reliable digital footprint - clients.last_meeting_at, advanced by every
  // logged meeting (migrations 005/013). "On cadence" = met within CX_CADENCE_DAYS
  // (a quarter + grace; the playbooks promise quarterly reviews). We deliberately do
  // NOT fake adherence on the other three - those happen in the room. The coverage
  // panel ties this back to the firm's authored script (phase 2). Firm-admin only.
  const CX_CADENCE_DAYS = 120;
  const cxQuality = useMemoAdv(() => {
    const cutoff = Date.now() - CX_CADENCE_DAYS * 86400000;
    const per = {};
    (advisors || []).forEach(a => { per[a.id] = { total: 0, onCadence: 0, overdue: 0, neverMet: 0 }; });
    let firmTotal = 0, firmOn = 0;
    (firmClients || []).forEach(c => {
      const s = per[c.advisor_id];
      if (!s) return;
      s.total++; firmTotal++;
      const last = c.last_meeting_at ? new Date(c.last_meeting_at).getTime() : null;
      if (last && last >= cutoff) { s.onCadence++; firmOn++; }
      else { s.overdue++; if (!last) s.neverMet++; }
    });
    Object.values(per).forEach(s => { s.pct = s.total ? Math.round((s.onCadence / s.total) * 100) : null; });
    return { per, firmTotal, firmOn, firmPct: firmTotal ? Math.round((firmOn / firmTotal) * 100) : null };
  }, [advisors, firmClients]);

  // Where the book actually sits by phase, vs. which phases the firm has scripted.
  // Surfaces "households still on the Prism default" - a nudge to finish authoring.
  const phaseCoverage = useMemoAdv(() => {
    const phases = (window.phasesData || []).filter(p => window.advisorPlaybook?.[p.id]);
    const counts = {};
    (firmClients || []).forEach(c => { const ph = Number(c.current_phase) || 0; counts[ph] = (counts[ph] || 0) + 1; });
    const rows = phases.map(p => ({
      id: p.id, num: p.num, title: p.title,
      households: counts[p.id] || 0,
      customized: !!(firmPlaybooks && firmPlaybooks[p.id]),
    }));
    const defaultExposure = rows.filter(p => !p.customized).reduce((s, p) => s + p.households, 0);
    return { rows, defaultExposure };
  }, [firmClients, firmPlaybooks]);
  const cadenceTone = (pct) => pct == null ? 'var(--ink-faint)' : pct >= 80 ? 'var(--forest)' : pct >= 50 ? 'var(--gold)' : 'var(--brick)';

  const totalAUM = useMemoAdv(() =>
    (firmClients || []).reduce((s, c) => s + (Number(c.aum) || 0), 0),
    [firmClients]
  );

  return (
    <div className="px-adv">
      <div className="px-adv-main">
        <div className="px-greet">
          <div className="px-eyebrow px-greet-eyebrow">Firm Administration</div>
          <h1><em>{firmName}</em></h1>
          <p className="px-greet-sub">
            {advisors?.length ?? '…'} advisor{advisors?.length !== 1 ? 's' : ''} ·{' '}
            {firmClients?.length ?? '…'} active client{firmClients?.length !== 1 ? 's' : ''} ·{' '}
            {fmt$(totalAUM, { short: true, decimals: 1 })} book AUM
          </p>
          <button className="px-btn px-btn-sm px-btn-ghost" style={{ marginTop: 12 }}
            onClick={() => setView('advisor')}
            title="Switch to your own advisor workspace">
            <Icons.TableCol size={12} /> Open advisor workspace <Icons.ArrowRight size={12} />
          </button>
        </div>

        {/* Billing & plan */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          background: planActive ? 'var(--forest-soft)' : 'var(--surface)', border: `1px solid ${planActive ? 'var(--forest)' : 'var(--border)'}`,
          borderRadius: 10, padding: '16px 18px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icons.Sparkles size={18} style={{ color: planActive ? 'var(--forest)' : 'var(--gold)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                {subscription === undefined ? 'Checking plan…'
                  : planActive ? `Growth plan · ${subscription.status}`
                  : 'Free preview'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 1 }}>
                {planActive && subscription.current_period_end
                  ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : 'Upgrade to unlock unlimited clients and priority support.'}
              </div>
            </div>
          </div>
          {!planActive && (
            <button className="px-btn px-btn-primary" onClick={startCheckout} disabled={checkoutBusy || subscription === undefined}>
              {checkoutBusy ? 'Starting…' : 'Upgrade to Growth'}
            </button>
          )}
        </div>

        {/* ── White-label branding ── */}
        <div className="px-section-head" style={{ marginTop: 8 }}>
          <h2>Branding <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>white-label</span></h2>
          {!brandForm && (
            <div className="px-section-tools">
              <button className="px-btn px-btn-sm px-btn-ghost" disabled={!brand}
                onClick={() => setBrandForm({
                  name: brand?.name || firmName,
                  brand_color: brand?.brand_color || '#1c2e4a',
                  logo_url: brand?.logo_url || null,
                  show_powered_by: brand?.show_powered_by !== false,
                })}>
                <Icons.Edit size={11} /> Edit branding
              </button>
            </div>
          )}
        </div>

        {!brandForm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 14px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24 }}>
            {brand?.logo_url
              ? <img className="px-brand-logo" src={brand.logo_url} alt="Firm logo" style={{ width: 36, height: 36 }} />
              : <div className="px-brand-mark" style={{ width: 36, height: 36, background: brand?.brand_color || 'var(--brand)' }}><Icons.Prism size={18} /></div>}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{firmName}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                Accent {brand?.brand_color || '#1c2e4a'} · {brand?.logo_url ? 'custom logo' : 'no logo yet'} ·{' '}
                {brand?.show_powered_by === false ? 'attribution off' : '"powered by Prism" shown'}
              </div>
              {brand?.slug && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 3, fontFamily: 'var(--mono)' }}>
                  Client portal: https://{brand.slug}.prismaw.com/portal
                </div>
              )}
            </div>
            <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: brand?.brand_color || '#1c2e4a', border: '1px solid var(--border-2)' }}
              title={`Accent color ${brand?.brand_color || '#1c2e4a'}`} />
          </div>
        ) : (
          <div style={{ padding: 14, background: 'var(--bg-elev)', borderRadius: 8, marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 14px', alignItems: 'center', maxWidth: 560 }}>
              <label style={{ fontSize: 12.5, color: 'var(--ink-mute)' }} htmlFor="px-brand-name">Firm name</label>
              <div>
                <input id="px-brand-name" className="px-input" style={{ width: '100%', maxWidth: 320 }}
                  value={brandForm.name || ''} placeholder="Firm name"
                  onChange={e => setBrandForm(f => ({ ...f, name: e.target.value }))} />
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>
                  Shown across the workspace and every client portal. Renames here cover a rebrand or
                  acquisition; your portal address ({brand?.slug || 'slug'}.prismaw.com) stays the same.
                </div>
              </div>
              <label style={{ fontSize: 12.5, color: 'var(--ink-mute)' }} htmlFor="px-brand-color">Accent color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input id="px-brand-color" type="color" value={brandForm.brand_color}
                  onChange={e => setBrandForm(f => ({ ...f, brand_color: e.target.value }))}
                  style={{ width: 36, height: 28, padding: 0, border: '1px solid var(--border-2)', borderRadius: 5, background: 'transparent', cursor: 'pointer' }} />
                <input className="px-input" style={{ width: 110, fontFamily: 'var(--mono)' }} value={brandForm.brand_color}
                  onChange={e => setBrandForm(f => ({ ...f, brand_color: e.target.value }))} aria-label="Accent color hex" />
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Pick a dark shade - it carries buttons and headers.</span>
              </div>
              <label style={{ fontSize: 12.5, color: 'var(--ink-mute)' }} htmlFor="px-brand-logo-file">Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {brandForm.logo_url && <img className="px-brand-logo" src={brandForm.logo_url} alt="Logo preview" style={{ width: 32, height: 32 }} />}
                <input id="px-brand-logo-file" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={e => onLogoFile(e.target.files?.[0])} style={{ fontSize: 12 }} />
                {brandForm.logo_url && (
                  <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }}
                    onClick={() => setBrandForm(f => ({ ...f, logo_url: null }))}>
                    <Icons.X size={10} /> Remove
                  </button>
                )}
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>Attribution</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>
                <input type="checkbox" checked={brandForm.show_powered_by}
                  onChange={e => setBrandForm(f => ({ ...f, show_powered_by: e.target.checked }))} />
                Show "powered by Prism" in the client portal
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <div style={{ flex: 1, fontSize: 11.5, color: 'var(--ink-faint)', alignSelf: 'center' }}>
                Applies to the advisor workspace and every client's portal at sign-in.
              </div>
              <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setBrandForm(null)}>Cancel</button>
              <button className="px-btn px-btn-sm px-btn-primary" onClick={saveBrand}
                disabled={brandSaving || !/^#[0-9a-fA-F]{6}$/.test(brandForm.brand_color)}>
                {brandSaving ? 'Saving…' : 'Save branding'}
              </button>
            </div>
          </div>
        )}

        {/* ── Workflow controls ── */}
        {ledgerGate !== null && (
          <>
            <div className="px-section-head">
              <h2>Workflow <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>firm-wide</span></h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24 }}>
              <Icons.Check size={16} style={{ color: ledgerGate ? 'var(--forest)' : 'var(--ink-faint)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Advisor approval for client ledger edits</div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                  When on, a client's "Your numbers" updates wait as a draft until their advisor approves them -
                  the advisor sees drafts on the dashboard, and every decision lands in the audit trail. Advisors' own edits are never held.
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={ledgerGate} onChange={toggleLedgerGate} />
                {ledgerGate ? 'Required' : 'Off'}
              </label>
            </div>
          </>
        )}

        {/* ── API & integrations (public API keys, migration 046) ── */}
        {apiKeys !== null && (() => {
          const PUBLIC_API_BASE = 'https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/public-api';
          const live = (apiKeys || []).filter(k => !k.revoked_at);
          return (
            <>
              <div className="px-section-head" style={{ marginTop: 8 }}>
                <h2>API &amp; integrations <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>Zapier · Make · custom · {live.length} active key{live.length === 1 ? '' : 's'}</span></h2>
              </div>
              <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5, marginBottom: 12 }}>
                  Mint a key to connect Prism to the rest of your stack: read new clients, meetings, and tasks
                  into another tool, or create clients and tasks from one. A key carries this firm's identity and
                  only ever touches this firm's data. The full guide is in <strong>Help → Integrations and API</strong>.
                </div>

                {/* Base URL */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Base URL</span>
                  <code style={{ fontSize: 12, background: 'var(--surface-2, var(--bg))', padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', color: 'var(--ink)' }}>{PUBLIC_API_BASE}</code>
                  <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => copyText(PUBLIC_API_BASE)}>Copy</button>
                </div>

                {/* One-time fresh-key reveal */}
                {freshKey && (
                  <div style={{ padding: 12, marginBottom: 14, background: 'var(--accent-soft, rgba(0,0,0,.04))', border: '1px solid var(--accent-line, var(--border))', borderRadius: 8 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                      Your new key - copy it now. For your security it is not shown again.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <code style={{ fontSize: 12.5, wordBreak: 'break-all', flex: 1, minWidth: 220, background: 'var(--bg)', padding: '6px 9px', borderRadius: 5, border: '1px solid var(--border)', color: 'var(--ink)' }}>{freshKey}</code>
                      <button className="px-btn px-btn-sm px-btn-primary" onClick={() => copyText(freshKey)}>Copy key</button>
                      <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setFreshKey(null)}>Done</button>
                    </div>
                  </div>
                )}

                {/* Create */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <input className="px-input" style={{ width: 'auto', flex: 1, minWidth: 160 }} placeholder='Key name, e.g. "Zapier"'
                    value={newKeyName} maxLength={80} onChange={e => setNewKeyName(e.target.value)} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={newKeyWrite} onChange={e => setNewKeyWrite(e.target.checked)} />
                    Allow write
                  </label>
                  <button className="px-btn px-btn-sm px-btn-primary" onClick={createApiKey} disabled={keyBusy}>
                    {keyBusy ? 'Creating…' : 'Create key'}
                  </button>
                </div>

                {/* Existing keys */}
                {live.length === 0 && (apiKeys || []).length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>No keys yet. Create one above to get started.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(apiKeys || []).map(k => {
                      const revoked = !!k.revoked_at;
                      const canWrite = (k.scopes || []).includes('write');
                      return (
                        <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, opacity: revoked ? 0.55 : 1 }}>
                          <div style={{ flex: 1, minWidth: 140 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                              {k.name}
                              <code style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-faint)', marginLeft: 8 }}>{k.prefix}…</code>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                              {canWrite ? 'Read + write' : 'Read only'} · created {new Date(k.created_at).toLocaleDateString()} ·{' '}
                              {revoked ? 'revoked' : (k.last_used_at ? `last used ${window.db.timeAgo(k.last_used_at)}` : 'never used')}
                            </div>
                          </div>
                          {!revoked && (
                            <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }}
                              onClick={() => revokeApiKey(k.id, k.name)}>Revoke</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ── CX playbook authoring (advisor playbook phase 2, migration 045) ── */}
        {firmPlaybooks !== null && pbForm && (() => {
          const phases = (window.phasesData || []).filter(p => window.advisorPlaybook?.[p.id]);
          const customCount = Object.keys(firmPlaybooks).length;
          const customized = !!firmPlaybooks[pbPhase];
          const LBL = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '12px 0 4px' };
          const HINT = { fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-faint)', marginLeft: 6 };
          const TA = { width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.5 };
          return (
            <>
              <div className="px-section-head" style={{ marginTop: 8 }}>
                <h2>CX playbook <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>advisor script · {customCount}/{phases.length} customized</span></h2>
              </div>
              <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5, marginBottom: 12 }}>
                  The per-phase script your advisors see in a client's quick view: questions to ask, expectations
                  to set, documents to gather, and the cadence to promise. Clients never see it. Edit a phase to
                  author your firm's version; whatever you leave on the Prism default stays the default.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select className="px-select" style={{ width: 'auto' }} value={pbPhase}
                    onChange={e => setPbPhase(Number(e.target.value))} aria-label="Playbook phase">
                    {phases.map(p => <option key={p.id} value={p.id}>Phase {p.num} · {p.title}</option>)}
                  </select>
                  <span style={{ fontSize: 11, fontWeight: 600, color: customized ? 'var(--forest)' : 'var(--ink-faint)' }}>
                    {customized ? 'Customized' : 'Prism default'}
                  </span>
                </div>

                <label style={LBL}>Questions to ask <span style={HINT}>one per line</span></label>
                <textarea className="px-input" rows={4} style={TA} value={pbForm.questions}
                  onChange={e => setPbForm(f => ({ ...f, questions: e.target.value }))} />

                <label style={LBL}>Expectations to set</label>
                <textarea className="px-input" rows={3} style={TA} value={pbForm.expectations}
                  onChange={e => setPbForm(f => ({ ...f, expectations: e.target.value }))} />

                <label style={LBL}>Documents to gather <span style={HINT}>one per line</span></label>
                <textarea className="px-input" rows={4} style={TA} value={pbForm.gather}
                  onChange={e => setPbForm(f => ({ ...f, gather: e.target.value }))} />

                <label style={LBL}>Cadence</label>
                <textarea className="px-input" rows={2} style={TA} value={pbForm.cadence}
                  onChange={e => setPbForm(f => ({ ...f, cadence: e.target.value }))} />

                <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
                  {customized && (
                    <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }} onClick={resetPlaybook}>
                      Reset to default
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button className="px-btn px-btn-sm px-btn-primary" onClick={savePlaybook} disabled={pbSaving}>
                    {pbSaving ? 'Saving…' : 'Save playbook'}
                  </button>
                </div>
              </div>
            </>
          );
        })()}

        {/* ── CX quality: playbook adherence (advisor playbook phase 3) ──
            A derived quality read - of the playbook's four promises, cadence is the
            one with a digital footprint (last_meeting_at). On-cadence % per advisor +
            where the book sits vs. the firm's authored script. Firm-admin only. */}
        {advisors !== undefined && firmClients !== undefined && (() => {
          const q = cxQuality;
          const days = CX_CADENCE_DAYS;
          if (!q.firmTotal) return null; // nothing to grade until the firm has a book
          const roster = (advisors || []).filter(a => (cxQuality.per[a.id]?.total || 0) > 0)
            .slice().sort((a, b) => (cxQuality.per[b.id].pct ?? -1) - (cxQuality.per[a.id].pct ?? -1));
          return (
            <>
              <div className="px-section-head" style={{ marginTop: 8 }}>
                <h2>CX quality <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>playbook adherence</span></h2>
              </div>
              <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5, marginBottom: 14 }}>
                  How the book is tracking against the playbook's cadence promise - the one of its four
                  commitments with a digital footprint. "On cadence" means a meeting was logged in the
                  last {days} days (a quarter plus grace). Asking the right questions, setting expectations,
                  and gathering documents happen in the room; this measures the relationship rhythm around them.
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span className="px-num-serif" style={{ fontSize: 30, fontWeight: 700, color: cadenceTone(q.firmPct) }}>{q.firmPct}%</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
                    of {q.firmTotal} household{q.firmTotal === 1 ? '' : 's'} on cadence firm-wide
                    {q.firmTotal - q.firmOn > 0 && <> · <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{q.firmTotal - q.firmOn} need a review</span></>}
                  </span>
                </div>

                <div className="px-roster">
                  <table className="px-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Advisor</th>
                        <th className="is-num">Households</th>
                        <th className="is-num">On cadence</th>
                        <th className="is-num">Needs review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map(a => {
                        const s = cxQuality.per[a.id];
                        const tone = cadenceTone(s.pct);
                        return (
                          <tr key={a.id}>
                            <td>
                              <span style={{ fontSize: 13, color: 'var(--ink)' }}>{a.full_name}</span>
                              {a.id === authUser?.id && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ink-faint)' }}>you</span>}
                            </td>
                            <td className="is-num"><span className="px-num-serif">{s.total}</span></td>
                            <td className="is-num">
                              <span className="px-num-serif" style={{ color: tone, fontWeight: 600 }}>{s.pct}%</span>
                              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}> · {s.onCadence}/{s.total}</span>
                            </td>
                            <td className="is-num">
                              {s.overdue > 0
                                ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
                                    {s.overdue}{s.neverMet > 0 ? <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}> ({s.neverMet} never met)</span> : null}
                                  </span>
                                : <span style={{ fontSize: 12, color: 'var(--forest)' }}>caught up</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Playbook coverage - where the book sits by phase vs. what the firm has scripted */}
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 8px' }}>
                  Where your book sits {phaseCoverage.defaultExposure > 0 && (
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--gold)', marginLeft: 6 }}>
                      {phaseCoverage.defaultExposure} household{phaseCoverage.defaultExposure === 1 ? '' : 's'} still on the Prism default script
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {phaseCoverage.rows.filter(p => p.households > 0).map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px',
                      background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--ink-mute)' }}>Phase {p.num} · {p.title}</span>
                      <span className="px-num-serif" style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.households}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '0 7px', borderRadius: 20,
                        color: p.customized ? 'var(--forest)' : 'var(--ink-faint)',
                        border: `1px solid ${p.customized ? 'var(--forest)' : 'var(--border-2)'}` }}>
                        {p.customized ? 'Customized' : 'Default'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}

        <div className="px-section-head">
          <h2>Advisor roster {advisors !== undefined && (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>live</span>
          )}</h2>
        </div>

        {advisors === undefined ? <RosterSkeleton /> : advisors.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
            No advisors found.
          </div>
        ) : (
          <div className="px-roster">
            <table className="px-table">
              <thead>
                <tr>
                  <th style={{ width: '36%' }}>Advisor</th>
                  <th style={{ width: '16%' }}>Role</th>
                  <th className="is-num">Clients</th>
                  <th className="is-num">Book AUM</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {advisors.map(a => {
                  const stats = advisorStats[a.id] || { clientCount: 0, aum: 0 };
                  const isMe  = a.id === authUser?.id;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="px-client-cell">
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--ink)', color: 'white', fontSize: 11,
                            fontWeight: 600, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', letterSpacing: '.02em',
                          }}>
                            {a.full_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="px-client-meta">
                            <div className="px-client-name">
                              {a.full_name}
                              {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ink-faint)' }}>you</span>}
                            </div>
                            <div className="px-client-tag">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--ink-mute)', textTransform: 'capitalize' }}>
                          {a.role}{a.credentials ? ` · ${a.credentials}` : ''}
                        </span>
                      </td>
                      <td className="is-num">
                        <span className="px-num-serif">{stats.clientCount}</span>
                      </td>
                      <td className="is-num">
                        <span className="px-num-serif">
                          {stats.aum ? fmt$(stats.aum, { short: true }) : '-'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                          {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Revenue & billing (advisory fees) ── */}
        <div className="px-section-head" style={{ marginTop: 32 }}>
          <h2>Revenue &amp; billing <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>advisory fees</span></h2>
          <div className="px-section-tools" style={{ display: 'flex', gap: 6 }}>
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={exportClientsCSV}
              disabled={!(firmClients || []).length} title="Download clients + fee assignments as CSV">
              <Icons.Download size={10} /> Clients CSV
            </button>
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={exportInvoicesCSV}
              disabled={!(invoices || []).length} title="Download all invoices as CSV">
              <Icons.Download size={10} /> Invoices CSV
            </button>
            <button className="px-btn px-btn-sm px-btn-primary" onClick={generateInvoices} disabled={genBusy}>
              <Icons.Refresh size={11} /> {genBusy ? 'Generating…' : 'Run billing now'}
            </button>
          </div>
        </div>

        <div className="px-kpis" style={{ marginBottom: 14 }}>
          <KpiTile label="Projected annual revenue" value={projectedRevenue ? fmt$(projectedRevenue, { short: true, decimals: 1 }) : '-'} sub="from assigned schedules" />
          <KpiTile label="Realized fees · YTD" value={realizedYTD ? fmt$(realizedYTD, { short: true, decimals: 1 }) : '-'} sub="approved + paid" />
          <KpiTile label="Open invoices" value={(invoices || []).filter(i => i.status === 'draft').length} sub="awaiting approval" />
          <KpiTile label="Fee schedules" value={(feeSchedules || []).length} sub="active templates" />
        </div>

        {/* Fee schedules */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Fee schedules</span>
          {!schedForm && (
            <button className="px-btn px-btn-sm px-btn-ghost"
              onClick={() => setSchedForm({ name: '', frequency: 'quarterly', basis: 'avg_daily', tiers: [{ up_to: '', annual_bps: '' }] })}>
              <Icons.Plus size={10} /> New schedule
            </button>
          )}
        </div>

        {schedForm && (
          <div style={{ padding: 14, background: 'var(--bg-elev)', borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <input className="px-input" placeholder="Schedule name (e.g. Standard 1%)" value={schedForm.name}
                onChange={e => setSchedForm(f => ({ ...f, name: e.target.value }))} />
              <select className="px-select" value={schedForm.frequency} onChange={e => setSchedForm(f => ({ ...f, frequency: e.target.value }))}>
                <option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="annually">Annually</option>
              </select>
              <select className="px-select" value={schedForm.basis} onChange={e => setSchedForm(f => ({ ...f, basis: e.target.value }))}>
                <option value="avg_daily">Avg daily balance</option><option value="period_end">Period-end balance</option>
              </select>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6 }}>Tiers (leave "up to" blank for the top band):</div>
            {(schedForm.tiers || []).map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <div className="px-input-affix" style={{ flex: 1 }}>
                  <span className="px-affix">$</span>
                  <input type="number" placeholder="up to (blank = and above)" value={t.up_to}
                    onChange={e => setSchedForm(f => { const tiers = [...f.tiers]; tiers[i] = { ...tiers[i], up_to: e.target.value }; return { ...f, tiers }; })} />
                </div>
                <div className="px-input-affix" style={{ width: 130 }}>
                  <input type="number" placeholder="annual" value={t.annual_bps}
                    onChange={e => setSchedForm(f => { const tiers = [...f.tiers]; tiers[i] = { ...tiers[i], annual_bps: e.target.value }; return { ...f, tiers }; })} />
                  <span className="px-affix px-affix-r">bps</span>
                </div>
                <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }}
                  onClick={() => setSchedForm(f => ({ ...f, tiers: f.tiers.filter((_, j) => j !== i) }))}>
                  <Icons.X size={10} />
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setSchedForm(f => ({ ...f, tiers: [...f.tiers, { up_to: '', annual_bps: '' }] }))}>
                <Icons.Plus size={10} /> Add tier
              </button>
              <div style={{ flex: 1 }} />
              <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setSchedForm(null)}>Cancel</button>
              <button className="px-btn px-btn-sm px-btn-primary" onClick={createSchedule}>Save schedule</button>
            </div>
          </div>
        )}

        {(feeSchedules || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {feeSchedules.map(s => (
              <div key={s.id} style={{ fontSize: 12, color: 'var(--ink-mute)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px' }}>
                <b style={{ color: 'var(--ink)' }}>{s.name}</b> · {s.frequency} · {(s.tiers || []).map(t => `${t.annual_bps}bps${t.up_to ? `≤${fmt$(t.up_to, { short: true })}` : ''}`).join(' / ')}
              </div>
            ))}
          </div>
        )}

        {/* Assign schedules to clients - inline, so it's not a per-client detour */}
        {(feeSchedules || []).length > 0 && (firmClients || []).length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Assign schedules to clients</span>
            <div className="px-roster" style={{ marginTop: 8 }}>
              <table className="px-table">
                <thead>
                  <tr><th>Client</th><th className="is-num">AUM</th><th style={{ width: 230 }}>Fee schedule</th></tr>
                </thead>
                <tbody>
                  {(firmClients || []).map(c => (
                    <tr key={c.id}>
                      <td data-label="Client">{c.short_name || c.household_name || 'Client'}</td>
                      <td className="is-num" data-label="AUM">{fmt$(Number(c.aum) || 0, { short: true })}</td>
                      <td data-label="Fee schedule">
                        <select className="px-select" value={c.fee_schedule_id || ''}
                          onChange={e => assignFeeSchedule(c.id, e.target.value)}
                          aria-label={`Fee schedule for ${c.short_name || c.household_name || 'client'}`}>
                          <option value="">- Unassigned -</option>
                          {feeSchedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invoices */}
        {(invoices || []).length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
            No invoices yet. Assign a fee schedule to clients above, then "Run billing now."
          </div>
        ) : (
          <div className="px-roster">
            <table className="px-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Client</th>
                  <th>Period</th>
                  <th className="is-num">Basis</th>
                  <th className="is-num">Fee</th>
                  <th style={{ width: 150 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.clients?.short_name || inv.clients?.household_name || 'Client'}</td>
                    <td><span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                      {new Date(inv.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–{new Date(inv.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </span></td>
                    <td className="is-num"><span style={{ color: 'var(--ink-mute)' }}>{fmt$(inv.basis_amount, { short: true })}</span></td>
                    <td className="is-num"><span className="px-num-serif">{fmt$(inv.fee_amount)}</span></td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: INVOICE_STATUS_TONE[inv.status], marginRight: 8 }}>{inv.status}</span>
                      {inv.status === 'draft' && (
                        <>
                          <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--forest)' }} onClick={() => setInvoiceStatus(inv, 'approved')}>Approve</button>
                          <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }} onClick={() => setInvoiceStatus(inv, 'void')}>Void</button>
                        </>
                      )}
                      {inv.status === 'approved' && (
                        <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setInvoiceStatus(inv, 'paid')}>Mark paid</button>
                      )}
                      <button className="px-btn px-btn-sm px-btn-ghost" title="Download invoice PDF"
                        onClick={() => window.printInvoiceReport?.(inv, inv.clients?.short_name || inv.clients?.household_name, authUser?.firms?.name)}>
                        <Icons.Download size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Compliance audit trail ── */}
        <div className="px-section-head" style={{ marginTop: 32 }}>
          <h2>Compliance audit trail <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>append-only · SEC 17a-3</span></h2>
          <div className="px-section-tools" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="px-select" style={{ width: 'auto' }} value={packetDays}
              onChange={e => setPacketDays(e.target.value)} aria-label="Exam packet audit window">
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
              <option value="0">Full history</option>
            </select>
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={exportAuditCSV}
              title="Download the selected audit window as CSV">
              <Icons.Download size={10} /> Audit CSV
            </button>
            <button className="px-btn px-btn-sm px-btn-primary" onClick={exportExamPacket} disabled={packetBusy}
              title="One-click books-&-records packet: advisors, clients, fee schedules, invoices, acknowledgements, audit trail">
              <Icons.Download size={11} /> {packetBusy ? 'Assembling…' : 'Exam packet'}
            </button>
          </div>
        </div>

        {auditLog === undefined ? (
          <div style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '12px 0' }}>Loading audit trail…</div>
        ) : auditLog.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
            No audit entries yet - material actions (client edits, meetings, profile saves, sign-ins) will appear here.
          </div>
        ) : (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input className="px-input" style={{ flex: 1, maxWidth: 340 }} value={auditFilter}
              placeholder="Filter by actor, action, or detail…" aria-label="Filter audit trail"
              onChange={e => setAuditFilter(e.target.value)} />
            <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
              {visibleAudit.length} of {auditLog.length} loaded entr{auditLog.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          {visibleAudit.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
            Nothing matches that filter in the loaded entries.
          </div>
          ) : (
          <div className="px-roster">
            <table className="px-table">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>When</th>
                  <th style={{ width: '24%' }}>Actor</th>
                  <th style={{ width: '20%' }}>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {visibleAudit.map(e => (
                  <tr key={e.id} style={{ cursor: 'default' }}>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'var(--mono, monospace)' }}>
                        {new Date(e.occurred_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--ink)' }}>{e.actor_email || '-'}</span>
                      {e.actor_role && <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginLeft: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{e.actor_role}</span>}
                    </td>
                    <td>
                      <span className="px-phase-pill-num" style={{ fontSize: 11 }}>
                        {AUDIT_ACTION_LABELS[e.action] || e.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{e.summary || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          {!auditMore && auditLog.length >= 100 && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button className="px-btn px-btn-sm px-btn-ghost" onClick={loadMoreAudit}>
                Load more (up to 500 entries) - use Audit CSV or the exam packet for the full window
              </button>
            </div>
          )}
          </>
        )}

        <div style={{ marginTop: 28, padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--ink-mute)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icons.Lock size={13} />
          <span>
            Firm admin view - exclusive to the <b>admin</b> role. The audit trail is <b>append-only</b> (no update/delete policy) and records are <b>archived, never erased</b>, per SEC Rule 17a-4. <b>Row-level security</b> still restricts each advisor to their own book.
          </span>
        </div>
      </div>
    </div>
  );
};

window.FirmAdminDashboard = FirmAdminDashboard;
