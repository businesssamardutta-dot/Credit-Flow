import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../lib/db';
import { statusBadge } from '../App';
import { fmtRs } from '../lib/utils';

export function PartiesPage({ parties, toast, refresh }: any) {
  const [modal, setModal] = useState<any>(null);
  const [filter, setFilter] = useState('');
  const [ledger, setLedger] = useState<any[]>([]);

  // Load ledger to compute dynamic recent transaction volume
  useEffect(() => {
    api.getLedger(null)
      .then(setLedger)
      .catch(err => console.warn('Could not load ledger inside PartiesPage:', err));
  }, []);

  const partyVolumes = useMemo(() => {
    const volumes: Record<string, number> = {};
    for (const entry of ledger) {
      const pId = entry['Party ID'] || '';
      const name = entry['Account Name'] || '';
      const debit = Number(entry['Debit (New Credit)']) || 0;
      const credit = Number(entry['Credit (Payment)']) || 0;
      const total = debit + credit;
      if (pId) {
        volumes[pId] = (volumes[pId] || 0) + total;
      }
      if (name) {
        volumes[name] = (volumes[name] || 0) + total;
      }
    }
    return volumes;
  }, [ledger]);

  const filtered = (parties || []).filter((p: any) => {
    const vol = partyVolumes[p.partyId] || partyVolumes[p.accountName] || 0;
    const searchVal = filter.toLowerCase().trim();
    if (!searchVal) return true;

    return (
      p.accountName?.toLowerCase().includes(searchVal) || 
      p.contactNo?.includes(searchVal) ||
      p.email?.toLowerCase().includes(searchVal) ||
      p.address?.toLowerCase().includes(searchVal) ||
      vol.toString().includes(searchVal) ||
      fmtRs(vol).toLowerCase().includes(searchVal)
    );
  });

  const del = async (id: string) => {
    if (!window.confirm('Delete this party?')) return;
    try { 
      await api.deleteParty(id); 
      toast('Deleted ✓', 'success'); 
      refresh(); 
    } catch (e: any) { 
      toast('Error: ' + e.message, 'error'); 
    }
  };

  return (
    <div>
      <div className="sec-hdr">
        <h2>Parties ({(parties || []).length})</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="search-input" placeholder="Search by name, contact, volume…" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: '280px' }} />
          <button className="btn" onClick={() => setModal('csv')}>📥 CSV Import</button>
          <button className="btn primary" onClick={() => setModal('add')}>+ Add Party</button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>SL</th>
              <th>Account Name</th>
              <th>Contact Details</th>
              <th>Credit Days</th>
              <th>Credit Limit</th>
              <th>Recent Vol</th>
              <th>Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => {
              const vol = partyVolumes[p.partyId] || partyVolumes[p.accountName] || 0;
              return (
                <tr key={p.partyId}>
                  <td className="mono">{p.slNo}</td>
                  <td style={{ fontWeight: 600 }}>{p.accountName}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="mono" style={{ fontSize: '12px' }}>{p.contactNo || '—'}</span>
                      {p.email && <span style={{ fontSize: '10px', color: 'var(--muted)' }}>✉ {p.email}</span>}
                    </div>
                  </td>
                  <td className="mono">{p.creditDays}</td>
                  <td className="mono">{p.creditLimit > 0 ? fmtRs(p.creditLimit) : '—'}</td>
                  <td className="mono" style={{ fontWeight: 600, color: vol > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                    {vol > 0 ? fmtRs(vol) : '—'}
                  </td>
                  <td>
                    <span className="mono">{p.score}</span>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: p.score + '%', background: p.score > 70 ? 'var(--green)' : p.score > 40 ? 'var(--yellow)' : 'var(--red)' }} />
                    </div>
                  </td>
                  <td>{statusBadge(p.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="act-btn edit" onClick={() => setModal(p)}>Edit</button>
                      <button className="act-btn del" onClick={() => del(p.partyId)}>Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {modal && modal !== 'csv' && modal !== 'add' && (
        <PartyModal 
          party={modal} 
          onClose={() => setModal(null)} 
          onSaved={() => { setModal(null); refresh(); toast('Updated ✓', 'success'); }} 
          toast={toast} 
        />
      )}
      
      {modal === 'add' && (
        <PartyModal 
          party={null} 
          onClose={() => setModal(null)} 
          onSaved={() => { setModal(null); refresh(); toast('Added ✓', 'success'); }} 
          toast={toast} 
        />
      )}

      {modal === 'csv' && (
        <CSVImportModal 
          onClose={() => setModal(null)} 
          onSaved={() => { setModal(null); refresh(); }} 
          toast={toast} 
        />
      )}
    </div>
  );
}

function PartyModal({ party, onClose, onSaved, toast }: any) {
  const [f, setF] = useState(party ? { slNo: party.slNo, accountName: party.accountName, contactNo: party.contactNo, address: party.address || '', email: party.email || '', creditLimit: party.creditLimit || 0, creditDays: party.creditDays || '7 DAYS', paymentMode: party.paymentMode || '' } : { slNo: '', accountName: '', contactNo: '', address: '', email: '', creditLimit: 0, creditDays: '7 DAYS', paymentMode: '' });
  const [busy, setBusy] = useState(false);
  const fc = (e: any) => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!f.accountName) { toast('Account name required', 'error'); return; }
    setBusy(true);
    try {
      if (party) await api.updateParty(party.partyId, f);
      else await api.addParty(f);
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
          <h2>{party ? 'Edit' : 'Add'} Party</h2>
          <button className="act-btn del" disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field"><label>SL No</label><input name="slNo" value={f.slNo} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Account Name *</label><input name="accountName" value={f.accountName} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Contact No</label><input name="contactNo" value={f.contactNo} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Email</label><input name="email" type="email" value={f.email} onChange={fc} disabled={busy} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Address</label><input name="address" value={f.address} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Credit Days</label><select name="creditDays" value={f.creditDays} onChange={fc} disabled={busy}><option>ADVANCE</option><option>3 DAYS</option><option>7 DAYS</option><option>15 DAYS</option><option>30 DAYS</option><option>45 DAYS</option></select></div>
            <div className="field"><label>Credit Limit (₹)</label><input name="creditLimit" type="number" value={f.creditLimit} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Payment Mode</label><select name="paymentMode" value={f.paymentMode} onChange={fc} disabled={busy}><option value="">Select…</option><option>Cash</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cheque</option></select></div>
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

const mapHeaders = (headers: string[]) => {
  const mapping: Record<string, number> = {};
  headers.forEach((h, idx) => {
    const val = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (val === 'sl' || val === 'slno') mapping['slNo'] = idx;
    else if (val === 'accountname' || val === 'name' || val === 'partyname' || val === 'account') mapping['accountName'] = idx;
    else if (val === 'contactno' || val === 'contact' || val === 'phone' || val === 'phoneno' || val === 'mobile') mapping['contactNo'] = idx;
    else if (val === 'email' || val === 'emailaddress') mapping['email'] = idx;
    else if (val === 'address' || val === 'location') mapping['address'] = idx;
    else if (val === 'creditlimit' || val === 'limit') mapping['creditLimit'] = idx;
    else if (val === 'creditdays' || val === 'days') mapping['creditDays'] = idx;
    else if (val === 'paymentmode' || val === 'mode') mapping['paymentMode'] = idx;
  });
  return mapping;
};

function CSVImportModal({ onClose, onSaved, toast }: any) {
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
      const mapping = mapHeaders(rawHeaders);
      
      const validated = rows.slice(1).map((row) => {
        const item: any = {
          slNo: mapping['slNo'] !== undefined ? row[mapping['slNo']] : '',
          accountName: mapping['accountName'] !== undefined ? row[mapping['accountName']] : '',
          contactNo: mapping['contactNo'] !== undefined ? row[mapping['contactNo']] : '',
          email: mapping['email'] !== undefined ? row[mapping['email']] : '',
          address: mapping['address'] !== undefined ? row[mapping['address']] : '',
          creditLimit: mapping['creditLimit'] !== undefined ? parseFloat(row[mapping['creditLimit']]?.replace(/[^\d.]/g, '')) || 0 : 0,
          creditDays: mapping['creditDays'] !== undefined ? row[mapping['creditDays']]?.toUpperCase()?.trim() : '7 DAYS',
          paymentMode: mapping['paymentMode'] !== undefined ? row[mapping['paymentMode']]?.trim() : '',
          errors: [] as string[]
        };

        if (!item.accountName) {
          item.errors.push('Account Name is required');
        }
        if (isNaN(item.creditLimit) || item.creditLimit < 0) {
          item.errors.push('Credit Limit must be a non-negative number');
        }
        const allowedDays = ['ADVANCE', '3 DAYS', '7 DAYS', '15 DAYS', '30 DAYS', '45 DAYS'];
        if (item.creditDays && !allowedDays.includes(item.creditDays)) {
          if (item.creditDays.includes('3')) item.creditDays = '3 DAYS';
          else if (item.creditDays.includes('7')) item.creditDays = '7 DAYS';
          else if (item.creditDays.includes('15')) item.creditDays = '15 DAYS';
          else if (item.creditDays.includes('30')) item.creditDays = '30 DAYS';
          else if (item.creditDays.includes('45')) item.creditDays = '45 DAYS';
          else if (item.creditDays.includes('ADV')) item.creditDays = 'ADVANCE';
          else item.creditDays = '7 DAYS';
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
      await api.addPartiesBulk(validRows);
      toast(`Successfully imported ${validRows.length} parties!`, 'success');
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
      <div className="modal" style={{ maxWidth: '800px', width: '100%' }}>
        <div className="modal-hdr">
          <h2>Bulk Party CSV Import</h2>
          <button className="act-btn del" disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '12px', background: 'var(--surface2)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <strong>Expected Columns (Any order, case-insensitive):</strong><br/>
            <code>SL NO, Account Name, Contact No, Email, Address, Credit Limit, Credit Days, Payment Mode</code>
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
              <strong>Drag & Drop CSV</strong>
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
                placeholder="SL NO,Account Name,Contact No,Credit Limit&#10;1,A1 Commercial,9876543210,500000"
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
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Account Name</th>
                      <th style={{ padding: '8px' }}>Credit Limit</th>
                      <th style={{ padding: '8px' }}>Credit Days</th>
                      <th style={{ padding: '8px' }}>Details / Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: r.errors.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {r.errors.length > 0 ? '❌' : '✅'}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{r.accountName || '—'}</td>
                        <td style={{ padding: '8px' }} className="mono">{fmtRs(r.creditLimit)}</td>
                        <td style={{ padding: '8px' }} className="mono">{r.creditDays}</td>
                        <td style={{ padding: '8px', color: r.errors.length > 0 ? 'var(--red)' : 'var(--muted)' }}>
                          {r.errors.length > 0 ? r.errors.join(', ') : 'Ready to import'}
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
