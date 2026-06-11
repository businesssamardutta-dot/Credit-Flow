import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';
import { fmtRs, mkLabel } from '../lib/utils';
import { statusBadge } from '../App';

export function DashboardPage({ summary, parties, toast, refresh, setTab }: any) {
  const agingRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLCanvasElement>(null);
  const acRef = useRef<Chart | null>(null);
  const scRef = useRef<Chart | null>(null);

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

  const kpis = [
    { label: 'Outstanding', val: fmtRs(summary.totalOutstanding), sub: 'Current month', col: '#1a6fbb' },
    { label: 'New Credit', val: fmtRs(summary.totalCredit), sub: 'This month', col: '#7c3aed' },
    { label: 'Collected', val: fmtRs(summary.totalCollected), sub: 'This month', col: '#059669' },
    { label: 'Overdue', val: summary.overdueCount, sub: 'Accounts', col: '#dc2626' },
    { label: 'Due Soon', val: summary.dueSoonCount, sub: 'Within 2 days', col: '#d97706' },
    { label: 'Paid', val: summary.paidCount, sub: 'This month', col: '#059669' },
    { label: 'Active', val: summary.activeCount, sub: 'Accounts', col: '#2563eb' },
    { label: 'Avg Score', val: summary.avgScore, sub: 'All parties', col: '#ea580c' },
  ];

  return (
    <div>
      <div className="sec-hdr"><h2>Dashboard</h2><span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>Month: {summary.currentMonth}</span></div>
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
    </div>
  );
}
