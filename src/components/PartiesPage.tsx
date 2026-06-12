import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../lib/db';
import { statusBadge } from '../App';
import { fmtRs } from '../lib/utils';


export function PartiesPage({ parties, toast, refresh }: any) {
  const [modal, setModal] = useState<any>(null);
  const [filter, setFilter] = useState('');

  const filtered = (parties || []).filter((p: any) => !filter || p.accountName?.toLowerCase().includes(filter.toLowerCase()) || p.contactNo?.includes(filter));

  const del = async (id: string) => {
    if (!window.confirm('Delete this party?')) return;
    try { await api.deleteParty(id); toast('Deleted ✓', 'success'); refresh(); }
    catch (e: any) { toast('Error: ' + e.message, 'error'); }
  };

  return (
    <div>
      <div className="sec-hdr"><h2>Parties ({(parties || []).length})</h2><div style={{ display: 'flex', gap: 10 }}><input className="search-input" placeholder="Search…" value={filter} onChange={e => setFilter(e.target.value)} /><button className="btn primary" onClick={() => setModal('add')}>+ Add Party</button></div></div>
      <div className="tbl-wrap"><table><thead><tr><th>SL</th><th>Account Name</th><th>Contact</th><th>Credit Days</th><th>Credit Limit</th><th>Score</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{filtered.map((p: any) => (<tr key={p.partyId}><td className="mono">{p.slNo}</td><td style={{ fontWeight: 600 }}>{p.accountName}</td><td className="mono">{p.contactNo}</td><td className="mono">{p.creditDays}</td><td className="mono">{p.creditLimit > 0 ? fmtRs(p.creditLimit) : '—'}</td><td><span className="mono">{p.score}</span><div className="score-bar"><div className="score-fill" style={{ width: p.score + '%', background: p.score > 70 ? 'var(--green)' : p.score > 40 ? 'var(--yellow)' : 'var(--red)' }} /></div></td><td>{statusBadge(p.status)}</td><td><div style={{ display: 'flex', gap: 4 }}><button className="act-btn edit" onClick={() => setModal(p)}>Edit</button><button className="act-btn del" onClick={() => del(p.partyId)}>Del</button></div></td></tr>))}</tbody>
      </table></div>
      {modal && <PartyModal party={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); toast((modal === 'add' ? 'Added' : 'Updated') + ' ✓', 'success'); }} toast={toast} />}
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
    } catch (e: any) { toast('Error: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr"><h2>{party ? 'Edit' : 'Add'} Party</h2><button className="act-btn del" disabled={busy} onClick={onClose}>✕</button></div>
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
