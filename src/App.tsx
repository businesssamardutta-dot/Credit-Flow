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
    api.initDatabase().then(() => refresh());
  }, [refresh]);

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
