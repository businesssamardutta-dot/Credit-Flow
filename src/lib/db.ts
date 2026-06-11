// Internal Mock DB functions implementing identical logic to Google Apps Script
const CFG = {
  DEMO_PARTIES:[
    ['1','GHOSH TRADERS','7001996720','249, MASTER PARA, PO KATWA, PURBA BARDHAMAN','7 DAYS'],
    ['2','HALDER ENTERPRISE','9153733873','SHYAMSUNDAR, PALISREE, RAINA, PURBA BARDHAMAN','7 DAYS'],
    ['3','HARIBANSHA (WS)','9735226666','111, B.B.GHOSH ROAD, RANIGANJ BAZAR','7 DAYS'],
    ['4','HARIBANSHA DUTTA & SONS','NA','110, B.B.GHOSH ROAD, RANIGANJ BAZAR','7 DAYS'],
    ['5','HARIBANSHA RETAIL','NA','111, B.B.GHOSH ROAD, RANIGANJ BAZAR','7 DAYS'],
    ['6','HINDUSTAN TRADERS','8617607611','GT.ROAD, RASULPUR BAZAR, PURBA BARDHAMAN','7 DAYS'],
    ['7','MAHAMAYA ENTERPRISE','9732162842','MALDANGA BAZAR, MALDANGA','7 DAYS'],
    ['8','PAUL ENTERPRISE','6294891299','MEMARI BABUNPARA MORE, MEMARI, BURDWAN','7 DAYS'],
    ['9','SANDHYA ENTERPRISE','9832174443','RAJAN, BURDWAN','7 DAYS'],
    ['10','SOUVIK ENTERPRISE','9634347405','STATION BAZAR, KATWA, PURBA BARDHAMAN','7 DAYS'],
    ['11','SUCHITRA ENTERPRISE','8001638521','JAUGRAM BAZAR, JAUGRAM, PURBA BARDHAMAN','7 DAYS'],
    ['12','PAYEL AGENCY','9064197587','DAINHAT','7 DAYS'],
    ['13','RUPA GHOSH','9474641567','KANAKPUR','7 DAYS'],
    ['14','HALDER TRADING COMPANY','7001242911','UROCHOTI','7 DAYS'],
    ['15','PAL ENTERPRISE(NEW)','7319275597','KAMARGORIA','ADVANCE'],
    ['16','BALORAM DAS','9732290839','RADHAKANTAPUR','7 DAYS'],
    ['17','AGNIVO ENTERPRISE','9733999555','BHATAR','7 DAYS'],
    ['18','ANIL TRADERS','7001554919','BURDWAN (HS)','3 DAYS'],
    ['19','CHANDRANATH HALDERS','9332128774','BURDWAN (HS)','3 DAYS'],
    ['20','BALAJI TRADING COMPANY','7001506733','BURDWAN (HS)','3 DAYS'],
    ['21','VINAYAK TRADERS','7001506782','BURDWAN (HS)','3 DAYS'],
    ['22','SUDIP GUPTA','9474984555','BURDWAN (HS)','3 DAYS'],
    ['23','NITISH ENTERPRISE','9434671591','BURDWAN (HS)','3 DAYS']
  ],
  DEMO_LIFTING_TARGETS: {
    '1': { target: 0, frequency: 'Weekly', day: 'Monday' },
    '2': { target: 0, frequency: 'Weekly', day: 'Wednesday' },
    '3': { target: 0, frequency: 'Bi-Weekly', day: 'Friday' },
    '6': { target: 0, frequency: 'Weekly', day: 'Tuesday' },
    '8': { target: 0, frequency: 'Weekly', day: 'Thursday' },
    '10': { target: 0, frequency: 'Bi-Weekly', day: 'Monday' }
  }
};

