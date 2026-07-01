import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chart } from 'chart.js';
import * as api from '../lib/db';
import { fmtRs, mkLabel } from '../lib/utils';
import { statusBadge } from '../App';

export function MonthlyPage({ months, parties, toast, currentMonth, settings, setSettings }: any) {
  const [sel, setSel] = useState(currentMonth || months[months.length - 1] || '');
  const [data, setData] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditModal, setCreditModal] = useState<any>(null);
  const [payModal, setPayModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);

  // Monthly Notes states
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (sel && settings) {
      setNoteInput(settings[`monthly_note_${sel}`] || '');
    }
  }, [sel, settings]);

  const handleSaveNote = async () => {
    if (!sel) return;
    setSavingNote(true);
    try {
      await api.saveSetting(`monthly_note_${sel}`, noteInput);
      if (setSettings) {
        setSettings((prev: any) => ({ ...prev, [`monthly_note_${sel}`]: noteInput }));
      }
      toast(`Monthly note for ${mkLabel(sel)} saved successfully ✓`, 'success');
    } catch (e: any) {
      toast(`Failed to save monthly note: ${e.message}`, 'error');
    } finally {
      setSavingNote(false);
    }
  };

  // Visualization state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [chartParty, setChartParty] = useState('');
  const [allLedgerRows, setAllLedgerRows] = useState<any[]>([]);

  useEffect(() => {
    api.getLedger(null)
      .then(setAllLedgerRows)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!sel) return;
    setBusy(true);
    api.getMonthData(sel)
      .then(r => setData(r || []))
      .catch((e: any) => toast('Error: ' + e.message, 'error'))
      .finally(() => setBusy(false));
  }, [sel, toast]);

  const reload = () => api.getMonthData(sel).then(r => setData(r || []));

  const totals = {
    td: data.reduce((s, r) => s + r['Total Debt'], 0),
    tc: data.reduce((s, r) => s + r['New Credit'], 0),
    tp: data.reduce((s, r) => s + r['Paid Amount'], 0),
    tb: data.reduce((s, r) => s + r['Balance'], 0),
    op: data.reduce((s, r) => s + r['Opening Balance'], 0)
  };

  const handleClose = async () => {
    if (!window.confirm(`Close month ${sel}?`)) return;
    setIsProcessing(true);
    try {
      const r = await api.closeMonth(sel);
      toast(`Closed. ${r.updated} overdue. Next: ${r.nextMonth}`, 'success');
      reload();
    } catch (e: any) { 
      toast('Error: ' + e.message, 'error'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleSyncLedger = async () => {
    if (!window.confirm(`Auto-fix and sync ${sel} balances from Ledger?`)) return;
    setIsProcessing(true);
    try {
      await api.syncMonthlyFromLedger(sel);
      toast(`Synced and auto-fixed balances from ledger successfully`, 'success');
      reload();
    } catch (e: any) {
      toast('Error syncing: ' + e.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Compile monthly trend data for selected party or all parties combined across all active months
  const chartData = useMemo(() => {
    if (!chartParty) return null;
    const isAll = chartParty === 'ALL_PARTIES';
    const monthLabels = months;
    const dataPoints: number[] = [];
    
    if (isAll) {
      monthLabels.forEach((m: string) => {
        let monthTotal = 0;
        parties.forEach((p: any) => {
          const pName = p.accountName || '';
          const filtered = allLedgerRows.filter((r: any) => 
            (r['Party ID'] === p.partyId || (r['Account Name'] || '').toLowerCase() === pName.toLowerCase())
          );
          const sorted = filtered.sort((a, b) => new Date(a['Timestamp']).getTime() - new Date(b['Timestamp']).getTime());
          
          let pBalance = Number(p.openingBalance) || 0;
          const txnsInMonth = sorted.filter((r: any) => r['Month'] === m);
          if (txnsInMonth.length > 0) {
            pBalance = Number(txnsInMonth[txnsInMonth.length - 1]['Closing Balance']) || 0;
          } else {
            const txnsBefore = sorted.filter((r: any) => r['Month'] < m);
            if (txnsBefore.length > 0) {
              pBalance = Number(txnsBefore[txnsBefore.length - 1]['Closing Balance']) || 0;
            }
          }
          monthTotal += pBalance;
        });
        dataPoints.push(monthTotal);
      });
    } else {
      const filtered = allLedgerRows.filter((r: any) => 
        (r['Account Name'] || '').toLowerCase() === chartParty.toLowerCase()
      );
      
      // Sort oldest to newest
      const sorted = filtered.sort((a, b) => new Date(a['Timestamp']).getTime() - new Date(b['Timestamp']).getTime());
      
      let currentBalance = 0;
      const partyObj = parties.find((p: any) => p.accountName?.toLowerCase() === chartParty.toLowerCase());
      if (partyObj) {
        currentBalance = Number(partyObj.openingBalance) || 0;
      }
      
      monthLabels.forEach((m: string) => {
        const txnsInMonth = sorted.filter((r: any) => r['Month'] === m);
        if (txnsInMonth.length > 0) {
          currentBalance = Number(txnsInMonth[txnsInMonth.length - 1]['Closing Balance']) || 0;
        } else {
          const txnsBefore = sorted.filter((r: any) => r['Month'] < m);
          if (txnsBefore.length > 0) {
            currentBalance = Number(txnsBefore[txnsBefore.length - 1]['Closing Balance']) || 0;
          }
        }
        dataPoints.push(currentBalance);
      });
    }
    
    return {
      labels: monthLabels.map((m: string) => mkLabel(m)),
      values: dataPoints
    };
  }, [chartParty, allLedgerRows, months, parties]);

  // Set up and update Chart.js instance
  useEffect(() => {
    if (!canvasRef.current || !chartData) return;
    
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: 'Closing Balance (₹)',
          data: chartData.values,
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#7c3aed',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#7c3aed',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            padding: 10,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { size: 11, weight: 'bold' },
            bodyFont: { size: 11, family: 'monospace' },
            callbacks: {
              label: (context) => `Balance: ₹${context.parsed.y.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(148, 163, 184, 0.1)',
            },
            ticks: {
              font: { size: 10 }
            }
          },
          y: {
            grid: {
              color: 'rgba(148, 163, 184, 0.1)',
            },
            ticks: {
              font: { size: 10, family: 'monospace' },
              callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`
            }
          }
        }
      }
    });
    
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [chartData]);

  // Populate default chart party if empty and parties available
  useEffect(() => {
    if (!chartParty && parties && parties.length > 0) {
      setChartParty('ALL_PARTIES');
    }
  }, [parties, chartParty]);

  return (
    <div>
      {isProcessing && (
        <div className="global-waiting">
          <div className="spinner"></div>
          <div className="waiting-text">PROCESSING...</div>
        </div>
      )}
      <div className="sec-hdr">
        <h2>Monthly View</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {sel && <button className="btn" onClick={handleSyncLedger}>🔄 Auto-Fix Balances</button>}
          {sel && <button className="btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleClose}>🔒 Close {sel}</button>}
        </div>
      </div>
      
      <div className="month-tabs">
        {months.slice().reverse().map((m: string) => (
          <div key={m} className={`mtab ${sel === m ? 'active' : ''}`} onClick={() => setSel(m)}>
            {mkLabel(m)}{m === currentMonth ? ' ●' : ''}
          </div>
        ))}
      </div>

      {/* Monthly Notes & Objectives Card */}
      {sel && (
        <div className="card" style={{ marginBottom: '18px', padding: '16px', background: 'var(--surface)', border: '1.5px solid var(--border)', animation: 'su .15s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px' }}>📌</span>
              <h3 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                Notes & Objectives for {mkLabel(sel)}
              </h3>
            </div>
            <button 
              className="btn sm primary" 
              onClick={handleSaveNote}
              disabled={savingNote}
              style={{ padding: '4px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {savingNote ? '💾 Saving...' : '💾 Save Note'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <textarea
              className="search-input"
              style={{ 
                flex: 1, 
                minHeight: '44px', 
                padding: '8px 12px', 
                fontSize: '12.5px', 
                borderRadius: '6px', 
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.4
              }}
              placeholder={`Attach objectives, growth targets, collection reminders or business plans for ${mkLabel(sel)} (e.g., 'Target: 10% growth'). These notes are saved securely in the cloud...`}
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
            />
          </div>
        </div>
      )}
      
      {data.length > 0 && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 18 }}>
          {[
            { label: 'Opening', val: fmtRs(totals.op), col: '#475569' }, 
            { label: 'New Credit', val: fmtRs(totals.tc), col: '#7c3aed' }, 
            { label: 'Total Debt', val: fmtRs(totals.td), col: '#1a6fbb' }, 
            { label: 'Collected', val: fmtRs(totals.tp), col: '#059669' }, 
            { label: 'Balance Due', val: fmtRs(totals.tb), col: '#dc2626' }
          ].map(k => (
            <div key={k.label} className="kpi" style={{ '--kpi-accent': k.col } as any}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-val" style={{ fontSize: 14 }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Yearly Balance Trend Visualizer Card */}
      {parties && parties.length > 0 && (
        <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>📈 Balance Shift & Trend Analysis</h3>
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Track real-time monthly liabilities and payment shifts over the active fiscal year.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>Select Party:</span>
              <select 
                className="search-input" 
                style={{ padding: '6px 12px', fontSize: '12px', minWidth: '220px' }}
                value={chartParty}
                onChange={e => setChartParty(e.target.value)}
              >
                <option value="ALL_PARTIES">📊 All Parties (Combined)</option>
                {parties.map((p: any) => (
                  <option key={p.partyId} value={p.accountName}>{p.accountName}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ height: '240px', position: 'relative', background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '12px', border: '1px solid var(--border)' }}>
            {chartParty ? (
              <canvas ref={canvasRef} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContext: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                Please select a registered party from the dropdown to initialize the trend analysis graph.
              </div>
            )}
          </div>
        </div>
      )}

      {busy ? (
        <div className="loading">Loading…</div>
      ) : data.length === 0 ? (
        <div className="empty">No data for this month</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Contact</th>
                <th>Opening</th>
                <th>New Credit</th>
                <th>Total Debt</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Credit Days</th>
                <th>Invoice Date</th>
                <th>Target Date</th>
                <th>Last Paid</th>
                <th>Status</th>
                <th>Score</th>
                <th>Overdue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r['Account Name']}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{r['Contact No']}</td>
                  <td className="mono">{fmtRs(r['Opening Balance'])}</td>
                  <td className="mono" style={{ color: 'var(--accent)' }}>{fmtRs(r['New Credit'])}</td>
                  <td className="mono">{fmtRs(r['Total Debt'])}</td>
                  <td className="mono" style={{ color: 'var(--green)', fontWeight: 600 }}>{fmtRs(r['Paid Amount'])}</td>
                  <td className="mono" style={{ color: (r['Balance'] || 0) > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{fmtRs(r['Balance'])}</td>
                  <td className="mono">{r['Credit Days']}</td>
                  <td className="mono">{r['Invoice Date']}</td>
                  <td className="mono">{r['Target Date']}</td>
                  <td className="mono">{r['Last Payment Date'] || '—'}</td>
                  <td>{statusBadge(r['Status'])}</td>
                  <td>
                    <span className="mono">{r['Score'] || 50}</span>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: (r['Score'] || 50) + '%', background: r['Score'] > 70 ? 'var(--green)' : r['Score'] > 40 ? 'var(--yellow)' : 'var(--red)' }} />
                    </div>
                  </td>
                  <td className="mono" style={{ color: (r['Overdue Days'] || 0) > 0 ? 'var(--red)' : 'var(--muted)' }}>
                    {(r['Overdue Days'] || 0) > 0 ? r['Overdue Days'] + 'd' : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="act-btn edit" onClick={() => setEditModal(r)}>✎ Edit</button>
                      <button className="act-btn credit" onClick={() => setCreditModal(r)}>+ Credit</button>
                      <button className="act-btn pay" onClick={() => setPayModal(r)}>₹ Pay</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {creditModal && (
        <CreditModal 
          row={creditModal} 
          mk={sel} 
          onClose={() => setCreditModal(null)} 
          onSaved={() => { setCreditModal(null); reload(); toast('Credit added ✓', 'success'); }} 
          toast={toast} 
        />
      )}
      {payModal && (
        <PayModal 
          row={payModal} 
          mk={sel} 
          onClose={() => setPayModal(null)} 
          onSaved={() => { setPayModal(null); reload(); toast('Payment recorded ✓', 'success'); }} 
          toast={toast} 
        />
      )}
      {editModal && (
        <EditModal 
          row={editModal} 
          mk={sel} 
          onClose={() => setEditModal(null)} 
          onSaved={() => { setEditModal(null); reload(); toast('Row updated ✓', 'success'); }} 
          toast={toast} 
        />
      )}
    </div>
  );
}

function EditModal({ row, mk, onClose, onSaved, toast }: any) {
  const [openingBalance, setOpeningBalance] = useState<string>(String(row['Opening Balance'] || '0'));
  const [newCredit, setNewCredit] = useState<string>(String(row['New Credit'] || '0'));
  const [paidAmount, setPaidAmount] = useState<string>(String(row['Paid Amount'] || '0'));
  const [creditDays, setCreditDays] = useState(row['Credit Days'] || '7 DAYS');
  const [invoiceDate, setInvoiceDate] = useState(row['Invoice Date'] || '');
  const [targetDate, setTargetDate] = useState(row['Target Date'] || '');
  const [busy, setBusy] = useState(false);
  
  const save = async () => {
    if (!invoiceDate) { toast('Invoice Date required', 'error'); return; }
    setBusy(true);
    try { 
      await api.updateMonthRow(mk, row['Row ID'], { 
        openingBalance: parseFloat(openingBalance) || 0,
        newCredit: parseFloat(newCredit) || 0,
        paidAmount: parseFloat(paidAmount) || 0,
        creditDays, 
        invoiceDate, 
        targetDate 
      }); 
      onSaved(); 
    } catch (e: any) { 
      toast('Error: ' + e.message, 'error'); 
    } finally { 
      setBusy(false); 
    }
  };
  
  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h2>✎ Edit Row — {row['Account Name']}</h2>
          <button className="act-btn del" disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="info-box">Balance: <strong>{fmtRs(row['Balance'])}</strong> · Status: {statusBadge(row['Status'])}</div>
          <div className="form-grid">
            <div className="field"><label>Opening Balance</label><input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} disabled={busy} /></div>
            <div className="field"><label>New Credit</label><input type="number" step="0.01" value={newCredit} onChange={e => setNewCredit(e.target.value)} disabled={busy} /></div>
            <div className="field"><label>Paid Amount</label><input type="number" step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} disabled={busy} /></div>
            <div className="field"><label>Credit Days</label><select value={creditDays} onChange={e => setCreditDays(e.target.value)} disabled={busy}><option>ADVANCE</option><option>3 DAYS</option><option>7 DAYS</option><option>15 DAYS</option><option>30 DAYS</option><option>45 DAYS</option></select></div>
            <div className="field"><label>Invoice Date</label><input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} disabled={busy} /></div>
            <div className="field"><label>Target Date</label><input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} disabled={busy} /></div>
          </div>
        </div>
        <div className="modal-ftr">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {busy && (
        <div className="global-waiting" style={{ position: 'absolute' }}>
          <div className="spinner"></div>
          <div className="waiting-text">PROCESSING...</div>
        </div>
      )}
    </div>
  );
}

function CreditModal({ row, mk, onClose, onSaved, toast }: any) {
  const [amount, setAmount] = useState(''); 
  const [notes, setNotes] = useState(''); 
  const [busy, setBusy] = useState(false);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`draft_credit_${row['Party ID']}`);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.amount !== undefined) setAmount(d.amount);
        if (d.notes !== undefined) setNotes(d.notes);
      }
    } catch (e) {}
  }, [row]);

  // Save draft on edit
  useEffect(() => {
    try {
      if (amount || notes) {
        localStorage.setItem(`draft_credit_${row['Party ID']}`, JSON.stringify({ amount, notes }));
      } else {
        localStorage.removeItem(`draft_credit_${row['Party ID']}`);
      }
    } catch (e) {}
  }, [amount, notes, row]);
  
  const save = async () => { 
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { 
      toast('Enter valid amount', 'error'); 
      return; 
    } 
    setBusy(true); 
    try { 
      await api.addCredit(row['Party ID'], Number(amount), notes, mk); 
      try {
        localStorage.removeItem(`draft_credit_${row['Party ID']}`);
      } catch (e) {}
      onSaved(); 
    } catch (e: any) { 
      toast('Error: ' + e.message, 'error'); 
    } finally { 
      setBusy(false); 
    } 
  };
  
  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h2>+ New Credit — {row['Account Name']}</h2>
          <button className="act-btn del" disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="info-box">Balance: <strong>{fmtRs(row['Balance'])}</strong> · Credit Days: <strong>{row['Credit Days']}</strong> · Month: <strong style={{ color: 'var(--accent)' }}>{mk}</strong></div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field"><label>Credit Amount (₹)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount…" disabled={busy} /></div>
            <div className="field"><label>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional…" disabled={busy} /></div>
          </div>
        </div>
        <div className="modal-ftr">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : '+ Add Credit'}</button>
        </div>
      </div>
      {busy && (
        <div className="global-waiting" style={{ position: 'absolute' }}>
          <div className="spinner"></div>
          <div className="waiting-text">PROCESSING...</div>
        </div>
      )}
    </div>
  );
}

