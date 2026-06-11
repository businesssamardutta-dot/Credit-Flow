import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../lib/db';
import { fmtRs, mkLabel } from '../lib/utils';
import { statusBadge } from '../App';

export function LedgerPage({ months, toast }: any) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
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
    return rows.filter((r: any) => {
      const matchParty = selectedParty === '' || r['Account Name'] === selectedParty;
      return matchParty;
    });
  }, [rows, selectedParty]);

  return (
    <div>
      <div className="sec-hdr">
        <h2>Ledger</h2>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
        <div className="field" style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '10px', marginBottom: '4px' }}>Select Month</label>
          <select className="search-input" style={{ width: '150px' }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            <option value="">All Months</option>
            {months.slice().reverse().map((m: string) => (
              <option key={m} value={m}>{mkLabel(m)}</option>
            ))}
          </select>
        </div>

        <div className="field" style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '10px', marginBottom: '4px' }}>Filter by Party</label>
          <select className="search-input" style={{ width: '220px' }} value={selectedParty} onChange={e => setSelectedParty(e.target.value)}>
            <option value="">All Parties</option>
            {parties.map(p => (
              <option key={p.partyId} value={p.accountName}>{p.accountName}</option>
            ))}
          </select>
        </div>

        <button className="btn sm" onClick={fetchLedger} style={{ marginTop: '18px' }}>↻ Refresh</button>
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