const uid = (p: string) => p + '_' + Math.random().toString(36).substr(2, 9);
const toNum = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
function fmtDate(d: any) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseD(s: any) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function mk(d: Date = new Date()) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
function addDays(d: any, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function cdNum(s: string) {
  if (!s) return 7;
  if (s === 'ADVANCE') return 0;
  const match = String(s).match(/(\d+)/);
  return match ? parseInt(match[1]) : 7;
}

type DBState = {
  users: any[];
  parties: any[];
  settings: Record<string, any>;
  contacts: any[];
  tasks: any[];
  interactions: any[];
  ledger: any[];
  liftingHistory: any[];
  monthSheets: Record<string, any[]>;
  liftingSheets: Record<string, any[]>;
};

const DB_KEY = 'CREDITFLOW_DB_STORE';

function getDB(): DBState {
  try {
    const data = localStorage.getItem(DB_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {}
  
  const initial: DBState = {
    users: [],
    parties: [],
    settings: { theme: 'ocean', remindersEnabled: true, adminEmail: '' },
    contacts: [],
    tasks: [],
    interactions: [],
    ledger: [],
    liftingHistory: [],
    monthSheets: {},
    liftingSheets: {}
  };
  return initial;
}

function saveDB(db: DBState) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Ensure init DB
export const initDatabase = async () => {
  const db = getDB();
  if (db.parties.length === 0) {
    const nowStr = fmtDate(new Date());
    db.parties = CFG.DEMO_PARTIES.map(p => ({
      'Party ID': uid('P'), 'SL NO': p[0], 'Account Name': p[1],
      'Contact No': p[2], 'Address': p[3], 'Email': '', 'Credit Limit': 0,
      'Credit Days': p[4], 'Status': 'ACTIVE', 'Score': 50,
      'Payment Mode': '', 'Created By': 'admin', 'Created At': nowStr, 'Updated At': nowStr
    }));
  }
  saveDB(db);
  await autoCreateNextMonth();
  return { success: true };
};

export const getParties = async () => {
  const db = getDB();
  return db.parties.map(p => ({
    partyId: p['Party ID'], slNo: p['SL NO'], accountName: p['Account Name'],
    contactNo: p['Contact No'], address: p['Address'], email: p['Email'],
    creditLimit: toNum(p['Credit Limit']), creditDays: p['Credit Days'],
    status: p['Status'], score: parseInt(p['Score']) || 50, paymentMode: p['Payment Mode']
  }));
};

export const autoCreateNextMonth = async () => {
  const db = getDB();
  const now = new Date();
  const nkCur = mk(now);
  const nowStr = fmtDate(now);
  const nkNext = mk(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  
  let created = false;
  let createdNext = false;
  
  const setupMonth = (mKey: string) => {
    let made = false;
    if (!db.monthSheets[mKey]) {
      db.monthSheets[mKey] = db.parties.map(p => {
        const dn = cdNum(p['Credit Days']);
        const inv = nowStr;
        const target = dn === 0 ? inv : fmtDate(addDays(now, dn));
        return {
          'Row ID': uid('MR'), 'Party ID': p['Party ID'], 'Account Name': p['Account Name'],
          'Contact No': p['Contact No'], 'Opening Balance': 0, 'New Credit': 0,
          'Total Debt': 0, 'Paid Amount': 0, 'Balance': 0,
          'Credit Days': p['Credit Days'], 'Invoice Date': inv, 'Target Date': target,
          'Last Payment Date': '', 'Status': p['Credit Days'] === 'ADVANCE' ? 'ADVANCE' : 'ACTIVE',
          'Score': p['Score'] || 50, 'Overdue Days': 0, 'Notes': '', 'Updated At': nowStr
        };
      });
      made = true;
    }
    if (!db.liftingSheets[mKey]) {
      db.liftingSheets[mKey] = db.parties.map(p => {
        const slNo = String(p['SL NO']);
        const dt = (CFG.DEMO_LIFTING_TARGETS as any)[slNo];
        const targetQty = dt ? dt.target : 0;
        const freq = dt ? dt.frequency : 'Weekly';
        const day = dt ? dt.day : 'Monday';
        return {
          'Row ID': uid('LR'), 'Party ID': p['Party ID'], 'Account Name': p['Account Name'],
          'Contact No': p['Contact No'], 'Month': mKey, 'Target Quantity (kg)': targetQty,
          'Delivered Quantity (kg)': 0, 'Remaining (kg)': targetQty, 'Completion %': 0,
          'Delivery Frequency': freq, 'Preferred Day': day,
          'Status': targetQty > 0 ? 'NOT STARTED' : 'NO TARGET',
          'Last Delivery Date': '', 'Last Delivery Qty': 0,
          'Created At': nowStr, 'Updated At': nowStr
        };
      });
      made = true;
    }
    return made;
  };
  
  if (setupMonth(nkCur)) created = true;
  if (setupMonth(nkNext)) createdNext = true;
  
  saveDB(db);
  return { created: created || createdNext, month: nkNext };
};

export const getSettings = async () => {
  const db = getDB();
  return db.settings;
};

export const saveSetting = async (key: string, value: any) => {
  const db = getDB();
  db.settings[key] = value;
  saveDB(db);
};

export const getDashboardSummary = async () => {
  const db = getDB();
  const curMk = mk();
  const md = db.monthSheets[curMk] || [];
  const ams: any = {};
  
  Object.keys(db.monthSheets).forEach(m => {
    const rows = db.monthSheets[m];
    let td=0,tc=0,tp=0,tb=0,oc=0,pc=0,ac=0,dc=0;
    rows.forEach(r => {
      td+=toNum(r['Total Debt']); tc+=toNum(r['New Credit']);
      tp+=toNum(r['Paid Amount']); tb+=toNum(r['Balance']);
      if(r.Status==='PAID') pc++; else if(r.Status==='OVERDUE') oc++;
      else if(r.Status==='DUE SOON') dc++; else ac++;
    });
    ams[m] = { month: m, year: m.split('-')[0], totalDebt: td, totalCredit: tc, totalPaid: tp, totalBalance: tb, overdueCount: oc, paidCount: pc, activeCount: ac, dueSoonCount: dc, partyCount: rows.length };
  });

  const today = new Date(); today.setHours(0,0,0,0);
  const ds = md.filter(r => {
    if (r['Balance'] <= 0) return false;
    const t = parseD(r['Target Date']); if (!t) return false;
    const df = Math.ceil((t.getTime() - today.getTime()) / 86400000);
    return df >= -1 && df <= 2;
  });

  const aging = {'0-7': 0, '8-15': 0, '16-30': 0, '30+': 0};
  md.forEach(r => {
    if (r['Balance'] <= 0) return;
    const dv = parseInt(r['Overdue Days']) || 0;
    if (dv > 30) aging['30+'] += r['Balance'];
    else if (dv > 15) aging['16-30'] += r['Balance'];
    else if (dv > 7) aging['8-15'] += r['Balance'];
    else if (dv > 0) aging['0-7'] += r['Balance'];
  });

  return {
    currentMonth: curMk,
    allMonths: Object.keys(db.monthSheets).sort(),
    allMonthSummaries: ams,
    totalOutstanding: md.reduce((s:number, r:any)=>s+r['Balance'],0),
    totalCredit: md.reduce((s:number, r:any)=>s+r['New Credit'],0),
    totalCollected: md.reduce((s:number, r:any)=>s+r['Paid Amount'],0),
    overdueCount: md.filter(r=>r.Status==='OVERDUE').length,
    paidCount: md.filter(r=>r.Status==='PAID').length,
    dueSoonCount: md.filter(r=>r.Status==='DUE SOON').length,
    activeCount: md.filter(r=>r.Status==='ACTIVE'||r.Status==='ADVANCE').length,
    avgScore: db.parties.length ? Math.round(db.parties.reduce((s:number,p:any)=>s+(parseInt(p.Score)||50),0)/db.parties.length) : 0,
    aging,
    dueSoon: ds
  };
};

export const listLiftingMonths = async () => {
  return Object.keys(getDB().liftingSheets).sort();
};

export const getLiftingData = async (monthKey: string) => {
  return getDB().liftingSheets[monthKey||mk()] || [];
};

export const getMonthData = async (monthKey: string) => {
  const db = getDB();
  return db.monthSheets[monthKey||mk()] || [];
};

export const closeMonth = async (monthKey: string) => {
  const mkStr = monthKey || mk();
  const db = getDB();
  const sh = db.monthSheets[mkStr];
  if (!sh) throw new Error("Not found");
  let upd = 0;
  sh.forEach(r => {
    const bal = toNum(r.Balance);
    if(bal>0 && r.Status!=='PAID'){ r.Status='OVERDUE'; upd++; }
    else if(bal===0){ r.Status='PAID'; }
  });
  
  const [yr, mo] = mkStr.split('-').map(Number);
  const nk = mk(new Date(yr, mo, 1));
  saveDB(db);
  await autoCreateNextMonth(); 
  return { success: true, updated: upd, nextMonth: nk };
};

export const sendReminderEmails = async () => { return 1; }; // Mock
export const updateAllScores = async () => { return 1; }; // Mock
export const deleteParty = async (id: string) => { const db=getDB(); db.parties = db.parties.filter(x=>x['Party ID']!==id); saveDB(db); };
export const addParty = async (data: any) => { 
  const db=getDB(); 
  db.parties.push({'Party ID': uid('P'), 'Account Name': data.accountName, 'SL NO': data.slNo, 'Contact No': data.contactNo, 'Address': data.address, 'Email': data.email, 'Credit Limit': data.creditLimit, 'Credit Days': data.creditDays || '7 DAYS', 'Status': 'ACTIVE', 'Score': 50, 'Payment Mode': data.paymentMode});
  saveDB(db); 
  await autoCreateNextMonth();
};
export const updateParty = async (id: string, updates: any) => {
  const db=getDB();
  const p = db.parties.find(x=>x['Party ID']===id);
  if(p){ Object.assign(p, {'Account Name':updates.accountName, 'Contact No':updates.contactNo, 'Address':updates.address, 'Email':updates.email, 'Credit Limit':updates.creditLimit, 'Credit Days':updates.creditDays, 'Payment Mode':updates.paymentMode}); }
  saveDB(db);
};
export const getContacts = async () => getDB().contacts;
export const addContact = async (data: any) => { const db=getDB(); db.contacts.push({'Contact ID':uid('C'), 'Party ID':data.partyId, 'Name':data.name, 'Phone':data.phone, 'Email':data.email, 'Role':data.role}); saveDB(db); };
export const deleteContact = async (id: string) => { const db=getDB(); db.contacts = db.contacts.filter(x=>x['Contact ID']!==id); saveDB(db); };
export const getTasks = async () => getDB().tasks;
export const addTask = async (data: any) => { const db=getDB(); db.tasks.push({'Task ID':uid('T'), 'Party ID':data.partyId, 'Title':data.title, 'Description':data.description, 'Target Date':data.dueDate, 'Assigned To':data.assignedTo, 'Status':data.status}); saveDB(db); };
export const updateTask = async (id: string, updates: any) => { const db=getDB(); const t=db.tasks.find(x=>x['Task ID']===id); if(t) t.Status = updates.status; saveDB(db); };
export const deleteTask = async (id: string) => { const db=getDB(); db.tasks=db.tasks.filter(x=>x['Task ID']!==id); saveDB(db); };
export const getLedger = async (mf: string|null) => {
  let l = getDB().ledger;
  if(mf){ l=l.filter(x=>x.Month===mf); }
  return l.sort((a,b)=>new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
};
export const getDeliveryHistory = async (partyId: string|null, mf: string|null) => {
  let l = getDB().liftingHistory;
  if(partyId) l=l.filter(x=>x['Party ID']===partyId);
  if(mf) l=l.filter(x=>x.Month===mf);
  return l.sort((a,b)=>new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
};

// ... Actions inside Month Data
export const updateMonthRow = async (mk: string, rowId: string, updates: any) => {
  const db=getDB(); const r=db.monthSheets[mk]?.find(x=>x['Row ID']===rowId);
  if(r){
    if(updates.creditDays) r['Credit Days']=updates.creditDays;
    if(updates.invoiceDate) r['Invoice Date']=updates.invoiceDate;
    if(updates.targetDate) r['Target Date']=updates.targetDate;
    saveDB(db);
  }
};
export const addCredit = async (partyId: string, amt: number, notes: string, mk: string) => {
  const db=getDB(); const r=db.monthSheets[mk]?.find(x=>x['Party ID']===partyId);
  if(r){
    r['New Credit'] += amt;
    r['Total Debt'] += amt;
    r['Balance'] += amt;
    r['Status'] = r['Balance']>0?'ACTIVE':'PAID';
    db.ledger.push({ Timestamp: fmtDate(new Date()), 'Account Name': r['Account Name'], Month: mk, MonthName: mk, 'Opening Balance': r['Closing Balance']||0, 'Debit (New Credit)': amt, 'Credit (Payment)': 0, 'Closing Balance': r['Balance'], Status: r['Status'], Notes: notes });
    saveDB(db);
  }
};
export const recordPayment = async (partyId: string, amt: number, method: string, ref: string, notes: string, mk: string) => {
  const db=getDB(); const r=db.monthSheets[mk]?.find(x=>x['Party ID']===partyId);
  if(r){
    r['Paid Amount'] += amt;
    r['Balance'] = Math.max(0, r['Total Debt'] - r['Paid Amount']);
    r['Status'] = r['Balance']===0?'PAID':'ACTIVE';
    db.ledger.push({ Timestamp: fmtDate(new Date()), 'Account Name': r['Account Name'], Month: mk, MonthName: mk, 'Opening Balance': r['Balance']+amt, 'Debit (New Credit)': 0, 'Credit (Payment)': amt, 'Closing Balance': r['Balance'], Status: r['Status'], Notes: `${method} ${ref} ${notes}` });
    saveDB(db);
  }
};

// ... Actions inside Lifting Data
export const updateLiftingTarget = async (mk: string, rowId: string, updates: any) => {
  const db=getDB(); const r=db.liftingSheets[mk]?.find(x=>x['Row ID']===rowId);
  if(r){
    r['Target Quantity (kg)'] = updates.targetQuantity;
    r['Delivery Frequency'] = updates.deliveryFrequency;
    r['Preferred Day'] = updates.preferredDay;
    r['Remaining (kg)'] = Math.max(0, updates.targetQuantity - r['Delivered Quantity (kg)']);
    r['Completion %'] = updates.targetQuantity > 0 ? Math.min(100, Math.round((r['Delivered Quantity (kg)'] / updates.targetQuantity) * 100)) : 0;
    saveDB(db);
  }
};
export const completeLiftingTarget = async (mk: string, rowId: string) => {
  const db=getDB(); const r=db.liftingSheets[mk]?.find(x=>x['Row ID']===rowId);
  if(r) {
    const trip = r['Remaining (kg)'];
    r['Delivered Quantity (kg)'] = r['Target Quantity (kg)'];
    r['Remaining (kg)'] = 0;
    r['Completion %'] = 100;
    r['Status'] = 'COMPLETED';
    db.liftingHistory.push({ Timestamp: fmtDate(new Date()), 'Party ID': r['Party ID'], 'Account Name': r['Account Name'], Month: mk, 'Target Quantity (kg)': r['Target Quantity (kg)'], 'Trip Delivery (kg)': trip, 'Remaining (kg)': 0, 'Completion %': 100, Status: 'COMPLETED', Notes: 'Auto completed' });
    saveDB(db);
  }
};
export const resetLiftingDeliveries = async (mk: string, rowId: string) => {
  const db=getDB(); const r=db.liftingSheets[mk]?.find(x=>x['Row ID']===rowId);
  if(r){
    r['Delivered Quantity (kg)'] = 0;
    r['Remaining (kg)'] = r['Target Quantity (kg)'];
    r['Completion %'] = 0;
    r['Status'] = 'NOT STARTED';
    saveDB(db);
  }
};
export const recordDelivery = async (mk: string, partyId: string, qty: number, notes: string) => {
  const db=getDB(); const r=db.liftingSheets[mk]?.find(x=>x['Party ID']===partyId);
  if(r){
    r['Delivered Quantity (kg)'] += qty;
    r['Remaining (kg)'] = Math.max(0, r['Target Quantity (kg)'] - r['Delivered Quantity (kg)']);
    r['Completion %'] = r['Target Quantity (kg)'] > 0 ? Math.min(100, Math.round((r['Delivered Quantity (kg)'] / r['Target Quantity (kg)']) * 100)) : 0;
    r['Status'] = r['Remaining (kg)'] === 0 ? 'COMPLETED' : 'IN PROGRESS';
    db.liftingHistory.push({ Timestamp: fmtDate(new Date()), 'Party ID': r['Party ID'], 'Account Name': r['Account Name'], Month: mk, 'Target Quantity (kg)': r['Target Quantity (kg)'], 'Trip Delivery (kg)': qty, 'Remaining (kg)': r['Remaining (kg)'], 'Completion %': r['Completion %'], Status: r['Status'], Notes: notes });
    saveDB(db);
  }
};
