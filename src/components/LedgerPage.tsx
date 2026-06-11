import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../lib/db';
import { fmtRs, mkLabel } from '../lib/utils';
import { statusBadge } from '../App';

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - ((v - min) / range) * (h - 10) - 5;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ marginLeft: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>Balance Trend</span>
      <svg width={w} height={h} style={{ overflow: 'visible', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
        <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => {
          const x = (i / (data.length - 1 || 1)) * w;
          const y = h - ((v - min) / range) * (h - 10) - 5;
          return <circle key={i} cx={x} cy={y} r="2" fill="var(--primary)" />
        })}
      </svg>
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
    const q = searchQuery.toLowerCase();
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
    if (!selectedParty || filteredRows.length === 0) return [];
    // Only show trend if exactly 1 party is effectively selected
    const uniqueParties = new Set(filteredRows.map((r: any) => r['Account Name']));
    if (uniqueParties.size !== 1) return [];
    
    return filteredRows.slice().reverse().map((r: any) => Number(r['Closing Balance']) || 0);
  }, [filteredRows, selectedParty]);

  return (
    <div>
      <div className="sec-hdr">
        <h2>Ledger</h2>
        <button className="btn" onClick={handleExportCSV}>⬇ Export CSV</button>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '10px', marginBottom: '4px' }}>Select Month</label>
          <select className="search-input" style={{ width: '130px' }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            <option value="">All Months</option>
            {months.slice().reverse().map((m: string) => (
              <option key={m} value={m}>{mkLabel(m)}</option>
            ))}
          </select>
        </div>

        <div className="field" style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '10px', marginBottom: '4px' }}>Filter by Party</label>
          <input 
            type="text" 
            className="search-input" 
            style={{ width: '180px' }} 
            placeholder="Type or select..." 
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

        <div className="field" style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '10px', marginBottom: '4px' }}>Search by Name/Notes</label>
          <input type="text" className="search-input" style={{ width: '150px' }} placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        <div className="field" style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '10px', marginBottom: '4px' }}>Start Date</label>
          <input type="date" className="search-input" style={{ width: '130px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>

        <div className="field" style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '10px', marginBottom: '4px' }}>End Date</label>
          <input type="date" className="search-input" style={{ width: '130px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>

        <button className="btn sm" onClick={fetchLedger} style={{ marginTop: '18px' }}>↻ Refresh</button>

        {trendData.length > 1 && <Sparkline data={trendData} />}
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
  );
}
