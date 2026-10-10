import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { NZD } from '../types/cash';
import { calculateDrop, formatNZD, totalCents } from '../lib/cash';
import { activeClosing, activeCounts, activeDrops, activeStation, addStation, blankCount, dayTotals, handoverNextShift, localDate, newWorkspace, planClosing, recordClosing, recordSafeDrop, updateActiveCounts, validateSafeDrop, type Page, type Policy, type ReceiptWidth, type Workspace } from '../lib/records';
import { exportWorkspace, importWorkspace, loadWorkspace, saveWorkspace } from '../lib/storage';
import { closingCsv, closingReceipt, dayReceipt, downloadHtml, downloadPdf, safeDropReceipt, saveBlob } from '../lib/receipts';
import { dayWorksheetHtml } from '../lib/worksheet';
import { shareReceipt, openNativePrint } from '../lib/mobilePrint';
import CloudOperations from './CloudOperations';

const menu:{page:Page;icon:string;label:string}[]=[
  {page:'dashboard',icon:'▦',label:'Overview'}, {page:'safe',icon:'↘',label:'Safe Drop'},
  {page:'closing',icon:'▤',label:'End of Shift'}, {page:'day',icon:'▣',label:'End of Day'},
  {page:'profile',icon:'◉',label:'My Profile'}, {page:'settings',icon:'⚙',label:'Settings'},
  {page:'cloud',icon:'☁',label:'Business Cloud'}
];
function moneyInput(cents:number){return (cents/100).toFixed(2)}
function parseAmount(s:string):number|null{if(!/^\d+(?:\.\d{1,2})?$/.test(s.trim()))return null;const [a,b='']=s.trim().split('.');const v=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(v)?v:null}
const displayTime=(date:string)=>new Date(date).toLocaleString('en-NZ',{dateStyle:'medium',timeStyle:'short'});
export default function CashCalculator(){
  const [w,setW]=useState<Workspace>(loadWorkspace);
  const [page,setPage]=useState<Page>('cloud');
  const [safeQty,setSafeQty]=useState<number[]>(blankCount);
  const [expected,setExpected]=useState('');
  const [newStationName,setNewStationName]=useState('');
  const [feedback,setFeedback]=useState('');
  const [backupError,setBackupError]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{try{saveWorkspace(w);setBackupError(false)}catch{setBackupError(true)}},[w]);
  useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(t)},[]);
  const station=activeStation(w);
  const counts=activeCounts(w);
  const total=totalCents(counts);
  const safeDrops=activeDrops(w);
  const closed=activeClosing(w);
  const plan=useMemo(()=>closed?null:planClosing(w),[w,closed]);
  const day=dayTotals(w);
  const safeAmount=totalCents(safeQty);
  const safeError=validateSafeDrop(w,safeQty);
  const currentExpected=expected.trim()===''?null:parseAmount(expected);
  const latestDrop=safeDrops.at(-1);
  const lastCheck=latestDrop?new Date(latestDrop.recordedAt).getTime():null;
  const due=lastCheck!==null&&clock-lastCheck>=station.policy.safeReminderHours*3600000;

  function action(fn:()=>Workspace,success:string){try{setW(fn());setFeedback(success)}catch(e){setFeedback((e as Error).message)}}
  function contextChange(patch:Partial<Workspace>){setW(old=>({...old,...patch}));setSafeQty(blankCount());setExpected('');setFeedback('')}
  function countChange(i:number,s:string){const n=s===''?0:Number(s);if(!Number.isSafeInteger(n)||n<0||n>1000000)return;try{setW(updateActiveCounts(w,counts.map((v,k)=>k===i?n:v)));setFeedback('')}catch(err){setFeedback((err as Error).message)}}
  function policyChange<K extends keyof Policy>(key:K,value:Policy[K]){
    setW(old=>({...old,stations:old.stations.map(s=>s.id===old.activeStationId?{...s,policy:{...s.policy,[key]:value}}:s)}));
  }
  function changeMoneyPolicy(key:'targetCents'|'toleranceCents'|'safeMinCents'|'safeMaxCents',raw:string){const cents=parseAmount(raw);if(cents===null)return;policyChange(key,cents)}
  function suggestNotes(){
    const cap=Math.min(station.policy.safeMaxCents,total-station.policy.targetCents);
    if(cap<station.policy.safeMinCents){setFeedback('Not enough removable cash for a safe drop.');return}
    const candidate=calculateDrop(counts,total-cap,cap-station.policy.safeMinCents);
    if(candidate && candidate.dropCents>=station.policy.safeMinCents){setSafeQty(candidate.removed);setFeedback('Suggested notes selected. Verify the notes physically before recording.')}else setFeedback('The available banknotes cannot make a drop within the configured range.');
  }
  function saveSafe(){if(safeError){setFeedback(safeError);return}if(!window.confirm(`Confirm ${formatNZD(safeAmount)} was physically placed in the safe? This will record the drop and subtract the notes from the drawer.`))return;
    action(()=>recordSafeDrop(w,safeQty),`Safe drop recorded: ${formatNZD(safeAmount)}. Receipt available below.`);setSafeQty(blankCount());
  }
  function closeShift(){if(closed||!plan)return;if(expected.trim()!==''&&currentExpected===null){setFeedback('Enter the POS expected cash as a valid dollar amount, or leave it blank.');return}if(!window.confirm(`Close ${w.shift}, ${w.register}? Final cash drop: ${formatNZD(plan.dropCents)}. This closes and locks the shift in this demo.`))return;
    action(()=>recordClosing(w,currentExpected), 'End of shift recorded and locked. Download the receipt now.');
  }
  function exportJson(){saveBlob(`FuelTill-demo-backup-${localDate()}.json`,new Blob([exportWorkspace(w)],{type:'application/json;charset=utf-8'}));setFeedback('Demo backup downloaded. Keep it somewhere secure.');}
  async function importJson(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;
    try{const raw=await file.text();const restored=importWorkspace(raw);if(window.confirm('Replace ALL data in this browser with the selected demo backup?')){setW(restored);setFeedback('Demo backup imported.')}}catch(err){setFeedback((err as Error).message)}finally{e.target.value=''}
  }
  function receiptActions(receipt:ReturnType<typeof dayReceipt>|null){
    if(!receipt)return <p className="muted">Record the transaction first to enable its final receipt.</p>;
    const width=station.policy.receiptWidth;
    return <div className="action-row receipt-actions">
      <button onClick={()=>downloadPdf(receipt,width)}>↓ Download {receipt.title} PDF</button>
      <button className="secondary" onClick={()=>{if(!openNativePrint(receipt,width))setFeedback('Allow pop-ups to open the print dialog; or download the PDF and print from the PDF viewer.')}}>⎙ Print on PC / Phone</button>
      <button className="secondary" onClick={()=>void shareReceipt(receipt,width).then(result=>setFeedback(result==='downloaded'?'PDF downloaded. Open the file and select Print.':'Use the device share/print controls to select your printer.')).catch(e=>setFeedback((e as Error).message))}>↗ Phone Share / Print</button>
      <button className="quiet" onClick={()=>downloadHtml(receipt,width)}>Download HTML</button>
    </div>;
  }
  function csvDownload(){if(!closed)return;saveBlob(`FuelTill-shift-${w.date}-${w.register}-${w.shift}.csv`,new Blob([closingCsv(closed)],{type:'text/csv;charset=utf-8'}))}
  async function copyClosing(){if(!closed)return;const r=closingReceipt(w,closed);try{await navigator.clipboard.writeText(r.lines.join('\n'));setFeedback('Exact end-of-shift breakdown copied.')}catch{setFeedback('Clipboard unavailable. Download the PDF or CSV instead.')}}
  const savedCount=Object.keys(w.drawerCounts).length;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="logo"><span className="logo-mark">F</span><span>FuelTill<small>CASH OPERATIONS</small></span></div>
      <div className="sidebar-section">WORKSPACE</div>
      <nav aria-label="Main navigation">{menu.map(x=><button key={x.page} className={`navitem ${page===x.page?'active':''}`} onClick={()=>{setPage(x.page);setFeedback('')}}><span className="navico">{x.icon}</span>{x.label}{(x.page==='safe'&&due)?<span className="navdot"/>:null}</button>)}</nav>
      <div className="sidebar-footer"><span className="status-dot"/> Browser demo mode <small>Saved on this device only · Not a secure business account</small></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div><span className="eyebrow">{w.organization}</span><h1>{menu.find(x=>x.page===page)?.label}</h1></div><div className="top-actions"><span className="mode-pill">{page==='cloud'?'BUSINESS CLOUD':'LOCAL DEMO'}</span><span className="avatar">{(w.profile.name||'U').slice(0,1).toUpperCase()}</span></div></header>
      <main className="content">
        {backupError&&<div className="notice danger">Browser storage is unavailable or full. Export a backup immediately; new changes may not survive a refresh.</div>}
        {page!=='profile'&&page!=='settings'&&page!=='cloud'&&<section className="context-bar" aria-label="Current work context">
          <label>Station<select value={w.activeStationId} onChange={e=>{const s=w.stations.find(st=>st.id===e.target.value);contextChange({activeStationId:e.target.value,register:s?.registers[0]||'POS 1'})}}>{w.stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Register<select value={w.register} onChange={e=>contextChange({register:e.target.value})}>{station.registers.map(s=><option key={s}>{s}</option>)}</select></label>
          <label>Shift<select value={w.shift} onChange={e=>contextChange({shift:e.target.value})}>{['Shift 1','Shift 2','Shift 3'].map(s=><option key={s}>{s}</option>)}</select></label>
          <label>Date<input type="date" value={w.date} onChange={e=>contextChange({date:e.target.value})}/></label>
        </section>}
        {feedback&&<div className="notice" role="status">{feedback}<button className="notice-close" aria-label="Dismiss notification" onClick={()=>setFeedback('')}>×</button></div>}

        {page==='cloud'&&<CloudOperations/>}
        {page==='dashboard'&&<>
          <div className="intro"><div><span className="eyebrow">CONTROL CENTRE</span><h2>Good to see you{w.profile.name?`, ${w.profile.name.split(' ')[0]}`:''}.</h2><p>Cash operations at a glance for <strong>{station.name}</strong> on {w.date}.</p></div><button onClick={()=>setPage('safe')}>+ New safe drop</button></div>
          <div className="metric-grid"><Metric label="Current drawer" value={formatNZD(total)} note={`${w.register} · ${w.shift}`}/><Metric label="Today's safe drops" value={formatNZD(day.safeCents)} note={`${day.drops.length} deposits recorded`}/><Metric label="Today's final drops" value={formatNZD(day.finalCents)} note={`${day.closings.length} shifts closed`}/><Metric label="Total deposited today" value={formatNZD(day.depositCents)} note="Safe + final drops"/></div>
          <div className="two-cols"><section className="panel"><div className="section-head"><h3>Quick actions</h3></div><div className="quick-actions"><button className="quick" onClick={()=>setPage('safe')}><span className="quick-symbol">↘</span><span><b>Record Safe Drop</b><small>Deposit notes to the locker</small></span><span>→</span></button><button className="quick" onClick={()=>setPage('closing')}><span className="quick-symbol">▤</span><span><b>End of Shift</b><small>Count, reconcile and hand over</small></span><span>→</span></button><button className="quick" onClick={()=>setPage('day')}><span className="quick-symbol">▣</span><span><b>End of Day</b><small>View station-wide cash movements</small></span><span>→</span></button></div></section>
          <section className="panel"><div className="section-head"><h3>Shift status</h3><span className={`chip ${closed?'green':'amber'}`}>{closed?'Closed':'In progress'}</span></div><div className="info-line"><span>Station</span><b>{station.name}</b></div><div className="info-line"><span>Register</span><b>{w.register}</b></div><div className="info-line"><span>Drawer target</span><b>{formatNZD(station.policy.targetCents)}</b></div><div className="info-line"><span>Recorded safe drops</span><b>{safeDrops.length}</b></div><div className="info-line"><span>Saved count drafts</span><b>{savedCount}</b></div><p className="help">Data is local to this browser. For real commercial use, secure accounts and a server-backed audit ledger are still required.</p></section></div>
        </>}

        {(page==='safe'||page==='closing')&&<section className="panel"><div className="section-head"><div><h3>Current drawer count</h3><p className="muted">Enter the number of each NZD coin and note physically in this drawer.</p></div><span className={`chip ${closed?'green':'amber'}`}>{closed?'Shift closed':'Live draft'}</span></div>
          <div className="count-grid">{NZD.map((d,i)=><label key={d.label} className="count-tile"><div className="count-top"><b>{d.label}</b><span>{d.kind}</span></div><input aria-label={`${d.label} quantity`} disabled={!!closed} type="number" min="0" max="1000000" step="1" value={counts[i]} onChange={e=>countChange(i,e.target.value)}/><small>{formatNZD(d.cents*counts[i])}</small></label>)}</div>
          <div className="drawer-summary"><span>Cash currently counted</span><strong>{formatNZD(total)}</strong><span className="muted">Target: {formatNZD(station.policy.targetCents)}</span></div>
          {!closed&&<button className="quiet" onClick={()=>{if(window.confirm('Clear this drawer draft? Recorded safe drops and closings will NOT be deleted.'))action(()=>updateActiveCounts(w,blankCount()),'Drawer draft cleared.')}}>Clear drawer draft</button>}
        </section>}

        {page==='safe'&&<><div className="page-description"><h2>Safe Drop</h2><p>Record notes physically deposited in the safe during a shift. A safe drop changes only this register's drawer and never closes the shift.</p></div>
          <div className="two-cols"><section className="panel"><div className="section-head"><h3>Prepare safe drop</h3><span className="chip">{formatNZD(station.policy.safeMinCents)} – {formatNZD(station.policy.safeMaxCents)}</span></div>
            <p className="muted">Select the exact notes being removed. Coins remain in the drawer.</p>
            <div className="table-scroll"><table><thead><tr><th>Note</th><th>Available</th><th>Drop qty</th><th className="right">Amount</th></tr></thead><tbody>{NZD.map((d,i)=>d.kind==='note'?<tr key={i}><td><b>{d.label}</b></td><td>{counts[i]}</td><td><input className="qty-input" type="number" aria-label={`${d.label} safe-drop quantity`} disabled={!!closed} min="0" max={counts[i]} value={safeQty[i]} onChange={e=>{const n=e.target.value===''?0:Number(e.target.value);if(Number.isSafeInteger(n)&&n>=0&&n<=counts[i])setSafeQty(old=>old.map((v,k)=>k===i?n:v))}}/></td><td className="right">{formatNZD(d.cents*safeQty[i])}</td></tr>:null)}</tbody></table></div>
            <div className="big-total"><span>Selected safe drop</span><b>{formatNZD(safeAmount)}</b></div>
            {safeError?<p className="field-warning">{safeError}</p>:<p className="positive">Ready to record after the physical locker deposit.</p>}
            <div className="action-row"><button disabled={!!safeError||!!closed} onClick={saveSafe}>Record safe deposit</button><button disabled={!!closed} className="secondary" onClick={suggestNotes}>Suggest notes</button></div>
          </section>
          <section className="panel"><div className="section-head"><h3>Drop policy</h3><span className={`chip ${due?'amber':'green'}`}>{due?'Check due':'Configured'}</span></div><div className="info-line"><span>Minimum safe drop</span><b>{formatNZD(station.policy.safeMinCents)}</b></div><div className="info-line"><span>Maximum safe drop</span><b>{formatNZD(station.policy.safeMaxCents)}</b></div><div className="info-line"><span>Drawer floor</span><b>{formatNZD(station.policy.targetCents)}</b></div><div className="info-line"><span>Check interval</span><b>Every {station.policy.safeReminderHours} hours</b></div><p className="help">{latestDrop?`Last recorded: ${displayTime(latestDrop.recordedAt)}. ${due?'A safe-drop check is due.':'The next check is based on this recorded drop.'}`:'Start by recording a safe drop. This prototype shows a check indicator while open; it cannot send background reminders.'}</p><p className="help">Check the physical banknotes and follow your workplace's cash-handling policy.</p></section></div>
          <section className="panel"><div className="section-head"><h3>Safe drop history — this shift</h3><span className="chip">{safeDrops.length} recorded</span></div>{safeDrops.length?<><div className="table-scroll"><table><thead><tr><th>Recorded</th><th>Register</th><th>Cashier</th><th className="right">Amount</th><th>Receipt</th></tr></thead><tbody>{safeDrops.map(d=><tr key={d.id}><td>{displayTime(d.recordedAt)}</td><td>{d.register}</td><td>{d.cashier}</td><td className="right"><b>{formatNZD(d.amountCents)}</b></td><td><button className="tiny" onClick={()=>downloadPdf(safeDropReceipt(w,d),station.policy.receiptWidth)}>PDF ↓</button></td></tr>)}</tbody></table></div><div className="big-total"><span>Safe total, current shift</span><b>{formatNZD(safeDrops.reduce((sum,d)=>sum+d.amountCents,0))}</b></div><h4>Latest safe drop receipt</h4>{receiptActions(latestDrop?safeDropReceipt(w,latestDrop):null)}</>:<p className="muted">No safe deposits recorded for this register, shift and date.</p>}</section>
        </>}

        {page==='closing'&&<><div className="page-description"><h2>End of Shift</h2><p>Complete your count, calculate the final drop and record the remaining quantities of every coin and note.</p></div>
          {closed?<div className="notice success">This shift is closed. Its recorded denominations are locked in the app. Print or download its completed receipt below.</div>:null}
          <section className="panel"><div className="section-head"><h3>Final reconciliation</h3><span className="chip">{safeDrops.length} prior safe drops: {formatNZD(safeDrops.reduce((s,d)=>s+d.amountCents,0))}</span></div>
            <p className="muted">Earlier safe drops have already been deducted from this drawer. They are not deducted again here.</p>
            <div className="metric-grid compact"><Metric label="Cash counted" value={formatNZD(closed?closed.totalCents:total)}/><Metric label="Final cash drop" value={closed?formatNZD(closed.dropCents):plan?formatNZD(plan.dropCents):'—'}/><Metric label="Leave in drawer" value={closed?formatNZD(closed.remainingCents):plan?formatNZD(plan.remainingCents):'—'}/><Metric label="Carry forward" value={closed?formatNZD(closed.carryForwardCents):plan?formatNZD(plan.carryForwardCents):'—'}/></div>
            {!(closed||plan)&&<p className="field-warning">{total<station.policy.targetCents?'Cash counted is below the drawer target.':'No combination of available banknotes can leave a drawer balance within the allowed range. You may need to exchange denominations under station procedure.'}</p>}
            {(closed||plan)&&<><div className="two-cols details"><div><h4>Notes to remove</h4><div className="table-scroll"><table><thead><tr><th>Note</th><th>Qty</th><th className="right">Value</th></tr></thead><tbody>{NZD.map((d,i)=>((closed?.removed??plan!.removed)[i]>0)?<tr key={i}><td>{d.label}</td><td>{(closed?.removed??plan!.removed)[i]}</td><td className="right">{formatNZD(d.cents*(closed?.removed??plan!.removed)[i])}</td></tr>:null)}</tbody></table></div></div><div><h4>Final drawer denomination counts</h4><div className="table-scroll"><table><thead><tr><th>Denomination</th><th>Qty left</th><th className="right">Value</th></tr></thead><tbody>{NZD.map((d,i)=><tr key={i}><td>{d.label}</td><td><b>{(closed?.remaining??plan!.remaining)[i]}</b></td><td className="right">{formatNZD(d.cents*(closed?.remaining??plan!.remaining)[i])}</td></tr>)}</tbody></table></div></div></div></>}
            {!closed&&plan&&<div className="closing-actions"><label className="field">POS expected drawer cash (optional)<input placeholder="e.g. 461.50" inputMode="decimal" value={expected} onChange={e=>setExpected(e.target.value)}/></label><p className="muted">Enter the POS's expected cash <b>currently in the drawer before the final drop</b>, not the day's total sales. Leave blank if unavailable.</p><button onClick={closeShift} disabled={expected.trim()!==''&&currentExpected===null}>Confirm & close shift</button></div>}
            {closed&&<><div className="info-line"><span>POS variance</span><b>{closed.varianceCents===null?'Not provided':formatNZD(closed.varianceCents)}</b></div>{receiptActions(closingReceipt(w,closed))}<div className="action-row"><button className="quiet" onClick={csvDownload}>↓ Download CSV</button><button className="quiet" onClick={()=>void copyClosing()}>Copy full counts</button><button className="secondary" onClick={()=>{if(window.confirm('Carry the final drawer denominations into the next shift?')){action(()=>handoverNextShift(w),'Drawer carried forward to next shift. Verify physical cash at handover.');setExpected('');setSafeQty(blankCount())}}}>↗ Start next shift with this drawer</button></div></>}
            <p className="help">The final receipt is generated from a saved closing snapshot, so later register changes cannot silently alter the completed report.</p>
          </section>
        </>}

        {page==='day'&&<><div className="page-description"><h2>End of Day</h2><p>Daily cash movement report for <b>{station.name}</b> on <b>{w.date}</b>. Combines this station's safe deposits and recorded shift closings only.</p></div>
          <div className="metric-grid"><Metric label="Safe drops" value={formatNZD(day.safeCents)} note={`${day.drops.length} deposits`}/><Metric label="Final drops" value={formatNZD(day.finalCents)} note={`${day.closings.length} shift closings`}/><Metric label="Total deposited" value={formatNZD(day.depositCents)} note="Safe + closing drops"/><Metric label="Completed shifts" value={String(day.closings.length)} note="Recorded and locked"/></div>
          <section className="panel"><div className="section-head"><h3>Cash movements by register and shift</h3><span className="chip">{w.date}</span></div><div className="table-scroll"><table><thead><tr><th>Category</th><th>Register</th><th>Shift</th><th>Cashier</th><th className="right">Deposited</th></tr></thead><tbody>{day.drops.map(d=><tr key={d.id}><td>Safe Drop</td><td>{d.register}</td><td>{d.shift}</td><td>{d.cashier}</td><td className="right">{formatNZD(d.amountCents)}</td></tr>)}{day.closings.map(c=><tr key={c.id}><td>Final Drop</td><td>{c.register}</td><td>{c.shift}</td><td>{c.cashier}</td><td className="right">{formatNZD(c.dropCents)}</td></tr>)}{day.drops.length+day.closings.length===0&&<tr><td colSpan={5}>No transactions recorded for this station and date.</td></tr>}</tbody></table></div><div className="big-total"><span>Total cash deposited</span><b>{formatNZD(day.depositCents)}</b></div>{receiptActions(dayReceipt(w))}<div className="action-row"><button className="secondary" onClick={()=>saveBlob(`FuelTill-day-worksheet-${w.date}.html`,new Blob([dayWorksheetHtml(w)],{type:'text/html;charset=utf-8'}))}>↓ Download A4 station worksheet</button><button className="quiet" onClick={()=>{const win=window.open('','_blank');if(!win){setFeedback('Allow pop-ups or download the worksheet.');return}win.document.open();win.document.write(dayWorksheetHtml(w));win.document.close()}}>⎙ Print station worksheet</button></div><p className="help">This is a cash movement summary, not a verified POS or banking reconciliation. POS sales and bank deposits are not integrated.</p></section>
        </>}

        {page==='profile'&&<><div className="page-description"><h2>My Profile</h2><p>Personal details for report headers. This is a local demonstration profile, not an authenticated account.</p></div><section className="panel"><div className="section-head"><h3>Employee details</h3><span className="chip">Local demo</span></div><div className="form-grid"><label className="field">Full name<input value={w.profile.name} onChange={e=>setW(old=>({...old,profile:{...old.profile,name:e.target.value}}))} placeholder="Cashier / operator name"/></label><label className="field">Email<input type="email" value={w.profile.email} onChange={e=>setW(old=>({...old,profile:{...old.profile,email:e.target.value}}))} placeholder="you@example.com"/></label><label className="field">Employee ID<input value={w.profile.employeeId} onChange={e=>setW(old=>({...old,profile:{...old.profile,employeeId:e.target.value}}))} placeholder="Optional"/></label><label className="field">Role (display only)<select value={w.profile.role} onChange={e=>setW(old=>({...old,profile:{...old.profile,role:e.target.value as Workspace['profile']['role']}}))}>{['Cashier','Supervisor','Station manager','Business owner'].map(r=><option key={r}>{r}</option>)}</select></label></div><p className="help">Role selection is not authorization. Never use this browser-only prototype as proof of employee identity or manager approval.</p></section></>}

        {page==='settings'&&<><div className="page-description"><h2>Settings</h2><p>Configure station cash policies, printable receipt paper and local demo data.</p></div>
          <section className="panel"><div className="section-head"><h3>Business & stations</h3><span className="chip">{w.stations.length} locations</span></div><div className="form-grid"><label className="field">Business display name<input value={w.organization} onChange={e=>setW(old=>({...old,organization:e.target.value}))}/></label><label className="field">Current station<select value={w.activeStationId} onChange={e=>{const s=w.stations.find(z=>z.id===e.target.value);contextChange({activeStationId:e.target.value,register:s?.registers[0]??'POS 1'})}}>{w.stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field">Station display name<input value={station.name} onChange={e=>setW(old=>({...old,stations:old.stations.map(s=>s.id===old.activeStationId?{...s,name:e.target.value}:s)}))}/></label></div><div className="action-row"><input className="flex-input" placeholder="New station name" value={newStationName} onChange={e=>setNewStationName(e.target.value)}/><button onClick={()=>{action(()=>addStation(w,newStationName),'Station added to demo workspace.');setNewStationName('')}}>+ Add station</button></div><p className="help">Multiple stations can be created for testing. Each has independent configuration and data, but they are not protected from one another by real user permissions.</p></section>
          <section className="panel"><h3>Cash policies — {station.name}</h3><div className="form-grid"><label className="field">Drawer target (NZD)<MoneyField value={station.policy.targetCents} onSave={v=>changeMoneyPolicy('targetCents',v)}/></label><label className="field">Allowed extra / carry-forward (NZD)<MoneyField value={station.policy.toleranceCents} onSave={v=>changeMoneyPolicy('toleranceCents',v)}/></label><label className="field">Minimum safe drop (NZD)<MoneyField value={station.policy.safeMinCents} onSave={v=>changeMoneyPolicy('safeMinCents',v)}/></label><label className="field">Maximum safe drop (NZD)<MoneyField value={station.policy.safeMaxCents} onSave={v=>changeMoneyPolicy('safeMaxCents',v)}/></label><label className="field">Safe-drop check interval (hours)<input type="number" min="1" max="24" step="1" value={station.policy.safeReminderHours} onChange={e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=1&&v<=24)policyChange('safeReminderHours',v)}}/></label><label className="field">Receipt paper<select value={station.policy.receiptWidth} onChange={e=>policyChange('receiptWidth',e.target.value as ReceiptWidth)}><option value="80mm">80 mm thermal</option><option value="58mm">58 mm thermal</option><option value="A4">A4 / regular printer</option></select></label></div>{station.policy.safeMinCents>station.policy.safeMaxCents&&<div className="field-warning">Safe-drop minimum exceeds maximum. Correct the policy before recording.</div>}<p className="help">Printer compatibility varies. Direct PDF downloads are available, but paper margins and cutting require testing on your printer.</p></section>
          <section className="panel"><h3>Backups & data ownership</h3><p className="muted">This prototype saves demo data only in your browser's local storage. Data can be lost when the browser is cleared, or when using a different computer. It is not encrypted, synced, backed up automatically or suitable as an authoritative financial audit ledger.</p><div className="action-row"><button onClick={exportJson}>↓ Export JSON backup</button><button className="secondary" onClick={()=>fileRef.current?.click()}>↑ Restore backup</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e=>void importJson(e)}/></div><div className="action-row"><button className="danger-button" onClick={()=>{if(window.confirm('Delete ALL local FuelTill demo data from this browser? This cannot be undone without a backup.')){setW(loadFresh());setSafeQty(blankCount());setFeedback('Demo data reset.')}}}>Reset local demo data</button></div></section>
          <section className="panel"><h3>Production readiness</h3><div className="checkline">✓ Cash calculations, per-shift records and PDF receipts in demo</div><div className="checkline">✓ Browser-local saved shifts, drop history and JSON backup</div><div className="checkline">○ Secure sign-in, role enforcement and tenant isolation on a server</div><div className="checkline">○ Server-generated immutable audit trail and backups</div><div className="checkline">○ Printer verification, deployment and pilot sign-off</div><p className="help">Firebase architecture and security starter files are included in the source archive. They are not connected until a real Firebase project is configured.</p></section>
        </>}
        <footer className="footer">FuelTill v1.1 · Local demo + optional secured business cloud · Validate physical counts · No POS connection or bank reconciliation</footer>
      </main>
    </div>
  </div>;
}
function Metric({label,value,note}:{label:string;value:string;note?:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
function MoneyField({value,onSave}:{value:number;onSave:(v:string)=>void}){
  const [text,setText]=useState(moneyInput(value));
  useEffect(()=>setText(moneyInput(value)),[value]);
  return <input type="text" inputMode="decimal" value={text} onChange={e=>setText(e.target.value)} onBlur={()=>{if(parseAmount(text)!==null)onSave(text);else setText(moneyInput(value))}}/>;
}
function loadFresh(){return newWorkspace();}
