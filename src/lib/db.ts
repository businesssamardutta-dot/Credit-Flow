const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyewh1tpN0kyvArPAIC_436tepFY1R6gph-f5vonqpeM0AVhVyyjxj5hqFq2wi0tqeHXA/exec';

async function gas(fn: string, ...args: any[]) {
  const payload = { func: fn, args };
  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      // Using text/plain prevents CORS preflight requests allowing the request to succeed transparently
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
  
  return result.data;
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
export const getContacts = async () => gas('getContacts');
export const addContact = async (data: any) => gas('addContact', data);
export const deleteContact = async (id: string) => gas('deleteContact', id);
export const getTasks = async () => gas('getTasks');
export const addTask = async (data: any) => gas('addTask', data);
export const updateTask = async (id: string, updates: any) => gas('updateTask', id, updates);
export const deleteTask = async (id: string) => gas('deleteTask', id);
export const getLedger = async (mf: string|null) => gas('getLedger', mf);
export const getDeliveryHistory = async (partyId: string|null, mf: string|null) => gas('getDeliveryHistory', partyId, mf);

export const updateMonthRow = async (mk: string, rowId: string, updates: any) => gas('updateMonthRow', mk, rowId, updates);
export const addCredit = async (partyId: string, amt: number, notes: string, mk: string) => gas('addCredit', partyId, amt, notes, mk);
export const recordPayment = async (partyId: string, amt: number, method: string, ref: string, notes: string, mk: string) => gas('recordPayment', partyId, amt, method, ref, notes, mk);

export const updateLiftingTarget = async (mk: string, rowId: string, updates: any) => gas('updateLiftingTarget', mk, rowId, updates);
export const completeLiftingTarget = async (mk: string, rowId: string) => gas('completeLiftingTarget', mk, rowId);
export const resetLiftingDeliveries = async (mk: string, rowId: string) => gas('resetLiftingDeliveries', mk, rowId);
export const recordDelivery = async (mk: string, partyId: string, qty: number, notes: string) => gas('recordDelivery', mk, partyId, qty, notes);
