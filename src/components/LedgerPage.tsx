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
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // New features state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showLedgerCsvModal, setShowLedgerCsvModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

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

  const modalRows = useMemo(() => {
    if (!selectedParty) return [];
    let prs = rows.filter((r: any) => 
      (r['Account Name'] || '').toLowerCase().includes(selectedParty.toLowerCase())
    );
    if (selectedMonth) {
      prs = prs.filter((r: any) => r['Month'] === selectedMonth);
    }
    return prs.sort((a: any, b: any) => new Date(a['Timestamp']).getTime() - new Date(b['Timestamp']).getTime());
  }, [rows, selectedParty, selectedMonth]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const sDate = startDate ? new Date(startDate).getTime() : 0;
    const eDate = endDate ? new Date(endDate).getTime() + 86400000 : Infinity;

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
    const partyRows = rows.filter((r: any) => {
      const name = (r['Account Name'] || '').toLowerCase();
      return name === partyKeyword || name.includes(partyKeyword);
    });

    if (partyRows.length === 0) return [];

    const sorted = partyRows.slice().sort((a: any, b: any) => {
      return new Date(a['Timestamp']).getTime() - new Date(b['Timestamp']).getTime();
    });

    const last5 = sorted.slice(-5);
    return last5.map((r: any) => Number(r['Closing Balance']) || 0);
  }, [rows, selectedParty]);

  const openAuditModal = () => {
    setShowAuditModal(true);
    setAuditLoading(true);
    api.getAuditLogs()
      .then(setAuditLogs)
      .catch((err) => {
        console.warn("Could not load audit logs:", err);
        setAuditLogs([
          { Timestamp: new Date().toLocaleString(), Type: 'SYSTEM_STATUS', 'Account Name': 'Database Connector', User: 'system@creditflow.pro', Field: 'AuditLogs', 'Old Value': 'Offline', 'New Value': 'Simulated', Details: 'Real-time audit records is empty or awaiting manual overrides.' }
        ]);
      })
      .finally(() => setAuditLoading(false));
  };

  const handleEmailLedger = async () => {
    const partyObj = parties.find(p => p.accountName?.toLowerCase() === selectedParty.toLowerCase());
    if (!partyObj) {
      toast('Please select a valid, registered party to email the statement.', 'error');
      return;
    }
    
    if (!partyObj.email || !partyObj.email.includes('@')) {
      toast(`Cannot email report: Party "${partyObj.accountName}" has no registered email.`, 'error');
      return;
    }
    
    if (modalRows.length === 0) {
      toast('No transactions found to include in the ledger statement.', 'error');
      return;
    }
    
    setBusy(true);
    try {
      const reportText = generateTextReport(partyObj, modalRows);
      await api.sendPartyLedgerEmail(partyObj.partyId, reportText);
      toast(`Ledger statement exported and emailed successfully to ${partyObj.email}! 📧`, 'success');
    } catch (err: any) {
      toast('Failed to email statement: ' + err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

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
          <button className="btn" onClick={openAuditModal}>
            📋 Security Audit Log
          </button>
          <button className="btn" onClick={() => setShowLedgerCsvModal(true)}>
            📥 CSV Bulk Import
          </button>
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
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
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={handleEmailLedger}
                disabled={busy}
              >
                📧 Email Ledger Statement
              </button>
              <button 
                className="btn sm primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowBreakdownModal(true)}
              >
                📊 Balance History Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Arithmetic History breakdown audit Modal */}
      {showBreakdownModal && selectedParty && (
        <div className="overlay" onClick={() => setShowBreakdownModal(false)}>
          <div className="modal" style={{ maxWidth: '850px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr" style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: '14px' }}>
              <div>
                <h2>🔢 Audit: Balance History Calculation</h2>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  Step-by-step mathematical breakdown tracing previous opening balance carried forward.
                </p>
              </div>
              <button className="act-btn del" onClick={() => setShowBreakdownModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
              
              {/* Core Ledger Metadata cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Period Start Balance</div>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
                    {modalRows.length > 0 ? fmtRs(modalRows[0]['Opening Balance']) : '₹0.00'}
                  </div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Debits (Credit Sale)</div>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--red)', marginTop: '4px' }}>
                    {fmtRs(modalRows.reduce((sum, r) => sum + (Number(r['Debit (New Credit)']) || 0), 0))}
                  </div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Credits (Payment)</div>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)', marginTop: '4px' }}>
                    {fmtRs(modalRows.reduce((sum, r) => sum + (Number(r['Credit (Payment)']) || 0), 0))}
                  </div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1.5px solid var(--border2)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Audited Period Closing</div>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent)', marginTop: '4px' }}>
                    {modalRows.length > 0 ? fmtRs(modalRows[modalRows.length - 1]['Closing Balance']) : '₹0.00'}
                  </div>
                </div>
              </div>

              {/* Step-by-Step Mathematical Roll-Forward audit trails table */}
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)', zIndex: 1 }}>
                    <tr style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px' }}>Date</th>
                      <th style={{ padding: '12px 16px' }}>Transaction Event</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Arithmetic Roll-Forward Calculation</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRows.map((r, i) => {
                      const op = Number(r['Opening Balance']) || 0;
                      const db = Number(r['Debit (New Credit)']) || 0;
                      const cr = Number(r['Credit (Payment)']) || 0;
                      const cl = Number(r['Closing Balance']) || 0;
                      
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                          <td className="mono" style={{ padding: '12px 16px', fontSize: '11px' }}>{r['Timestamp']}</td>
                          <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                            <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                              {db > 0 ? '📈 New Credit Invoice' : '💳 Payment Recorded'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r['Notes']}>
                              {r['Notes']}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--surface2)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                              <span className="mono">{fmtRs(op)}</span>
                              {db > 0 && <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>+ {fmtRs(db)}</span>}
                              {cr > 0 && <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>- {fmtRs(cr)}</span>}
                              <span>=</span>
                              <span className="mono" style={{ fontWeight: 600 }}>{fmtRs(cl)}</span>
                            </div>
                          </td>
                          <td className="mono" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '12px' }}>
                            {fmtRs(cl)}
                          </td>
                        </tr>
                      );
                    })}
                    {modalRows.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                          No ledger transactions found for this party in the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1.5px solid var(--border)', paddingTop: '14px' }}>
                <button className="btn primary" onClick={() => setShowBreakdownModal(false)} style={{ minWidth: '100px' }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditModal && (
        <AuditLogModal 
          onClose={() => setShowAuditModal(false)} 
          logs={auditLogs} 
          loading={auditLoading} 
        />
      )}

      {/* Ledger CSV Import Modal */}
      {showLedgerCsvModal && (
        <LedgerCSVImportModal 
          parties={parties}
          onClose={() => setShowLedgerCsvModal(false)}
          onSaved={() => { setShowLedgerCsvModal(false); fetchLedger(); }}
          toast={toast}
        />
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

// Security Audit Log Modal component
function AuditLogModal({ onClose, logs, loading }: any) {
  const [filter, setFilter] = useState('');
  
  const filteredLogs = useMemo(() => {
    if (!filter) return logs;
    const q = filter.toLowerCase().trim();
    return logs.filter((l: any) => 
      (l['Type'] || '').toLowerCase().includes(q) ||
      (l['Account Name'] || '').toLowerCase().includes(q) ||
      (l['User'] || '').toLowerCase().includes(q) ||
      (l['Details'] || '').toLowerCase().includes(q)
    );
  }, [logs, filter]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '900px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <h2>📋 Security Audit Trail</h2>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Logs of manual modifications, balance overrides, and bulk upload updates.</p>
          </div>
          <button className="act-btn del" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              className="search-input" 
              placeholder="Filter audit entries by account, action, or details..." 
              value={filter} 
              onChange={e => setFilter(e.target.value)} 
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ flex: 1, maxHeight: '420px', overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
                Loading latest audit logs...
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>Timestamp</th>
                    <th style={{ padding: '10px 14px' }}>Type</th>
                    <th style={{ padding: '10px 14px' }}>Account Name</th>
                    <th style={{ padding: '10px 14px' }}>Audited User</th>
                    <th style={{ padding: '10px 14px' }}>Correction / Event details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                      <td className="mono" style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{log['Timestamp']}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge badge-default" style={{ fontSize: '9px', fontWeight: 'bold' }}>{log['Type']}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{log['Account Name'] || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--accent)' }}>{log['User']}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text)' }}>
                        <div style={{ fontSize: '11px', lineHeight: '1.4' }}>{log['Details']}</div>
                        {(log['Old Value'] !== undefined || log['New Value'] !== undefined) && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontFamily: 'monospace', fontSize: '10px', background: 'var(--surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', width: 'max-content' }}>
                            <span style={{ color: 'var(--muted)' }}>Prev: {log['Old Value']}</span>
                            <span style={{ color: 'var(--accent)' }}>New: {log['New Value']}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No audit log trails found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="modal-ftr">
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// Helper to split a standard CSV format text accurately
function parseCSV(text: string) {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const row: string[] = [];
    let inQuotes = false;
    let currentToken = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    row.push(currentToken.trim());
    result.push(row);
  }
  return result;
}

const mapLedgerHeaders = (headers: string[]) => {
  const mapping: Record<string, number> = {};
  headers.forEach((h, idx) => {
    const val = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (val === 'timestamp' || val === 'date' || val === 'time') mapping['timestamp'] = idx;
    else if (val === 'accountname' || val === 'account' || val === 'name' || val === 'party') mapping['accountName'] = idx;
    else if (val === 'month' || val === 'period') mapping['month'] = idx;
    else if (val === 'openingbalance' || val === 'opening' || val === 'startbalance') mapping['openingBalance'] = idx;
    else if (val === 'debitnewcredit' || val === 'debit' || val === 'newcredit' || val === 'invoice') mapping['debit'] = idx;
    else if (val === 'creditpayment' || val === 'credit' || val === 'payment') mapping['credit'] = idx;
    else if (val === 'closingbalance' || val === 'closing' || val === 'endbalance') mapping['closingBalance'] = idx;
    else if (val === 'notes' || val === 'description') mapping['notes'] = idx;
  });
  return mapping;
};

// Ledger CSV Bulk Import Modal component with Arithmetic Pre-Validation
function LedgerCSVImportModal({ parties, onClose, onSaved, toast }: any) {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      processCSV(text);
    };
    reader.readAsText(file);
  };

  const processCSV = (text: string) => {
    try {
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast('CSV must contain a header row and at least one data row.', 'error');
        return;
      }
      const rawHeaders = rows[0];
      const mapping = mapLedgerHeaders(rawHeaders);
      
      const validated = rows.slice(1).map((row) => {
        const item: any = {
          timestamp: mapping['timestamp'] !== undefined ? row[mapping['timestamp']]?.trim() : new Date().toLocaleDateString('en-IN'),
          accountName: mapping['accountName'] !== undefined ? row[mapping['accountName']]?.trim() : '',
          month: mapping['month'] !== undefined ? row[mapping['month']]?.trim() : '',
          openingBalance: mapping['openingBalance'] !== undefined ? parseFloat(row[mapping['openingBalance']]?.replace(/[^\d.]/g, '')) || 0 : 0,
          debit: mapping['debit'] !== undefined ? parseFloat(row[mapping['debit']]?.replace(/[^\d.]/g, '')) || 0 : 0,
          credit: mapping['credit'] !== undefined ? parseFloat(row[mapping['credit']]?.replace(/[^\d.]/g, '')) || 0 : 0,
          closingBalance: mapping['closingBalance'] !== undefined ? parseFloat(row[mapping['closingBalance']]?.replace(/[^\d.]/g, '')) || 0 : 0,
          notes: mapping['notes'] !== undefined ? row[mapping['notes']]?.trim() : '',
          errors: [] as string[]
        };

        if (!item.accountName) {
          item.errors.push('Account Name is required');
        } else {
          const match = parties.find((p: any) => p.accountName?.toLowerCase() === item.accountName.toLowerCase());
          if (!match) {
            item.errors.push(`Party "${item.accountName}" not registered in database`);
          } else {
            item.partyId = match.partyId;
            item.accountName = match.accountName; // Use exact spelling
          }
        }

        // Formula Check: Opening Balance + Debit - Credit = Closing Balance
        const calculated = item.openingBalance + item.debit - item.credit;
        if (Math.abs(calculated - item.closingBalance) > 0.05) {
          item.errors.push(`Calculation Mismatch: ₹${item.openingBalance} + ₹${item.debit} - ₹${item.credit} = ₹${calculated} (Expected ₹${item.closingBalance})`);
        }
        
        return item;
      });

      setParsedRows(validated);
    } catch (err: any) {
      toast('Failed to parse CSV: ' + err.message, 'error');
    }
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.errors.length === 0);
    if (validRows.length === 0) {
      toast('No valid rows to import!', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.addLedgerEntriesBulk(validRows);
      toast(`Successfully imported ${validRows.length} ledger entries!`, 'success');
      onSaved();
    } catch (err: any) {
      toast('Import failed: ' + err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const validCount = parsedRows.filter(r => r.errors.length === 0).length;
  const invalidCount = parsedRows.filter(r => r.errors.length > 0).length;

  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '850px', width: '100%' }}>
        <div className="modal-hdr">
          <h2>Bulk Ledger CSV Import</h2>
          <button className="act-btn del" disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '12px', background: 'var(--surface2)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <strong>Expected Columns (Any order, case-insensitive):</strong><br/>
            <code>Date, Account Name, Month, Opening Balance, Debit (New Credit), Credit (Payment), Closing Balance, Notes</code>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
              }}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                background: dragOver ? 'var(--surface2)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }}
            >
              <span style={{ fontSize: '32px', marginBottom: '8px' }}>📂</span>
              <strong>Drag & Drop Ledger CSV</strong>
              <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>or click to browse from device</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Or Paste CSV Text directly:</label>
              <textarea 
                style={{
                  flex: 1,
                  minHeight: '120px',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  resize: 'none',
                  outline: 'none'
                }}
                placeholder="Date,Account Name,Month,Opening Balance,Debit,Credit,Closing Balance,Notes&#10;2026-06-15,A1 Commercial,2026-06,50000,10000,0,60000,Delivered goods"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  processCSV(e.target.value);
                }}
              />
            </div>
          </div>

          {parsedRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px' }}>Validation Result Summary:</strong>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span className="badge badge-paid" style={{ fontSize: '10px' }}>{validCount} Ready</span>
                  {invalidCount > 0 && <span className="badge badge-overdue" style={{ fontSize: '10px' }}>{invalidCount} Errors</span>}
                </div>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Account Name</th>
                      <th style={{ padding: '8px' }}>Opening</th>
                      <th style={{ padding: '8px' }}>Dr / Cr</th>
                      <th style={{ padding: '8px' }}>Closing</th>
                      <th style={{ padding: '8px' }}>Details / Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: r.errors.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {r.errors.length > 0 ? '❌' : '✅'}
                        </td>
                        <td style={{ padding: '8px' }} className="mono">{r.timestamp}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{r.accountName || '—'}</td>
                        <td style={{ padding: '8px' }} className="mono">{fmtRs(r.openingBalance)}</td>
                        <td style={{ padding: '8px' }} className="mono">+{fmtRs(r.debit)} / -{fmtRs(r.credit)}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }} className="mono">{fmtRs(r.closingBalance)}</td>
                        <td style={{ padding: '8px', color: r.errors.length > 0 ? 'var(--red)' : 'var(--muted)' }}>
                          {r.errors.length > 0 ? r.errors.join('; ') : 'Ready to import'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="modal-ftr">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button 
            className="btn primary" 
            onClick={handleImport} 
            disabled={busy || validCount === 0}
          >
            {busy ? 'Importing…' : `Confirm Ingestion (${validCount} rows)`}
          </button>
        </div>
      </div>
      {busy && (
        <div className="global-waiting" style={{ position: 'absolute' }}>
          <div className="spinner"></div>
          <div className="waiting-text">INGESTING DATA...</div>
        </div>
      )}
    </div>
  );
}

