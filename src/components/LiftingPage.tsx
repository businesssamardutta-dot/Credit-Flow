import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../lib/db';
import { statusBadge } from '../App';
import { fmt, mkLabel } from '../lib/utils';

export function LiftingPage({ parties, toast, currentMonth }: any) {
  const [liftingMonths, setLiftingMonths] = useState<string[]>([]);
  const [sel, setSel] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [view, setView] = useState('cards');
  const [q, setQ] = useState('');
  const [targetModal, setTargetModal] = useState<any>(null);
  const [deliverModal, setDeliverModal] = useState<any>(null);
  const [historyModal, setHistoryModal] = useState<any>(null);

  useEffect(() => {
    setLoadingMonths(true);
    api.listLiftingMonths()
      .then(months => {
        const sorted = (months || []).sort();
        setLiftingMonths(sorted);
        if (sorted.length > 0) {
          const def = sorted.includes(currentMonth) ? currentMonth : sorted[sorted.length - 1];
          setSel(def);
        }
      })
      .catch((e: any) => toast('Cannot load lifting months: ' + e.message, 'error'))
      .finally(() => setLoadingMonths(false));
  }, [currentMonth, toast]);

  useEffect(() => {
    if (!sel) return;
    loadData(sel);
  }, [sel]);

  const loadData = (monthKey: string) => {
    setBusy(true);
    api.getLiftingData(monthKey)
      .then(rows => {
        const d = rows || [];
        setData(d);
        computeKpis(d);
      })
      .catch((e: any) => { toast('Error loading lifting data: ' + e.message, 'error'); setData([]); setKpis(null); })
      .finally(() => setBusy(false));
  };

  const computeKpis = (d: any[]) => {
    const withT = d.filter(r => Number(r['Target Quantity (kg)']) > 0);
    setKpis({
      totalParties: d.length,
      withTarget: withT.length,
      completed: d.filter(r => r['Status'] === 'COMPLETED').length,
      inProgress: d.filter(r => r['Status'] === 'IN PROGRESS').length,
      notStarted: d.filter(r => r['Status'] === 'NOT STARTED').length,
      noTarget: d.filter(r => r['Status'] === 'NO TARGET').length,
      totalTarget: d.reduce((s, r) => s + Number(r['Target Quantity (kg)']), 0),
      totalDelivered: d.reduce((s, r) => s + Number(r['Delivered Quantity (kg)']), 0),
      totalRemaining: d.reduce((s, r) => s + Number(r['Remaining (kg)']), 0),
      avgCompletion: withT.length > 0 ? Math.round(withT.reduce((s, r) => s + Number(r['Completion %']), 0) / withT.length) : 0,
    });
  };

  const reload = () => loadData(sel);

  const handleCarryForward = async () => {
    if (!sel) return;
    if (!window.confirm(`Carry forward lifting targets from the previous month to ${mkLabel(sel)}? This will apply targets, days, and frequencies from the last month for any accounts currently set with 'NO TARGET'.`)) return;
    setBusy(true);
    try {
      try {
        const res = await api.carryForwardLiftingTargets(sel);
        if (res && res.updated > 0) {
          toast(`Successfully carried forward targets for ${res.updated} account(s)!`, 'success');
          reload();
        } else {
          toast(`No unassigned accounts found to carry forward, or previous month targets matched current targets.`, 'info');
        }
      } catch (srvError: any) {
        console.warn('Backend carryForwardLiftingTargets failed or is not updated yet. Running robust client-side fallback...', srvError.message);
        
        // 1. Calculate previous month key
        const parts = sel.split('-');
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10);
        const prevDate = new Date(yr, mo - 2, 1);
        const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        
        // 2. Fetch previous month data and current month data
        const [prevData, curData] = await Promise.all([
          api.getLiftingData(prevMonthKey).catch(() => []),
          api.getLiftingData(sel)
        ]);
        
        if (!prevData || prevData.length === 0) {
          throw new Error(`Could not find previous month's (${prevMonthKey}) targets or previous sheet has no data.`);
        }
        
        // Create map of previous month's target by Party ID
        const prevMap: Record<string, any> = {};
        prevData.forEach((r: any) => {
          const pId = String(r['Party ID'] || '').trim();
          if (pId) {
            prevMap[pId] = {
              target: Number(r['Target Quantity (kg)']) || 0,
              frequency: r['Delivery Frequency'] || 'Weekly',
              day: r['Preferred Day'] || 'Monday'
            };
          }
        });
        
        // Filter current rows that have status === 'NO TARGET' or target === 0
        const unassigned = curData.filter((r: any) => {
          const currentTarget = Number(r['Target Quantity (kg)']) || 0;
          const currentStatus = String(r['Status'] || '');
          return currentTarget === 0 || currentStatus === 'NO TARGET';
        });
        
        if (unassigned.length === 0) {
          toast(`No unassigned accounts ('NO TARGET') found to carry forward in the current month.`, 'info');
          setBusy(false);
          return;
        }
        
        let updateCount = 0;
        // Loop through and update unassigned accounts that have historical target in prevMap
        for (const r of unassigned) {
          const pId = String(r['Party ID'] || '').trim();
          const prevRow = prevMap[pId];
          if (prevRow && prevRow.target > 0) {
            const rowId = r['Row ID'];
            await api.updateLiftingTarget(sel, rowId, {
              targetQuantity: prevRow.target,
              deliveryFrequency: prevRow.frequency,
              preferredDay: prevRow.day
            });
            updateCount++;
          }
        }
        
        if (updateCount > 0) {
          toast(`Successfully carried forward targets for ${updateCount} account(s)!`, 'success');
          reload();
        } else {
          toast(`No historical targets found in the previous month for the currently unassigned accounts.`, 'info');
        }
      }
    } catch (e: any) {
      toast('Error carrying forward targets: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async (row: any) => {
    if (!window.confirm(`Complete target for ${row['Account Name']}? This will set delivered = target.`)) return;
    setBusy(true);
    try {
      await api.completeLiftingTarget(sel, row['Row ID']);
      toast('Target completed ✓', 'success');
      reload();
    } catch (e: any) { toast('Error: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const handleNewTarget = async (row: any) => {
    if (!window.confirm(`Reset deliveries to 0 for ${row['Account Name']}? You can then set a new target.`)) return;
    setBusy(true);
    try {
      await api.resetLiftingDeliveries(sel, row['Row ID']);
      toast('Deliveries reset. Set a new target.', 'success');
      const updatedRow = { ...row, 'Delivered Quantity (kg)': 0, 'Remaining (kg)': row['Target Quantity (kg)'], 'Completion %': 0, 'Status': 'NOT STARTED' };
      setTargetModal(updatedRow);
      reload();
    } catch (e: any) { toast('Error: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => {
    if (!q) return data;
    const lq = q.toLowerCase();
    return data.filter(r =>
      String(r['Account Name'] || '').toLowerCase().includes(lq) ||
      String(r['Contact No'] || '').includes(lq) ||
      String(r['Status'] || '').toLowerCase().includes(lq)
    );
  }, [data, q]);

  if (loadingMonths) return <div className="loading">⟳ Loading lifting sheets…</div>;

  const kpiDefs = kpis ? [
    { label: 'Total Parties', val: kpis.totalParties, col: '#475569' },
    { label: 'With Target', val: kpis.withTarget, col: '#1a6fbb' },
    { label: 'Completed', val: kpis.completed, col: '#059669' },
    { label: 'In Progress', val: kpis.inProgress, col: '#0e7490' },
    { label: 'Not Started', val: kpis.notStarted, col: '#64748b' },
    { label: 'No Target', val: kpis.noTarget, col: '#d97706' },
    { label: 'Total Target', val: fmt(kpis.totalTarget) + ' kg', col: '#7c3aed' },
    { label: 'Delivered', val: fmt(kpis.totalDelivered) + ' kg', col: '#16a34a' },
    { label: 'Remaining', val: fmt(kpis.totalRemaining) + ' kg', col: '#dc2626' },
    { label: 'Avg Completion', val: kpis.avgCompletion + '%', col: '#ea580c' },
  ] : [];

  return (
    <div>
      <div className="sec-hdr">
        <h2>Goods Lifting Tracker</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn sm" 
            disabled={busy} 
            onClick={handleCarryForward} 
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', marginRight: 6, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            📥 Carry Forward Targets
          </button>
          <input className="search-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search party…" style={{ width: 170 }} />
          <button className={`btn sm ${view === 'cards' ? 'primary' : ''}`} onClick={() => setView('cards')}>⊞ Cards</button>
          <button className={`btn sm ${view === 'table' ? 'primary' : ''}`} onClick={() => setView('table')}>≡ Table</button>
        </div>
      </div>

      <div className="month-tabs">
        {liftingMonths.slice().reverse().map(m => (
          <div key={m} className={`mtab ${sel === m ? 'active' : ''}`} onClick={() => setSel(m)}>
            {mkLabel(m)}{m === currentMonth ? ' ●' : ''}
          </div>
        ))}
      </div>

      {kpis && kpis.withTarget === 0 && kpis.totalParties > 0 && !busy && (
        <div className="card" style={{ padding: '12px 16px', background: 'rgba(124, 45, 18, 0.05)', borderColor: 'rgba(124, 45, 18, 0.2)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>💡</span>
            <span style={{ fontSize: '13px' }}>
              No targets are configured for <strong>{mkLabel(sel)}</strong> yet. Tap <strong>Carry Forward Targets</strong> to automatically copy previous targets.
            </span>
          </div>
          <button className="btn sm primary" onClick={handleCarryForward} disabled={busy}>
            Carry Forward Now
          </button>
        </div>
      )}

      {kpis && !busy && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(145px,1fr))', marginBottom: 18 }}>
          {kpiDefs.map(k => (
            <div key={k.label} className="kpi" style={{ '--kpi-accent': k.col } as any}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-val" style={{ fontSize: 18 }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {busy ? (
        <div className="loading">⟳ Loading {mkLabel(sel)}…</div>
      ) : data.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
          <strong>No lifting data for {mkLabel(sel)}</strong>
        </div>
      ) : view === 'cards' ? (
        <div className="lifting-grid">
          {filtered.map((r, i) => {
            const tgt = Number(r['Target Quantity (kg)']) || 0;
            const dlv = Number(r['Delivered Quantity (kg)']) || 0;
            const rem = Number(r['Remaining (kg)']) || 0;
            const pct = Number(r['Completion %']) || 0;
            const hasTgt = tgt > 0;
            const pc = pct >= 100 ? 'var(--green)' : pct >= 50 ? '#0e7490' : pct > 0 ? 'var(--yellow)' : 'var(--border2)';
            return (
              <div key={i} className={`lpc ${!hasTgt ? 'no-target' : ''}`}>
                <div className="lpc-top">
                  <div>
                    <div className="lpc-name">{r['Account Name']}</div>
                    <div className="lpc-contact">{r['Contact No'] || '—'}</div>
                  </div>
                  {statusBadge(r['Status'])}
                </div>

                {hasTgt ? <>
                  <div className="lpc-nums">
                    <div className="lpc-num"><div className="lpc-num-lbl">Target</div><div className="lpc-num-val" style={{ color: 'var(--accent)' }}>{fmt(tgt)}</div><div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>kg</div></div>
                    <div className="lpc-num"><div className="lpc-num-lbl">Delivered</div><div className="lpc-num-val" style={{ color: 'var(--green)' }}>{fmt(dlv)}</div><div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>kg</div></div>
                    <div className="lpc-num"><div className="lpc-num-lbl">Remaining</div><div className="lpc-num-val" style={{ color: rem > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(rem)}</div><div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>kg</div></div>
                  </div>
                  <div style={{ margin: '8px 0 10px' }}>
                    <div className="lpc-bar-row">
                      <span className="lpc-bar-lbl">{r['Delivery Frequency'] || 'Weekly'} · {r['Preferred Day'] || 'Monday'}</span>
                      <span className="lpc-bar-pct" style={{ color: pc }}>{pct}%</span>
                    </div>
                    <div className="prog-bar" style={{ width: '100%', height: 8 }}><div className="prog-fill" style={{ width: Math.min(pct, 100) + '%', background: pc }} /></div>
                  </div>
                </> : <div style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0', fontStyle: 'italic' }}>No target set for this month. Click "Set Target" to add one.</div>}

                <div className="lpc-actions">
                  <button className="act-btn edit" onClick={() => setTargetModal(r)}>✎ Set Target</button>
                  {hasTgt && (
                    <>
                      <button className="act-btn deliver" onClick={() => setDeliverModal(r)}>📦 Deliver</button>
                      <button className="act-btn" style={{ color: 'var(--green)' }} onClick={() => handleComplete(r)}>✓ Complete</button>
                      <button className="act-btn" style={{ color: 'var(--accent)' }} onClick={() => handleNewTarget(r)}>⟳ New Target</button>
                    </>
                  )}
                  <button className="act-btn" onClick={() => setHistoryModal(r)}>📜 History</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tbl-wrap">
          {/* Implement table view mapping similarly. */}
          <table>
             <thead>
              <tr>
                <th>Account</th><th>Contact</th><th>Target (kg)</th><th>Delivered (kg)</th>
                <th>Remaining (kg)</th><th>Completion</th><th>Frequency</th><th>Pref. Day</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r,i) => {
                 const pct=Number(r['Completion %'])||0;
                 const pc=pct>=100?'#16a34a':pct>=50?'#0e7490':pct>0?'#f59e0b':'#cbd5e1';
                 const hasTgt = Number(r['Target Quantity (kg)'])>0;
                 return (
                   <tr key={i}>
                     <td style={{fontWeight:600}}>{r['Account Name']}</td>
                     <td className="mono" style={{fontSize:11}}>{r['Contact No']||'—'}</td>
                     <td className="mono" style={{color:'var(--accent)',fontWeight:600}}>{fmt(Number(r['Target Quantity (kg)']))}</td>
                     <td className="mono" style={{color:'var(--green)',fontWeight:700}}>{fmt(Number(r['Delivered Quantity (kg)']))}</td>
                     <td className="mono" style={{color:Number(r['Remaining (kg)'])>0?'var(--red)':'var(--muted)'}}>{fmt(Number(r['Remaining (kg)']))}</td>
                     <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span className="mono" style={{fontWeight:600,minWidth:35}}>{pct}%</span>
                        <div className="prog-bar" style={{width:80}}>
                          <div className="prog-fill" style={{width:Math.min(pct,100)+'%',background:pc}}/>
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{fontSize:11}}>{r['Delivery Frequency']||'—'}</td>
                    <td className="mono" style={{fontSize:11}}>{r['Preferred Day']||'—'}</td>
                    <td>{statusBadge(r['Status'])}</td>
                    <td>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        <button className="act-btn edit" onClick={()=>setTargetModal(r)}>✎ Target</button>
                        {hasTgt && <button className="act-btn deliver" onClick={()=>setDeliverModal(r)}>📦 Deliver</button>}
                        {hasTgt && <button className="act-btn" style={{color:'var(--green)'}} onClick={()=>handleComplete(r)}>✓ Complete</button>}
                        <button className="act-btn" onClick={()=>setHistoryModal(r)}>📜 History</button>
                      </div>
                    </td>
                   </tr>
                 )
              })}
            </tbody>
          </table>
        </div>
      )}

      {targetModal && <TargetModal row={targetModal} mk={sel} onClose={() => setTargetModal(null)} onSaved={() => { setTargetModal(null); reload(); toast('Target updated ✓', 'success'); }} toast={toast} />}
      {deliverModal && <DeliverModal row={deliverModal} mk={sel} onClose={() => setDeliverModal(null)} onSaved={() => { setDeliverModal(null); reload(); toast('Delivery recorded ✓', 'success'); }} toast={toast} />}
      {historyModal && <HistoryModal row={historyModal} mk={sel} onClose={() => setHistoryModal(null)} toast={toast} />}
    </div>
  );
}

// Additional components for Lifting flow (TargetModal, DeliverModal, HistoryModal, LiftingSchedulePage, LiftingLedgerPage)

function TargetModal({row,mk,onClose,onSaved,toast}:any){
  const [target,setTarget] = useState(Number(row['Target Quantity (kg)'])||0);
  const [freq,setFreq]     = useState(row['Delivery Frequency']||'Weekly');
  const [day,setDay]       = useState(row['Preferred Day']||'Monday');
  const [busy,setBusy]     = useState(false);

  const save = async()=>{
    if(Number(target)<0){ toast('Target must be ≥ 0','error'); return; }
    setBusy(true);
    try{
      await api.updateLiftingTarget(mk,row['Row ID'],{ targetQuantity:Number(target), deliveryFrequency:freq, preferredDay:day });
      onSaved();
    }catch(e:any){ toast('Error: '+e.message,'error'); }
    finally{ setBusy(false); }
  };

  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e=>!busy && e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h2>✎ Set Target — {row['Account Name']}</h2>
          <button className="act-btn del" disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field">
              <label>Monthly Target (kg)</label>
              <input type="number" min="0" value={target} onChange={e=>setTarget(e.target.value)} placeholder="Enter kg…" disabled={busy} />
            </div>
            <div className="field">
              <label>Delivery Frequency</label>
              <select value={freq} onChange={e=>setFreq(e.target.value)} disabled={busy}>
                <option>Weekly</option><option>Bi-Weekly</option><option>Monthly</option>
              </select>
            </div>
            <div className="field" style={{gridColumn:'span 2'}}>
              <label>Preferred Delivery Day</label>
              <select value={day} onChange={e=>setDay(e.target.value)} disabled={busy}>
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-ftr"><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}>{busy?'Saving…':'Save Target'}</button></div>
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

function DeliverModal({row,mk,onClose,onSaved,toast}:any){
  const [qty,setQty]     = useState('');
  const [notes,setNotes] = useState('');
  const [busy,setBusy]   = useState(false);

  const tgt=Number(row['Target Quantity (kg)'])||0;
  const dlv=Number(row['Delivered Quantity (kg)'])||0;
  const rem=Number(row['Remaining (kg)'])||0;

  const save = async()=>{
    if(!qty||isNaN(Number(qty))||Number(qty)<=0){ toast('Enter a valid quantity','error'); return; }
    setBusy(true);
    try{
      await api.recordDelivery(mk,row['Party ID'],Number(qty),notes);
      onSaved();
    }catch(e:any){ toast('Error: '+e.message,'error'); }
    finally{ setBusy(false); }
  };

  return (
    <div className={`overlay ${busy ? 'pointer-events-none' : ''}`} onClick={e=>!busy && e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h2>📦 Record Delivery — {row['Account Name']}</h2>
          <button className="act-btn del" disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="info-box">
            Target: <strong>{fmt(tgt)} kg</strong> &nbsp;·&nbsp;
            Delivered so far: <strong style={{color:'var(--green)'}}>{fmt(dlv)} kg</strong> &nbsp;·&nbsp;
            Remaining: <strong style={{color:rem>0?'var(--red)':'var(--green)'}}>{fmt(rem)} kg</strong>
          </div>
          <div className="form-grid" style={{gridTemplateColumns:'1fr'}}>
            <div className="field">
              <label>Delivery Quantity (kg)</label>
              <input type="number" min="0.1" step="0.1" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Enter quantity…" disabled={busy} />
            </div>
            <div className="field">
              <label>Notes (Optional)</label>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Vehicle, driver, remarks…" disabled={busy} />
            </div>
          </div>
        </div>
        <div className="modal-ftr">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy}>{busy?'Recording…':'📦 Record Delivery'}</button>
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

function HistoryModal({row,mk,onClose,toast}:any){
  const [history,setHistory] = useState<any[]>([]);
  const [busy,setBusy]       = useState(false);

  useEffect(()=>{
    setBusy(true);
    api.getDeliveryHistory(row['Party ID'], mk)
      .then(r=>setHistory(r||[]))
      .catch((e:any)=>toast('Error: '+e.message,'error'))
      .finally(()=>setBusy(false));
  },[mk, row, toast]);

  const total=history.reduce((s,h)=>s+(Number(h['Trip Delivery (kg)'])||0),0);

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:680}}>
        <div className="modal-hdr">
          <div>
            <h2>📜 Delivery History — {row['Account Name']}</h2>
            <div style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--muted)',marginTop:4}}>
              {mkLabel(mk)} · {history.length} deliveries · Total: <strong style={{color:'var(--green)'}}>{fmt(total)} kg</strong>
            </div>
          </div>
          <button className="act-btn del" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{maxHeight:460,overflowY:'auto'}}>
          {busy ? (
            <div className="loading" style={{height:80}}>Loading…</div>
          ) : history.length===0 ? (
            <div className="empty" style={{padding:30}}>No deliveries recorded for {mkLabel(mk)}</div>
          ) : (
            <div className="tbl-wrap" style={{border:'none',boxShadow:'none'}}>
              <table>
                <thead><tr><th>Date</th><th>Target (kg)</th><th>Trip (kg)</th><th>Status</th><th>Notes</th></tr></thead>
                <tbody>
                  {history.map((h,i)=>(
                    <tr key={i}>
                      <td className="mono">{h['Timestamp']}</td>
                      <td className="mono" style={{fontWeight:600}}>{fmt(Number(h['Target Quantity (kg)']))} kg</td>
                      <td className="mono" style={{color:'var(--green)',fontWeight:700}}>{fmt(Number(h['Trip Delivery (kg)']))} kg</td>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{h['Status']||'—'}</td>
                      <td style={{fontSize:11,color:'var(--muted)',maxWidth:180}}>{h['Notes']||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-ftr">
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function LiftingLedgerPage({parties, toast}:any) {
  const [selectedParty, setSelectedParty] = useState('');
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (parties.length && !selectedParty) setSelectedParty(parties[0]?.partyId);
  }, [parties, selectedParty]);

  useEffect(() => {
    if (!selectedParty) return;
    setBusy(true);
    api.getDeliveryHistory(selectedParty, null)
      .then(data => setDeliveries(data || []))
      .catch((e:any) => toast('Error loading ledger: ' + e.message, 'error'))
      .finally(() => setBusy(false));
  }, [selectedParty, toast]);

  const partyName = parties.find((p:any) => p.partyId === selectedParty)?.accountName || '';

  return (
    <div>
      <div className="sec-hdr">
        <h2>📋 Lifting Ledger</h2>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <select
          className="search-input"
          style={{ width: 260 }}
          value={selectedParty}
          onChange={e => setSelectedParty(e.target.value)}
        >
          {parties.map((p:any) => (
            <option key={p.partyId} value={p.partyId}>{p.accountName}</option>
          ))}
        </select>
        {partyName && (
          <span className="mono" style={{ color: 'var(--muted)' }}>
            Viewing records for: <strong>{partyName}</strong>
          </span>
        )}
      </div>

      {busy ? (
        <div className="loading">Loading ledger records…</div>
      ) : deliveries.length === 0 ? (
        <div className="empty">No ledger records found for this party.</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>MONTH</th>
                <th>TARGET (KG)</th>
                <th>DELIVERED (KG)</th>
                <th>REMAINING (KG)</th>
                <th>COMP %</th>
                <th>STATUS</th>
                <th>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontWeight: 500 }}>{d['Timestamp']}</td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{d['Month']}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{fmt(d['Target Quantity (kg)'])}</td>
                  
                  <td className="mono" style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(d['Trip Delivery (kg)'])}</td>
                  
                  <td className="mono" style={{ color: Number(d['Remaining (kg)']) > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(d['Remaining (kg)'])}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono">{d['Completion %']}%</span>
                      <div className="prog-bar" style={{ width: 50 }}>
                        <div className="prog-fill" style={{ width: d['Completion %'] + '%', background: d['Completion %'] >= 100 ? 'var(--green)' : 'var(--yellow)' }} />
                      </div>
                    </div>
                  </td>
                  <td>{statusBadge(d['Status'])}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 180 }}>{d['Notes'] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function LiftingSchedulePage({parties,toast,currentMonth}:any){
  const [rows,setRows] = useState<any[]>([]);
  const [busy,setBusy] = useState(true);
  const [monthFilter,setMonthFilter] = useState('');
  const [partyFilter,setPartyFilter] = useState('');
  const [months,setMonths] = useState<string[]>([]);
  
  const loadHistory = (mf:string, pf:string) => {
    setBusy(true);
    api.getDeliveryHistory(pf||null, mf||null)
      .then(r=>{
        setRows(r||[]);
        const ms = [...new Set((r||[]).map((x:any)=>x['Month']).filter(Boolean))].sort() as string[];
        setMonths(ms);
      })
      .catch((e:any)=>toast('Error: '+e.message,'error'))
      .finally(()=>setBusy(false));
  };
  
  useEffect(()=>{ loadHistory('',''); },[]);

  const filtered = useMemo(()=>{
    let r = rows;
    if(monthFilter) r = r.filter(x=>x['Month']===monthFilter);
    if(partyFilter) {
      const lq = partyFilter.toLowerCase();
      r = r.filter(x=>String(x['Account Name']||'').toLowerCase().includes(lq)||
                       String(x['Party ID']||'').toLowerCase().includes(lq));
    }
    return r;
  },[rows,monthFilter,partyFilter]);

  return (
    <div>
      <div className="sec-hdr"><h2>Lifting Schedule</h2></div>
      {busy ? <div className="loading">Loading records</div> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Date</th><th>Party</th><th>Month</th><th>Target</th><th>Trip</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {filtered.map((d,i)=>(
                 <tr key={i}>
                    <td className="mono">{d.Timestamp}</td>
                    <td>{d['Account Name']}</td>
                    <td className="mono">{d.Month}</td>
                    <td className="mono">{d['Target Quantity (kg)']} kg</td>
                    <td className="mono" style={{color:'var(--green)',fontWeight:'bold'}}>{d['Trip Delivery (kg)']} kg</td>
                    <td>{statusBadge(d.Status)}</td>
                    <td style={{color:'var(--muted)'}}>{d.Notes}</td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
