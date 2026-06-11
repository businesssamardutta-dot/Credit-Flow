import React from 'react';
import * as api from '../lib/db';
import { THEMES, ThemeKey } from '../lib/utils';

export function SettingsPage({ settings, setSettings, saveTheme, toast, refresh }: any) {
  const toggleReminders = async (v: boolean) => {
    setSettings((s: any) => ({ ...s, remindersEnabled: v }));
    try {
      await api.saveSetting('remindersEnabled', v);
      toast('Saved ✓', 'success');
    } catch (e) {
      toast('Error', 'error');
    }
  };

  const saveAdminEmail = async () => {
    try {
      await api.saveSetting('adminEmail', settings.adminEmail || '');
      toast('Saved ✓', 'success');
    } catch (e) {
      toast('Error', 'error');
    }
  };

  return (
    <div>
      <div className="sec-hdr"><h2>Settings</h2></div>
      <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="card">
          <div className="card-title">Theme (Light)</div>
          <div className="theme-grid">
            {Object.entries(THEMES).map(([key, t]) => (
              <div key={key} className={`theme-swatch ${settings.theme === key ? 'active' : ''}`} onClick={() => saveTheme(key as ThemeKey)}>
                <div className="swatch-dot" style={{ background: t.dot }} /><div className="swatch-name">{t.label}</div><div className="swatch-font">{t.font}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Email Reminders</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div onClick={() => toggleReminders(!settings.remindersEnabled)} style={{ width: 42, height: 23, background: settings.remindersEnabled ? 'var(--green)' : 'var(--border2)', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 2, left: settings.remindersEnabled ? 20 : 2, width: 19, height: 19, background: '#fff', borderRadius: '50%', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </div>
            <span style={{ fontSize: 13 }}>Daily payment reminder emails (8 AM)</span>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>Sends 2 days before and on Target Date for parties with outstanding balance and valid email.</p>
        </div>
        <div className="card">
          <div className="card-title">Admin Email</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="search-input" style={{ flex: 1, width: 'auto' }} type="email" value={settings.adminEmail || ''} onChange={e => setSettings((s: any) => ({ ...s, adminEmail: e.target.value }))} placeholder="admin@example.com" />
            <button className="btn primary" onClick={saveAdminEmail}>Save</button>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Quick Actions</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => api.updateAllScores().then(() => { toast('Scores updated ✓', 'success'); refresh(); }).catch((e: any) => toast(e.message, 'error'))}>📊 Recalculate Scores</button>
            <button className="btn" onClick={() => api.sendReminderEmails().then((n: number) => toast(`${n} reminders sent ✓`, 'success')).catch((e: any) => toast(e.message, 'error'))}>✉ Send Reminders</button>
            <button className="btn" onClick={() => api.autoCreateNextMonth().then(r => { toast(r.created ? `Created ${r.month}` : `${r.month} exists`, 'success'); refresh(); }).catch((e: any) => toast(e.message, 'error'))}>📅 Create Next Month</button>
            <button className="btn" onClick={() => api.closeMonth('').then(r => { toast(`Closed. ${r.updated} overdue. Next: ${r.nextMonth}`, 'success'); refresh(); }).catch((e: any) => toast(e.message, 'error'))}>🔒 Close Current Month</button>
          </div>
        </div>
      </div>
    </div>
  );
}
