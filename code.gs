function doPost(e) {
  if (!e || !e.postData) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: "No post data"}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const payload = JSON.parse(e.postData.contents);
    let result = null;
    
    // Map of frontend functions to apps script functions
    if (payload.func === 'getParties') result = getParties();
    else if (payload.func === 'initDatabase') result = initDatabase();
    else if (payload.func === 'autoCreateNextMonth') result = autoCreateNextMonth();
    else if (payload.func === 'getSettings') result = getSettings();
    else if (payload.func === 'saveSetting') result = saveSetting.apply(null, payload.args);
    else if (payload.func === 'getDashboardSummary') result = getDashboardSummary();
    else if (payload.func === 'listLiftingMonths') result = listLiftingMonths();
    else if (payload.func === 'getLiftingData') result = getLiftingData.apply(null, payload.args);
    else if (payload.func === 'getMonthData') result = getMonthData.apply(null, payload.args);
    else if (payload.func === 'closeMonth') result = closeMonth.apply(null, payload.args);
    else if (payload.func === 'sendReminderEmails') result = sendReminderEmails();
    else if (payload.func === 'updateAllScores') result = updateAllScores();
    else if (payload.func === 'deleteParty') result = deleteParty.apply(null, payload.args);
    else if (payload.func === 'addParty') result = addParty.apply(null, payload.args);
    else if (payload.func === 'updateParty') result = updateParty.apply(null, payload.args);
    else if (payload.func === 'getLedger') result = getLedger.apply(null, payload.args);
    else if (payload.func === 'getDeliveryHistory') result = getDeliveryHistory.apply(null, payload.args);
    else if (payload.func === 'updateMonthRow') result = updateMonthRow.apply(null, payload.args);
    else if (payload.func === 'addCredit') result = addCredit.apply(null, payload.args);
    else if (payload.func === 'recordPayment') result = recordPayment.apply(null, payload.args);
    else if (payload.func === 'updateLiftingTarget') result = updateLiftingTarget.apply(null, payload.args);
    else if (payload.func === 'completeLiftingTarget') result = completeLiftingTarget.apply(null, payload.args);
    else if (payload.func === 'resetLiftingDeliveries') result = resetLiftingDeliveries.apply(null, payload.args);
    else if (payload.func === 'recordDelivery') result = recordDelivery.apply(null, payload.args);
    else if (payload.func === 'carryForwardLiftingTargets') result = carryForwardLiftingTargets.apply(null, payload.args);
    else if (payload.func === 'addPartiesBulk') result = addPartiesBulk.apply(null, payload.args);
    else if (payload.func === 'addLedgerEntriesBulk') result = addLedgerEntriesBulk.apply(null, payload.args);
    else if (payload.func === 'getAuditLogs') result = getAuditLogs();
    else if (payload.func === 'sendPartyLedgerEmail') result = sendPartyLedgerEmail.apply(null, payload.args);
    else if (payload.func === 'restoreDatabaseBackup') result = restoreDatabaseBackup.apply(null, payload.args);
    else throw new Error("Unknown function requested: " + payload.func);

    return ContentService.createTextOutput(JSON.stringify({success: true, data: result}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  if (e.parameter.action === 'auth') {
    const email = Session.getActiveUser().getEmail();
    const returnUrl = e.parameter.returnUrl;
    if (returnUrl) {
      const destUrl = returnUrl + (returnUrl.indexOf('?') === -1 ? '?' : '&') + 'auth_email=' + encodeURIComponent(email || '');
      const htmlOutput = HtmlService.createHtmlOutput(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head><base target="_top"></head>' +
        '<body>' +
        '<p style="font-family:sans-serif; text-align:center; margin-top:50px; color:#333;">' +
        'Authenticating your Google Account... If you are not redirected automatically, ' +
        '<a href="' + destUrl + '" target="_top" id="redir-link" style="color:#2563eb; font-weight:bold; text-decoration:underline;">click here</a>.' +
        '</p>' +
        '<script>' +
        '  var dest = "' + destUrl + '";' +
        '  try {' +
        '    var link = document.getElementById("redir-link");' +
        '    link.click();' +
        '  } catch(e) {' +
        '    try {' +
        '      window.open(dest, "_top");' +
        '    } catch(e2) {' +
        '      window.top.location.href = dest;' +
        '    }' +
        '  }' +
        '</script>' +
        '</body>' +
        '</html>'
      );
      return htmlOutput;
    }
  }
  return ContentService.createTextOutput("Backend Active");
}

function doOptions(e) { 
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT); 
}

const CFG = {
  SH:{ PARTIES:'Parties', CONTACTS:'Contacts', TASKS:'Tasks',
       INTERACTIONS:'Interactions', LEDGER:'Ledger', USERS:'Users', SETTINGS:'Settings',
       LIFTING_HISTORY:'Lifting Ledger' },
  MONTHLY_PREFIX:'Month_',
  LIFTING_PREFIX:'Lifting_',
  LIFTING_HIST_PREFIX:'Lifting_Hist_', 
  ROLES:{ ADMIN:'Admin', COLLECTOR:'Collector', VIEWER:'Viewer' },
  COLS:{
    PARTIES:['Party ID','SL NO','Account Name','Contact No','Address','Email',
             'Credit Limit','Credit Days','Status','Score','Payment Mode',
             'Created By','Created At','Updated At'],
    CONTACTS:['Contact ID','Party ID','Name','Phone','Email','Role','Created At','Updated At'],
    TASKS:['Task ID','Party ID','Title','Description','Target Date','Assigned To','Status','Created At','Updated At'],
    INTERACTIONS:['Interaction ID','Party ID','Type','Date','Subject','Notes','Created At'],
    LEDGER:['Timestamp','Party ID','Account Name','Month','Opening Balance',
            'Debit (New Credit)','Credit (Payment)','Closing Balance','Status','Collector','Notes'],
    USERS:['Email','Role','Created At'],
    SETTINGS:['Key','Value'],
    MONTHLY:['Row ID','Party ID','Account Name','Contact No','Opening Balance',
             'New Credit','Total Debt','Paid Amount','Balance',
             'Credit Days','Invoice Date','Target Date','Last Payment Date',
             'Status','Score','Overdue Days','Notes','Updated At'],
    LIFTING:['Row ID','Party ID','Account Name','Contact No','Month',
             'Target Quantity (kg)','Delivered Quantity (kg)','Remaining (kg)',
             'Completion %','Delivery Frequency','Preferred Day','Status',
             'Last Delivery Date','Last Delivery Qty','Created At','Updated At'],
    LIFTING_HISTORY:['Timestamp','Party ID','Account Name','Month','Target Quantity (kg)','Trip Delivery (kg)','Cumulative Delivered (kg)','Remaining (kg)','Completion %','Status','Collector','Notes']
  },
  DEMO_PARTIES:[
    ['1','GHOSH TRADERS','7001996720','249, MASTER PARA, PO KATWA, PURBA BARDHAMAN','7 DAYS']
  ],
  DEMO_LIFTING_TARGETS: { }
};

function uid(p){ return p+'_'+Utilities.getUuid().replace(/-/g,'').slice(0,10); }
function toNum(v){ const n=parseFloat(v); return isNaN(n)?0:n; }
function fmtDate(d){
  if(!d) return '';
  try{ return Utilities.formatDate(d instanceof Date?d:new Date(d), Session.getScriptTimeZone(),'yyyy-MM-dd'); }
  catch(e){ return ''; }
}
function parseD(s){
  if(!s) return null;
  try{ const d=new Date(s); return isNaN(d.getTime())?null:d; }
  catch(e){ return null; }
}
function mk(d){ d=d||new Date(); return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM'); }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function cdNum(s){
  if(!s) return 7;
  if(s==='ADVANCE') return 0;
  const m=String(s).match(/(\d+)/);
  return m?parseInt(m[1]):7;
}
function SS(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function colMap(hdr){ const c={}; hdr.forEach((h,i)=>c[h]=i); return c; }
function colMap1(hdr){ const c={}; hdr.forEach((h,i)=>c[h]=i+1); return c; }

function getRole(){
  try{
    const e=Session.getActiveUser().getEmail();
    if(!e) return CFG.ROLES.ADMIN;
    const sh=SS().getSheetByName(CFG.SH.USERS);
    if(!sh) return CFG.ROLES.ADMIN;
    const d=sh.getDataRange().getValues();
    for(let i=1;i<d.length;i++) if(d[i][0]===e) return d[i][1];
    return CFG.ROLES.ADMIN;
  }catch(e){ return CFG.ROLES.ADMIN; }
}
function assertRole(a){ const r=getRole(); if(!a.includes(r)) throw new Error('Access denied: '+r); }

function ensureSheet(name,headers,color){
  const ss=SS(); let sh=ss.getSheetByName(name);
  if(!sh){
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground(color||'#1e293b');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1,headers.length,140);
  }
  return sh;
}

function ensureMonthSheet(monthKey){
  monthKey = monthKey || mk();
  const name=CFG.MONTHLY_PREFIX+monthKey;
  const ss=SS();
  let sh=ss.getSheetByName(name);
  if(!sh){
    sh=ss.insertSheet(name);
    const cols=CFG.COLS.MONTHLY;
    sh.getRange(1,1,1,cols.length).setValues([cols])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#0f172a');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1,cols.length,140);
    try{
      const sr=sh.getRange(2,14,500,1);
      const rules=[];
      [['PAID','#166534','#bbf7d0'],['OVERDUE','#7f1d1d','#fecaca'],
       ['DUE SOON','#78350f','#fef3c7'],['ACTIVE','#1e3a5f','#bfdbfe'],
       ['ADVANCE','#4a044e','#f5d0fe']].forEach(([t,bg,fg])=>
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo(t).setBackground(bg).setFontColor(fg)
          .setRanges([sr]).build()));
      sh.setConditionalFormatRules(rules);
    }catch(e){}
    populateMonthSheet(sh,monthKey);
  }
  return sh;
}

function getOrCreateMonthSheet(monthKey){
  monthKey = monthKey || mk();
  return SS().getSheetByName(CFG.MONTHLY_PREFIX+monthKey) || ensureMonthSheet(monthKey);
}

