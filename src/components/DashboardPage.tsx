import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Chart } from 'chart.js';
import { fmtRs, mkLabel } from '../lib/utils';
import { statusBadge } from '../App';
import * as api from '../lib/db';

export function DashboardPage({ summary, parties, toast, refresh, setTab }: any) {
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [selectedKpis, setSelectedKpis] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('creditflow_selected_kpis');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 4 && parsed.length <= 6) {
          return parsed;
        }
      }
    } catch (e) {}
    return ['outstanding', 'credit', 'collected', 'overdue', 'dueSoon', 'avgScore'];
  });

  const allKpiOptions = useMemo(() => {
    const totalPendingCredits = (parties || []).reduce((acc: number, p: any) => acc + (p.balance > 0 ? p.balance : 0), 0);
    const sumOfLimits = (parties || []).reduce((acc: number, p: any) => acc + (Number(p.creditLimit) || 0), 0);
    return [
      { id: 'outstanding', label: 'Outstanding Balance', val: fmtRs(summary.totalOutstanding), sub: 'Current month', col: '#1a6fbb' },
      { id: 'credit', label: 'Total Pending Credits', val: fmtRs(totalPendingCredits), sub: 'Accumulated active balance', col: '#4f46e5' },
      { id: 'newCredit', label: 'New Credit Sales', val: fmtRs(summary.totalCredit), sub: 'This month', col: '#7c3aed' },
      { id: 'collected', label: 'Monthly Collection', val: fmtRs(summary.totalCollected), sub: 'This month', col: '#059669' },
      { id: 'overdue', label: 'Total Overdue', val: summary.overdueCount + ' Accounts', sub: 'Action required', col: '#dc2626' },
      { id: 'dueSoon', label: 'Due Soon', val: summary.dueSoonCount + ' Accounts', sub: 'Within 2 days', col: '#d97706' },
      { id: 'paid', label: 'Paid Accounts', val: summary.paidCount + ' Accounts', sub: 'Fully clear this month', col: '#059669' },
      { id: 'active', label: 'Active Accounts', val: summary.activeCount + ' Accounts', sub: 'This month', col: '#2563eb' },
      { id: 'avgScore', label: 'Avg Credit Score', val: summary.avgScore, sub: 'All parties', col: '#ea580c' },
      { id: 'sumOfLimits', label: 'Total Credit Limits', val: fmtRs(sumOfLimits), sub: 'Max exposure', col: '#0d9488' }
    ];
  }, [summary, parties]);

  const kpis = useMemo(() => {
    const map = new Map(allKpiOptions.map(opt => [opt.id, opt]));
    return selectedKpis.map(id => map.get(id)).filter(Boolean);
  }, [selectedKpis, allKpiOptions]);

  const handleToggleKpi = (id: string) => {
    setSelectedKpis(prev => {
      let next;
      if (prev.includes(id)) {
        if (prev.length <= 4) {
          toast('You must display at least 4 metrics on the dashboard.', 'error');
          return prev;
        }
        next = prev.filter(x => x !== id);
      } else {
        if (prev.length >= 6) {
          toast('You can select a maximum of 6 metrics on the dashboard.', 'error');
          return prev;
        }
        next = [...prev, id];
      }
      localStorage.setItem('creditflow_selected_kpis', JSON.stringify(next));
      return next;
    });
  };

  const agingRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLCanvasElement>(null);
  const acRef = useRef<Chart | null>(null);
  const scRef = useRef<Chart | null>(null);

  // Quick Notes state
  const [notes, setNotes] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('creditflow_quick_notes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notePartyId, setNotePartyId] = useState('');

  // Recent Activity state
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [localActivities, setLocalActivities] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('creditflow_local_activities');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const logLocalActivity = (desc: string, type: string = 'note') => {
    const newAct = {
      id: Date.now().toString(),
      Timestamp: new Date().toISOString(),
      Notes: desc,
      type: type
    };
    const updated = [newAct, ...localActivities].slice(0, 10);
    setLocalActivities(updated);
    localStorage.setItem('creditflow_local_activities', JSON.stringify(updated));
  };

  const fetchRecentActivity = () => {
    setLoadingActivity(true);
    api.getLedger(null)
      .then(r => {
        if (r && r.length > 0) {
          const sorted = r.sort((a: any, b: any) => new Date(b['Timestamp']).getTime() - new Date(a['Timestamp']).getTime());
          setRecentTxns(sorted.slice(0, 5));
        }
      })
      .catch(err => console.error("Error loading activities:", err))
      .finally(() => setLoadingActivity(false));
  };

  useEffect(() => {
    fetchRecentActivity();
  }, [summary]); // Refresh when dashboard summary updates

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    const selectedParty = parties.find((p: any) => p.partyId === notePartyId);
    const newNote = {
      id: Date.now().toString(),
      partyId: notePartyId || 'general',
      partyName: selectedParty ? selectedParty.accountName : 'General Reminder',
      text: noteText.trim(),
      updatedAt: new Date().toLocaleString()
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    localStorage.setItem('creditflow_quick_notes', JSON.stringify(updated));
    setNoteText('');
    setNotePartyId('');
    setIsAddingNote(false);
    toast('Quick Note saved ✓', 'success');
    logLocalActivity(`Added reminder note: "${newNote.text.slice(0, 30)}${newNote.text.length > 30 ? '...' : ''}" associated with ${newNote.partyName}`, 'note');
  };

  const handleDeleteNote = (id: string, name: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    localStorage.setItem('creditflow_quick_notes', JSON.stringify(updated));
    toast('Note deleted ✓', 'info');
    logLocalActivity(`Removed note associated with ${name}`, 'note');
  };

  const mergedActivities = useMemo(() => {
    const txns = recentTxns.map((t: any) => {
      const dbVal = Number(t['Debit (New Credit)']) || 0;
      const crVal = Number(t['Credit (Payment)']) || 0;
      const isDebit = dbVal > 0;
      return {
        id: t['Row ID'] || t['Timestamp'] + t['Account Name'] + t['Closing Balance'],
        timestamp: t['Timestamp'],
        title: t['Account Name'] || 'System Transaction',
        desc: t['Notes'] ? `Remarks: ${t['Notes']}` : (isDebit ? 'Goods purchased on credit' : 'Received outstanding payment'),
        amount: isDebit ? `+${fmtRs(dbVal)}` : `-${fmtRs(crVal)}`,
        amountColor: isDebit ? 'var(--red)' : 'var(--green)',
        type: isDebit ? 'credit-sale' : 'payment',
        rawDate: new Date(t['Timestamp']).getTime() || 0
      };
    });

    const locals = localActivities.map((l: any) => ({
      id: l.id,
      timestamp: new Date(l.Timestamp).toLocaleString(),
      title: 'Workspace Operation',
      desc: l.Notes,
      amount: '',
      amountColor: 'var(--muted)',
      type: l.type || 'note',
      rawDate: new Date(l.Timestamp).getTime() || 0
    }));

    return [...txns, ...locals]
      .sort((a, b) => b.rawDate - a.rawDate)
      .slice(0, 5);
  }, [recentTxns, localActivities]);


  useEffect(() => {
    if (!summary) return;
    if (acRef.current) acRef.current.destroy();
    if (scRef.current) scRef.current.destroy();
    
    if (agingRef.current) {
      acRef.current = new Chart(agingRef.current, {
        type: 'bar',
        data: {
          labels: Object.keys(summary.aging || {}),
          datasets: [{ label: '₹', data: Object.values(summary.aging || {}), backgroundColor: ['#93c5fd', '#fcd34d', '#fdba74', '#fca5a5'], borderRadius: 5 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(0,0,0,.05)' } }, y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { callback: v => '₹' + (Number(v) >= 1000 ? (Number(v) / 1000).toFixed(0) + 'k' : v), font: { size: 10 } } } } }
      });
    }

    if (scoreRef.current) {
      const r: Record<string, number> = { '0–25': 0, '26–50': 0, '51–75': 0, '76–100': 0 };
      (parties || []).forEach((p: any) => { const s = p.score || 50; if (s <= 25) r['0–25']++; else if (s <= 50) r['26–50']++; else if (s <= 75) r['51–75']++; else r['76–100']++; });
      scRef.current = new Chart(scoreRef.current, {
        type: 'doughnut',
        data: { labels: Object.keys(r), datasets: [{ data: Object.values(r), backgroundColor: ['#fca5a5', '#fcd34d', '#93c5fd', '#6ee7b7'], borderWidth: 2, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } } }
      });
    }
    return () => { if (acRef.current) acRef.current.destroy(); if (scRef.current) scRef.current.destroy(); };
  }, [summary, parties]);

  if (!summary) return null;
  const ams = summary.allMonthSummaries || {};
  const monthList = summary.allMonths || [];
  const byYear: Record<string, string[]> = {};
  monthList.forEach((mk: string) => { const yr = mk.split('-')[0]; if (!byYear[yr]) byYear[yr] = []; byYear[yr].push(mk); });
  const years = Object.keys(byYear).sort().reverse();
  const yearTotals: Record<string, any> = {};
  years.forEach(yr => {
    yearTotals[yr] = byYear[yr].reduce((acc, mk) => {
      const d = ams[mk] || {};
      return { totalDebt: acc.totalDebt + (d.totalDebt || 0), totalPaid: acc.totalPaid + (d.totalPaid || 0), totalBalance: acc.totalBalance + (d.totalBalance || 0) };
    }, { totalDebt: 0, totalPaid: 0, totalBalance: 0 });
  });

  const exceededParties = useMemo(() => {
    return (parties || []).filter((p: any) => p.creditLimit > 0 && (p.balance || 0) > p.creditLimit);
  }, [parties]);

  return (
    <div>
      <div className="sec-hdr">
        <h2>Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn sm" onClick={() => setShowCustomizer(!showCustomizer)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '5px 10px', borderRadius: '6px' }}>
            ⚙️ Customize KPIs
          </button>
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>Month: {summary.currentMonth}</span>
        </div>
      </div>
      
      {showCustomizer && (
        <div className="card" style={{ marginBottom: '20px', padding: '16px', background: 'var(--surface2)', border: '1.5px solid var(--border)', animation: 'su .15s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚙️ Dashboard KPI Customization (Select 4 to 6 metrics)
            </span>
            <button className="btn sm primary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => setShowCustomizer(false)}>
              Close
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px 0' }}>
            Choose which metrics you want to prioritize on your dashboard.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px' }}>
            {allKpiOptions.map(opt => {
              const isSelected = selectedKpis.includes(opt.id);
              return (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--surface)', borderRadius: '6px', border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <input 
                    type="checkbox" 
                    checked={isSelected} 
                    disabled={!isSelected && selectedKpis.length >= 6}
                    onChange={() => handleToggleKpi(opt.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{opt.label}</span>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }} className="mono">{opt.val}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Predefined Credit Limit Threshold Warning Banner */}
      {exceededParties.length > 0 && (
        <div style={{
          background: '#fee2e2', 
          border: '1.5px solid #fca5a5', 
          borderRadius: '8px', 
          padding: '14px 18px', 
          marginBottom: '20px', 
          color: '#991b1b',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)',
          animation: 'su .15s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ letterSpacing: '0.5px' }}>CREDIT LIMIT EXCEEDED WARNING</span>
            <span style={{ fontSize: '11px', background: '#fecaca', padding: '2px 8px', borderRadius: '12px', color: '#991b1b', border: '1px solid #f87171', marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {exceededParties.length} {exceededParties.length === 1 ? 'Party' : 'Parties'}
            </span>
          </div>
          <p style={{ fontSize: '12.5px', margin: 0, opacity: 0.95, lineHeight: 1.4 }}>
            The following customer accounts have crossed their predefined credit thresholds. Immediate collection action or hold is recommended:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', marginTop: '6px' }}>
            {exceededParties.map((p: any) => (
              <div key={p.partyId} style={{ background: '#ffffff', border: '1px solid #fee2e2', borderRadius: '6px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>🏢 {p.accountName}</span>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontWeight: 700, color: '#dc2626' }}>{fmtRs(p.balance)}</div>
                  <div className="mono" style={{ fontSize: '10px', color: '#6b7280' }}>Limit: {fmtRs(p.creditLimit)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="kpi-grid">
        {kpis.map(k => (<div key={k.label} className="kpi" style={{ '--kpi-accent': k.col } as any}><div className="kpi-label">{k.label}</div><div className="kpi-val">{k.val}</div><div className="kpi-sub">{k.sub}</div></div>))}
      </div>
      {(summary.dueSoon || []).length > 0 && (
        <div className="card" style={{ marginBottom: 22, borderColor: '#fcd34d', borderWidth: 2 }}>
          <div className="card-title" style={{ color: '#92400e' }}>⚠ Due in Next 2 Days ({summary.dueSoon.length})</div>
          <div className="tbl-wrap" style={{ border: 'none', boxShadow: 'none' }}>
            <table><thead><tr><th>Account</th><th>Balance</th><th>Target Date</th><th>Status</th></tr></thead>
              <tbody>{summary.dueSoon.map((r: any, i: number) => (<tr key={i}><td style={{ fontWeight: 600 }}>{r['Account Name']}</td><td className="mono" style={{ color: 'var(--red)', fontWeight: 700 }}>{fmtRs(r['Balance'])}</td><td className="mono">{r['Target Date']}</td><td>{statusBadge(r['Status'])}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
      {years.map(yr => (
        <div key={yr} className="year-group">
          <div className="year-label">{yr}<span className="year-total">Total Debt {fmtRs(yearTotals[yr].totalDebt)} · Collected {fmtRs(yearTotals[yr].totalPaid)} · Balance {fmtRs(yearTotals[yr].totalBalance)}</span></div>
          <div className="month-cards-grid">
            {byYear[yr].slice().reverse().map(mk => {
              const d = ams[mk] || {}; const isCur = mk === summary.currentMonth;
              return (
                <div key={mk} className={`month-card ${isCur ? 'current' : ''}`} onClick={() => setTab('monthly')}>
                  <div className="month-card-header"><div className="month-card-title">{mkLabel(mk)}</div><div className="month-card-year">{mk}</div></div>
                  <div className="month-card-stats">
                    <div className="mcs"><div className="mcs-label">Total Debt</div><div className="mcs-val">{fmtRs(d.totalDebt)}</div></div>
                    <div className="mcs"><div className="mcs-label">New Credit</div><div className="mcs-val">{fmtRs(d.totalCredit)}</div></div>
                    <div className="mcs"><div className="mcs-label">Collected</div><div className="mcs-val" style={{ color: 'var(--green)' }}>{fmtRs(d.totalPaid)}</div></div>
                    <div className="mcs"><div className="mcs-label">Balance Due</div><div className="mcs-val" style={{ color: (d.totalBalance || 0) > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtRs(d.totalBalance)}</div></div>
                  </div>
                  <div className="month-card-badges">
                    {(d.paidCount || 0) > 0 && <span className="badge badge-paid">{d.paidCount} paid</span>}
                    {(d.overdueCount || 0) > 0 && <span className="badge badge-overdue">{d.overdueCount} overdue</span>}
                    {(d.dueSoonCount || 0) > 0 && <span className="badge badge-duesoon">{d.dueSoonCount} due soon</span>}
                    {(d.activeCount || 0) > 0 && <span className="badge badge-active">{d.activeCount} active</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="chart-grid">
        <div className="chart-wrap"><div className="card-title">Aging Analysis (Current Month)</div><canvas ref={agingRef} /></div>
        <div className="chart-wrap"><div className="card-title">Score Distribution (All Parties)</div><canvas ref={scoreRef} /></div>
      </div>

      {/* Dynamic bottom section for Recent Activity and Quick Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '24px' }}>
        
        {/* Left column: Recent Activity Feed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
            <span>⚡ Recent Activity Feed</span>
            <span className="mono" style={{ fontSize: '10px', textTransform: 'none', fontWeight: 500 }}>Unified timeline</span>
          </div>
          
          {loadingActivity ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              ⟳ Syncing with ledger...
            </div>
          ) : mergedActivities.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}>No recent activities detected.</div>
          ) : (
            <div className="timeline">
              {mergedActivities.map(act => (
                <div key={act.id} className="timeline-item">
                  <div className={`timeline-dot ${act.type}`} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <span className="timeline-content">{act.title}</span>
                    {act.amount && <span className="mono" style={{ fontSize: '11px', fontWeight: 700, color: act.amountColor }}>{act.amount}</span>}
                  </div>
                  <p className="timeline-desc">{act.desc}</p>
                  <span className="timeline-time">{act.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Quick Notes & Reminders */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
            <span>📌 Quick Notes & Reminders</span>
            <button 
              className="btn sm" 
              style={{ padding: '3px 8px', fontSize: '10px', fontFamily: 'var(--font-sans)', borderRadius: '6px' }}
              onClick={() => setIsAddingNote(!isAddingNote)}
            >
              {isAddingNote ? '✕ Close Form' : '+ Add Note'}
            </button>
          </div>

          {isAddingNote && (
            <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="field">
                <label style={{ fontSize: '9px', fontWeight: 600 }}>Associate with Party (Optional)</label>
                <select 
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
                  value={notePartyId}
                  onChange={e => setNotePartyId(e.target.value)}
                >
                  <option value="">General (No Party)</option>
                  {(parties || []).map((p: any) => (
                    <option key={p.partyId} value={p.partyId}>{p.accountName}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label style={{ fontSize: '9px', fontWeight: 600 }}>Snippet or Reminder Text</label>
                <textarea 
                  style={{ width: '100%', height: '60px', padding: '8px 10px', fontSize: '12.5px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', resize: 'none', outline: 'none' }}
                  placeholder="Type your reminder or temporary note here..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
              </div>
              <button 
                className="btn sm primary" 
                style={{ alignSelf: 'flex-end', padding: '6px 12px', fontWeight: 600, fontSize: '11px', fontFamily: 'var(--font-sans)' }}
                onClick={handleSaveNote}
                disabled={!noteText.trim()}
              >
                Save Note
              </button>
            </div>
          )}

          {notes.length === 0 ? (
            <div className="empty" style={{ padding: '40px 0' }}>
              No quick notes saved yet. Click "+ Add Note" to create one.
            </div>
          ) : (
            <div className="notes-list">
              {notes.map(note => (
                <div key={note.id} className="note-card">
                  <div className="note-card-header">
                    <span className="note-card-party">🏢 {note.partyName}</span>
                    <button 
                      className="note-action-btn del"
                      title="Delete Note"
                      onClick={() => handleDeleteNote(note.id, note.partyName)}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="note-card-text">{note.text}</p>
                  <div className="note-card-footer">
                    <span>{note.updatedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
