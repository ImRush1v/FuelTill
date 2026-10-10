import {describe,expect,it} from 'vitest';
import {NZD} from '../types/cash';
import {totalCents} from './cash';
import {activeClosing,activeCounts,activeDrops,activeKey,addStation,blankCount,dayTotals,handoverNextShift,newWorkspace,planClosing,recordClosing,recordSafeDrop,updateActiveCounts,validateSafeDrop} from './records';
import {closingReceipt,dayReceipt,receiptPdf,safeDropReceipt} from './receipts';
const empty=()=>NZD.map(()=>0);

describe('FuelTill station and shift records',()=>{
  it('isolates register counts',()=>{
    let w=newWorkspace();const a=empty();a[8]=9;w=updateActiveCounts(w,a);
    const b={...w,register:'POS 2'};expect(totalCents(activeCounts(b))).toBe(0);expect(totalCents(activeCounts(w))).toBe(45000);
  });
  it('isolates stations',()=>{
    let w=newWorkspace();let c=empty();c[7]=20;w=updateActiveCounts(w,c);let second=addStation(w,'North Shore Station');expect(activeCounts(second)).toEqual(empty());expect(second.stations).toHaveLength(2);
  });
  it('validates a $400 safe drop and never removes coins',()=>{
    let w=newWorkspace();const c=empty();c[7]=15;c[8]=9;w=updateActiveCounts(w,c);const d=empty();d[8]=8;
    expect(validateSafeDrop(w,d)).toBeNull();const illegal=empty();illegal[4]=1;expect(validateSafeDrop(w,illegal)).toBeTruthy();
    w=recordSafeDrop(w,d,'2026-10-10T08:00:00Z');expect(totalCents(activeCounts(w))).toBe(35000);expect(activeDrops(w)).toHaveLength(1);
    expect(activeDrops(w)[0].amountCents).toBe(40000);expect(w.audit[0].kind).toBe('safe-drop');
  });
  it('closes a shift exactly once, leaving final denominations',()=>{
    let w=newWorkspace();let c=empty();c[2]=1;c[3]=1;c[6]=30;c[7]=3;c[8]=2;
    w=updateActiveCounts(w,c);const p=planClosing(w)!;expect(p.remainingCents).toBe(30150);
    w=recordClosing(w,46150);expect(activeClosing(w)?.dropCents).toBe(16000);expect(totalCents(activeCounts(w))).toBe(30150);
    expect(()=>recordClosing(w,null)).toThrow();expect(()=>updateActiveCounts(w,c)).toThrow();
    expect(()=>recordSafeDrop(w,empty())).toThrow();
  });
  it('carries exact closing denominations into the next shift without overwriting',()=>{
    let w=newWorkspace();const c=empty();c[2]=1;c[3]=1;c[6]=30;c[7]=3;c[8]=2;
    w=recordClosing(updateActiveCounts(w,c),null);
    w=handoverNextShift(w);expect(w.shift).toBe('Shift 2');expect(totalCents(activeCounts(w))).toBe(30150);
    expect(()=>handoverNextShift({...w,shift:'Shift 1'})).toThrow();
  });
  it('does not mix dates in end-of-day reports',()=>{
    let w=newWorkspace();const c=empty();c[7]=15;c[8]=9;w=updateActiveCounts(w,c);const d=empty();d[8]=8;
    w=recordSafeDrop(w,d);expect(dayTotals(w).safeCents).toBe(40000);
    expect(dayTotals({...w,date:'2026-11-01'}).safeCents).toBe(0);
  });
  it('creates separate receipts and valid PDF signatures',()=>{
    let w=newWorkspace();const c=empty();c[2]=1;c[3]=1;c[6]=30;c[7]=3;c[8]=2;w=updateActiveCounts(w,c);w=recordClosing(w,null);
    const close=closingReceipt(w,activeClosing(w)!);const pdf=receiptPdf(close,'58mm');
    expect(new TextDecoder().decode(pdf.slice(0,8))).toBe('%PDF-1.4');
    expect(close.lines.join('\n')).toContain('$301.50');
    const daily=dayReceipt(w);expect(daily.lines.join('\n')).not.toContain('FINAL DRAWER COUNTS');
    const separate=recordSafeDrop(updateActiveCounts(newWorkspace(),[0,0,0,0,0,0,0,15,9,0]),[0,0,0,0,0,0,0,0,8,0]);
    const safe=safeDropReceipt(separate,activeDrops(separate)[0]);expect(safe.lines.join('\n')).not.toContain('FINAL DRAWER COUNTS');
    expect(safe.lines.join('\n')).toContain('SAFE DROP TOTAL');
  });
  it('preserves deterministic active keys',()=>{
    const w=newWorkspace();expect(activeKey(w)).toContain('POS 1');expect(blankCount()).toHaveLength(NZD.length);
  });
});