function populateMonthSheet(sh,monthKey){
  const parties=getAllPartiesRaw();
  if(!parties.length) return;
  const now=new Date();
  const rows=parties.map(p=>{
    const dn=cdNum(p['Credit Days']);
    const inv=fmtDate(now);
    const target=dn===0?inv:fmtDate(addDays(now,dn));
    return[uid('MR'),p['Party ID'],p['Account Name'],p['Contact No'],
      0,0,0,0,0,
      p['Credit Days'] || '7 DAYS',inv,target,'',
      p['Credit Days']==='ADVANCE'?'ADVANCE':'ACTIVE',
      p['Score']||50,0,'',fmtDate(now)];
  });
  if(rows.length)
    sh.getRange(2,1,rows.length,CFG.COLS.MONTHLY.length).setValues(rows);
  carryForward(sh,monthKey);
}

function carryForward(sh,monthKey){
  try{
    const[yr,mo]=monthKey.split('-').map(Number);
    const prevMonthDate = new Date(yr, mo - 2, 1); 
    const prevSh=SS().getSheetByName(CFG.MONTHLY_PREFIX+mk(prevMonthDate));
    
    // Load initial opening balances of all parties from Parties sheet as fallback
    const initialOp = {};
    try {
      const parties = getAllPartiesRaw();
      parties.forEach(p => {
        const pId = String(p['Party ID'] || '').trim();
        if (pId) {
          initialOp[pId] = toNum(p['Opening Balance']);
        }
      });
    } catch(e) {
      console.log("Error loading initial party opening balances:", e);
    }
    
    const bm={};
    if(prevSh && prevSh.getLastRow() >= 2) {
      const pd=prevSh.getDataRange().getValues(); 
      const ph=pd[0];
      const pidI=ph.indexOf('Party ID'); 
      const balI=ph.indexOf('Balance');
      if(pidI !== -1 && balI !== -1) {
        for(let i=1;i<pd.length;i++){
          const pId = String(pd[i][pidI]).trim();
          if(pId) bm[pId] = toNum(pd[i][balI]);
        }
      }
    }

    const cd=sh.getDataRange().getValues(); 
    const ch=cd[0];
    const cC=colMap1(ch);
    const targetPidI = ch.indexOf('Party ID');
    if(targetPidI === -1) return;

    let updated = false;
    for(let i=1;i<cd.length;i++){
      const currentPartyId = String(cd[i][targetPidI]).trim();
      const carry = bm[currentPartyId] !== undefined ? bm[currentPartyId] : (initialOp[currentPartyId] || 0);
      
      const oldOpening = toNum(cd[i][ch.indexOf('Opening Balance')]);
      const oldNewCredit = toNum(cd[i][ch.indexOf('New Credit')]);
      const oldPaid = toNum(cd[i][ch.indexOf('Paid Amount')]);
      
      if(oldOpening !== carry){
        const newTotalDebt = carry + oldNewCredit;
        const newBalance = newTotalDebt - oldPaid;
        
        sh.getRange(i+1, cC['Opening Balance']).setValue(carry);
        sh.getRange(i+1, cC['Total Debt']).setValue(newTotalDebt);
        sh.getRange(i+1, cC['Balance']).setValue(newBalance);
        
        if (newBalance < 0) {
          sh.getRange(i+1, cC['Status']).setValue('ADVANCE');
        } else if (newBalance === 0) {
          sh.getRange(i+1, cC['Status']).setValue('PAID');
        } else {
          const statusColVal = cd[i][ch.indexOf('Status')];
          if (statusColVal === 'PAID' || statusColVal === 'ADVANCE') {
            sh.getRange(i+1, cC['Status']).setValue(cd[i][ch.indexOf('Credit Days')] === 'ADVANCE' ? 'ADVANCE' : 'ACTIVE');
          }
        }
        updated = true;
      }
    }
    if (updated) {
      SpreadsheetApp.flush();
    }
  }catch(e){ console.error('carryForward error:',e.message); }
}

function ensureLiftingSheet(monthKey){
  monthKey = monthKey || mk();
  const name=CFG.LIFTING_PREFIX+monthKey;
  const ss=SS();
  let sh=ss.getSheetByName(name);
  if(!sh){
    sh=ss.insertSheet(name);
    const cols=CFG.COLS.LIFTING;
    sh.getRange(1,1,1,cols.length).setValues([cols])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#7c2d12');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1,cols.length,140);
    try{
      const sr=sh.getRange(2,12,500,1);
      const rules=[];
      [['COMPLETED','#166534','#bbf7d0'],['IN PROGRESS','#0e7490','#a5f3fc'],
       ['NOT STARTED','#64748b','#e2e8f0'],['OVERDUE','#7f1d1d','#fecaca'],
       ['NO TARGET','#78350f','#fef3c7']].forEach(([t,bg,fg])=>
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo(t).setBackground(bg).setFontColor(fg)
          .setRanges([sr]).build()));
      sh.setConditionalFormatRules(rules);
    }catch(e){}
    populateLiftingSheet(sh,monthKey);
  }
  return sh;
}

function populateLiftingSheet(sh, monthKey){
  const parties = getAllPartiesRaw();
  if(!parties.length) return;
  const now = new Date();

  // Look for previous month's lifting sheet to carry forward targets
  var prevLiftingMap = {};
  try {
    var parts = monthKey.split('-');
    var yr = parseInt(parts[0], 10);
    var mo = parseInt(parts[1], 10);
    var prevMonthDate = new Date(yr, mo - 2, 1);
    var prevKey = mk(prevMonthDate);
    var prevSh = SS().getSheetByName(CFG.LIFTING_PREFIX + prevKey);
    
    if (prevSh && prevSh.getLastRow() >= 2) {
      var pd = prevSh.getDataRange().getValues();
      var ph = pd[0];
      var pidI = ph.indexOf('Party ID');
      var targetI = ph.indexOf('Target Quantity (kg)');
      var freqI = ph.indexOf('Delivery Frequency');
      var dayI = ph.indexOf('Preferred Day');
      
      if (pidI !== -1 && targetI !== -1 && freqI !== -1 && dayI !== -1) {
        for (var i = 1; i < pd.length; i++) {
          var pId = String(pd[i][pidI]).trim();
          if (pId) {
            prevLiftingMap[pId] = {
              target: toNum(pd[i][targetI]),
              frequency: pd[i][freqI] || 'Weekly',
              day: pd[i][dayI] || 'Monday'
            };
          }
        }
      }
    }
  } catch (e) {
    console.error('populateLiftingSheet auto-carry forward error:', e.message);
  }

  const rows = parties.map(p => {
    const partyId = p['Party ID'];
    const slNo = String(p['SL NO']);
    
    // Check if we have previous month's target data
    let targetQty = 0;
    let freq = 'Weekly';
    let day = 'Monday';
    
    if (prevLiftingMap[partyId] !== undefined) {
      targetQty = prevLiftingMap[partyId].target;
      freq = prevLiftingMap[partyId].frequency;
      day = prevLiftingMap[partyId].day;
    } else {
      const demoTarget = CFG.DEMO_LIFTING_TARGETS[slNo];
      targetQty = demoTarget ? demoTarget.target : 0;
      freq = demoTarget ? demoTarget.frequency : 'Weekly';
      day = demoTarget ? demoTarget.day : 'Monday';
    }

    return [
      uid('LR'), partyId, p['Account Name'], p['Contact No'], monthKey,
      targetQty, 0, targetQty, 0, freq, day,
      targetQty > 0 ? 'NOT STARTED' : 'NO TARGET', '', '', fmtDate(now), fmtDate(now)
    ];
  });
  if(rows.length) {
    sh.getRange(2, 1, rows.length, CFG.COLS.LIFTING.length).setValues(rows);
  }
}

function carryForwardLiftingTargets(monthKey) {
  assertRole([CFG.ROLES.ADMIN, CFG.ROLES.COLLECTOR]);
  try {
    const sh = SS().getSheetByName(CFG.LIFTING_PREFIX + monthKey);
    if (!sh) throw new Error("Sheet not found for " + monthKey);
    
    const parts = monthKey.split('-');
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10);
    const prevMonthDate = new Date(yr, mo - 2, 1);
    const prevKey = mk(prevMonthDate);
    const prevSh = SS().getSheetByName(CFG.LIFTING_PREFIX + prevKey);
    
    if (!prevSh || prevSh.getLastRow() < 2) {
      throw new Error("No lifting data found in previous month (" + prevKey + ") to carry forward.");
    }
    
    // Read previous month's targets
    const pd = prevSh.getDataRange().getValues();
    const ph = pd[0];
    const pidI = ph.indexOf('Party ID');
    const targetI = ph.indexOf('Target Quantity (kg)');
    const freqI = ph.indexOf('Delivery Frequency');
    const dayI = ph.indexOf('Preferred Day');
    
    if (pidI === -1 || targetI === -1 || freqI === -1 || dayI === -1) {
      throw new Error("Previous month's columns are unsupported.");
    }
    
    const prevMap = {};
    for (let i = 1; i < pd.length; i++) {
      const pId = String(pd[i][pidI]).trim();
      if (pId) {
        prevMap[pId] = {
          target: toNum(pd[i][targetI]),
          frequency: pd[i][freqI] || 'Weekly',
          day: pd[i][dayI] || 'Monday'
        };
      }
    }
    
    // Read current month's columns
    const cd = sh.getDataRange().getValues();
    const ch = cd[0];
    const c_pidI = ch.indexOf('Party ID');
    const c_targetI = ch.indexOf('Target Quantity (kg)');
    const c_remainI = ch.indexOf('Remaining (kg)');
    const c_freqI = ch.indexOf('Delivery Frequency');
    const c_dayI = ch.indexOf('Preferred Day');
    const c_statusI = ch.indexOf('Status');
    const c_updI = ch.indexOf('Updated At');
    
    if (c_pidI === -1 || c_targetI === -1 || c_remainI === -1 || c_freqI === -1 || c_dayI === -1 || c_statusI === -1) {
      throw new Error("Lifting columns are missing in the sheet.");
    }
    
    let updateCount = 0;
    const nowStr = fmtDate(new Date());
    
    const c_delivI = ch.indexOf('Delivered Quantity (kg)');
    for (let i = 1; i < cd.length; i++) {
      const pId = String(cd[i][c_pidI]).trim();
      const prevData = prevMap[pId];
      if (prevData) {
        const delivered = c_delivI !== -1 ? toNum(cd[i][c_delivI]) : 0;
        const targetVal = prevData.target;
        const remainVal = Math.max(0, targetVal - delivered);
        const statusVal = targetVal > 0 ? (remainVal <= 0 ? 'COMPLETED' : 'IN PROGRESS') : 'NO TARGET';

        sh.getRange(i + 1, c_targetI + 1).setValue(targetVal);
        sh.getRange(i + 1, c_remainI + 1).setValue(remainVal);
        sh.getRange(i + 1, c_freqI + 1).setValue(prevData.frequency);
        sh.getRange(i + 1, c_dayI + 1).setValue(prevData.day);
        sh.getRange(i + 1, c_statusI + 1).setValue(statusVal);
        if (c_updI !== -1) {
          sh.getRange(i + 1, c_updI + 1).setValue(nowStr);
        }
        updateCount++;
      }
    }
    
    if (updateCount > 0) {
      SpreadsheetApp.flush();
    }
    return { success: true, updated: updateCount };
    
  } catch (e) {
    console.error('carryForwardLiftingTargets error:', e.message);
    throw new Error(e.message);
  }
}

