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

export function ContactsPage({ parties, toast }: any) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const load = () => api.getContacts().then(r => setContacts(r || []));
  
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!window.confirm('Delete?')) return;
    try { await api.deleteContact(id); toast('Deleted ✓', 'success'); load(); }
    catch (e: any) { toast('Error: ' + e.message, 'error'); }
  };
  const pName = (pid: string) => (parties || []).find((p: any) => p.partyId === pid)?.accountName || '—';

  return (
    <div>
      <div className="sec-hdr"><h2>Contacts ({contacts.length})</h2><button className="btn primary" onClick={() => setModal(true)}>+ Add Contact</button></div>
      <div className="tbl-wrap"><table><thead><tr><th>Name</th><th>Party</th><th>Phone</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>{contacts.map((c: any) => (<tr key={c['Contact ID']}><td style={{ fontWeight: 600 }}>{c['Name']}</td><td style={{ color: 'var(--muted)', fontSize: 12 }}>{pName(c['Party ID'])}</td><td className="mono">{c['Phone']}</td><td className="mono" style={{ fontSize: 11 }}>{c['Email']}</td><td><span className="badge badge-active">{c['Role'] || '—'}</span></td><td><button className="act-btn del" onClick={() => del(c['Contact ID'])}>Del</button></td></tr>))}</tbody>
      </table></div>
      {modal && <ContactModal parties={parties} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); toast('Added ✓', 'success'); }} toast={toast} />}
    </div>
  );
}

function ContactModal({ parties, onClose, onSaved, toast }: any) {
  const [f, setF] = useState({ partyId: '', name: '', phone: '', email: '', role: '' });
  const [busy, setBusy] = useState(false);
  const fc = (e: any) => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!f.name) { toast('Name required', 'error'); return; }
    setBusy(true);
    try { await api.addContact(f); onSaved(); }
    catch (e: any) { toast('Error: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr"><h2>Add Contact</h2><button className="act-btn del" disabled={busy} onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Party</label><select name="partyId" value={f.partyId} onChange={fc} disabled={busy}><option value="">Select…</option>{(parties || []).map((p: any) => <option key={p.partyId} value={p.partyId}>{p.accountName}</option>)}</select></div>
            <div className="field"><label>Name *</label><input name="name" value={f.name} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Role</label><input name="role" value={f.role} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Phone</label><input name="phone" value={f.phone} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Email</label><input name="email" type="email" value={f.email} onChange={fc} disabled={busy} /></div>
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

export function TasksPage({ parties, toast }: any) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  
  const load = () => api.getTasks().then(r => setTasks(r || []));
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!window.confirm('Delete?')) return;
    try { await api.deleteTask(id); toast('Deleted ✓', 'success'); load(); }
    catch (e: any) { toast('Error: ' + e.message, 'error'); }
  };

  const chgStatus = async (id: string, st: string) => {
    try { await api.updateTask(id, { status: st }); load(); toast('Updated ✓', 'success'); }
    catch (e: any) { toast('Error: ' + e.message, 'error'); }
  };

  const pName = (pid: string) => (parties || []).find((p: any) => p.partyId === pid)?.accountName || '—';

  return (
    <div>
      <div className="sec-hdr"><h2>Tasks ({tasks.length})</h2><button className="btn primary" onClick={() => setModal(true)}>+ Add Task</button></div>
      <div className="tbl-wrap"><table><thead><tr><th>Title</th><th>Party</th><th>Due</th><th>Assignee</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{tasks.map((t: any) => (<tr key={t['Task ID']}><td style={{ fontWeight: 600 }}>{t['Title']}</td><td style={{ color: 'var(--muted)', fontSize: 12 }}>{pName(t['Party ID'])}</td><td className="mono">{t['Target Date'] || '—'}</td><td style={{ fontSize: 12 }}>{t['Assigned To'] || '—'}</td>
          <td><select value={t['Status']} onChange={e => chgStatus(t['Task ID'], e.target.value)} style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', color: 'var(--text)', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}><option>Pending</option><option>In-Progress</option><option>Done</option></select></td>
          <td><button className="act-btn del" onClick={() => del(t['Task ID'])}>Del</button></td></tr>))}</tbody>
      </table></div>
      {modal && <TaskModal parties={parties} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); toast('Added ✓', 'success'); }} toast={toast} />}
    </div>
  );
}

function TaskModal({ parties, onClose, onSaved, toast }: any) {
  const [f, setF] = useState({ partyId: '', title: '', description: '', dueDate: '', assignedTo: '', status: 'Pending' });
  const [busy, setBusy] = useState(false);
  const fc = (e: any) => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!f.title) { toast('Title required', 'error'); return; }
    setBusy(true);
    try { await api.addTask(f); onSaved(); }
    catch (e: any) { toast('Error: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e => !busy && e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr"><h2>Add Task</h2><button className="act-btn del" disabled={busy} onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Party</label><select name="partyId" value={f.partyId} onChange={fc} disabled={busy}><option value="">Select…</option>{(parties || []).map((p: any) => <option key={p.partyId} value={p.partyId}>{p.accountName}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Title *</label><input name="title" value={f.title} onChange={fc} disabled={busy} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Description</label><input name="description" value={f.description} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Target Date</label><input name="dueDate" type="date" value={f.dueDate} onChange={fc} disabled={busy} /></div>
            <div className="field"><label>Assignee</label><input name="assignedTo" value={f.assignedTo} onChange={fc} placeholder="email" disabled={busy} /></div>
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
