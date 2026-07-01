const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyewh1tpN0kyvArPAIC_436tepFY1R6gph-f5vonqpeM0AVhVyyjxj5hqFq2wi0tqeHXA/exec';

function parseMoney(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[₹,\sa-zA-Z]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

const MONEY_KEYS = [
  'Opening Balance', 'New Credit', 'Total Debt', 'Paid Amount', 'Balance',
  'Debit (New Credit)', 'Credit (Payment)', 'Closing Balance',
  'totalOutstanding', 'totalCredit', 'totalCollected', 'totalDebt', 'totalPaid', 'totalBalance'
];

function sanitizeData(data: any): any {
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  } else if (data && typeof data === 'object') {
    const obj = { ...data };
    for (const key in obj) {
      if (MONEY_KEYS.includes(key)) {
        obj[key] = parseMoney(obj[key]);
      } else {
        obj[key] = sanitizeData(obj[key]);
      }
    }
    return obj;
  }
  return data;
}

async function gas(fn: string, ...args: any[]) {
  const payload = { func: fn, args };
  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
  });
  
  if (!response.ok) {
    throw new Error('Network error: ' + response.statusText);
  }
  
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Server error');
  }
  
  return sanitizeData(result.data);
}

// Audit helper to identify party balance discrepancies
export async function auditLedgers() {
  const [parties, ledger] = await Promise.all([getParties(), getLedger(null)]);
  
  const differences = [];
  
  for (const party of parties) {
    const partyLedger = ledger.filter((r: any) => r['Party ID'] === party.partyId || r['Account Name'] === party.accountName);
    
    // Sort transactions by time
    partyLedger.sort((a: any, b: any) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
    
    let calculatedBalance = party.openingBalance || 0;
    
    partyLedger.forEach((entry: any) => {
      const debit = entry['Debit (New Credit)'] || 0;
      const credit = entry['Credit (Payment)'] || 0;
      calculatedBalance = calculatedBalance + debit - credit;
    });

    const masterBalance = party.balance || 0;
    
    if (Math.abs(calculatedBalance - masterBalance) > 1) {
      differences.push({
        partyId: party.partyId,
        accountName: party.accountName,
        masterBalance,
        calculatedBalance,
        diff: masterBalance - calculatedBalance
      });
    }
  }
  
  return differences;
}

export const initDatabase = async () => gas('initDatabase');
export const getParties = async () => gas('getParties');
export const autoCreateNextMonth = async () => gas('autoCreateNextMonth');
export const getSettings = async () => gas('getSettings');
export const saveSetting = async (key: string, value: any) => gas('saveSetting', key, value);
export const getDashboardSummary = async () => gas('getDashboardSummary');
export const listLiftingMonths = async () => gas('listLiftingMonths');
export const getLiftingData = async (monthKey: string) => gas('getLiftingData', monthKey);
export const getMonthData = async (monthKey: string) => gas('getMonthData', monthKey);
export const closeMonth = async (monthKey: string) => gas('closeMonth', monthKey);
export const sendReminderEmails = async () => gas('sendReminderEmails');
export const updateAllScores = async () => gas('updateAllScores');
export const deleteParty = async (id: string) => gas('deleteParty', id);
export const addParty = async (data: any) => gas('addParty', data);
export const updateParty = async (id: string, updates: any) => gas('updateParty', id, updates);
export const getLedger = async (mf: string|null) => gas('getLedger', mf);
export const getDeliveryHistory = async (partyId: string|null, mf: string|null) => gas('getDeliveryHistory', partyId, mf);

export const updateMonthRow = async (mk: string, rowId: string, updates: any) => gas('updateMonthRow', mk, rowId, updates);
export const addCredit = async (partyId: string, amt: number, notes: string, mk: string) => gas('addCredit', partyId, amt, notes, mk);
export const recordPayment = async (partyId: string, amt: number, method: string, ref: string, notes: string, mk: string) => gas('recordPayment', partyId, amt, method, ref, notes, mk);
export const syncMonthlyFromLedger = async (monthKey: string) => gas('syncMonthlyFromLedger', monthKey);

export const updateLiftingTarget = async (mk: string, rowId: string, updates: any) => gas('updateLiftingTarget', mk, rowId, updates);
export const completeLiftingTarget = async (mk: string, rowId: string) => gas('completeLiftingTarget', mk, rowId);
export const resetLiftingDeliveries = async (mk: string, rowId: string) => gas('resetLiftingDeliveries', mk, rowId);
export const recordDelivery = async (mk: string, partyId: string, qty: number, notes: string) => gas('recordDelivery', mk, partyId, qty, notes);
export const carryForwardLiftingTargets = async (mk: string) => gas('carryForwardLiftingTargets', mk);