function getOrCreateLiftingSheet(monthKey){
  monthKey = monthKey || mk();
  return SS().getSheetByName(CFG.LIFTING_PREFIX+monthKey) || ensureLiftingSheet(monthKey);
}

function initDatabase(){
  ensureSheet(CFG.SH.USERS,     CFG.COLS.USERS,        '#1e293b');
  ensureSheet(CFG.SH.SETTINGS,  CFG.COLS.SETTINGS,     '#1e293b');
  ensureSheet(CFG.SH.PARTIES,   CFG.COLS.PARTIES,      '#3730a3');

  // Safely delete Contacts and Tasks sheets as requested to remove them completely
  try {
    const shContacts = SS().getSheetByName(CFG.SH.CONTACTS);
    if (shContacts) {
      SS().deleteSheet(shContacts);
    }
  } catch (e) {
    console.warn('Could not delete Contacts sheet:', e.message);
  }

  try {
    const shTasks = SS().getSheetByName(CFG.SH.TASKS);
    if (shTasks) {
      SS().deleteSheet(shTasks);
    }
  } catch (e) {
    console.warn('Could not delete Tasks sheet:', e.message);
  }

  ensureSheet(CFG.SH.INTERACTIONS,CFG.COLS.INTERACTIONS,'#b45309');
  ensureSheet(CFG.SH.LEDGER,    CFG.COLS.LEDGER,       '#065f46');
  ensureSheet(CFG.SH.LIFTING_HISTORY,CFG.COLS.LIFTING_HISTORY,'#9a3412'); 

  const uSh=SS().getSheetByName(CFG.SH.USERS);
  if(uSh.getLastRow()<2)
    uSh.appendRow([Session.getEffectiveUser().getEmail(),CFG.ROLES.ADMIN,new Date()]);

  const sSh=SS().getSheetByName(CFG.SH.SETTINGS);
  if(sSh.getLastRow()<2)
    [['theme','ocean'],['remindersEnabled','true'],['adminEmail','']].forEach(r=>sSh.appendRow(r));

  const pSh=SS().getSheetByName(CFG.SH.PARTIES);
  if(pSh.getLastRow()<2)
    CFG.DEMO_PARTIES.forEach(p=>pSh.appendRow([uid('P'),p[0],p[1],p[2],p[3],'',0,p[4],
      'ACTIVE',50,Session.getActiveUser().getEmail(),new Date(),new Date()]));

  ensureMonthSheet(mk());
  ensureLiftingSheet(mk());
  autoCreateNextMonth();
  return{success:true};
}

function autoCreateNextMonth(){
  try{
    const now=new Date();
    const nk=mk(new Date(now.getFullYear(),now.getMonth()+1,1));
    let created=false;
    if(!SS().getSheetByName(CFG.MONTHLY_PREFIX+nk)){
      ensureMonthSheet(nk);
      created=true;
    }
    if(!SS().getSheetByName(CFG.LIFTING_PREFIX+nk)){
      ensureLiftingSheet(nk); 
      created=true;
    }
    return{created:created,month:nk};
  }catch(e){
    console.error('autoCreateNextMonth:',e.message);
    return{created:false,error:e.message};
  }
}

function getAllPartiesRaw(){
  const sh=SS().getSheetByName(CFG.SH.PARTIES);
  if(!sh||sh.getLastRow()<2) return[];
  const d=sh.getDataRange().getValues(); const h=d[0];
  return d.slice(1).map(r=>{ const o={}; h.forEach((k,i)=>o[k]=r[i]); return o; });
}

function getParties(){
  return getAllPartiesRaw().map(p=>({
    partyId:p['Party ID'], slNo:p['SL NO'], accountName:p['Account Name'],
    contactNo:p['Contact No'], address:p['Address'], email:p['Email'],
    creditLimit:toNum(p['Credit Limit']), creditDays:p['Credit Days'],
    status:p['Status'], score:parseInt(p['Score'])||50, paymentMode:p['Payment Mode']
  }));
}

function syncNewPartyToExistingMonths(partyId, p) {
  const ss = SS();
  const sheets = ss.getSheets();
  const now = new Date();
  const inv = fmtDate(now);
  const dn = cdNum(p.creditDays);
  const target = dn === 0 ? inv : fmtDate(addDays(now, dn));

  sheets.forEach(sh => {
    const name = sh.getName();
    if (name.startsWith(CFG.MONTHLY_PREFIX)) {
      const data = sh.getDataRange().getValues();
      const exists = data.slice(1).some(row => String(row[1]) === String(partyId));
      if (!exists) {
        sh.appendRow([
          uid('MR'), partyId, p.accountName || '', p.contactNo || '',
          0, 0, 0, 0, 0, p.creditDays || '7 DAYS', inv, target, '',
          p.creditDays === 'ADVANCE' ? 'ADVANCE' : 'ACTIVE', 50, 0, '', inv
        ]);
      }
    }
    if (name.startsWith(CFG.LIFTING_PREFIX)) {
      const mKey = name.replace(CFG.LIFTING_PREFIX, '');
      const data = sh.getDataRange().getValues();
      const exists = data.slice(1).some(row => String(row[1]) === String(partyId));
      if (!exists) {
        sh.appendRow([
          uid('LR'), partyId, p.accountName || '', p.contactNo || '', mKey,
          0, 0, 0, 0, 'Weekly', 'Monday', 'NO TARGET', '', '', inv, inv
        ]);
      }
    }
  });
}

function addParty(data){
  assertRole([CFG.ROLES.ADMIN,CFG.ROLES.COLLECTOR]);
  const sh=SS().getSheetByName(CFG.SH.PARTIES);
  const id=uid('P');
  sh.appendRow([id,data.slNo||'',data.accountName||'',data.contactNo||'',
    data.address||'',data.email||'',toNum(data.creditLimit),data.creditDays||'7 DAYS',
    'ACTIVE',50,data.paymentMode||'',Session.getActiveUser().getEmail(),new Date(),new Date()]);
  try{
    const monthKey=mk();
    getOrCreateMonthSheet(monthKey);
    getOrCreateLiftingSheet(monthKey);
    syncNewPartyToExistingMonths(id, data);
  }catch(e){ console.error('addParty month sync:',e); }
  return id;
}

function updateParty(partyId,updates){
  assertRole([CFG.ROLES.ADMIN,CFG.ROLES.COLLECTOR]);
  const sh=SS().getSheetByName(CFG.SH.PARTIES);
  const d=sh.getDataRange().getValues(); const h=d[0];
  const c=colMap1(h);
  const fm={accountName:'Account Name',contactNo:'Contact No',address:'Address',
            email:'Email',creditLimit:'Credit Limit',creditDays:'Credit Days',
            status:'Status',paymentMode:'Payment Mode'};
  for(let i=1;i<d.length;i++){
    if(String(d[i][0])===String(partyId)){
      Object.entries(updates).forEach(([k,v])=>{ if(fm[k]&&c[fm[k]]) sh.getRange(i+1,c[fm[k]]).setValue(v); });
      sh.getRange(i+1,c['Updated At']).setValue(new Date());
      return true;
    }
  }
  throw new Error('Party not found');
}

function deleteParty(partyId){
  assertRole([CFG.ROLES.ADMIN]);
  const sh=SS().getSheetByName(CFG.SH.PARTIES);
  const d=sh.getDataRange().getValues();
  for(let i=1;i<d.length;i++){
    if(String(d[i][0])===String(partyId)){ sh.deleteRow(i+1); return true; }
  }
  throw new Error('Party not found');
}

function updatePartyScore(partyId,score){
  const sh=SS().getSheetByName(CFG.SH.PARTIES);
  if(!sh) return;
  const d=sh.getDataRange().getValues(); const h=d[0];
  const pi=h.indexOf('Party ID'); const si=h.indexOf('Score');
  for(let i=1;i<d.length;i++){
    if(String(d[i][pi])===String(partyId)){ sh.getRange(i+1,si+1).setValue(score); return; }
  }
}