function PayModal({ row, mk, onClose, onSaved, toast }: any) {
  const [f, setF] = useState({ amount: '', method: 'Cash', reference: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const fc = (e: any) => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`draft_pay_${row['Party ID']}`);
      if (saved) {
        setF(JSON.parse(saved));
      }
    } catch (e) {}
  }, [row]);

  // Save draft on edit
  useEffect(() => {
    try {
      if (f.amount || f.reference || f.notes) {
        localStorage.setItem(`draft_pay_${row['Party ID']}`, JSON.stringify(f));
      } else {
        localStorage.removeItem(`draft_pay_${row['Party ID']}`);
      }
    } catch (e) {}
  }, [f, row]);
  
  const save = async () => { 
    if (!f.amount || isNaN(Number(f.amount)) || Number(f.amount) <= 0) { 
      toast('Enter valid amount', 'error'); 
      return; 
    } 
    setBusy(true); 
    try { 
      await api.recordPayment(row['Party ID'], Number(f.amount), f.method, f.reference, f.notes, mk); 
      try {
        localStorage.removeItem(`draft_pay_${row['Party ID']}`);
      } catch (e) {}
      onSaved(); 
    } catch (e: any) { 
      toast('Error: ' + e.message, 'error'); 
    } finally { 
      setBusy(false); 
    } 
  };
  
  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h2>₹ Record Payment — {row['Account Name']}</h2>
          <button className="act-btn del" disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="info-box">Outstanding: <strong style={{ color: 'var(--red)' }}>{fmtRs(row['Balance'])}</strong> · Due: <strong>{row['Target Date'] || '—'}</strong></div>
          <div className="form-grid">
            <div className="field"><label>Amount (₹)</label><input name="amount" type="number" value={f.amount} onChange={fc} placeholder="Enter amount…" disabled={busy} /></div>
            <div className="field"><label>Method</label><select name="method" value={f.method} onChange={fc} disabled={busy}><option>Cash</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cheque</option><option>DD</option></select></div>
            <div className="field"><label>Reference / UTR</label><input name="reference" value={f.reference} onChange={fc} placeholder="Optional…" disabled={busy} /></div>
            <div className="field"><label>Notes</label><input name="notes" value={f.notes} onChange={fc} placeholder="Optional…" disabled={busy} /></div>
          </div>
        </div>
        <div className="modal-ftr">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : '₹ Record'}</button>
        </div>
      </div>
      {busy && (
        <div className="global-waiting" style={{ position: 'absolute' }}>
          <div className="spinner"></div>
          <div className="waiting-text">PROCESSING...</div>
        </div>
      )}
    </div>
  );
}
