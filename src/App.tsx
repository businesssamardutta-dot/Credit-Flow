import React, { useState, useEffect, useCallback } from 'react';
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

  const saveTheme = async (t: string) => {
    setSettings(s => ({ ...s, theme: t }));
    document.documentElement.setAttribute('data-theme', t);
    try {
      await api.saveSetting('theme', t);
      toast('Theme saved ✓', 'success');
    } catch (e) {}
  };

  return (
    <div className="layout">
      <header className="top-header">
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
      </header>

      <div className="main">
        <div className="topbar">
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
              {tab === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} saveTheme={saveTheme} toast={toast} refresh={refresh} />}
            </>
          )}
        </div>
      </div>

      {snack && <div className={`snack ${snack.type}`}>{snack.msg}</div>}
    </div>
  );
}