function syncMonthlyFromLedger(monthKey) {
  monthKey = monthKey || mk();
  const ledgerSheet = SS().getSheetByName(CFG.SH.LEDGER);
  const monthSheet = SS().getSheetByName(CFG.MONTHLY_PREFIX + monthKey);
  if (!ledgerSheet || !monthSheet || ledgerSheet.getLastRow() < 2 || monthSheet.getLastRow() < 2) return;

  const ledgerData = ledgerSheet.getDataRange().getValues();
  const lh = ledgerData[0];
  const l_pidSrc = lh.indexOf('Party ID');
  const l_moSrc = lh.indexOf('Month');
  const l_dbSrc = lh.indexOf('Debit (New Credit)');
  const l_crSrc = lh.indexOf('Credit (Payment)');
  const l_notesSrc = lh.indexOf('Notes');
  
  if (l_pidSrc === -1 || l_moSrc === -1 || l_dbSrc === -1 || l_crSrc === -1) return;

  // Load initial opening balances of all parties from Parties sheet
  const initialOp = {};
  try {
    const parties = getAllPartiesRaw();
    parties.forEach(p => {
      const pId = String(p['Party ID'] || '').trim();
      if (pId) {
        initialOp[pId] = toNum(p['Opening Balance']);
      }
    });
  } catch(e) {
    console.log("Error loading initial party opening balances:", e);
  }
  
  const stats = {};
  const lastClosing = {};
  
  for(let i=1; i<ledgerData.length; i++) {
    const l = ledgerData[i];
    const pid = String(l[l_pidSrc]).trim();
    if (!pid) continue;
    
    if (!stats[pid]) stats[pid] = { db: 0, cr: 0, openingBalance: 0, activeInMonth: false };
    
    let rawMonth = l[l_moSrc];
    let recMonth = '';
    if (rawMonth instanceof Date) {
      recMonth = Utilities.formatDate(rawMonth, Session.getScriptTimeZone(), 'yyyy-MM');
    } else {
      recMonth = String(rawMonth || '').trim();
    }

    let debit = toNum(l[l_dbSrc]);
    let credit = toNum(l[l_crSrc]);
    
    // Safeguard against Double-Entry bug 
    if (debit > 0 && credit > 0 && debit === credit) {
       const notes = String(l[l_notesSrc]||'').toLowerCase();
       if(notes.includes("pay") || notes.includes("neft") || notes.includes("rtgs") || notes.includes("cash")) {
           debit = 0;
       } else {
           credit = 0;
       }
    }

    if (recMonth === monthKey || recMonth.includes(monthKey)) {
      if (!stats[pid].activeInMonth) {
        stats[pid].activeInMonth = true;
        stats[pid].openingBalance = lastClosing[pid] !== undefined ? lastClosing[pid] : (initialOp[pid] || 0);
      }
      
      stats[pid].db += debit;
      stats[pid].cr += credit;
    } else if (recMonth < monthKey) {
      if (lastClosing[pid] === undefined) {
        lastClosing[pid] = initialOp[pid] || 0;
      }
      lastClosing[pid] = lastClosing[pid] + debit - credit;
    }
  }

  for(let p in stats) {
    if (!stats[p].activeInMonth) {
      stats[p].openingBalance = lastClosing[p] !== undefined ? lastClosing[p] : (initialOp[p] || 0);
    }
  }

  const mData = monthSheet.getDataRange().getValues();
  const mh = mData[0];
  const m_pidIdx = mh.indexOf('Party ID');
  const m_ncIdx = mh.indexOf('New Credit');
  const m_paIdx = mh.indexOf('Paid Amount');
  const m_obIdx = mh.indexOf('Opening Balance');
  const m_tdIdx = mh.indexOf('Total Debt');
  const m_balIdx = mh.indexOf('Balance');
  const m_statIdx = mh.indexOf('Status');
  const m_cdIdx = mh.indexOf('Credit Days');
  const m_tgtIdx = mh.indexOf('Target Date');
  const c1 = colMap1(mh);

  let updated = false;
  const today = new Date(); today.setHours(0,0,0,0);

  for(let i=1; i<mData.length; i++) {
    const row = mData[i];
    const pid = String(row[m_pidIdx]).trim();
    if (stats[pid]) {
      const op = stats[pid].openingBalance;
      const oldOp = Math.round(toNum(row[m_obIdx])*100)/100;
      const checkOp = Math.round(op*100)/100;
      
      const oldNc = Math.round(toNum(row[m_ncIdx])*100)/100;
      const oldPa = Math.round(toNum(row[m_paIdx])*100)/100;
      const checkNc = Math.round(stats[pid].db*100)/100;
      const checkPa = Math.round(stats[pid].cr*100)/100;
      
      const td = op + stats[pid].db;
      const bal = td - stats[pid].cr;
      
      const checkTd = Math.round(td*100)/100;
      const checkBal = Math.round(bal*100)/100;
      const oldTd = Math.round(toNum(row[m_tdIdx])*100)/100;
      const oldBal = Math.round(toNum(row[m_balIdx])*100)/100;
      
      if (oldNc !== checkNc || oldPa !== checkPa || oldTd !== checkTd || oldBal !== checkBal || oldOp !== checkOp) {
        monthSheet.getRange(i+1, c1['Opening Balance']).setValue(op);
        monthSheet.getRange(i+1, c1['New Credit']).setValue(stats[pid].db);
        monthSheet.getRange(i+1, c1['Paid Amount']).setValue(stats[pid].cr);
        monthSheet.getRange(i+1, c1['Total Debt']).setValue(td);
        monthSheet.getRange(i+1, c1['Balance']).setValue(bal);

        
        let st = row[m_statIdx];
        const cd = row[m_cdIdx];
        const tD = parseD(row[m_tgtIdx]);
        
        if (cd === 'ADVANCE') {
          st = 'ADVANCE';
        } else if (bal <= 0) {
          st = 'PAID';
        } else if (tD) {
          const df = Math.ceil((tD-today)/86400000);
          if (df < 0) st = 'OVERDUE'; 
          else if (df <= 2) st = 'DUE SOON';
          else st = 'ACTIVE';
        } else {
          st = 'ACTIVE';
        }
        
        monthSheet.getRange(i+1, c1['Status']).setValue(st);
        updated = true;
      }
    }
  }
  
  if (updated) SpreadsheetApp.flush();
}

function getMonthData(monthKey){
  monthKey=monthKey||mk();
  const sh=SS().getSheetByName(CFG.MONTHLY_PREFIX+monthKey);
  if(!sh||sh.getLastRow()<2) return[];
  
  carryForward(sh, monthKey);
  
  try {
    syncMonthlyFromLedger(monthKey); // Automatically sync on load!
  } catch(e) {
    console.log("Error syncing month from ledger", e);
  }

  const d=sh.getDataRange().getValues(); const h=d[0];
  const pIdx = h.indexOf('Party ID');
  const rows = [];
  for (let i = 1; i < d.length; i++) {
    const r = d[i];
    if (pIdx !== -1 && !String(r[pIdx]).trim()) continue; // Skip empty rows
    const o={}; h.forEach((k,idx)=>o[k]=r[idx]);
    ['Invoice Date','Target Date','Last Payment Date','Updated At'].forEach(k=>{
      if(o[k] instanceof Date) o[k]=fmtDate(o[k]);
    });
    ['New Credit','Total Debt','Paid Amount','Balance','Opening Balance','Overdue Days','Score'].forEach(k=>{
      o[k]=toNum(o[k]);
    });
    rows.push(o);
  }
  return rows;
}

function updateMonthRow(monthKey,rowId,updates){
  assertRole([CFG.ROLES.ADMIN,CFG.ROLES.COLLECTOR]);
  monthKey=monthKey||mk();
  const sh=getOrCreateMonthSheet(monthKey);
  const d=sh.getDataRange().getValues(); const h=d[0];
  const c=colMap1(h);
  const fm={
    accountName:'Account Name',contactNo:'Contact No',
    openingBalance:'Opening Balance',newCredit:'New Credit',
    paidAmount:'Paid Amount',creditDays:'Credit Days',
    invoiceDate:'Invoice Date',targetDate:'Target Date',
    lastPaymentDate:'Last Payment Date',
    status:'Status',score:'Score',notes:'Notes'
  };
  for(let i=1;i<d.length;i++){
    if(String(d[i][0])===String(rowId)){
      const r=i+1;
      Object.entries(updates).forEach(([k,v])=>{
        if(fm[k]&&c[fm[k]]) sh.getRange(r,c[fm[k]]).setValue(v);
      });
      const row=sh.getRange(r,1,1,h.length).getValues()[0];
      const rc=colMap(h);
      const op=toNum(row[rc['Opening Balance']]);
      const nc=toNum(row[rc['New Credit']]);
      const pp=toNum(row[rc['Paid Amount']]);
      const td=op+nc;
      const bal=td-pp;
      sh.getRange(r,c['Total Debt']).setValue(td);
      sh.getRange(r,c['Balance']).setValue(bal);
      if(!updates.status){
        const target=parseD(row[rc['Target Date']]);
        const now=new Date(); now.setHours(0,0,0,0);
        const cd=row[rc['Credit Days']];
        let st='ACTIVE';
        if(cd==='ADVANCE') st='ADVANCE';
        else if(bal<=0) st='PAID';
        else if(target){
          const df=Math.ceil((target-now)/86400000);
          if(df<0) st='OVERDUE'; else if(df<=2) st='DUE SOON';
        }
        sh.getRange(r,c['Status']).setValue(st);
        const ov=target?Math.max(Math.floor((now-target)/86400000),0):0;
        sh.getRange(r,c['Overdue Days']).setValue(ov);
      }
      sh.getRange(r,c['Updated At']).setValue(fmtDate(new Date()));
      return{success:true};
    }
  }
  throw new Error('Row not found: '+rowId+' in month: '+monthKey);
}

