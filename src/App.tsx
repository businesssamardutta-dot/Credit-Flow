import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import * as api from './lib/db';
import { fmt, fmtRs, mkLabel } from './lib/utils';
import { DashboardPage } from './components/DashboardPage';
import { MonthlyPage } from './components/MonthlyPage';
import { LiftingLedgerPage, LiftingPage, LiftingSchedulePage } from './components/LiftingPage';
import { PartiesPage } from './components/PartiesPage';
import { LedgerPage } from './components/LedgerPage';
import { SettingsPage } from './components/SettingsPage';

Chart.register(...registerables);

const nav = [
  { id: 'dashboard', ico: '◈', label: 'Dashboard' },
  { id: 'monthly', ico: '📅', label: 'Monthly View' },
  { id: 'lifting', ico: '📦', label: 'Goods Lifting' },
  { id: 'lifting-schedule', ico: '🚚', label: 'Lifting Schedule' },
  { id: 'lifting-ledger', ico: '📋', label: 'Lifting Ledger' },
  { id: 'parties', ico: '🏢', label: 'Parties' },
  { id: 'ledger', ico: '📒', label: 'Ledger' },
  { id: 'settings', ico: '⚙', label: 'Settings' },
];

export function statusBadge(s: string) {
  const m: Record<string, string> = {
    PAID: 'paid', OVERDUE: 'overdue', 'DUE SOON': 'duesoon',
    ACTIVE: 'active', ADVANCE: 'advance', COMPLETED: 'completed',
    'IN PROGRESS': 'inprogress', 'NOT STARTED': 'notstarted', 'NO TARGET': 'notarget'
  };
  return <span className={`badge badge-${m[s] || 'default'}`}>{s || '—'}</span>;
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [parties, setParties] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [settings, setSettings] = useState({ theme: 'ocean', remindersEnabled: true });
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Command Palette State
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);

  // Quick Ledger Entry State
  const [showQuickEntryModal, setShowQuickEntryModal] = useState(false);
  const [qePartyId, setQePartyId] = useState('');
  const [qeType, setQeType] = useState<'credit' | 'payment'>('credit');
  const [qeMonth, setQeMonth] = useState('');
  const [qeAmount, setQeAmount] = useState('');
  const [qeNotes, setQeNotes] = useState('');
  const [qeMethod, setQeMethod] = useState('Cash');
  const [qeRef, setQeRef] = useState('');
  const [qeBusy, setQeBusy] = useState(false);

  // Load draft on mount / load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('draft_quick_ledger');
      if (saved) {
        const d = JSON.parse(saved);
        if (d.qePartyId) setQePartyId(d.qePartyId);
        if (d.qeType) setQeType(d.qeType);
        if (d.qeMonth) setQeMonth(d.qeMonth);
        if (d.qeAmount) setQeAmount(d.qeAmount);
        if (d.qeNotes) setQeNotes(d.qeNotes);
        if (d.qeMethod) setQeMethod(d.qeMethod);
        if (d.qeRef) setQeRef(d.qeRef);
      }
    } catch (e) {}
  }, []);

  // Save draft on change
  useEffect(() => {
    try {
      localStorage.setItem('draft_quick_ledger', JSON.stringify({
        qePartyId, qeType, qeMonth, qeAmount, qeNotes, qeMethod, qeRef
      }));
    } catch (e) {}
  }, [qePartyId, qeType, qeMonth, qeAmount, qeNotes, qeMethod, qeRef]);

  // Auto-align default quick-entry month if no draft is present
  useEffect(() => {
    if (summary?.currentMonth && !localStorage.getItem('draft_quick_ledger')) {
      setQeMonth(summary.currentMonth);
    }
  }, [summary]);

  // Global Keyboard Shortcuts Event Listener (Ctrl+K and Ctrl+N)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (!authEmail) return; // Only trigger shortcuts if authenticated

      const isModifier = e.ctrlKey || e.metaKey;
      if (isModifier && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (isModifier && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowQuickEntryModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [authEmail]);

  // Load saved local/session storage email
  useEffect(() => {
    let savedEmail = null;
    try {
      savedEmail = sessionStorage.getItem('auth_email') || localStorage.getItem('auth_email');
    } catch (e) {
      console.warn('Storage getItem failed', e);
    }
    if (savedEmail) {
      setAuthEmail(savedEmail);
    }
    setAuthChecking(false);
  }, []);

  const handleLogin = (email: string) => {
    try {
      sessionStorage.setItem('auth_email', email);
      localStorage.setItem('auth_email', email);
    } catch (e) {
      console.warn('Storage setItem failed', e);
    }
    setAuthEmail(email);
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('auth_email');
      localStorage.removeItem('auth_email');
    } catch (e) {
      console.warn('Storage removeItem failed', e);
    }
    setAuthEmail(null);
  };

  const toast = useCallback((msg: string, type = 'info') => {
    setSnack({ msg, type });
    setTimeout(() => setSnack(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, cfg] = await Promise.all([
        api.getParties(),
        api.getDashboardSummary(),
        api.getSettings(),
      ]);
      setParties(p || []);
      setSummary(s);
      setSettings(cfg || { theme: 'ocean' });
    } catch (e: any) {
      toast('Load error: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const ALLOWED_EMAILS = [
    'sefalicommercial@gmail.com',
    'basudebbanerjee653@gmail.com',
    'business.samardutta@gmail.com'
  ];

  useEffect(() => {
    if (!authChecking && authEmail) {
      if (ALLOWED_EMAILS.includes(authEmail)) {
        api.initDatabase().then(() => refresh());
      }
    }
  }, [authChecking, authEmail, refresh]);

  const checkAndRunRecurringTransactions = useCallback(async (currentSettings: any, currentSummary: any) => {
    if (!currentSummary?.currentMonth) return;
    
    let runLog: string[] = [];
    try {
      runLog = currentSettings.recurringTxnsRunLog ? JSON.parse(currentSettings.recurringTxnsRunLog) : [];
    } catch (e) {
      try {
        const fallback = localStorage.getItem('creditflow_recurring_txns_run_log');
        runLog = fallback ? JSON.parse(fallback) : [];
      } catch (err) {}
    }
    
    if (!Array.isArray(runLog)) {
      runLog = [];
    }

    const thisMonth = currentSummary.currentMonth;
    if (runLog.includes(thisMonth)) {
      return;
    }

    let recurringTxns: any[] = [];
    try {
      recurringTxns = currentSettings.recurringTransactions ? JSON.parse(currentSettings.recurringTransactions) : [];
    } catch (e) {
      try {
        const fallback = localStorage.getItem('creditflow_recurring_txns');
        recurringTxns = fallback ? JSON.parse(fallback) : [];
      } catch (err) {}
    }

    if (!Array.isArray(recurringTxns) || recurringTxns.length === 0) {
      return;
    }

    console.log(`[Recurring Txns] Running ${recurringTxns.length} recurring entries for month ${thisMonth}`);
    toast(`⚙ Auto-processing ${recurringTxns.length} recurring entries for ${thisMonth}...`, 'info');

    let processedCount = 0;
    for (const rx of recurringTxns) {
      try {
        if (rx.type === 'credit') {
          await api.addCredit(rx.partyId, Number(rx.amount), rx.notes + ' [Auto-Recurring Entry]', thisMonth);
        } else {
          await api.recordPayment(rx.partyId, Number(rx.amount), rx.method || 'Cash', rx.ref || 'Auto-Recurring', rx.notes + ' [Auto-Recurring Entry]', thisMonth);
        }
        processedCount++;
      } catch (err: any) {
        console.error(`[Recurring Txns] Failed to process transaction for party ${rx.partyId}:`, err);
      }
    }

    // Update run log
    const nextRunLog = [...runLog, thisMonth];
    const nextRunLogStr = JSON.stringify(nextRunLog);
    try {
      await api.saveSetting('recurringTxnsRunLog', nextRunLogStr);
      setSettings((s: any) => ({ ...s, recurringTxnsRunLog: nextRunLogStr }));
      localStorage.setItem('creditflow_recurring_txns_run_log', nextRunLogStr);
    } catch (e) {
      console.error('[Recurring Txns] Failed to save run log:', e);
    }

    toast(`✅ Auto-processed ${processedCount} recurring transactions for ${thisMonth}!`, 'success');
    refresh();
  }, [toast, refresh]);

  const [recurringCheckedMonth, setRecurringCheckedMonth] = useState('');

  useEffect(() => {
    if (summary?.currentMonth && settings && !loading && recurringCheckedMonth !== summary.currentMonth && authEmail) {
      setRecurringCheckedMonth(summary.currentMonth);
      checkAndRunRecurringTransactions(settings, summary);
    }
  }, [summary, settings, loading, recurringCheckedMonth, authEmail, checkAndRunRecurringTransactions]);

  const saveTheme = async (t: string) => {
    setSettings(s => ({ ...s, theme: t }));
    document.documentElement.setAttribute('data-theme', t);
    try {
      await api.saveSetting('theme', t);
      toast('Theme saved ✓', 'success');
    } catch (e) {}
  };

  // Command Palette Options and Selection Mechanisms
  const staticCommands = useMemo(() => [
    { id: 'nav-dashboard', label: 'Go to Dashboard', category: 'Navigation', action: () => { setTab('dashboard'); } },
    { id: 'nav-monthly', label: 'Go to Monthly View', category: 'Navigation', action: () => { setTab('monthly'); } },
    { id: 'nav-lifting', label: 'Go to Goods Lifting', category: 'Navigation', action: () => { setTab('lifting'); } },
    { id: 'nav-schedule', label: 'Go to Lifting Schedule', category: 'Navigation', action: () => { setTab('lifting-schedule'); } },
    { id: 'nav-lifting-ledger', label: 'Go to Lifting Ledger', category: 'Navigation', action: () => { setTab('lifting-ledger'); } },
    { id: 'nav-parties', label: 'Go to Parties', category: 'Navigation', action: () => { setTab('parties'); } },
    { id: 'nav-ledger', label: 'Go to Ledger & Audits', category: 'Navigation', action: () => { setTab('ledger'); } },
    { id: 'nav-settings', label: 'Go to Settings', category: 'Navigation', action: () => { setTab('settings'); } },
    
    { id: 'act-quick-entry', label: 'Post New Ledger Entry (Ctrl+N)', category: 'Quick Actions', action: () => { setShowQuickEntryModal(true); } },
    { id: 'act-refresh', label: 'Sync / Refresh Workspace Data', category: 'Quick Actions', action: () => { refresh(); toast('Synchronizing workspace...', 'info'); } },
    { id: 'act-reminders', label: 'Send Outstanding Reminders', category: 'Quick Actions', action: () => { api.sendReminderEmails().then(c => toast(`${c} reminders sent ✓`, 'success')).catch(e => toast(e.message, 'error')); } },
    
    { id: 'theme-ocean', label: 'Switch Theme to Ocean Blue', category: 'Theme Configuration', action: () => { saveTheme('ocean'); } },
    { id: 'theme-sakura', label: 'Switch Theme to Sakura Cherry', category: 'Theme Configuration', action: () => { saveTheme('sakura'); } },
    { id: 'theme-forest', label: 'Switch Theme to Forest Green', category: 'Theme Configuration', action: () => { saveTheme('forest'); } },
    { id: 'theme-amber', label: 'Switch Theme to Amber Rust', category: 'Theme Configuration', action: () => { saveTheme('amber'); } },
    { id: 'theme-slate', label: 'Switch Theme to Minimal Slate', category: 'Theme Configuration', action: () => { saveTheme('slate'); } },
    { id: 'theme-lavender', label: 'Switch Theme to Lavender Dusk', category: 'Theme Configuration', action: () => { saveTheme('lavender'); } },
  ], [refresh, toast]);

  const filteredCommands = useMemo(() => {
    const query = commandSearch.trim().toLowerCase();
    const partyCommands = parties
      .filter(p => !query || p.accountName?.toLowerCase().includes(query))
      .map(p => ({
        id: `party-${p.partyId}`,
        label: `Open Transaction Ledger for ${p.accountName}`,
        category: 'Parties & Accounts',
        action: () => {
          setTab('ledger');
          try {
            sessionStorage.setItem('preferred_ledger_party', p.accountName);
            window.dispatchEvent(new Event('ledger_party_changed'));
          } catch (e) {}
        }
      }));

    const staticFiltered = staticCommands.filter(c => 
      !query || c.label.toLowerCase().includes(query) || c.category.toLowerCase().includes(query)
    );

    return [...staticFiltered, ...partyCommands];
  }, [commandSearch, parties, staticCommands]);

  useEffect(() => {
    setCommandSelectedIndex(0);
  }, [commandSearch]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'ocean');
  }, [settings.theme]);

  if (authChecking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="loading" style={{ fontSize: '18px' }}>⟳ Checking Workspace Authentication…</div>
      </div>
    );
  }

  if (!authEmail || !ALLOWED_EMAILS.includes(authEmail)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '20px' }}>
        <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '32px', boxShadow: 'var(--shadow)', background: 'var(--surface)' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span style={{ fontSize: '42px' }}>🔒</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, marginTop: '14px', color: 'var(--text)' }}>CreditFlow PRO</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>Select an authorized account to enter the workspace</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="field">
              <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px' }}>Authorize Account Chooser</label>
              <select 
                style={{ width: '100%', padding: '10px 12px', background: 'var(--surface2)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', outline: 'none' }}
                onChange={(e) => {
                  if (e.target.value) {
                    handleLogin(e.target.value);
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>-- Select Email Address --</option>
                {ALLOWED_EMAILS.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'center', margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span style={{ height: '1px', background: 'var(--border)', flex: 1 }}></span>
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>OR ENTER MANUALLY</span>
              <span style={{ height: '1px', background: 'var(--border)', flex: 1 }}></span>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const inputVal = (e.currentTarget.elements.namedItem('manualEmail') as HTMLInputElement)?.value?.trim();
              if (inputVal) {
                if (ALLOWED_EMAILS.includes(inputVal)) {
                  handleLogin(inputVal);
                } else {
                  toast('Email not authorized!', 'error');
                }
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <input 
                  name="manualEmail"
                  type="email" 
                  placeholder="name@example.com" 
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--surface2)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', outline: 'none' }}
                  required
                />
              </div>

              <button type="submit" className="btn primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', fontWeight: 600 }}>
                Secure Access
              </button>
            </form>
          </div>

          <div style={{ marginTop: '28px', borderTop: '1.5px solid var(--border)', paddingTop: '18px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5' }}>
              Authorized administrator accounts only.<br />
              Please contact your system admin to authorize a new account.
            </p>
          </div>
        </div>
        {snack && <div className={`snack ${snack.type}`}>{snack.msg}</div>}
      </div>
    );
  }


  const handleCommandKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCommandSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCommandSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[commandSelectedIndex]) {
        filteredCommands[commandSelectedIndex].action();
        setShowCommandPalette(false);
      }
    } else if (e.key === 'Escape') {
      setShowCommandPalette(false);
    }
  };

  // Quick entry ledger post mechanism
  const handlePostQuickEntry = async () => {
    if (!qePartyId || !qeAmount || Number(qeAmount) <= 0) {
      toast('Please choose a party and input a valid amount.', 'error');
      return;
    }
    setQeBusy(true);
    try {
      if (qeType === 'credit') {
        await api.addCredit(qePartyId, Number(qeAmount), qeNotes, qeMonth);
        toast('Credit Sale posted successfully! ✓', 'success');
      } else {
        await api.recordPayment(qePartyId, Number(qeAmount), qeMethod, qeRef, qeNotes, qeMonth);
        toast('Payment received & posted! ✓', 'success');
      }
      setShowQuickEntryModal(false);
      setQePartyId('');
      setQeAmount('');
      setQeNotes('');
      setQeRef('');
      setQeMethod('Cash');
      try {
        localStorage.removeItem('draft_quick_ledger');
      } catch (e) {}
      refresh();
    } catch (err: any) {
      toast('Transaction failed: ' + err.message, 'error');
    } finally {
      setQeBusy(false);
    }
  };

  return (
    <div className="layout">
      <header className="top-header no-print">
        <div className="sidebar-brand">
          <h1>CreditFlow PRO</h1>
          <span>{summary?.currentMonth || 'Loading…'}</span>
        </div>
        <nav className="top-nav">
          {nav.map(n => (
            <div key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
              <span className="ico">{n.ico}</span>
              <span>{n.label}</span>
            </div>
          ))}
        </nav>

        {/* Sidebar Shortcut Reference Legend */}
        <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Command Palette</span>
            <kbd className="command-kbd-tip">Ctrl+K</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Quick Entry Form</span>
            <kbd className="command-kbd-tip">Ctrl+N</kbd>
          </div>
        </div>
      </header>

      <div className="main">
        <div className="topbar no-print">
          <span className="topbar-title">{nav.find(n => n.id === tab)?.label}</span>
          {authEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginRight: '10px' }}>
              <span className="mono" style={{ opacity: 0.85, fontWeight: 500 }}>👤 {authEmail}</span>
              <button className="btn sm" onClick={handleLogout} style={{ color: 'var(--red)', borderColor: 'var(--border2)' }}>
                🚪 Sign Out
              </button>
            </div>
          )}
          <button className="btn" onClick={() => api.sendReminderEmails().then(c => toast(`${c} reminders sent ✓`, 'success')).catch(e => toast(e.message, 'error'))}>
            ✉ Reminders
          </button>
          <button className="btn" onClick={() => api.autoCreateNextMonth().then(r => { toast(r.created ? `Created ${r.month}` : `${r.month} exists`, 'success'); refresh(); }).catch(e => toast(e.message, 'error'))}>
            + Month
          </button>
          <button className="btn primary" onClick={refresh}>↻ Refresh</button>
        </div>

        <div className="content">
          {loading ? <div className="loading">⟳ Loading…</div> : (
            <>
              {tab === 'dashboard' && <DashboardPage summary={summary} parties={parties} toast={toast} refresh={refresh} setTab={setTab} />}
              {tab === 'monthly' && <MonthlyPage months={summary?.allMonths || []} parties={parties} toast={toast} currentMonth={summary?.currentMonth} />}
              {tab === 'lifting' && <LiftingPage parties={parties} toast={toast} currentMonth={summary?.currentMonth} />}
              {tab === 'lifting-schedule' && <LiftingSchedulePage parties={parties} toast={toast} currentMonth={summary?.currentMonth} />}
              {tab === 'lifting-ledger' && <LiftingLedgerPage parties={parties} toast={toast} />}
              {tab === 'parties' && <PartiesPage parties={parties} toast={toast} refresh={refresh} />}
              {tab === 'ledger' && <LedgerPage months={summary?.allMonths || []} parties={parties} toast={toast} />}
              {tab === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} saveTheme={saveTheme} toast={toast} refresh={refresh} parties={parties} summary={summary} />}
            </>
          )}
        </div>
      </div>

      {/* Global Command Palette Modal Overlay */}
      {showCommandPalette && (
        <div className="command-palette-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette" onClick={e => e.stopPropagation()}>
            <div className="command-input-container">
              <span style={{ fontSize: '16px' }}>🔍</span>
              <input 
                type="text"
                className="command-input"
                placeholder="Type a command, theme, menu, or party name..."
                value={commandSearch}
                onChange={e => setCommandSearch(e.target.value)}
                onKeyDown={handleCommandKeyDown}
                autoFocus
              />
              <span className="command-kbd-tip">ESC to exit</span>
            </div>
            <div className="command-list">
              {filteredCommands.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  No matching workspace commands found.
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const isSelected = idx === commandSelectedIndex;
                  const showHeader = idx === 0 || filteredCommands[idx - 1].category !== cmd.category;
                  return (
                    <React.Fragment key={cmd.id}>
                      {showHeader && (
                        <div className="command-category">{cmd.category}</div>
                      )}
                      <div 
                        className={`command-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          cmd.action();
                          setShowCommandPalette(false);
                        }}
                        onMouseEnter={() => setCommandSelectedIndex(idx)}
                      >
                        <span className="command-item-label">{cmd.label}</span>
                        <span className="command-item-category">{cmd.category}</span>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Quick Ledger Entry Modal Overlay */}
      {showQuickEntryModal && (
        <div className="overlay" style={{ zIndex: 99999 }}>
          <div className="modal" style={{ maxWidth: '480px', animation: 'su .15s ease-out' }}>
            <div className="modal-hdr">
              <h3>⚡ Quick Ledger Transaction</h3>
              <button className="modal-close" onClick={() => setShowQuickEntryModal(false)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
              <div className="field">
                <label style={{ fontSize: '11px', fontWeight: 600 }}>Party Account *</label>
                <select 
                  style={{ width: '100%', padding: '10px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
                  value={qePartyId}
                  onChange={e => setQePartyId(e.target.value)}
                >
                  <option value="">-- Choose Party --</option>
                  {(parties || []).map(p => (
                    <option key={p.partyId} value={p.partyId}>{p.accountName}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label style={{ fontSize: '11px', fontWeight: 600 }}>Transaction Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                    className={`btn ${qeType === 'credit' ? 'primary' : ''}`}
                    style={{ fontWeight: 600, padding: '10px' }}
                    onClick={() => setQeType('credit')}
                  >
                    📈 Credit Sale
                  </button>
                  <button 
                    className="btn"
                    style={{ 
                      fontWeight: 600, 
                      padding: '10px',
                      borderColor: qeType === 'payment' ? 'var(--green)' : '', 
                      background: qeType === 'payment' ? 'var(--green)' : '', 
                      color: qeType === 'payment' ? '#ffffff' : '' 
                    }}
                    onClick={() => setQeType('payment')}
                  >
                    📉 Payment Received
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="field">
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>Accounting Month *</label>
                  <select 
                    style={{ width: '100%', padding: '10px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
                    value={qeMonth}
                    onChange={e => setQeMonth(e.target.value)}
                  >
                    {(summary?.allMonths || []).map((m: string) => (
                      <option key={m} value={m}>{mkLabel(m)}</option>
                    ))}
                  </select>
                </div>
                
                <div className="field">
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>Amount (₹) *</label>
                  <input 
                    type="number"
                    className="search-input"
                    style={{ width: '100%', padding: '10px' }}
                    placeholder="0.00"
                    value={qeAmount}
                    onChange={e => setQeAmount(e.target.value)}
                  />
                </div>
              </div>

              {qeType === 'payment' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div className="field">
                    <label style={{ fontSize: '10px', fontWeight: 600 }}>Payment Method</label>
                    <select 
                      style={{ width: '100%', padding: '8px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
                      value={qeMethod}
                      onChange={e => setQeMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="GPay/UPI">GPay/UPI</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  <div className="field">
                    <label style={{ fontSize: '10px', fontWeight: 600 }}>Ref / Check No.</label>
                    <input 
                      type="text"
                      className="search-input"
                      style={{ width: '100%', padding: '8px', background: 'var(--surface)' }}
                      placeholder="e.g. TXN123456"
                      value={qeRef}
                      onChange={e => setQeRef(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="field">
                <label style={{ fontSize: '11px', fontWeight: 600 }}>Remarks / Notes</label>
                <input 
                  type="text"
                  className="search-input"
                  style={{ width: '100%', padding: '10px' }}
                  placeholder="e.g. Goods loaded on Truck 4, advance paid"
                  value={qeNotes}
                  onChange={e => setQeNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button className="btn" onClick={() => setShowQuickEntryModal(false)}>Cancel</button>
                <button 
                  className="btn primary" 
                  onClick={handlePostQuickEntry}
                  disabled={!qePartyId || !qeAmount || Number(qeAmount) <= 0 || qeBusy}
                >
                  {qeBusy ? 'Posting Entry...' : 'Confirm Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {snack && <div className={`snack ${snack.type}`}>{snack.msg}</div>}
    </div>
  );
}
