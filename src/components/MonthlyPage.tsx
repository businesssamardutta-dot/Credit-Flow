import React, { useState, useEffect } from 'react';
import * as api from '../lib/db';
import { fmtRs, mkLabel } from '../lib/utils';
import { statusBadge } from '../App';

export function MonthlyPage({ months, parties, toast, currentMonth }: any) {
  const [sel, setSel] = useState(currentMonth || months[months.length - 1] || '');
  const [data, setData] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditModal, setCreditModal] = useState<any>(null);
  const [payModal, setPayModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);

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
    } catch (e: any) { toast('Error: ' + e.message, 'error'); }
    finally { setIsProcessing(false); }
  };

  const handleSyncLedger = async () => {
    if (!window.confirm(`Auto-fix and sync ${sel} balances from Ledger?`)) return;
    setIsProcessing(true);
    try {
      const ledger = await api.getLedger(sel);
      
      // Sort ledger chronologically (oldest first) so the first entry provides true Opening Balance
      const sortedLedger = [...ledger].sort((a: any, b: any) => new Date(a['Timestamp']).getTime() - new Date(b['Timestamp']).getTime());
      
      const partyData: Record<string, { op: number, cred: number, paid: number }> = {};
      
      sortedLedger.forEach((l: any) => {
        const pid = String(l['Party ID']);
        if (!partyData[pid]) {
          partyData[pid] = { op: Number(l['Opening Balance']) || 0, cred: 0, paid: 0 };
        }
        partyData[pid].cred += Number(l['Debit (New Credit)']) || Number(l['Debit (Credit)']) || Number(l['Debit']) || 0;
        partyData[pid].paid += Number(l['Credit (Payment)']) || Number(l['Credit']) || 0;
      });

      let updated = 0;
      for (const row of data) {
        const pid = String(row['Party ID']);
        if (partyData[pid]) {
          const pd = partyData[pid];
          // Check if it's different and needs sync
          if (row['Opening Balance'] !== pd.op || row['New Credit'] !== pd.cred || row['Paid Amount'] !== pd.paid) {
            await api.updateMonthRow(sel, row['Row ID'], {
              openingBalance: pd.op,
              newCredit: pd.cred,
              paidAmount: pd.paid
            });
            updated++;
          }
        }
      }
      toast(`Synced ${updated} rows from ledger successfully`, 'success');
      reload();
    } catch (e: any) {
      toast('Error syncing: ' + e.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

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
        {months.slice().reverse().map((m: string) => (<div key={m} className={`mtab ${sel === m ? 'active' : ''}`} onClick={() => setSel(m)}>{mkLabel(m)}{m === currentMonth ? ' ●' : ''}</div>))}
      </div>
      {data.length > 0 && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 18 }}>
          {[{ label: 'Opening', val: fmtRs(totals.op), col: '#475569' }, { label: 'New Credit', val: fmtRs(totals.tc), col: '#7c3aed' }, { label: 'Total Debt', val: fmtRs(totals.td), col: '#1a6fbb' }, { label: 'Collected', val: fmtRs(totals.tp), col: '#059669' }, { label: 'Balance Due', val: fmtRs(totals.tb), col: '#dc2626' }].map(k => (
            <div key={k.label} className="kpi" style={{ '--kpi-accent': k.col } as any}><div className="kpi-label">{k.label}</div><div className="kpi-val" style={{ fontSize: 16 }}>{k.val}</div></div>
          ))}
        </div>
      )}
      {busy ? <div className="loading">Loading…</div> : data.length === 0 ? <div className="empty">No data for this month</div> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Account</th><th>Contact</th><th>Opening</th><th>New Credit</th><th>Total Debt</th><th>Paid</th><th>Balance</th><th>Credit Days</th><th>Invoice Date</th><th>Target Date</th><th>Last Paid</th><th>Status</th><th>Score</th><th>Overdue</th><th>Actions</th></tr></thead>
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
                  <td><span className="mono">{r['Score'] || 50}</span><div className="score-bar"><div className="score-fill" style={{ width: (r['Score'] || 50) + '%', background: r['Score'] > 70 ? 'var(--green)' : r['Score'] > 40 ? 'var(--yellow)' : 'var(--red)' }} /></div></td>
                  <td className="mono" style={{ color: (r['Overdue Days'] || 0) > 0 ? 'var(--red)' : 'var(--muted)' }}>{(r['Overdue Days'] || 0) > 0 ? r['Overdue Days'] + 'd' : '—'}</td>
                  <td><div style={{ display: 'flex', gap: 4 }}>
                    <button className="act-btn edit" onClick={() => setEditModal(r)}>✎ Edit</button>
                    <button className="act-btn credit" onClick={() => setCreditModal(r)}>+ Credit</button>
                    <button className="act-btn pay" onClick={() => setPayModal(r)}>₹ Pay</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creditModal && <CreditModal row={creditModal} mk={sel} onClose={() => setCreditModal(null)} onSaved={() => { setCreditModal(null); reload(); toast('Credit added ✓', 'success'); }} toast={toast} />}
      {payModal && <PayModal row={payModal} mk={sel} onClose={() => setPayModal(null)} onSaved={() => { setPayModal(null); reload(); toast('Payment recorded ✓', 'success'); }} toast={toast} />}
      {editModal && <EditModal row={editModal} mk={sel} onClose={() => setEditModal(null)} onSaved={() => { setEditModal(null); reload(); toast('Row updated ✓', 'success'); }} toast={toast} />}
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
    }
    catch (e: any) { toast('Error: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr"><h2>✎ Edit Row — {row['Account Name']}</h2><button className="act-btn del" disabled={busy} onClick={onClose}>✕</button></div>
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
        <div className="modal-ftr"><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
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
  const [amount, setAmount] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => { if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { toast('Enter valid amount', 'error'); return; } setBusy(true); try { await api.addCredit(row['Party ID'], Number(amount), notes, mk); onSaved(); } catch (e: any) { toast('Error: ' + e.message, 'error'); } finally { setBusy(false); } };
  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr"><h2>+ New Credit — {row['Account Name']}</h2><button className="act-btn del" disabled={busy} onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="info-box">Balance: <strong>{fmtRs(row['Balance'])}</strong> · Credit Days: <strong>{row['Credit Days']}</strong> · Month: <strong style={{ color: 'var(--accent)' }}>{mk}</strong></div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field"><label>Credit Amount (₹)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount…" disabled={busy} /></div>
            <div className="field"><label>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional…" disabled={busy} /></div>
          </div>
        </div>
        <div className="modal-ftr"><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : '+ Add Credit'}</button></div>
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
  const save = async () => { if (!f.amount || isNaN(Number(f.amount)) || Number(f.amount) <= 0) { toast('Enter valid amount', 'error'); return; } setBusy(true); try { await api.recordPayment(row['Party ID'], Number(f.amount), f.method, f.reference, f.notes, mk); onSaved(); } catch (e: any) { toast('Error: ' + e.message, 'error'); } finally { setBusy(false); } };
  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr"><h2>₹ Record Payment — {row['Account Name']}</h2><button className="act-btn del" disabled={busy} onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="info-box">Outstanding: <strong style={{ color: 'var(--red)' }}>{fmtRs(row['Balance'])}</strong> · Due: <strong>{row['Target Date'] || '—'}</strong></div>
          <div className="form-grid">
            <div className="field"><label>Amount (₹)</label><input name="amount" type="number" value={f.amount} onChange={fc} placeholder="Enter amount…" disabled={busy} /></div>
            <div className="field"><label>Method</label><select name="method" value={f.method} onChange={fc} disabled={busy}><option>Cash</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cheque</option><option>DD</option></select></div>
            <div className="field"><label>Reference / UTR</label><input name="reference" value={f.reference} onChange={fc} placeholder="Optional…" disabled={busy} /></div>
            <div className="field"><label>Notes</label><input name="notes" value={f.notes} onChange={fc} placeholder="Optional…" disabled={busy} /></div>
          </div>
        </div>
        <div className="modal-ftr"><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : '₹ Record'}</button></div>
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