function getLastClosingBalance(partyId) {
  const sh = SS().getSheetByName(CFG.SH.LEDGER);
  if (!sh || sh.getLastRow() < 2) return 0;
  
  const d = sh.getDataRange().getValues();
  const c = colMap(d[0]);
  
  const pIdx = c['Party ID'];
  const l_dbSrc = c['Debit (New Credit)'];
  const l_crSrc = c['Credit (Payment)'];
  const l_notesSrc = c['Notes'];
  
  if (pIdx === undefined || l_dbSrc === undefined || l_crSrc === undefined) return 0;
  
  let initialBalance = 0;
  try {
    const partiesSh = SS().getSheetByName(CFG.SH.PARTIES);
    if (partiesSh && partiesSh.getLastRow() >= 2) {
      const pd = partiesSh.getDataRange().getValues();
      const pc = colMap(pd[0]);
      const partyIdCol = pc['Party ID'];
      const opBalCol = pc['Opening Balance'];
      if (partyIdCol !== undefined && opBalCol !== undefined) {
        for (let j = 1; j < pd.length; j++) {
          if (String(pd[j][partyIdCol]).trim() === String(partyId).trim()) {
            initialBalance = toNum(pd[j][opBalCol]);
            break;
          }
        }
      }
    }
  } catch(e) {
    console.log("Error finding party initial balance:", e);
  }
  
  let balance = initialBalance;
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][pIdx]).trim() === String(partyId).trim()) {
      let debit = toNum(d[i][l_dbSrc]);
      let credit = toNum(d[i][l_crSrc]);
      
      // Safeguard against Double-Entry bug 
      if (debit > 0 && credit > 0 && debit === credit) {
         const notes = String(d[i][l_notesSrc]||'').toLowerCase();
         if(notes.includes("pay") || notes.includes("neft") || notes.includes("rtgs") || notes.includes("cash")) {
             debit = 0;
         } else {
             credit = 0;
         }
      }
      balance = balance + debit - credit;
    }
  }
  return balance;
}

function addCredit(partyId,amount,notes,monthKey){
  assertRole([CFG.ROLES.ADMIN,CFG.ROLES.COLLECTOR]);
  monthKey=monthKey||mk();
  const sh=getOrCreateMonthSheet(monthKey);
  const d=sh.getDataRange().getValues(); const h=d[0];
  const c=colMap(h); const c1=colMap1(h);
  for(let i=1;i<d.length;i++){
    if(String(d[i][c['Party ID']])===String(partyId)){
      const r=i+1;
      const oldTotalDebt = toNum(d[i][c['Total Debt']]);
      const oldPaidAmount = toNum(d[i][c['Paid Amount']]);
      const oldNewCredit = toNum(d[i][c['New Credit']]);
      
      const newAmount = toNum(amount);
      const newNewCredit = oldNewCredit + newAmount;
      const newTotalDebt = oldTotalDebt + newAmount;
      const newBalance = newTotalDebt - oldPaidAmount;
      
      const cd=d[i][c['Credit Days']];
      const dn=cdNum(cd);
      const now=new Date();
      const target=dn===0?fmtDate(now):fmtDate(addDays(now,dn));
      const today=new Date(); today.setHours(0,0,0,0);
      const tD=parseD(target);
      let st=cd==='ADVANCE'?'ADVANCE':'ACTIVE';
      if(cd!=='ADVANCE'&&tD){
        const df=Math.ceil((tD-today)/86400000);
        if(newBalance<=0) st='PAID'; else if(df<0) st='OVERDUE'; else if(df<=2) st='DUE SOON';
      }

      sh.getRange(r,c1['New Credit']).setValue(newNewCredit);
      sh.getRange(r,c1['Total Debt']).setValue(newTotalDebt);
      sh.getRange(r,c1['Balance']).setValue(newBalance);
      
      sh.getRange(r,c1['Invoice Date']).setValue(fmtDate(now));
      sh.getRange(r,c1['Target Date']).setValue(target);
      sh.getRange(r,c1['Notes']).setValue(notes||'');
      sh.getRange(r,c1['Status']).setValue(newBalance<=0?'PAID':st);
      sh.getRange(r,c1['Updated At']).setValue(fmtDate(now));
      
      const previousClosing = getLastClosingBalance(partyId);
      const newLedgerBalance = previousClosing + newAmount;
      
      addLedgerEntry({
        partyId,
        accountName:d[i][c['Account Name']],
        month:monthKey,
        openingBalance:previousClosing,
        debit:newAmount,
        credit:0,
        closingBalance:newLedgerBalance,
        status:st,
        notes:notes||''
      });
      return{success:true,totalDebt:newTotalDebt,balance:newBalance,targetDate:target};
    }
  }
  throw new Error('Party not found in month: '+monthKey);
}

function recordPayment(partyId,amount,method,reference,notes,monthKey){
  assertRole([CFG.ROLES.ADMIN,CFG.ROLES.COLLECTOR]);
  monthKey = monthKey || mk();
  const sh = getOrCreateMonthSheet(monthKey);
  const d = sh.getDataRange().getValues(); 
  const h = d[0];
  const c = colMap(h); 
  const c1 = colMap1(h);
  
  for(let i=1; i<d.length; i++){
    if(String(d[i][c['Party ID']]) === String(partyId)){
      const r = i+1;
      const oldTotalDebt = toNum(d[i][c['Total Debt']]);
      const oldPaidAmount = toNum(d[i][c['Paid Amount']]);
      const paymentAmount = toNum(amount);
      
      const newPaidAmount = oldPaidAmount + paymentAmount;
      const newBalance = oldTotalDebt - newPaidAmount;

      const cs = parseInt(d[i][c['Score']]) || 50;
      const target = parseD(d[i][c['Target Date']]);
      const today = new Date(); today.setHours(0,0,0,0);
      const dl = target ? Math.floor((today-target)/86400000) : 0;
      const sa = newBalance<=0 ? (dl<=0?10:dl<=7?5:dl<=15?0:-10) : Math.max(2-Math.min(dl,10),-8);
      const ns = Math.min(100, Math.max(0, cs+sa));
      const st = newBalance<=0 ? 'PAID' : dl>0 ? 'OVERDUE' : 'ACTIVE';
      
      sh.getRange(r,c1['Paid Amount']).setValue(newPaidAmount);
      sh.getRange(r,c1['Balance']).setValue(newBalance);
      sh.getRange(r,c1['Last Payment Date']).setValue(fmtDate(new Date()));
      sh.getRange(r,c1['Status']).setValue(st);
      sh.getRange(r,c1['Score']).setValue(ns);
      sh.getRange(r,c1['Overdue Days']).setValue(Math.max(dl,0));
      sh.getRange(r,c1['Updated At']).setValue(fmtDate(new Date()));
      
      updatePartyScore(partyId, ns);
      
      const previousClosing = getLastClosingBalance(partyId);
      const newLedgerBalance = previousClosing - paymentAmount;
      
      addLedgerEntry({
        partyId,
        accountName: d[i][c['Account Name']],
        month: monthKey,
        openingBalance: previousClosing, 
        debit: 0,
        credit: paymentAmount,
        closingBalance: newLedgerBalance,
        status: st,
        notes: `${method||'Cash'} ${reference||'-'} ${notes||''}`
      });
      return {success:true, newBal:newBalance, newScore:ns, newStatus:st};
    }
  }
  throw new Error('Party not found in month sheet');
}

function addAuditLog(e) {
  try {
    const sh = ensureSheet('Audit Logs', ['Timestamp', 'Type', 'Party ID', 'Account Name', 'User', 'Field', 'Old Value', 'New Value', 'Details'], '#7f1d1d');
    const now = new Date();
    const user = Session.getActiveUser().getEmail() || 'System';
    sh.appendRow([
      now,
      e.type || 'VALIDATION',
      e.partyId || '',
      e.accountName || '',
      user,
      e.field || '',
      String(e.oldVal !== undefined ? e.oldVal : ''),
      String(e.newVal !== undefined ? e.newVal : ''),
      e.details || ''
    ]);
  } catch(err) {
    console.log("Error writing audit log:", err);
  }
}

function onEdit(e) {
  if (!e) return;
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    
    if (sheetName === CFG.SH.LEDGER) {
      const row = range.getRow();
      const col = range.getColumn();
      
      // 'Opening Balance' is 5th column.
      if (row > 1 && col === 5) {
        const oldVal = e.oldValue;
        const newVal = range.getValue();
        
        const partyId = sheet.getRange(row, 2).getValue();
        const accountName = sheet.getRange(row, 3).getValue();
        
        addAuditLog({
          type: 'LEDGER_SHEET_EDIT',
          partyId: partyId,
          accountName: accountName,
          field: 'Opening Balance',
          oldVal: oldVal,
          newVal: newVal,
          details: `User manually edited Opening Balance cell in 'Ledger' sheet at row ${row}, col ${col} from ₹${oldVal} to ₹${newVal}.`
        });
      }
    }
  } catch(err) {
    console.log("Error in onEdit trigger:", err);
  }
}

function addLedgerEntry(e){
  const expectedOpening = getLastClosingBalance(e.partyId);
  const passedOpening = toNum(e.openingBalance);
  
  if (Math.abs(passedOpening - expectedOpening) > 0.01) {
    addAuditLog({
      type: 'LEDGER_OVERRIDE_WARNING',
      partyId: e.partyId,
      accountName: e.accountName,
      field: 'Opening Balance',
      oldVal: expectedOpening,
      newVal: passedOpening,
      details: `Manual opening balance override detected! Attempted override from ₹${expectedOpening} to ₹${passedOpening} for transaction: ${e.notes || ''}. Auto-corrected to prevent data corruption.`
    });
    
    e.openingBalance = expectedOpening;
    e.closingBalance = expectedOpening + (e.debit || 0) - (e.credit || 0);
  }

  const sh=ensureSheet(CFG.SH.LEDGER,CFG.COLS.LEDGER,'#065f46');
  const data = sh.getDataRange().getValues();
  const h = data[0];
  
  const colMap = {};
  h.forEach((header, index) => {
    colMap[header.toString().trim().toLowerCase()] = index;
  });

  const newRow = new Array(h.length).fill("");

  const setValue = (targetHeaderNames, value) => {
    for (let name of targetHeaderNames) {
      let idx = colMap[name.toLowerCase()];
      if (idx !== undefined) {
        newRow[idx] = value;
        return true;
      }
    }
    return false;
  };

  setValue(['Timestamp', 'Date'], new Date());
  setValue(['Party ID'], e.partyId);
  setValue(['Account Name', 'Account'], e.accountName || '');
  setValue(['Month'], String(e.month || mk()));
  setValue(['Opening Balance', 'Opening'], e.openingBalance || 0);
  setValue(['Debit (New Credit)', 'Debit (Credit)', 'Debit'], e.debit || 0);
  setValue(['Credit (Payment)', 'Credit (Payment)', 'Credit'], e.credit || 0);
  setValue(['Closing Balance', 'Closing'], e.closingBalance || 0);
  setValue(['Status'], e.status || '');
  setValue(['Collector', 'User'], Session.getActiveUser().getEmail());
  setValue(['Notes'], e.notes || '');

  sh.appendRow(newRow);
}