// Generate the beautiful, structured plain-text ledger report
const generateTextReport = (partyObj: any, periodRows: any[]) => {
  const line = "=".repeat(70);
  const subLine = "-".repeat(70);
  let report = `${line}\n`;
  report += `               LEDGER ACCOUNT STATEMENT – CREDITFLOW PRO\n`;
  report += `${line}\n`;
  report += `Customer Account : ${partyObj.accountName}\n`;
  report += `Registered Email : ${partyObj.email || 'N/A'}\n`;
  report += `Contact Number   : ${partyObj.contactNo || 'N/A'}\n`;
  report += `Credit Limit     : ₹${(partyObj.creditLimit || 0).toLocaleString('en-IN')}\n`;
  report += `Credit Period    : ${partyObj.creditDays || '7 DAYS'}\n`;
  report += `Statement Date   : ${new Date().toLocaleDateString('en-IN')}\n`;
  report += `${line}\n\n`;

  report += `TRANSACTION HISTORY:\n`;
  report += `${subLine}\n`;
  report += `Date       | Transaction Details | Debit (+)   | Credit (-)  | Balance\n`;
  report += `${subLine}\n`;

  periodRows.forEach(r => {
    const db = Number(r['Debit (New Credit)']) || 0;
    const cr = Number(r['Credit (Payment)']) || 0;
    const cl = Number(r['Closing Balance']) || 0;
    const dateStr = r['Timestamp'] || '';
    const typeStr = db > 0 ? "Credit Sale" : "Payment    ";
    
    const dbStr = db > 0 ? `₹${db.toFixed(2)}` : '—';
    const crStr = cr > 0 ? `₹${cr.toFixed(2)}` : '—';
    const clStr = `₹${cl.toFixed(2)}`;
    
    report += `${dateStr.padEnd(10)} | ${typeStr.padEnd(19)} | ${dbStr.padEnd(11)} | ${crStr.padEnd(11)} | ${clStr}\n`;
    if (r['Notes']) {
      report += `           ↳ Notes: ${r['Notes']}\n`;
    }
  });

  report += `${subLine}\n\n`;
  
  const startingBal = periodRows[0]?.['Opening Balance'] || 0;
  const totalDebits = periodRows.reduce((sum, r) => sum + (Number(r['Debit (New Credit)']) || 0), 0);
  const totalCredits = periodRows.reduce((sum, r) => sum + (Number(r['Credit (Payment)']) || 0), 0);
  const endingBal = periodRows[periodRows.length - 1]?.['Closing Balance'] || startingBal;

  report += `SUMMARY ACCOUNT BALANCE:\n`;
  report += `Starting Balance : ₹${startingBal.toLocaleString('en-IN')}\n`;
  report += `Total Credit (+) : ₹${totalDebits.toLocaleString('en-IN')}\n`;
  report += `Total Paid (-)   : ₹${totalCredits.toLocaleString('en-IN')}\n`;
  report += `${subLine}\n`;
  report += `Outstanding Due  : ₹${endingBal.toLocaleString('en-IN')}\n`;
  report += `${line}\n`;
  report += `Generated automatically via CreditFlow PRO. For support, email support@creditflow.pro.`;
  
  return report;
};
