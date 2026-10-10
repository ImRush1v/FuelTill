import { NZD } from '../types/cash';
import { formatNZD, totalCents } from './cash';
import { activeStation, dayTotals, type Closing, type ReceiptWidth, type SafeDrop, type Workspace } from './records';
export type Receipt={title:string; filename:string; lines:string[]};
const fname=(s:string)=>s.replace(/[^a-z0-9_-]/gi,'-').slice(0,60);
const units=(qty:number[],includeZero=false)=>NZD.flatMap((d,i)=>qty[i]||includeZero?[`${d.label.padEnd(5)} x ${String(qty[i]).padStart(4)}  ${formatNZD(d.cents*qty[i])}`]:[]);
export function safeDropReceipt(w:Workspace,drop:SafeDrop):Receipt{
  const st=w.stations.find(s=>s.id===drop.stationId);
  return {title:'SAFE DROP',filename:`FuelTill-safe-drop-${fname(drop.id)}`,
    lines:['FUELTILL','SAFE DROP',st?.name??'Station',`Date: ${drop.date}`,`Register: ${drop.register}`,`Shift: ${drop.shift}`,`Cashier: ${drop.cashier}`,`Recorded: ${new Date(drop.recordedAt).toLocaleString('en-NZ')}`,`Reference: ${drop.id.slice(0,12)}`,'-----------------------------','NOTES DEPOSITED',...units(drop.removed),'-----------------------------',`SAFE DROP TOTAL: ${formatNZD(drop.amountCents)}`,'','Cashier signature: ____________','Verified by: _________________','Confirm physical locker deposit.']};
}
export function closingReceipt(w:Workspace,closing:Closing):Receipt{
  const st=w.stations.find(s=>s.id===closing.stationId);
  return {title:'END OF SHIFT',filename:`FuelTill-end-shift-${fname(closing.date)}-${fname(closing.register)}-${fname(closing.shift)}`,
    lines:['FUELTILL','END OF SHIFT',st?.name??'Station',`Date: ${closing.date}`,`Register: ${closing.register}`,`Shift: ${closing.shift}`,`Cashier: ${closing.cashier}`,`Closed: ${new Date(closing.recordedAt).toLocaleString('en-NZ')}`,'-----------------------------',`Counted in drawer: ${formatNZD(closing.totalCents)}`,`Final drop: ${formatNZD(closing.dropCents)}`,`Drawer remaining: ${formatNZD(closing.remainingCents)}`,`Carry forward: ${formatNZD(closing.carryForwardCents)}`,...(closing.expectedCents===null?['POS expected: Not provided']:[`POS expected: ${formatNZD(closing.expectedCents)}`,`Variance: ${formatNZD(closing.varianceCents??0)}`]),'-----------------------------','FINAL DROP NOTES',...(closing.removed.some(x=>x>0)?units(closing.removed):['No final notes removed']),'-----------------------------','FINAL DRAWER COUNTS',...units(closing.remaining,true),`TOTAL LEFT: ${formatNZD(totalCents(closing.remaining))}`,'','Cashier signature: ____________','Manager signature: ____________','Verify against physical cash.']};
}
export function dayReceipt(w:Workspace):Receipt{
  const station=activeStation(w),{drops,closings,safeCents,finalCents,depositCents}=dayTotals(w);
  const lines=['FUELTILL','END OF DAY — CASH MOVEMENT',station.name,`Date: ${w.date}`,'-----------------------------','SAFE DROPS',...(drops.length?drops.map((d,i)=>`${i+1}. ${d.register} ${d.shift}  ${formatNZD(d.amountCents)}`):['No recorded safe drops']),`SAFE DROP TOTAL: ${formatNZD(safeCents)}`,'-----------------------------','SHIFT CLOSINGS',...(closings.length?closings.map(c=>`${c.register} ${c.shift}  ${formatNZD(c.dropCents)} drop`):['No completed shifts']),`FINAL DROP TOTAL: ${formatNZD(finalCents)}`,'-----------------------------',`DEPOSITS RECORDED: ${formatNZD(depositCents)}`,`Shifts closed: ${closings.length}`,`Safe drops: ${drops.length}`,'','NOTE: cash movement report only.','POS/bank reconciliation not verified.','','Manager signature: ____________'];
  return {title:'END OF DAY',filename:`FuelTill-end-day-${fname(w.date)}-${fname(station.name)}`,lines};
}
export function previewClosing(w:Workspace,counts:number[],plan:{removed:number[];remaining:number[];dropCents:number;remainingCents:number;carryForwardCents:number}, expected:number|null):Receipt{
  return closingReceipt(w,{id:'UNRECORDED PREVIEW',stationId:w.activeStationId,date:w.date,register:w.register,shift:w.shift,cashier:w.profile.name||'Unassigned',recordedAt:new Date().toISOString(),counted:counts,removed:plan.removed,remaining:plan.remaining,totalCents:totalCents(counts),dropCents:plan.dropCents,remainingCents:plan.remainingCents,carryForwardCents:plan.carryForwardCents,expectedCents:expected,varianceCents:expected===null?null:totalCents(counts)-expected});
}
const htmlEscape=(s:string)=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
export function printableHtml(receipt:Receipt,width:ReceiptWidth):string{
  const paper=width==='A4'?'A4':width;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${htmlEscape(receipt.title)} - FuelTill</title><style>@page{size:${paper} auto;margin:${width==='A4'?'12mm':'2mm'}}*{box-sizing:border-box}body{color:#111;background:#fff;font:12px/1.5 ui-monospace,Consolas,monospace;max-width:${width==='A4'?'180mm':width};margin:0 auto;padding:3mm}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.tools{padding:10px 0;margin-bottom:16px}button{background:#085e59;color:white;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}@media print{.tools{display:none}body{padding:0;font-size:${width==='58mm'?'10px':'12px'}}}</style></head><body><div class="tools"><button onclick="window.print()">Print / Save as PDF</button></div><pre>${receipt.lines.map(htmlEscape).join('\n')}</pre></body></html>`;
}
export function saveBlob(name:string,blob:Blob):void{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function downloadHtml(receipt:Receipt,width:ReceiptWidth):void{saveBlob(receipt.filename+'.html',new Blob([printableHtml(receipt,width)],{type:'text/html;charset=utf-8'}));}
export function printReceipt(receipt:Receipt,width:ReceiptWidth):boolean{
  const w=window.open('','_blank');if(!w)return false;
  w.document.open();w.document.write(printableHtml(receipt,width));w.document.close();w.focus();return true;
}
/** Dependency-free, valid single/multipage PDF. Uses Courier and ASCII-safe printable text. */
export function receiptPdf(receipt:Receipt,width:ReceiptWidth):Uint8Array{
  const pageW=width==='A4'?595.28:width==='80mm'?226.77:164.41;
  const fontSize=width==='A4'?10:width==='80mm'?8:7;
  const leading=fontSize+4;
  const margin=width==='A4'?38:9;
  const maxChars=Math.floor((pageW-2*margin)/(fontSize*0.6));
  const safeAscii=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7e]/g,'?');
  const lines:string[]=[];
  for(const raw of receipt.lines){let s=safeAscii(raw);if(!s){lines.push('');continue;}while(s.length>maxChars){let split=s.lastIndexOf(' ',maxChars);if(split<Math.floor(maxChars*0.5))split=maxChars;lines.push(s.slice(0,split));s=s.slice(split).trimStart();}lines.push(s);}
  const maxPerPage=width==='A4'?53:110;
  const chunks:string[][]=[];for(let i=0;i<lines.length;i+=maxPerPage)chunks.push(lines.slice(i,i+maxPerPage));
  if(!chunks.length)chunks.push(['']);
  const objects:string[]=[];
  const add=(str:string)=>{objects.push(str);return objects.length};
  const catalog=add('');const pagesRoot=add('');const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const pageIds:number[]=[];
  for(const chunk of chunks){
    const height=width==='A4'?841.89:Math.max(125,margin*2+leading*(chunk.length+2));
    const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
    const commands=[`BT /F1 ${fontSize} Tf ${margin} ${height-margin-fontSize} Td ${leading} TL`,...chunk.map((line,i)=>`${i?'T* ':''}(${escape(line)}) Tj`),'ET'].join('\n');
    const len=new TextEncoder().encode(commands).length;
    const stream=add(`<< /Length ${len} >>\nstream\n${commands}\nendstream`);
    const page=add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${pageW} ${height}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`);
    pageIds.push(page);
  }
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
  objects[pagesRoot-1]=`<< /Type /Pages /Kids [${pageIds.map(n=>`${n} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let output='%PDF-1.4\n';const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(new TextEncoder().encode(output).length);output+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=new TextEncoder().encode(output).length;
  output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)output+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  output+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}
export function downloadPdf(receipt:Receipt,width:ReceiptWidth):void{
  const bytes=receiptPdf(receipt,width);
  saveBlob(receipt.filename+'.pdf',new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));
}
const escapeCsv=(s:string)=>{const protectedCell=/^[=+@\-\t\r]/.test(s)?`'${s}`:s;return `"${protectedCell.replace(/"/g,'""')}"`;};
export function closingCsv(closing:Closing):string{
  const rows=[['FuelTill end-of-shift',closing.date],['Register',closing.register],['Shift',closing.shift],['Counted',formatNZD(closing.totalCents)],['Final cash drop',formatNZD(closing.dropCents)],['Drawer left',formatNZD(closing.remainingCents)],['Carry forward',formatNZD(closing.carryForwardCents)],[],['Denomination','Original qty','Removed qty','Remaining qty','Remaining value'],...NZD.map((d,i)=>[d.label,String(closing.counted[i]),String(closing.removed[i]),String(closing.remaining[i]),formatNZD(d.cents*closing.remaining[i])])];
  return rows.map(r=>r.map(escapeCsv).join(',')).join('\r\n');
}
