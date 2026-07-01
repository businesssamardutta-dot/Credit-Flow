import React, { useState, useMemo } from 'react';
import * as api from '../lib/db';
import { THEMES, ThemeKey, fmtRs } from '../lib/utils';

export function SettingsPage({ settings, setSettings, saveTheme, toast, refresh, parties, summary }: any) {
  // State for adding a recurring transaction
  const [rxPartyId, setRxPartyId] = useState('');
  const [rxType, setRxType] = useState<'credit' | 'payment'>('credit');
  const [rxAmount, setRxAmount] = useState('');
  const [rxNotes, setRxNotes] = useState('');
  const [rxMethod, setRxMethod] = useState('Cash');
  const [rxRef, setRxRef] = useState('');
  const [rxBusy, setRxBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Parse defined recurring transactions
  const recurringTxns = useMemo(() => {
    try {
      return settings.recurringTransactions ? JSON.parse(settings.recurringTransactions) : [];
    } catch (e) {
      return [];
    }
  }, [settings.recurringTransactions]);

  // Parse run log
  const runLog = useMemo(() => {
    try {
      return settings.recurringTxnsRunLog ? JSON.parse(settings.recurringTxnsRunLog) : [];
    } catch (e) {
      return [];
    }
  }, [settings.recurringTxnsRunLog]);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      toast('Generating full system backup...', 'info');
      const allParties = await api.getParties();
      const allLedger = await api.getLedger(null);
      
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        settings: settings,
        parties: allParties,
        ledger: allLedger
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `creditflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast('Backup exported successfully! 💾', 'success');
    } catch (err: any) {
      toast('Export failed: ' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const confirmRestore = window.confirm(
      "⚠️ WARNING: Restoring a backup will overwrite and replace the entire database state (Parties, Ledgers, and Settings). This action is irreversible. Are you absolutely sure you want to proceed?"
    );
    if (!confirmRestore) {
      e.target.value = ''; // clear input
      return;
    }
    
    setRestoring(true);
    toast('Parsing backup file...', 'info');
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.parties || !data.ledger || !data.settings) {
        throw new Error("Invalid backup format. Ensure it contains parties, ledger, and settings keys.");
      }
      
      toast('Restoring data to server...', 'info');
      await api.restoreDatabaseBackup(data);
      
      toast('Database restore complete! Recalculating scores...', 'info');
      await api.updateAllScores();
      
      toast('Database fully restored successfully! ✓', 'success');
      refresh();
    } catch (err: any) {
      toast('Restore failed: ' + err.message, 'error');
    } finally {
      setRestoring(false);
      e.target.value = ''; // clear input
    }
  };

  const isProcessedForThisMonth = summary?.currentMonth ? runLog.includes(summary.currentMonth) : false;

  const handleAddRecurring = async () => {
    if (!rxPartyId || !rxAmount || Number(rxAmount) <= 0) {
      toast('Please select a party and input a valid amount.', 'error');
      return;
    }

    setRxBusy(true);
    try {
      const newRx = {
        id: Date.now().toString(),
        partyId: rxPartyId,
        type: rxType,
        amount: Number(rxAmount),
        notes: rxNotes.trim(),
        method: rxType === 'payment' ? rxMethod : undefined,
        ref: rxType === 'payment' ? rxRef : undefined
      };

      const updated = [...recurringTxns, newRx];
      const jsonStr = JSON.stringify(updated);
      await api.saveSetting('recurringTransactions', jsonStr);
      setSettings((s: any) => ({ ...s, recurringTransactions: jsonStr }));
      localStorage.setItem('creditflow_recurring_txns', jsonStr);

      toast('Recurring transaction added successfully! ✓', 'success');
      setRxPartyId('');
      setRxAmount('');
      setRxNotes('');
      setRxRef('');
    } catch (err: any) {
      toast('Failed to save recurring transaction: ' + err.message, 'error');
    } finally {
      setRxBusy(false);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this recurring transaction?')) return;
    try {
      const updated = recurringTxns.filter((rx: any) => rx.id !== id);
      const jsonStr = JSON.stringify(updated);
      await api.saveSetting('recurringTransactions', jsonStr);
      setSettings((s: any) => ({ ...s, recurringTransactions: jsonStr }));
      localStorage.setItem('creditflow_recurring_txns', jsonStr);
      toast('Recurring transaction removed ✓', 'info');
    } catch (err: any) {
      toast('Failed to delete recurring transaction: ' + err.message, 'error');
    }
  };

  const handleManualTrigger = async () => {
    if (recurringTxns.length === 0) {
      toast('No recurring transactions defined.', 'error');
      return;
    }
    if (!summary?.currentMonth) return;

    if (isProcessedForThisMonth) {
      if (!window.confirm(`Recurring transactions have already been automatically run for ${summary.currentMonth}. Running them again will post duplicate entries! Proceed anyway?`)) {
        return;
      }
    }

    setRxBusy(true);
    toast(`Running ${recurringTxns.length} transactions for ${summary.currentMonth}...`, 'info');
    try {
      let count = 0;
      for (const rx of recurringTxns) {
        if (rx.type === 'credit') {
          await api.addCredit(rx.partyId, rx.amount, rx.notes + ' [Recurring Entry]', summary.currentMonth);
        } else {
          await api.recordPayment(rx.partyId, rx.amount, rx.method || 'Cash', rx.ref || 'Recurring', rx.notes + ' [Recurring Entry]', summary.currentMonth);
        }
        count++;
      }

      // Mark as processed
      const nextLog = runLog.includes(summary.currentMonth) ? runLog : [...runLog, summary.currentMonth];
      const nextLogStr = JSON.stringify(nextLog);
      await api.saveSetting('recurringTxnsRunLog', nextLogStr);
      setSettings((s: any) => ({ ...s, recurringTxnsRunLog: nextLogStr }));
      localStorage.setItem('creditflow_recurring_txns_run_log', nextLogStr);

      toast(`Successfully processed ${count} recurring entries! ✓`, 'success');
      refresh();
    } catch (err: any) {
      toast('Processing failed: ' + err.message, 'error');
    } finally {
      setRxBusy(false);
    }
  };

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

        {/* Recurring Transactions Section */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🔁 Recurring Transactions ({recurringTxns.length})</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'normal' }}>
              Auto-populates ledger monthly
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 14px 0', lineHeight: 1.4 }}>
            Define monthly fixed transactions that automatically post at the start of each month (e.g. maintenance fees, interest, retainers).
          </p>

          {recurringTxns.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'var(--surface2)', borderRadius: '6px', fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', border: '1px dashed var(--border)' }}>
              No recurring transactions configured yet. Add one below.
            </div>
          ) : (
            <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '16px', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Party</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Notes</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {recurringTxns.map((rx: any) => {
                    const matchParty = (parties || []).find((p: any) => p.partyId === rx.partyId);
                    return (
                      <tr key={rx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{matchParty ? matchParty.accountName : rx.partyId}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontWeight: 600,
                            background: rx.type === 'credit' ? '#fef2f2' : '#f0fdf4',
                            color: rx.type === 'credit' ? '#b91c1c' : '#15803d',
                            border: rx.type === 'credit' ? '1px solid #fca5a5' : '1px solid #86efac'
                          }}>
                            {rx.type === 'credit' ? '📈 Debit' : '📉 Credit'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }} className="mono">{fmtRs(rx.amount)}</td>
                        <td style={{ padding: '8px', color: 'var(--muted)' }}>{rx.notes || '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button 
                            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }} 
                            onClick={() => handleDeleteRecurring(rx.id)}
                            title="Delete recurring item"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Form to Add New */}
          <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>
              Add Recurring Transaction
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <div className="field">
                <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Party</label>
                <select 
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
                  value={rxPartyId}
                  onChange={e => setRxPartyId(e.target.value)}
                >
                  <option value="">Select Party...</option>
                  {(parties || []).map((p: any) => (
                    <option key={p.partyId} value={p.partyId}>{p.accountName}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Type</label>
                <select 
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
                  value={rxType}
                  onChange={e => setRxType(e.target.value as any)}
                >
                  <option value="credit">📈 Debit (New Credit Sale)</option>
                  <option value="payment">📉 Credit (Payment Received)</option>
                </select>
              </div>
              <div className="field">
                <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Amount (₹)</label>
                <input 
                  type="number" 
                  className="search-input" 
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px' }} 
                  placeholder="e.g. 5000" 
                  value={rxAmount}
                  onChange={e => setRxAmount(e.target.value)}
                />
              </div>
            </div>

            {rxType === 'payment' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="field">
                  <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Payment Method</label>
                  <select 
                    style={{ width: '100%', padding: '6px 10px', fontSize: '12px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
                    value={rxMethod}
                    onChange={e => setRxMethod(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div className="field">
                  <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Reference #</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    style={{ width: '100%', padding: '6px 10px', fontSize: '12px' }} 
                    placeholder="e.g. TXN9876" 
                    value={rxRef}
                    onChange={e => setRxRef(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description / Notes</label>
              <input 
                type="text" 
                className="search-input" 
                style={{ width: '100%', padding: '6px 10px', fontSize: '12px' }} 
                placeholder="e.g. Monthly cloud subscription" 
                value={rxNotes}
                onChange={e => setRxNotes(e.target.value)}
              />
            </div>

            <button 
              className="btn primary sm" 
              style={{ alignSelf: 'flex-end', padding: '6px 14px', fontSize: '11px', fontWeight: 600 }}
              onClick={handleAddRecurring}
              disabled={rxBusy}
            >
              {rxBusy ? 'Adding...' : '+ Add Configuration'}
            </button>
          </div>

          {/* Trigger Panel */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isProcessedForThisMonth ? 'rgba(5, 150, 105, 0.08)' : 'rgba(217, 119, 6, 0.08)', borderRadius: '6px', border: isProcessedForThisMonth ? '1.5px solid #86efac' : '1.5px solid #fcd34d' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: isProcessedForThisMonth ? '#059669' : '#d97706' }}>
                {isProcessedForThisMonth ? '✅ AUTO-PROCESSED FOR CURRENT MONTH' : '⏳ PENDING PROCESS FOR CURRENT MONTH'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Target Month: {summary?.currentMonth || '—'}
              </span>
            </div>
            <button 
              className="btn" 
              style={{ padding: '6px 12px', fontSize: '11.5px', background: 'var(--surface)', fontWeight: 600 }}
              onClick={handleManualTrigger}
              disabled={rxBusy}
            >
              🚀 Process entries for {summary?.currentMonth || 'Month'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">🗄️ Data Management</div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 14px 0', lineHeight: 1.4 }}>
            Export all application state including settings, parties, and transaction ledger histories to a local backup file, or restore from a previously saved backup file.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              className="btn" 
              style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleExportBackup}
              disabled={exporting || restoring}
            >
              📥 {exporting ? 'Exporting...' : 'Export System Backup'}
            </button>
            <div style={{ position: 'relative' }}>
              <input 
                type="file" 
                id="restore-file-input" 
                accept=".json" 
                style={{ display: 'none' }} 
                onChange={handleRestoreBackup}
                disabled={exporting || restoring}
              />
              <button 
                className="btn primary" 
                style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => document.getElementById('restore-file-input')?.click()}
                disabled={exporting || restoring}
              >
                📤 {restoring ? 'Restoring...' : 'Restore System Backup'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Quick Actions</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => api.updateAllScores().then(() => { toast('Scores updated ✓', 'success'); refresh(); }).catch((e: any) => toast(e.message, 'error'))}>📊 Recalculate Scores</button>
            <button className="btn" onClick={() => api.sendReminderEmails().then((n: number) => toast(`${n} reminders sent ✓`, 'success')).catch((e: any) => toast(e.message, 'error'))}>✉ Send Reminders</button>
            <button className="btn" onClick={() => api.autoCreateNextMonth().then(r => { toast(r.created ? `Created ${r.month}` : `${r.month} exists`, 'success'); refresh(); }).catch((e: any) => toast(e.message, 'error'))}>📅 Create Next Month</button>
            <button className="btn" onClick={() => api.closeMonth('').then(r => { toast(`Closed. ${r.updated} overdue. Next: ${r.nextMonth}`, 'success'); refresh(); }).catch((e: any) => toast(e.message, 'error'))}>🔒 Close Current Month</button>
            <button className="btn" onClick={() => {
              toast('Running ledger audit...', 'success');
              api.auditLedgers().then(diffs => {
                const discrepancies = diffs.filter((d: any) => Math.abs(d.calculatedBalance - d.masterBalance) > 1);
                if (discrepancies.length === 0) {
                  alert("Ledger Audit Complete: All party master balances perfectly match their ledger transaction history (Closing Balance)!");
                } else {
                  console.warn("Ledger Discrepancies:", discrepancies);
                  alert(`Ledger Audit Complete: Found ${discrepancies.length} parties where the balance doesn't match the Ledger sum. Check console for details.`);
                }
              }).catch((e: any) => {
                toast('Audit failed: ' + e.message, 'error');
              });
            }}>🔍 Audit Ledgers</button>
          </div>
        </div>
      </div>
    </div>
  );
}
