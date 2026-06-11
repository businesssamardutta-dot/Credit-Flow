import React, { useState, useEffect, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
import * as api from './lib/db';
import { fmt, fmtRs, mkLabel } from './lib/utils';
import { DashboardPage } from './components/DashboardPage';
import { MonthlyPage } from './components/MonthlyPage';
import { LiftingLedgerPage, LiftingPage, LiftingSchedulePage } from './components/LiftingPage';
import { PartiesPage, ContactsPage, TasksPage } from './components/PartiesPage';
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
  { id: 'contacts', ico: '👤', label: 'Contacts' },
  { id: 'tasks', ico: '✓', label: 'Tasks' },
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

  // Authenticate user via Apps Script
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailFromUrl = params.get('auth_email');
    if (emailFromUrl) {
      sessionStorage.setItem('auth_email', emailFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthEmail(emailFromUrl);
      setAuthChecking(false);
      return;
    }

    const savedEmail = sessionStorage.getItem('auth_email');
    if (savedEmail) {
      setAuthEmail(savedEmail);
      setAuthChecking(false);
    } else {
      // Redirect to Google Apps Script for Google Authentication
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbyewh1tpN0kyvArPAIC_436tepFY1R6gph-f5vonqpeM0AVhVyyjxj5hqFq2wi0tqeHXA/exec';
      const redirectUri = window.location.origin + window.location.pathname;
      window.location.href = `${scriptUrl}?action=auth&returnUrl=${encodeURIComponent(redirectUri)}`;
    }
  }, []);

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

  useEffect(() => {
    if (!authChecking && authEmail) {
      const ALLOWED_EMAILS = [
        'sefalicommercial@gmail.com',
        'basudebbanerjee653@gmail.com',
        'business.samardutta@gmail.com'
      ];
      if (ALLOWED_EMAILS.includes(authEmail)) {
        api.initDatabase().then(() => refresh());
      }
    }
  }, [authChecking, authEmail, refresh]);

  if (authChecking) {
    return <div style={{ padding: '50px', textAlign: 'center', fontSize: '18px' }}>Authenticating your Google Account...</div>;
  }

  const ALLOWED_EMAILS = [
    'sefalicommercial@gmail.com',
    'basudebbanerjee653@gmail.com',
    'business.samardutta@gmail.com'
  ];

  if (!authEmail || !ALLOWED_EMAILS.includes(authEmail)) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'var(--font-sans)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <div style={{ fontSize: '48px' }}>🔒</div>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--red)' }}>Access Denied</h2>
        <div style={{ padding: '16px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Logged in as:</p>
          <strong style={{ fontSize: '18px' }}>{authEmail || 'Guest Mode'}</strong>
        </div>
        <p style={{ fontSize: '16px', maxWidth: '400px', lineHeight: '1.5' }}>
          You are Not Authorise for Operate This App Please Contact to Admin
        </p>
        <button className="btn primary" onClick={() => { sessionStorage.clear(); window.location.reload(); }} style={{ marginTop: '10px' }}>
          Try Another Account
        </button>
      </div>
    );
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'ocean');
  }, [settings.theme]);

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
              {tab === 'contacts' && <ContactsPage parties={parties} toast={toast} />}
              {tab === 'tasks' && <TasksPage parties={parties} toast={toast} />}
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