function getLedger(monthFilter){
  const sh=SS().getSheetByName(CFG.SH.LEDGER);
  if(!sh||sh.getLastRow()<2) return[];
  const d=sh.getDataRange().getValues(); const h=d[0];
  
  const findIdx = (keywords) => {
    return h.findIndex(hdr => {
      const s = hdr.toString().toLowerCase();
      return keywords.some(k => {
        const kl = k.toLowerCase();
        if (kl === 'credit') {
          return s.includes('credit') && !s.includes('debit');
        }
        return s.includes(kl);
      });
    });
  };

  const idxTs = findIdx(['timestamp', 'date']);
  const idxParty = findIdx(['party id']);
  const idxAcc = findIdx(['account', 'name']);
  const idxMnth = findIdx(['month']);
  const idxOp = findIdx(['opening']);
  const idxDb = findIdx(['debit', 'new credit']);
  const idxCr = findIdx(['credit', 'payment']);
  const idxCl = findIdx(['closing']);
  const idxSt = findIdx(['status']);
  const idxNt = findIdx(['notes']);

  const rows=d.slice(1).map(r=>{
    const getV = (idx) => idx !== -1 ? r[idx] : 0;
    
    let dateValue = '';
    if (idxTs !== -1 && r[idxTs]) {
      const ts = r[idxTs];
      dateValue = (ts instanceof Date) ? fmtDate(ts) : String(ts);
    }

    let monthName = '';
    let monthKey = '';
    if (idxMnth !== -1 && r[idxMnth]) {
      const m = r[idxMnth];
      if (m instanceof Date) {
        monthName = Utilities.formatDate(m, Session.getScriptTimeZone(), 'MMMM');
        monthKey = Utilities.formatDate(m, Session.getScriptTimeZone(), 'yyyy-MM');
      } else {
        monthName = String(m);
        monthKey = String(m); 
      }
    }

    return {
      'Timestamp': dateValue,
      'Party ID': idxParty !== -1 ? r[idxParty] : '',
      'Account Name': idxAcc !== -1 ? r[idxAcc] : '',
      'Month': monthKey,        
      'MonthName': monthName,   
      'Opening Balance': toNum(getV(idxOp)),
      'Debit (New Credit)': toNum(getV(idxDb)),
      'Credit (Payment)': toNum(getV(idxCr)),
      'Closing Balance': toNum(getV(idxCl)),
      'Status': idxSt !== -1 ? r[idxSt] : '',
      'Notes': idxNt !== -1 ? r[idxNt] : ''
    };
  });

  if(monthFilter && typeof monthFilter==='string' && monthFilter.trim() !== '') {
    let filterFormatted = monthFilter;
    if(monthFilter.includes(' ')) {
       const parts = monthFilter.split(' ');
       const d = new Date(parts[1] + '-' + parts[0] + '-01');
       if(!isNaN(d.getTime())) filterFormatted = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
    }
    return rows.filter(r => String(r['Month']).trim() === String(filterFormatted).trim());
  }
  return rows;
}


function listLiftingMonths(){
  const sheets = SS().getSheets();
  const months = [];
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name.indexOf(CFG.LIFTING_PREFIX) === 0) {
      months.push(name.replace(CFG.LIFTING_PREFIX, ''));
    }
  }
  months.sort();
  return months;
}

function getLiftingData(monthKey){
  monthKey = monthKey || mk();
  const sheetName = CFG.LIFTING_PREFIX + monthKey;
  let sh = SS().getSheetByName(sheetName);
  if(!sh) sh = ensureLiftingSheet(monthKey);
  if(!sh || sh.getLastRow() < 2) return [];
  const d = sh.getDataRange().getValues();
  const h = d[0];
  const result = [];
  for(let i = 1; i < d.length; i++){
    const row = d[i];
    if(!row[0] && !row[1]) continue;
    const obj = {};
    for(let j = 0; j < h.length; j++){
      let val = row[j];
      if(val instanceof Date) val = fmtDate(val);
      obj[h[j]] = val;
    }
    ['Target Quantity (kg)', 'Delivered Quantity (kg)', 'Remaining (kg)', 'Completion %', 'Last Delivery Qty']
      .forEach(f => { if(obj[f] !== undefined) obj[f] = parseFloat(obj[f]) || 0; });
    result.push(obj);
  }
  return result;
}

function updateLiftingTarget(monthKey,rowId,updates){
  assertRole([CFG.ROLES.ADMIN,CFG.ROLES.COLLECTOR]);
  monthKey=monthKey||mk();
  const sh=getOrCreateLiftingSheet(monthKey);
  const d=sh.getDataRange().getValues(); const h=d[0];
  const c=colMap1(h);
  const fm={
    targetQuantity:'Target Quantity (kg)',
    deliveryFrequency:'Delivery Frequency',
    preferredDay:'Preferred Day'
  };
  for(let i=1;i<d.length;i++){
    if(String(d[i][0])===String(rowId)){
      const r=i+1;
      Object.entries(updates).forEach(([k,v])=>{
        if(fm[k]&&c[fm[k]]) sh.getRange(r,c[fm[k]]).setValue(v);
      });
      const row=sh.getRange(r,1,1,h.length).getValues()[0];
      const rc=colMap(h);
      const target=toNum(row[rc['Target Quantity (kg)']]);
      const delivered=toNum(row[rc['Delivered Quantity (kg)']]);
      const remaining=Math.max(target-delivered,0);
      const completion=target>0?Math.min(Math.round((delivered/target)*100),100):0;
      let status='NOT STARTED';
      if(target===0) status='NO TARGET';
      else if(delivered===0) status='NOT STARTED';
      else if(delivered>=target) status='COMPLETED';
      else status='IN PROGRESS';
      sh.getRange(r,c['Remaining (kg)']).setValue(remaining);
      sh.getRange(r,c['Completion %']).setValue(completion);
      sh.getRange(r,c['Status']).setValue(status);
      sh.getRange(r,c['Updated At']).setValue(fmtDate(new Date()));
      return{success:true};
    }
  }
  throw new Error('Row not found: '+rowId+' in month: '+monthKey);
}

function completeLiftingTarget(monthKey,rowId){
  assertRole([CFG.ROLES.ADMIN,CFG.ROLES.COLLECTOR]);
  monthKey=monthKey||mk();
  const sh=getOrCreateLiftingSheet(monthKey);
  const d=sh.getDataRange().getValues(); const h=d[0];
  const c=colMap(h); const c1=colMap1(h);
  for(let i=1;i<d.length;i++){
    if(String(d[i][0])===String(rowId)){
      const r=i+1;
      const target=toNum(d[i][c['Target Quantity (kg)']]);
      const delivered=toNum(d[i][c['Delivered Quantity (kg)']]);
      if(target===0) throw new Error('No target set');
      if(delivered >= target) return {success:true};
      const remainingNeeded = target - delivered;
      
      sh.getRange(r,c1['Delivered Quantity (kg)']).setValue(target);
      sh.getRange(r,c1['Remaining (kg)']).setValue(0);
      sh.getRange(r,c1['Completion %']).setValue(100);
      sh.getRange(r,c1['Status']).setValue('COMPLETED');
      sh.getRange(r,c1['Last Delivery Date']).setValue(fmtDate(new Date()));
      sh.getRange(r,c1['Last Delivery Qty']).setValue(remainingNeeded);
      sh.getRange(r,c1['Updated At']).setValue(fmtDate(new Date()));
      
      addDeliveryRecord({
        partyId:d[i][c['Party ID']],
        accountName:d[i][c['Account Name']],
        month:monthKey,
        quantity:remainingNeeded,
        cumulative:target,
        notes:'Auto-completed target'
      });
      return {success:true};
    }
  }
  throw new Error('Row not found: '+rowId);
}

function recordDelivery(monthKey, partyId, quantity, notes) {
  assertRole([CFG.ROLES.ADMIN, CFG.ROLES.COLLECTOR]);
  monthKey = monthKey || mk();
  const sh = getOrCreateLiftingSheet(monthKey);
  const d = sh.getDataRange().getValues(); 
  const h = d[0];
  const c = colMap(h); 
  const c1 = colMap1(h);

  for (let i = 1; i < d.length; i++) {
    if (String(d[i][c['Party ID']]) === String(partyId)) {
      const r = i + 1;
      const target = toNum(d[i][c['Target Quantity (kg)']]);
      const oldDelivered = toNum(d[i][c['Delivered Quantity (kg)']]);
      
      const tripQty = toNum(quantity);
      const newDelivered = oldDelivered + tripQty;
      const remaining = Math.max(target - newDelivered, 0);
      const completion = target > 0 ? Math.min(Math.round((newDelivered / target) * 100), 100) : 0;      
      let status = 'IN PROGRESS';
      if (target === 0) status = 'NO TARGET';
      else if (newDelivered >= target) status = 'COMPLETED';

      sh.getRange(r, c1['Delivered Quantity (kg)']).setValue(newDelivered);
      sh.getRange(r, c1['Remaining (kg)']).setValue(remaining);
      sh.getRange(r, c1['Completion %']).setValue(completion);
      sh.getRange(r, c1['Status']).setValue(status);
      sh.getRange(r, c1['Last Delivery Date']).setValue(fmtDate(new Date()));
      sh.getRange(r, c1['Last Delivery Qty']).setValue(tripQty);
      sh.getRange(r, c1['Updated At']).setValue(fmtDate(new Date()));
      
      addDeliveryRecord({
        partyId: partyId,
        accountName: d[i][c['Account Name']],
        month: monthKey,
        quantity: tripQty,
        cumulative: newDelivered,
        notes: notes || ''
      });

      return { success: true };
    }
  }
}

