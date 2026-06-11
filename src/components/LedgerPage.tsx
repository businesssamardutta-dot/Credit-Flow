import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../lib/db';
import { fmtRs, mkLabel } from '../lib/utils';
import { statusBadge } from '../App';

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 140;
  const h = 32;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
        <span style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 650 }}>Balance Trend</span>
        <span style={{ fontSize: '8px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', opacity: 0.75 }}>Last 5 txn</span>
      </div>
      <div style={{ background: 'var(--surface2)', padding: '4px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'inline-flex' }}>
        <svg width={w} height={h} style={{ overflow: 'visible' }}>
          <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((v, i) => {
            const x = (i / (data.length - 1 || 1)) * w;
            const y = h - ((v - min) / range) * (h - 8) - 4;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="3.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
                <title>Txn {i + 1}: ₹{v.toLocaleString('en-IN')}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function LedgerPage({ months, toast }: any) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [parties, setParties] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getParties().then(setParties).catch(console.error);
  }, []);

  const fetchLedger = () => {
    setBusy(true);
    api.getLedger(selectedMonth || null)
      .then(r => setRows(r || []))
      .catch((e: any) => toast('Error: ' + e.message, 'error'))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    fetchLedger();
  }, [selectedMonth]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const sDate = startDate ? new Date(startDate).getTime() : 0;
    const eDate = endDate ? new Date(endDate).getTime() + 86400000 : Infinity; // Include the end date fully

    return rows.filter((r: any) => {
      const matchParty = selectedParty === '' || (r['Account Name'] || '').toLowerCase().includes(selectedParty.toLowerCase());
      const matchSearch = q === '' || (r['Account Name'] || '').toLowerCase().includes(q) || (r['Notes'] || '').toLowerCase().includes(q);
      
      let matchDate = true;
      if (sDate > 0 || eDate < Infinity) {
        let entryTime = 0;
        if (r['Timestamp']) {
          entryTime = new Date(r['Timestamp']).getTime();
        }
        matchDate = entryTime >= sDate && entryTime < eDate;
      }
      
      return matchParty && matchSearch && matchDate;
    });
  }, [rows, selectedParty, searchQuery, startDate, endDate]);

  const handleExportCSV = () => {
    if (filteredRows.length === 0) {
      toast('No data to export', 'error');
      return;
    }
    const headers = ['Date', 'Account', 'Month', 'Opening', 'Debit (New Credit)', 'Credit (Payment)', 'Closing', 'Status', 'Notes'];
    const csvRows = [headers.join(',')];
    
    for (const r of filteredRows) {
      const row = [
        r['Timestamp'],
        `"${(r['Account Name']||'').replace(/"/g, '""')}"`,
        r['MonthName'],
        r['Opening Balance'],
        r['Debit (New Credit)'],
        r['Credit (Payment)'],
        r['Closing Balance'],
        r['Status'],
        `"${(r['Notes']||'').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ledger_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trendData = useMemo(() => {
    if (!selectedParty) return [];
    const partyKeyword = selectedParty.toLowerCase().trim();
    // Gather all rows matching this selected party account
    const partyRows = rows.filter((r: any) => {
      const name = (r['Account Name'] || '').toLowerCase();
      return name === partyKeyword || name.includes(partyKeyword);
    });

    if (partyRows.length === 0) return [];

    // Sort chronologically (oldest to newest) using Timestamp
    const sorted = partyRows.slice().sort((a: any, b: any) => {
      return new Date(a['Timestamp']).getTime() - new Date(b['Timestamp']).getTime();
    });

    // Get the last 5 transactions
    const last5 = sorted.slice(-5);
    return last5.map((r: any) => Number(r['Closing Balance']) || 0);
  }, [rows, selectedParty]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Header */}
      <div className="sec-hdr" style={{ margin: 0 }}>
        <div>
          <h2>Ledger Audit & Statements</h2>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Audit party transactions, filter dates, view trends, and backup offline records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={fetchLedger}>
            ↻ Refresh Data
          </button>
          <button className="btn primary" onClick={handleExportCSV}>
            ⬇ Export to CSV
          </button>
        </div>
      </div>

      {/* Filter and Period Selection Configuration Row */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', background: 'var(--surface)' }}>
        
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600 }}>Accounting Month</label>
          <select className="search-input" style={{ width: '100%' }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            <option value="">All Months</option>
            {months.slice().reverse().map((m: string) => (
              <option key={m} value={m}>{mkLabel(m)}</option>
            ))}
          </select>
        </div>

        <div className="field" style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600 }}>Filter by Party</label>
          <input 
            type="text" 
            className="search-input" 
            style={{ width: '100%' }} 
            placeholder="Type party name..." 
            value={selectedParty} 
            onChange={e => setSelectedParty(e.target.value)} 
            list="parties-list" 
          />
          <datalist id="parties-list">
            {parties.map(p => (
              <option key={p.partyId} value={p.accountName} />
            ))}
          </datalist>
        </div>

        {/* Date Range Picker using standard HTML date inputs */}
        <div className="field" style={{ flex: '1 1 155px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600 }}>From Date</label>
          <input 
            type="date" 
            className="search-input" 
            style={{ width: '100%' }} 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
          />
        </div>

        <div className="field" style={{ flex: '1 1 155px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600 }}>To Date</label>
          <input 
            type="date" 
            className="search-input" 
            style={{ width: '100%' }} 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
          />
        </div>

        {(startDate || endDate || selectedMonth || selectedParty) && (
          <button 
            className="btn sm" 
            style={{ height: '38px', color: 'var(--red)', borderColor: 'var(--border2)' }}
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSelectedMonth('');
              setSelectedParty('');
              setSearchQuery('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Selected Party Visual Header and Sparkline Trend */}
      {selectedParty && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '16px 20px', 
          background: 'var(--surface2)', 
          border: '1.5px solid var(--border)', 
          borderRadius: 'var(--radius)', 
          boxShadow: 'var(--shadow)',
          flexWrap: 'wrap', 
          gap: '16px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--surface)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: 'var(--shadow)' }}>👤</div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)' }}>Selected Account Status</span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text)' }}>
                {selectedParty}
              </h3>
            </div>
          </div>
          {trendData && trendData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Current Balance</span>
                <span className="mono" style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent)' }}>
                  {filteredRows.length > 0 && (filteredRows[0]['Account Name'] || '').toLowerCase().includes(selectedParty.toLowerCase()) 
                    ? fmtRs(filteredRows[0]['Closing Balance']) 
                    : '₹0.00'}
                </span>
              </div>
              
              {/* Sparkline chart next to selected party name displaying last 5 transactions */}
              <Sparkline data={trendData} />
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>No balance history found</span>
          )}
        </div>
      )}

      {/* Main Table Section with Real-Time Search Bar at the absolute top of the table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Real-time table search bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          background: 'var(--surface)', 
          padding: '12px 18px', 
          borderRadius: 'var(--radius)', 
          border: '1.5px solid var(--border)', 
          boxShadow: 'var(--shadow)' 
        }}>
          <span style={{ fontSize: '18px' }}>🔍</span>
          <input 
            type="text" 
            className="search-input" 
            style={{ flex: 1, border: 'none', padding: '4px 0', fontSize: '14px', background: 'transparent' }} 
            placeholder="Search filtered entries in real-time by party name, or transaction description/notes..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
          {searchQuery && (
            <button 
              className="btn sm" 
              style={{ padding: '2px 8px', fontSize: '10px' }} 
              onClick={() => setSearchQuery('')}
            >
              Clear
            </button>
          )}
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            Showing {filteredRows.length} entries
          </span>
        </div>

        {busy ? (
          <div className="loading">Loading ledger entries…</div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Month</th>
                  <th>Opening</th>
                  <th>Debit (Credit)</th>
                  <th>Credit (Payment)</th>
                  <th>Closing</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: 11 }}>{r['Timestamp']}</td>
                    <td style={{ fontWeight: 600 }}>{r['Account Name']}</td>
                    <td className="mono">{r['MonthName']}</td>
                    <td className="mono">{fmtRs(r['Opening Balance'])}</td>
                    <td className="mono" style={{ color: 'var(--red)' }}>{fmtRs(r['Debit (New Credit)'])}</td>
                    <td className="mono" style={{ color: 'var(--green)' }}>{fmtRs(r['Credit (Payment)'] || 0)}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{fmtRs(r['Closing Balance'])}</td>
                    <td>{statusBadge(r['Status'])}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r['Notes']}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && <tr><td colSpan={9} className="empty">No ledger entries found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
