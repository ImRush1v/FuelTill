import { receiptPdf, printableHtml, type Receipt } from './receipts';
import type { ReceiptWidth } from './records';

/** Shares a real PDF with the phone's system share sheet (Print is offered when supported).
 * The web cannot silently choose a thermal printer; the OS/printer must support printing.
 */
export async function shareReceipt(receipt:Receipt,width:ReceiptWidth):Promise<'shared'|'opened'|'downloaded'> {
  const pdf = new Blob([new Uint8Array(receiptPdf(receipt,width))],{type:'application/pdf'});
  const file = new File([pdf],`${receipt.filename}.pdf`,{type:'application/pdf'});
  if (typeof navigator.share==='function' && typeof navigator.canShare==='function' && navigator.canShare({files:[file]})) {
    try { await navigator.share({files:[file],title:`FuelTill ${receipt.title}`}); return 'shared'; }
    catch (e) { if ((e as Error).name==='AbortError') return 'shared'; }
  }
  // Opening a PDF invokes the native viewer: use its Print/Share control.
  const url=URL.createObjectURL(pdf);
  const tab=window.open(url,'_blank');
  if(tab){setTimeout(()=>URL.revokeObjectURL(url),90000);return 'opened';}
  const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),90000);
  return 'downloaded';
}

/** Opens a receipt in the browser's print experience; a physical printer is selected by the user. */
export function openNativePrint(receipt:Receipt,width:ReceiptWidth):boolean {
  const popup=window.open('','_blank');
  if(!popup) return false;
  popup.document.open();popup.document.write(printableHtml(receipt,width));popup.document.close();
  // User can tap the visible Print button if mobile Safari blocks automatic print.
  popup.addEventListener('load',()=>{popup.focus();try{popup.print()}catch{/* manual button remains */}}, {once:true});
  return true;
}