function resetLiftingDeliveries(monthKey,rowId){
  assertRole([CFG.ROLES.ADMIN,CFG.ROLES.COLLECTOR]);
  monthKey=monthKey||mk();
  const sh=getOrCreateLiftingSheet(monthKey);
  const d=sh.getDataRange().getValues(); const h=d[0];
  const c=colMap(h); const c1=colMap1(h);
  for(let i=1;i<d.length;i++){
    if(String(d[i][0])===String(rowId)){
      const r=i+1;
      const target=toNum(d[i][c['Target Quantity (kg)']]);
      let status = target===0?'NO TARGET':'NOT STARTED';
      sh.getRange(r,c1['Delivered Quantity (kg)']).setValue(0);
      sh.getRange(r,c1['Remaining (kg)']).setValue(target);
      sh.getRange(r,c1['Completion %']).setValue(0);
      sh.getRange(r,c1['Status']).setValue(status);
      sh.getRange(r,c1['Last Delivery Qty']).setValue(0);
      sh.getRange(r,c1['Updated At']).setValue(fmtDate(new Date()));
      return {success:true};
    }
  }
}

function addDeliveryRecord(data) {
  const sh = ensureSheet(CFG.SH.LIFTING_HISTORY, CFG.COLS.LIFTING_HISTORY, '#9a3412');
  let target = 0;
  const liftSheet = SS().getSheetByName(CFG.LIFTING_PREFIX + data.month);
  if (liftSheet) {
    const liftData = liftSheet.getDataRange().getValues();
    const liftH = liftData[0];
    const pIdx = liftH.indexOf('Party ID');
    const tIdx = liftH.indexOf('Target Quantity (kg)');
    for (let i = 1; i < liftData.length; i++) {
      if (String(liftData[i][pIdx]) === String(data.partyId)) {
        target = toNum(liftData[i][tIdx]);
        break;
      }
    }
  }

  const tripQty = toNum(data.quantity);
  const cumulative = toNum(data.cumulative);
  const remaining = Math.max(target - cumulative, 0);
  const completion = target > 0 ? Math.min(Math.round((cumulative / target) * 100), 100) : 0;
  
  let status = 'IN PROGRESS';
  if (target > 0 && remaining === 0) status = 'COMPLETED';
  else if (target === 0) status = 'NO TARGET';

  sh.appendRow([
    new Date(), 
    data.partyId,
    data.accountName || '',
    String(data.month),
    target,
    tripQty,
    cumulative,
    remaining,
    completion,
    status,
    Session.getActiveUser().getEmail(),
    data.notes || ''
  ]);
}

function getDeliveryHistory(partyId, monthFilter){
  const sh = SS().getSheetByName(CFG.SH.LIFTING_HISTORY);
  if(!sh || sh.getLastRow() < 2) return [];
  const d = sh.getDataRange().getValues();
  const h = d[0];
  const rows = [];
  for(let i=1; i<d.length; i++){
    const row = d[i];
    if(!row[0]) continue;
    const obj = {};
    h.forEach((key, idx) => {
      let val = row[idx];
      if(val instanceof Date) val = fmtDate(val);
      obj[key] = val;
    });
    rows.push(obj);
  }
  let filtered = rows;
  if(partyId && partyId !== '' && partyId !== 'null'){
    filtered = filtered.filter(r => String(r['Party ID']) === String(partyId));
  }
  if(monthFilter && monthFilter !== '' && monthFilter !== 'null'){
    filtered = filtered.filter(r => String(r['Month']).trim() === String(monthFilter).trim());
  }
  return filtered;
}

function closeMonth(monthKey){
  assertRole([CFG.ROLES.ADMIN]);
  monthKey=monthKey||mk();
  const sh=SS().getSheetByName(CFG.MONTHLY_PREFIX+monthKey);
  if(!sh) throw new Error('Month sheet not found: '+monthKey);
  const d=sh.getDataRange().getValues(); const h=d[0];
  const c=colMap(h); const c1=colMap1(h);
  let upd=0;
  for(let i=1;i<d.length;i++){
    const bal=toNum(d[i][c['Balance']]); const st=d[i][c['Status']];
    if(bal>0&&st!=='PAID'){ sh.getRange(i+1,c1['Status']).setValue('OVERDUE'); upd++; }
    else if(bal===0){ sh.getRange(i+1,c1['Status']).setValue('PAID'); }
  }
  const[yr,mo]=monthKey.split('-').map(Number);
  const nk=mk(new Date(yr,mo,1));
  ensureMonthSheet(nk);
  ensureLiftingSheet(nk);
  
  const nextSh = SS().getSheetByName(CFG.MONTHLY_PREFIX+nk);
  if(nextSh) carryForward(nextSh, nk);

  return{success:true,updated:upd,nextMonth:nk};
}

function listMonths(){
  return SS().getSheets()
    .map(s=>s.getName())
    .filter(n=>n.startsWith(CFG.MONTHLY_PREFIX))
    .map(n=>n.replace(CFG.MONTHLY_PREFIX,''))
    .sort();
}

function getAllMonthSummaries(){
  const months=listMonths(); const out={};
  months.forEach(monthKey=>{
    const sh=SS().getSheetByName(CFG.MONTHLY_PREFIX+monthKey);
    if(!sh||sh.getLastRow()<2){
      out[monthKey]={month:monthKey,year:monthKey.split('-')[0],
        totalDebt:0,totalCredit:0,totalPaid:0,totalBalance:0,
        overdueCount:0,paidCount:0,activeCount:0,dueSoonCount:0,partyCount:0};
      return;
    }
    const d=sh.getDataRange().getValues(); const h=d[0]; const c=colMap(h);
    let td=0,tc=0,tp=0,tb=0,oc=0,pc=0,ac=0,dc=0,partyCount=0;
    d.slice(1).forEach(row=>{
      if (c['Party ID'] !== undefined && !String(row[c['Party ID']]).trim()) return; // Skip empty rows
      partyCount++;
      td+=toNum(row[c['Total Debt']]); tc+=toNum(row[c['New Credit']]);
      tp+=toNum(row[c['Paid Amount']]); tb+=toNum(row[c['Balance']]);
      const st=row[c['Status']];
      if(st==='PAID') pc++; else if(st==='OVERDUE') oc++;
      else if(st==='DUE SOON') dc++; else ac++;
    });
    out[monthKey]={month:monthKey,year:monthKey.split('-')[0],
      totalDebt:td,totalCredit:tc,totalPaid:tp,totalBalance:tb,
      overdueCount:oc,paidCount:pc,activeCount:ac,dueSoonCount:dc,
      partyCount:partyCount};
  });
  return out;
}

function getSettings(){
  const sh=SS().getSheetByName(CFG.SH.SETTINGS);
  if(!sh||sh.getLastRow()<2) return{theme:'ocean',remindersEnabled:true,adminEmail:''};
  const d=sh.getDataRange().getValues(); const m={};
  d.slice(1).forEach(r=>{ let v=r[1]; if(v==='true')v=true; else if(v==='false')v=false; m[r[0]]=v; });
  return m;
}
function saveSetting(key,value){
  const sh=SS().getSheetByName(CFG.SH.SETTINGS);
  const d=sh.getDataRange().getValues();
  for(let i=1;i<d.length;i++){ if(d[i][0]===key){ sh.getRange(i+1,2).setValue(value); return; } }
  sh.appendRow([key,value]);
}

function getDashboardSummary(){
  autoCreateNextMonth();
  const curMk=mk();
  const md=getMonthData(curMk);
  const ams=getAllMonthSummaries();
  const parties=getAllPartiesRaw();
  const today=new Date(); today.setHours(0,0,0,0);
  const ds=md.filter(r=>{
    if(r['Balance']<=0) return false;
    const t=parseD(r['Target Date']); if(!t) return false;
    const df=Math.ceil((t-today)/86400000);
    return df>=-1&&df<=2;
  });
  const aging={'0-7':0,'8-15':0,'16-30':0,'30+':0};
  md.forEach(r=>{
    if(r['Balance']<=0) return;
    const dv=parseInt(r['Overdue Days'])||0;
    if(dv>30) aging['30+']+=r['Balance'];
    else if(dv>15) aging['16-30']+=r['Balance'];
    else if(dv>7) aging['8-15']+=r['Balance'];
    else if(dv>0) aging['0-7']+=r['Balance'];
  });
  return{
    currentMonth:curMk,
    allMonths:listMonths(),
    allMonthSummaries:ams,
    totalOutstanding:md.reduce((s,r)=>s+r['Balance'],0),
    totalCredit:md.reduce((s,r)=>s+r['New Credit'],0),
    totalCollected:md.reduce((s,r)=>s+r['Paid Amount'],0),
    overdueCount:md.filter(r=>r['Status']==='OVERDUE').length,
    paidCount:md.filter(r=>r['Status']==='PAID').length,
    dueSoonCount:md.filter(r=>r['Status']==='DUE SOON').length,
    activeCount:md.filter(r=>r['Status']==='ACTIVE'||r['Status']==='ADVANCE').length,
    avgScore:parties.length?Math.round(parties.reduce((s,p)=>s+(parseInt(p['Score'])||50),0)/parties.length):0,
    aging:aging,
    dueSoon:ds
  };
}

function sendReminderEmails(){
  const s=getSettings(); if(!s.remindersEnabled) return 0;
  const curMk=mk();
  const sh=SS().getSheetByName(CFG.MONTHLY_PREFIX+curMk);
  if(!sh||sh.getLastRow()<2) return 0;
  const d=sh.getDataRange().getValues(); const h=d[0]; const c=colMap(h);
  const em={}; getAllPartiesRaw().forEach(p=>em[p['Party ID']]=p['Email']);
  const today=new Date(); today.setHours(0,0,0,0);
  let sent=0;
  d.slice(1).forEach(row=>{
    const bal=toNum(row[c['Balance']]); if(bal<=0) return;
    const email=em[row[c['Party ID']]];
    if(!email||!email.includes('@')) return;
    const target=parseD(row[c['Target Date']]); if(!target) return;
    const diff=Math.ceil((target-today)/86400000);
    if(diff>=0&&diff<=2){
      try{MailApp.sendEmail(email,
        `⏰ Payment Due ${diff===0?'TODAY':diff+'d'} – ${row[c['Account Name']]}.`,
        `Dear ${row[c['Account Name']]},\n\nBalance ₹${bal.toLocaleString('en-IN')} is due on ${row[c['Target Date']]}.\n\nPlease arrange payment at the earliest.\n\nCreditFlow PRO`);
        sent++;
      }catch(e){}
    }
  });
  return sent;
}

