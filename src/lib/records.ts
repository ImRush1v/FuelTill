import { NZD, type Count } from '../types/cash';
import { calculateDrop, totalCents, type DropPlan } from './cash';

export type Role = 'Cashier' | 'Supervisor' | 'Station manager' | 'Business owner';
export type ReceiptWidth = '58mm' | '80mm' | 'A4';
export type Page = 'dashboard' | 'safe' | 'closing' | 'day' | 'profile' | 'settings' | 'cloud';
export type Policy = {
  targetCents: number;
  toleranceCents: number;
  safeMinCents: number;
  safeMaxCents: number;
  safeReminderHours: number;
  receiptWidth: ReceiptWidth;
};
export type Station = { id: string; name: string; registers: string[]; policy: Policy };
export type Profile = { name: string; email: string; employeeId: string; role: Role };
export type SafeDrop = {
  id: string; stationId: string; register: string; shift: string; date: string;
  recordedAt: string; cashier: string; removed: Count; amountCents: number;
};
export type Closing = {
  id: string; stationId: string; register: string; shift: string; date: string;
  recordedAt: string; cashier: string; counted: Count; removed: Count; remaining: Count;
  totalCents: number; dropCents: number; remainingCents: number; carryForwardCents: number;
  expectedCents: number | null; varianceCents: number | null;
};
export type AuditEvent = { id: string; at: string; kind: 'safe-drop' | 'shift-closed' | 'station-added' | 'handover'; stationId: string; description: string };
export type Workspace = {
  version: 1; organization: string; stations: Station[]; activeStationId: string;
  register: string; shift: string; date: string; profile: Profile;
  drawerCounts: Record<string, Count>; safeDrops: SafeDrop[]; closings: Closing[]; audit: AuditEvent[];
};
export const blankCount = (): Count => NZD.map(() => 0);
export const localDate = (date = new Date()): string => {
  const y = date.getFullYear();
  return `${y}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const id = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const defaultPolicy = (): Policy => ({targetCents: 30000, toleranceCents: 499, safeMinCents: 35000, safeMaxCents: 50000, safeReminderHours: 3, receiptWidth: '80mm'});
export function newWorkspace(): Workspace {
  const station: Station = {id:'station-demo', name:'Demo Fuel Station', registers:['POS 1','POS 2','TACC'], policy:defaultPolicy()};
  return {
    version:1, organization:'My Demo Business', stations:[station], activeStationId:station.id,
    register:'POS 1',shift:'Shift 1',date:localDate(),
    profile:{name:'',email:'',employeeId:'',role:'Cashier'},drawerCounts:{},safeDrops:[],closings:[],audit:[]
  };
}
export const contextKey = (stationId:string, date:string, register:string, shift:string) => JSON.stringify([stationId,date,register,shift]);
export const activeKey = (w:Workspace) => contextKey(w.activeStationId,w.date,w.register,w.shift);
export const activeStation = (w:Workspace) => w.stations.find(s=>s.id===w.activeStationId) ?? w.stations[0];
export const activeCounts = (w:Workspace) => w.drawerCounts[activeKey(w)] ?? blankCount();
export const activeClosing = (w:Workspace) => w.closings.find(c=>c.stationId===w.activeStationId&&c.date===w.date&&c.register===w.register&&c.shift===w.shift);
export const activeDrops = (w:Workspace) => w.safeDrops.filter(d=>d.stationId===w.activeStationId&&d.date===w.date&&d.register===w.register&&d.shift===w.shift);
export function validCounts(counts:Count):boolean {
  return Array.isArray(counts)&&counts.length===NZD.length&&counts.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)&&Number.isSafeInteger(totalCents(counts));
}
export function updateActiveCounts(w:Workspace, counts:Count): Workspace {
  if(activeClosing(w))throw Error('This shift is already closed. Counts cannot be changed.');
  if(!validCounts(counts))throw Error('Enter valid whole-number quantities.');
  return {...w, drawerCounts:{...w.drawerCounts,[activeKey(w)]:[...counts]}};
}
export function validateSafeDrop(w:Workspace, removed:Count):string|null {
  const counts=activeCounts(w), policy=activeStation(w).policy;
  if(activeClosing(w))return 'The shift is already closed.';
  if(!validCounts(removed))return 'Invalid note quantities.';
  if(removed.some((qty,i)=>qty>counts[i]||(NZD[i].kind==='coin'&&qty!==0)))return 'Only notes currently in this drawer can be deposited.';
  const amount=totalCents(removed);
  if(amount<policy.safeMinCents||amount>policy.safeMaxCents)return `Safe drop must be within the station policy range.`;
  if(totalCents(counts)-amount<policy.targetCents)return 'The drop would leave the drawer below its target.';
  return null;
}
export function recordSafeDrop(w:Workspace, removed:Count, at = new Date().toISOString()): Workspace {
  const invalid=validateSafeDrop(w,removed); if(invalid)throw Error(invalid);
  const amount=totalCents(removed);
  const entry: SafeDrop={id:id(),stationId:w.activeStationId,date:w.date,register:w.register,shift:w.shift,recordedAt:at,cashier:w.profile.name||'Unassigned',removed:[...removed],amountCents:amount};
  const next=activeCounts(w).map((q,i)=>q-removed[i]);
  const result=updateActiveCounts(w,next);
  return {...result,safeDrops:[...w.safeDrops,entry],audit:[...w.audit,{id:id(),at,kind:'safe-drop',stationId:w.activeStationId,description:`${w.register}, ${w.shift}: ${amount} cents`}]};
}
export function planClosing(w: Workspace): DropPlan|null {
  const p=activeStation(w).policy;
  return calculateDrop(activeCounts(w),p.targetCents,p.toleranceCents);
}
export function recordClosing(w:Workspace, expectedCents:number|null, at=new Date().toISOString()):Workspace {
  if(activeClosing(w))throw Error('This register and shift have already been closed.');
  if(expectedCents!==null&&(!Number.isSafeInteger(expectedCents)||expectedCents<0))throw Error('Expected cash must be a valid amount.');
  const plan=planClosing(w);if(!plan)throw Error('No valid final cash-drop combination for the drawer policy.');
  const counted=[...activeCounts(w)];
  const entry:Closing={id:id(),stationId:w.activeStationId,register:w.register,shift:w.shift,date:w.date,recordedAt:at,cashier:w.profile.name||'Unassigned',counted,removed:[...plan.removed],remaining:[...plan.remaining],totalCents:totalCents(counted),dropCents:plan.dropCents,remainingCents:plan.remainingCents,carryForwardCents:plan.carryForwardCents,expectedCents,varianceCents:expectedCents===null?null:totalCents(counted)-expectedCents};
  return {...w,drawerCounts:{...w.drawerCounts,[activeKey(w)]:[...plan.remaining]},closings:[...w.closings,entry],audit:[...w.audit,{id:id(),at,kind:'shift-closed',stationId:w.activeStationId,description:`${w.register}, ${w.shift}: closed`}]};
}
export function dayTotals(w:Workspace){
  const drops=w.safeDrops.filter(x=>x.stationId===w.activeStationId&&x.date===w.date);
  const closings=w.closings.filter(x=>x.stationId===w.activeStationId&&x.date===w.date);
  const safeCents=drops.reduce((s,x)=>s+x.amountCents,0);
  const finalCents=closings.reduce((s,x)=>s+x.dropCents,0);
  return {drops,closings,safeCents,finalCents,depositCents:safeCents+finalCents};
}
export function addStation(w:Workspace,name:string):Workspace {
  const trimmed=name.trim(); if(trimmed.length<2||trimmed.length>80)throw Error('Enter a station name between 2 and 80 characters.');
  const station:Station={id:id(),name:trimmed,registers:['POS 1','POS 2','TACC'],policy:defaultPolicy()};
  return {...w,stations:[...w.stations,station],activeStationId:station.id,register:'POS 1',audit:[...w.audit,{id:id(),at:new Date().toISOString(),kind:'station-added',stationId:station.id,description:`Added ${trimmed}`}]};
}

/** Copies a completed drawer float to the next shift only when its draft is still empty. */
export function handoverNextShift(w: Workspace): Workspace {
  const closing=activeClosing(w);
  if(!closing)throw Error('Complete this shift before handing over the drawer.');
  const order=['Shift 1','Shift 2','Shift 3'];
  const n=order.indexOf(w.shift);
  if(n<0)throw Error('Unknown shift.');
  const nextShift=order[(n+1)%order.length];
  let nextDate=w.date;
  if(n===2){const d=new Date(`${w.date}T12:00:00`);d.setDate(d.getDate()+1);nextDate=localDate(d)}
  const key=contextKey(w.activeStationId,nextDate,w.register,nextShift);
  if(w.closings.some(c=>c.stationId===w.activeStationId&&c.date===nextDate&&c.register===w.register&&c.shift===nextShift))throw Error('The next shift is already closed.');
  if(w.drawerCounts[key]?.some(x=>x!==0))throw Error('Next shift already has a drawer count. Cannot overwrite it.');
  return {...w,date:nextDate,shift:nextShift,drawerCounts:{...w.drawerCounts,[key]:[...closing.remaining]},audit:[...w.audit,{id:id(),at:new Date().toISOString(),kind:'handover',stationId:w.activeStationId,description:`${closing.shift} to ${nextShift}: ${closing.remainingCents} cents`}]};
}