function updateAllScores(){
  const curMk=mk();
  const sh=SS().getSheetByName(CFG.MONTHLY_PREFIX+curMk);
  if(!sh||sh.getLastRow()<2) return;
  const d=sh.getDataRange().getValues(); const h=d[0]; const c=colMap(h); const c1=colMap1(h);
  const today=new Date(); today.setHours(0,0,0,0);
  for(let i=1;i<d.length;i++){
    const bal=toNum(d[i][c['Balance']]); if(bal<=0) continue;
    const target=parseD(d[i][c['Target Date']]); if(target){
      const ov=Math.floor((today-target)/86400000); if(ov<=0) continue;
      const adj=ov>30?-20:ov>15?-10:ov>7?-5:-2;
      const ns=Math.min(100,Math.max(0,(parseInt(d[i][c['Score']])||50)+adj));
      sh.getRange(i+1,c1['Score']).setValue(ns);
      sh.getRange(i+1,c1['Status']).setValue('OVERDUE');
      sh.getRange(i+1,c1['Overdue Days']).setValue(ov);
      updatePartyScore(d[i][c['Party ID']],ns);
    }
  }
}

function addPartiesBulk(partiesArray) {
  assertRole([CFG.ROLES.ADMIN, CFG.ROLES.COLLECTOR]);
  const sh = SS().getSheetByName(CFG.SH.PARTIES);
  const user = Session.getActiveUser().getEmail() || 'System';
  const monthKey = mk();
  
  try {
    getOrCreateMonthSheet(monthKey);
    getOrCreateLiftingSheet(monthKey);
  } catch(e) {
    console.log("Bulk pre-sheet creation error:", e);
  }
  
  const addedIds = [];
  partiesArray.forEach(p => {
    const id = uid('P');
    const slNo = p.slNo || '';
    const name = p.accountName || '';
    const contact = p.contactNo || '';
    const address = p.address || '';
    const email = p.email || '';
    const limit = toNum(p.creditLimit);
    const days = p.creditDays || '7 DAYS';
    const mode = p.paymentMode || '';
    
    sh.appendRow([id, slNo, name, contact, address, email, limit, days, 'ACTIVE', 50, mode, user, new Date(), new Date()]);
    
    try {
      syncNewPartyToExistingMonths(id, { accountName: name, contactNo: contact, creditDays: days });
    } catch(err) {
      console.log("bulk sync error:", err);
    }
    
    addedIds.push(id);
    
    addAuditLog({
      type: 'PARTY_IMPORT',
      partyId: id,
      accountName: name,
      field: 'CSV Bulk Import',
      newVal: JSON.stringify(p),
      details: `Imported party "${name}" via bulk CSV upload.`
    });
  });
  
  return addedIds;
}

function addLedgerEntriesBulk(entriesArray) {
  assertRole([CFG.ROLES.ADMIN, CFG.ROLES.COLLECTOR]);
  const sh = ensureSheet(CFG.SH.LEDGER, CFG.COLS.LEDGER, '#065f46');
  const user = Session.getActiveUser().getEmail() || 'System';
  
  entriesArray.forEach(e => {
    const newRow = new Array(CFG.COLS.LEDGER.length).fill("");
    const colMap = {};
    CFG.COLS.LEDGER.forEach((header, index) => {
      colMap[header.toString().trim().toLowerCase()] = index;
    });
    
    const setValue = (targetHeaderNames, value) => {
      for (let name of targetHeaderNames) {
        let idx = colMap[name.toLowerCase()];
        if (idx !== undefined) {
          newRow[idx] = value;
          return true;
        }
      }
      return false;
    };
    
    setValue(['Timestamp', 'Date'], e.timestamp ? new Date(e.timestamp) : new Date());
    setValue(['Party ID'], e.partyId);
    setValue(['Account Name', 'Account'], e.accountName || '');
    setValue(['Month'], String(e.month || mk()));
    setValue(['Opening Balance', 'Opening'], toNum(e.openingBalance));
    setValue(['Debit (New Credit)', 'Debit (Credit)', 'Debit'], toNum(e.debit));
    setValue(['Credit (Payment)', 'Credit (Payment)', 'Credit'], toNum(e.credit));
    setValue(['Closing Balance', 'Closing'], toNum(e.closingBalance));
    setValue(['Status'], e.status || '');
    setValue(['Collector', 'User'], user);
    setValue(['Notes'], e.notes || '');
    
    sh.appendRow(newRow);
    
    addAuditLog({
      type: 'LEDGER_IMPORT',
      partyId: e.partyId,
      accountName: e.accountName,
      field: 'CSV Bulk Import',
      newVal: JSON.stringify(e),
      details: `Imported ledger entry of ₹${e.debit || e.credit} for "${e.accountName}" via bulk CSV upload.`
    });
  });
  
  return true;
}

function getAuditLogs() {
  const sh = SS().getSheetByName('Audit Logs');
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const h = data[0];
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const log = {};
    h.forEach((colName, index) => {
      log[colName] = row[index];
    });
    out.push(log);
  }
  out.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
  return out;
}

function sendPartyLedgerEmail(partyId, textReport) {
  const parties = getAllPartiesRaw();
  const party = parties.find(p => String(p['Party ID']) === String(partyId));
  if (!party) {
    throw new Error('Party not found');
  }
  const email = party['Email'];
  const accountName = party['Account Name'];
  if (!email || !email.includes('@')) {
    throw new Error(`Party "${accountName}" has no registered email address.`);
  }
  
  const subject = `📑 Account Ledger Statement – ${accountName}`;
  const body = `Dear ${accountName},\n\nPlease find your ledger statement below:\n\n==================================================\n${textReport}\n==================================================\n\nBest regards,\nCreditFlow PRO Admin`;
  
  MailApp.sendEmail(email, subject, body);
  
  addAuditLog({
    type: 'EMAIL_LEDGER',
    partyId: partyId,
    accountName: accountName,
    field: 'Ledger Export',
    details: `Exported and emailed ledger statement to ${email}`
  });
  
  return true;
}

function clearSheetRows(sheetName, headers, color) {
  const ss = SS();
  let sh = ss.getSheetByName(sheetName);
  if (sh) {
    const lastRow = sh.getLastRow();
    if (lastRow > 1) {
      sh.deleteRows(2, lastRow - 1);
    }
  } else {
    ensureSheet(sheetName, headers, color);
  }
}

function restoreDatabaseBackup(data) {
  assertRole([CFG.ROLES.ADMIN]);
  if (!data) throw new Error("No restore data provided");
  
  const parties = data.parties || [];
  const ledger = data.ledger || [];
  const settings = data.settings || {};
  
  // 1. Clear sheets
  clearSheetRows(CFG.SH.PARTIES, CFG.COLS.PARTIES, '#3730a3');
  clearSheetRows(CFG.SH.LEDGER, CFG.COLS.LEDGER, '#065f46');
  clearSheetRows(CFG.SH.SETTINGS, CFG.COLS.SETTINGS, '#1e293b');
  
  // 2. Restore settings
  const sSh = SS().getSheetByName(CFG.SH.SETTINGS);
  Object.keys(settings).forEach(key => {
    sSh.appendRow([key, String(settings[key] || '')]);
  });
  
  // 3. Restore parties
  const pSh = SS().getSheetByName(CFG.SH.PARTIES);
  const user = Session.getActiveUser().getEmail() || 'System';
  parties.forEach(p => {
    const id = p.partyId || uid('P');
    const slNo = p.slNo || '';
    const name = p.accountName || '';
    const contact = p.contactNo || '';
    const address = p.address || '';
    const email = p.email || '';
    const limit = toNum(p.creditLimit);
    const days = p.creditDays || '7 DAYS';
    const status = p.status || 'ACTIVE';
    const score = toNum(p.score || 50);
    const mode = p.paymentMode || '';
    
    pSh.appendRow([id, slNo, name, contact, address, email, limit, days, status, score, mode, user, new Date(p.createdAt || Date.now()), new Date()]);
  });
  
  // 4. Restore ledger
  const lSh = SS().getSheetByName(CFG.SH.LEDGER);
  ledger.forEach(e => {
    const newRow = new Array(CFG.COLS.LEDGER.length).fill("");
    const colMap = {};
    CFG.COLS.LEDGER.forEach((header, index) => {
      colMap[header.toString().trim().toLowerCase()] = index;
    });
    
    const setValue = (targetHeaderNames, value) => {
      for (let name of targetHeaderNames) {
        let idx = colMap[name.toLowerCase()];
        if (idx !== undefined) {
          newRow[idx] = value;
          return true;
        }
      }
      return false;
    };
    
    setValue(['Timestamp', 'Date'], e.timestamp ? new Date(e.timestamp) : new Date());
    setValue(['Party ID'], e.partyId);
    setValue(['Account Name', 'Account'], e.accountName || '');
    setValue(['Month'], String(e.month || mk()));
    setValue(['Opening Balance', 'Opening'], toNum(e.openingBalance));
    setValue(['Debit (New Credit)', 'Debit (Credit)', 'Debit'], toNum(e.debit));
    setValue(['Credit (Payment)', 'Credit (Payment)', 'Credit'], toNum(e.credit));
    setValue(['Closing Balance', 'Closing'], toNum(e.closingBalance));
    setValue(['Status'], e.status || '');
    setValue(['Collector', 'User'], e.collector || user);
    setValue(['Notes'], e.notes || '');
    
    lSh.appendRow(newRow);
  });
  
  // Re-sync monthly and lifting just to be absolutely sure they are healthy
  try {
    const monthKey = mk();
    syncMonthlyFromLedger(monthKey);
  } catch (e) {
    console.warn("Restore syncMonth error:", e);
  }
  
  return { success: true, restoredParties: parties.length, restoredLedger: ledger.length };
}
