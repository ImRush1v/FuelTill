import {useEffect,useMemo,useState} from 'react';
import type {User} from 'firebase/auth';
import { NZD } from '../types/cash';
import { calculateDrop, formatNZD, totalCents } from '../lib/cash';
import { closingReceipt, dayReceipt, downloadPdf, safeDropReceipt, downloadHtml } from '../lib/receipts';
import { openNativePrint, shareReceipt } from '../lib/mobilePrint';
import {newWorkspace,localDate,type Workspace,type ReceiptWidth,type Policy} from '../lib/records';
import {
  isCloudConfigured,cloudAuth,subscribeUser,register,login,logout,resendVerification,verifyAgain,resetPassword,
  myOrganizations,createOrganization,myStations,addBusinessStation,createInvitation,acceptInvitation,
  updateBusinessStationPolicy,listBusinessMembers,revokeBusinessMember,type CloudMember,
  readShift,saveDrawerCount,recordCloudSafeDrop,closeCloudShift,readDaySummary,
  type Organization,type CloudStation,type CloudShiftState,type CloudSafeDrop,type CloudClosing,type ShiftContext
} from '../lib/cloud';
const empty=()=>NZD.map(()=>0);
type SubPage='drop'|'closing'|'day'|'team';
const parseMoney=(v:string):number|null=>/^\d+(\.\d{1,2})?$/.test(v.trim())?Math.round(Number(v.trim())*100):null;
function toWorkspace(org:Organization,station:CloudStation,date:string,register:string,shift:string,user:User,drops:CloudSafeDrop[]=[],closings:CloudClosing[]=[]):Workspace{
 return {...newWorkspace(),organization:org.name,stations:[station],activeStationId:station.id,date,register,shift,
   profile:{name:user.email||'',email:user.email||'',employeeId:'',role:'Cashier'},
   safeDrops:drops,closings,audit:[]};
}
const errText=(e:unknown)=>e instanceof Error?e.message:String(e);
export default function CloudOperations(){
 const [user,setUser]=useState<User|null>(cloudAuth?.currentUser||null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [orgs,setOrgs]=useState<Organization[]>([]),[orgId,setOrgId]=useState(''),[stations,setStations]=useState<CloudStation[]>([]),[stationId,setStationId]=useState('');
 const [newOrg,setNewOrg]=useState(''),[firstStation,setFirstStation]=useState(''),[stationName,setStationName]=useState('');
 const [members,setMembers]=useState<CloudMember[]>([]);
 const [inviteCode,setInviteCode]=useState(''),[inviteEmail,setInviteEmail]=useState(''),[inviteRole,setInviteRole]=useState('cashier'),[invitedIds,setInvitedIds]=useState<string[]>([]),[generatedCode,setGeneratedCode]=useState('');
 const [registerName,setRegisterName]=useState('POS 1'),[shift,setShift]=useState('Shift 1'),[date,setDate]=useState(localDate()),[tab,setTab]=useState<SubPage>('drop');
 const [state,setState]=useState<CloudShiftState|null>(null),[counts,setCounts]=useState<number[]>(empty),[removed,setRemoved]=useState<number[]>(empty),[dirty,setDirty]=useState(false);
 const [expected,setExpected]=useState(''),[dayData,setDayData]=useState<{closings:CloudClosing[];drops:CloudSafeDrop[]}|null>(null),[receiptWidth,setReceiptWidth]=useState<ReceiptWidth>('80mm');
 const org=orgs.find(o=>o.id===orgId),station=stations.find(s=>s.id===stationId),context:ShiftContext={orgId,stationId,register:registerName,shift,date};
 const total=totalCents(counts),removable=totalCents(removed);
 const plan=useMemo(()=>station&&!dirty?calculateDrop(counts,station.policy.targetCents,station.policy.toleranceCents):null,[counts,station,dirty]);
 const manager=org?.role==='owner'||org?.role==='manager';
 useEffect(()=>subscribeUser(u=>{setUser(u);setState(null);setOrgs([]);setOrgId('');setStations([]);setStationId('')}),[]);
 async function perform(operation:()=>Promise<void>){setBusy(true);setMessage('');try{await operation()}catch(e){setMessage(errText(e))}finally{setBusy(false)}}
 async function refreshOrgs(){const data=await myOrganizations();setOrgs(data.organizations);setOrgId(old=>data.organizations.some(o=>o.id===old)?old:(data.organizations[0]?.id||''))}
 async function refreshStations(targetOrg:string){if(!targetOrg){setStations([]);setStationId('');return}const data=await myStations(targetOrg);setStations(data.stations);setStationId(old=>data.stations.some(s=>s.id===old)?old:(data.stations[0]?.id||''))}
 useEffect(()=>{if(!user?.emailVerified)return;void refreshOrgs().catch(e=>setMessage(errText(e)))},[user?.uid,user?.emailVerified]);
 useEffect(()=>{if(!orgId)return;setState(null);void refreshStations(orgId).catch(e=>setMessage(errText(e)))},[orgId]);
 useEffect(()=>{if(!station){setState(null);return}if(!station.registers.includes(registerName))setRegisterName(station.registers[0]);setReceiptWidth(station.policy.receiptWidth)},[stationId,stations]);
 async function refreshShift(ctx:ShiftContext=context){const data=await readShift(ctx);setState(data.state);setCounts([...data.state.counts]);setRemoved(empty());setDirty(false);}
 useEffect(()=>{if(!orgId||!stationId||!station?.registers.includes(registerName)){setState(null);return}let active=true;
  readShift(context).then(data=>{if(active){setState(data.state);setCounts([...data.state.counts]);setRemoved(empty());setDirty(false)}}).catch(e=>{if(active){setState(null);setMessage(errText(e))}});
  return()=>{active=false};
 },[orgId,stationId,registerName,shift,date]);
 useEffect(()=>{setDayData(null)},[orgId,stationId,date]);
 function receiptForSafe(drop:CloudSafeDrop){if(!org||!station||!user)return null;return safeDropReceipt(toWorkspace(org,station,date,registerName,shift,user),drop)}
 function receiptForClosing(closing:CloudClosing){if(!org||!station||!user)return null;return closingReceipt(toWorkspace(org,station,date,registerName,shift,user),closing)}
 function receiptForDay(){if(!org||!station||!user||!dayData)return null;return dayReceipt(toWorkspace(org,station,date,registerName,shift,user,dayData.drops,dayData.closings))}
 function downloads(r:ReturnType<typeof receiptForSafe>){if(!r)return null;return <div className="action-row receipt-actions">
  <button onClick={()=>downloadPdf(r,receiptWidth)}>↓ Download {r.title} PDF</button>
  <button className="secondary" onClick={()=>{if(!openNativePrint(r,receiptWidth))setMessage('Allow pop-ups or download the PDF and print from your device.')}}>⎙ Print Phone / PC</button>
  <button className="secondary" onClick={()=>void shareReceipt(r,receiptWidth).then(()=>setMessage('Use your phone’s Share → Print option if supported.')).catch(e=>setMessage(errText(e)))}>↗ Phone Share / Print</button>
  <button className="quiet" onClick={()=>downloadHtml(r,receiptWidth)}>Download HTML</button>
 </div>}
 function updateQty(i:number,val:string,kind:'counts'|'removed'){
   const num=val.trim()===''?0:Number(val);if(!Number.isSafeInteger(num)||num<0||num>1000000)return;
   if(kind==='counts'){setCounts(old=>old.map((x,k)=>k===i?num:x));setDirty(true)}
   else if(i>=5)setRemoved(old=>old.map((x,k)=>k===i?num:x));
 }
 function denominationInputs(kind:'counts'|'removed'){
   const value=kind==='counts'?counts:removed;
   return <div className="count-grid">{NZD.map((d,i)=><label key={d.label} className="count-tile"><div className="count-top"><b>{d.label}</b><span>{d.kind}</span></div>
     <input inputMode="numeric" type="number" min="0" step="1" disabled={Boolean(state?.closed)||(kind==='removed'&&i<5)} value={value[i]??0} onChange={e=>updateQty(i,e.target.value,kind)}/>
     <small>{formatNZD(d.cents*(value[i]||0))}</small></label>)}</div>;
 }
 async function saveCount(){if(!state)return;const result=await saveDrawerCount(context,counts,state.revision);await refreshShift();setMessage(`Count saved securely (revision ${result.revision}).`)}
 async function recordDrop(){if(!state||dirty)throw Error('Save the drawer count before recording a safe drop.');
   if(!window.confirm(`Confirm you physically deposited ${formatNZD(removable)} in the safe?`))return;
   const requestId=crypto.randomUUID();await recordCloudSafeDrop(context,removed,state.revision,requestId);await refreshShift();setMessage(`Safe drop ${formatNZD(removable)} recorded on the business server.`)}
 async function close(){if(!state||dirty)throw Error('Save your count first.');if(!plan)throw Error('Cannot form a valid final drop.');
   const expectedCents=expected.trim()?parseMoney(expected):null;if(expected.trim()&&expectedCents===null)throw Error('Invalid POS expected amount.');
   if(!window.confirm(`Close this shift and drop ${formatNZD(plan.dropCents)}? This cannot be undone from a cashier account.`))return;
   await closeCloudShift(context,state.revision,expectedCents);await refreshShift();setMessage('Shift permanently closed. Download the final receipt.');}
 async function loadDay(){const x=await readDaySummary({orgId,stationId,date});setDayData({closings:x.closings,drops:x.drops});setMessage('Day records loaded from business cloud.');}
 if(!isCloudConfigured)return <><div className="page-description"><h2>Business Cloud</h2><p>Connect employees to their approved station and company from any phone or PC.</p></div>
   <section className="panel"><h3>Cloud setup required</h3><p>The account system and secure Cloud Functions are included in this ZIP, but this copy has no live Firebase project connected.</p>
   <p>Configure your own Firebase project using <code>.env.example</code> and <code>docs/CLOUD-SETUP.md</code>. Until then, the other FuelTill pages work in local demonstration mode.</p>
   <p className="help">This is intentionally disabled rather than offering fake authentication or storing private cash records in a public database.</p></section></>;
 if(!user)return <><div className="page-description"><h2>Sign in to Business Cloud</h2><p>Access only the businesses and stations assigned to your verified account.</p></div>
   {message&&<div role="status" className="notice">{message}</div>}
   <section className="panel cloud-auth"><div className="form-grid"><label className="field">Work email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label className="field">Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label></div>
   <div className="action-row"><button disabled={busy} onClick={()=>void perform(async()=>{await login(email,password);setMessage('Signed in.')} )}>Sign in</button>
   <button className="secondary" disabled={busy} onClick={()=>void perform(async()=>{await register(email,password);setMessage('Account created. Check your email and verify before connecting a business.')})}>Create account</button>
   <button className="quiet" disabled={busy} onClick={()=>void perform(async()=>{if(!email)throw Error('Enter your email first.');await resetPassword(email);setMessage('If the email is registered, password reset instructions have been sent.')})}>Forgot password?</button></div>
   <p className="help">Use a unique password. For a public rollout, administrators should enable multi-factor authentication and App Check before accepting financial records.</p></section></>;
 if(!user.emailVerified)return <section className="panel"><h2>Verify your email</h2><p>A verification email must be confirmed before accessing station data. Signed in as <b>{user.email}</b>.</p>
   {message&&<div className="notice">{message}</div>}
   <div className="action-row"><button disabled={busy} onClick={()=>void perform(async()=>{const done=await verifyAgain();setUser(cloudAuth?.currentUser||null);setMessage(done?'Verified. You can now access your businesses.':'Not verified yet. Open the email verification link first.')})}>I've verified — Continue</button>
   <button className="secondary" disabled={busy} onClick={()=>void perform(async()=>{await resendVerification();setMessage('Verification email requested.')})}>Resend email</button><button className="quiet" onClick={()=>void logout()}>Sign out</button></div></section>;
 return <>
  <div className="page-description"><h2>Connected businesses</h2><p>Signed in as <b>{user.email}</b>. Records below use a server-authoritative ledger when a Firebase project is configured.</p></div>
  {message&&<div className="notice" role="status">{message}</div>}
  <div className="action-row"><button className="quiet" onClick={()=>void perform(refreshOrgs)}>↻ Refresh businesses</button><button className="quiet" onClick={()=>void logout()}>Sign out</button></div>
  <section className="panel"><div className="section-head"><h3>Join or create your business</h3><span className="chip">Verified email · Business affiliation not verified</span></div>
   <div className="form-grid"><label className="field">Business<select value={orgId} onChange={e=>{setOrgId(e.target.value);setGeneratedCode('')}}><option value="">Select your business</option>{orgs.map(x=><option key={x.id} value={x.id}>{x.name} ({x.role})</option>)}</select></label>
   <label className="field">Private station invitation code<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} placeholder="Paste code from your manager"/></label></div>
   <div className="action-row"><button className="secondary" disabled={busy||!inviteCode} onClick={()=>void perform(async()=>{await acceptInvitation(inviteCode.trim());setInviteCode('');await refreshOrgs();setMessage('Business invitation accepted. Your assigned stations are now available.')})}>Join using invite</button></div>
   <details className="details"><summary>Create a new business (owners only)</summary><div className="form-grid"><label className="field">Registered business display name<input value={newOrg} onChange={e=>setNewOrg(e.target.value)} placeholder="Company name"/></label>
   <label className="field">First station name<input value={firstStation} onChange={e=>setFirstStation(e.target.value)} placeholder="Station location"/></label></div>
   <button disabled={busy||!newOrg||!firstStation} onClick={()=>void perform(async()=>{const created=await createOrganization(newOrg,firstStation);await refreshOrgs();setOrgId(created.orgId);setNewOrg('');setFirstStation('');setMessage('New company and first station created; you are the verified owner.')})}>Create business</button></details>
  </section>
  {org&&<><section className="context-bar"><label>Station<select value={stationId} onChange={e=>setStationId(e.target.value)}>{stations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Register<select value={registerName} onChange={e=>setRegisterName(e.target.value)}>{(station?.registers||[]).map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Shift<select value={shift} onChange={e=>setShift(e.target.value)}>{['Shift 1','Shift 2','Shift 3'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></section>
    <div className="action-row subnav"><button className={tab==='drop'?'':'secondary'} onClick={()=>setTab('drop')}>Safe Drop</button><button className={tab==='closing'?'':'secondary'} onClick={()=>setTab('closing')}>End of Shift</button><button className={tab==='day'?'':'secondary'} onClick={()=>setTab('day')}>End of Day</button>{manager&&<button className={tab==='team'?'':'secondary'} onClick={()=>setTab('team')}>Stations & Staff</button>}</div>
    {station&&tab!=='team'&&<div className="action-row"><label className="field">Print format<select value={receiptWidth} onChange={e=>setReceiptWidth(e.target.value as ReceiptWidth)}><option value="80mm">80 mm receipt</option><option value="58mm">58 mm receipt</option><option value="A4">A4</option></select></label>
      <button className="quiet" disabled={busy} onClick={()=>void perform(async()=>{await refreshShift();setMessage('Current shift refreshed from cloud.')})}>↻ Reload shift</button></div>}
    {(tab==='drop'||tab==='closing')&&station&&<><section className="panel"><div className="section-head"><h3>Cash count — {station.name}</h3><span className="chip">{state?.closed?'Shift closed':dirty?'Unsaved changes':'Cloud revision '+(state?.revision??'—')}</span></div>
      {state?denominationInputs('counts'):<p>Loading cash record…</p>}
      <div className="big-total"><span>Cash in drawer</span><b>{formatNZD(total)}</b></div><div className="action-row"><button disabled={busy||!state||!dirty||state.closed} onClick={()=>void perform(saveCount)}>Save current count securely</button></div>
      <p className="help">Counts are deliberately saved with a revision number. If another device changes this register, stale updates are rejected; reload before proceeding.</p></section></>}
    {tab==='drop'&&station&&state&&<><section className="panel"><h3>Safe Drop — Deposit to locker</h3><p className="muted">Allowed range: {formatNZD(station.policy.safeMinCents)}–{formatNZD(station.policy.safeMaxCents)}. Drawer must retain {formatNZD(station.policy.targetCents)} or more.</p>
      {denominationInputs('removed')}<div className="big-total"><span>Proposed safe drop</span><b>{formatNZD(removable)}</b></div><div className="action-row">
      <button className="secondary" disabled={dirty||state.closed} onClick={()=>{
        const available=total-station.policy.targetCents,cap=Math.min(station.policy.safeMaxCents,available);
        if(cap<station.policy.safeMinCents){setMessage('Not enough excess cash.');return}
        const proposal=calculateDrop(counts,total-cap,cap-station.policy.safeMinCents);if(!proposal||proposal.dropCents<station.policy.safeMinCents){setMessage('No available banknote combination fits this safe-drop range.');return}
        setRemoved(proposal.removed);setMessage('Proposed notes selected; count and verify them before confirming.');
      }}>Suggest notes</button>
      <button disabled={busy||dirty||state.closed||removable<station.policy.safeMinCents||removable>station.policy.safeMaxCents||removed.some((v,i)=>v>counts[i])||total-removable<station.policy.targetCents} onClick={()=>void perform(recordDrop)}>Confirm physical safe drop</button></div>
      <p className="help">Saving records the physical deposit on the server. It is never removed again during end-of-shift or daily totals.</p></section>
      <section className="panel"><h3>Safe Drop History — This Shift</h3>{!state.drops.length&&<p>No safe deposits recorded.</p>}
      {state.drops.map(d=><div className="cloud-receipt-row" key={d.id}><div><b>{formatNZD(d.amountCents)}</b> · {d.recordedAt?.slice(0,16).replace('T',' ')} <small>{d.id.slice(0,8)}</small></div>{downloads(receiptForSafe(d))}</div>)}</section></>}
    {tab==='closing'&&station&&state&&<><section className="panel"><h3>End of Shift</h3>{state.closed?<><p className="notice success">Shift is closed on the server; official saved receipt below.</p>
       <div className="metric-grid compact"><div className="metric"><span>Final cash drop</span><strong>{formatNZD(state.closing?.dropCents||0)}</strong></div><div className="metric"><span>Leave in drawer</span><strong>{formatNZD(state.closing?.remainingCents||0)}</strong></div></div>{state.closing&&downloads(receiptForClosing(state.closing))}</>:
       <><p>Target drawer: <b>{formatNZD(station.policy.targetCents)}</b> · Carry-forward tolerance: {formatNZD(station.policy.toleranceCents)}</p>{dirty&&<div className="field-warning">Save count before closing this shift.</div>}
       {!plan?<div className="field-warning">No exact banknote combination keeps the desired target. Check quantities first.</div>:
       <div className="metric-grid compact"><div className="metric"><span>Cash drop</span><strong>{formatNZD(plan.dropCents)}</strong></div><div className="metric"><span>Drawer remaining</span><strong>{formatNZD(plan.remainingCents)}</strong></div><div className="metric"><span>Carry forward</span><strong>{formatNZD(plan.carryForwardCents)}</strong></div></div>}
       <label className="field cloud-expected">POS expected drawer cash after safe drops (optional)<input type="text" inputMode="decimal" placeholder="Optional, e.g. 461.50" value={expected} onChange={e=>setExpected(e.target.value)}/></label>
       <div className="action-row"><button disabled={busy||dirty||!plan} onClick={()=>void perform(close)}>Confirm and close shift</button></div></>}
       <p className="help">The downloadable End of Shift receipt includes original counts, notes removed, and exact coin/note quantities remaining.</p></section></>}
    {tab==='day'&&station&&<section className="panel"><h3>End of Day — {date}</h3><p>Retrieve completed shifts and safe deposits for this station only.</p>
     <button disabled={busy} onClick={()=>void perform(loadDay)}>Load day report</button>
     {dayData&&<><div className="metric-grid compact"><div className="metric"><span>Safe drops</span><strong>{formatNZD(dayData.drops.reduce((s,d)=>s+d.amountCents,0))}</strong></div>
       <div className="metric"><span>Closing drops</span><strong>{formatNZD(dayData.closings.reduce((s,c)=>s+c.dropCents,0))}</strong></div>
       <div className="metric"><span>Completed shifts</span><strong>{dayData.closings.length}</strong></div></div>{downloads(receiptForDay())}</>}
     <p className="help">This is a station cash-movement summary, not independently reconciled POS sales or bank deposits.</p></section>}
    {tab==='team'&&manager&&<><section className="panel"><h3>Add another station</h3><div className="action-row"><input className="flex-input" value={stationName} onChange={e=>setStationName(e.target.value)} placeholder="New station name"/><button disabled={busy||stationName.trim().length<2} onClick={()=>void perform(async()=>{await addBusinessStation(orgId,stationName);setStationName('');await refreshStations(orgId);setMessage('Station created and connected to this company.')})}>Add station</button></div></section>
      <section className="panel"><h3>Invite staff to specific stations</h3><p className="muted">Only the employee whose verified email matches the invitation can accept it. Invitations expire after 48 hours and can be used once.</p>
      <div className="form-grid"><label className="field">Employee email<input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label>
      <label className="field">Role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="cashier">Cashier</option><option value="supervisor">Supervisor</option>{org.role==='owner'&&<option value="manager">Manager</option>}</select></label></div>
      {inviteRole!=='manager'&&<fieldset className="station-checks"><legend>Assigned stations</legend>{stations.map(st=><label key={st.id}><input type="checkbox" checked={invitedIds.includes(st.id)} onChange={e=>setInvitedIds(prev=>e.target.checked?[...prev,st.id]:prev.filter(v=>v!==st.id))}/> {st.name}</label>)}</fieldset>}
      <button disabled={busy||!inviteEmail||(!invitedIds.length&&inviteRole!=='manager')} onClick={()=>void perform(async()=>{const result=await createInvitation(orgId,inviteEmail,inviteRole,invitedIds);setGeneratedCode(result.code);setMessage('Private invite created. Send it securely to the exact email owner.')})}>Create private invitation</button>
      {generatedCode&&<div className="invite-secret"><p><b>Invitation code (shown once):</b></p><code>{generatedCode}</code><div className="action-row"><button className="secondary" onClick={()=>void navigator.clipboard.writeText(generatedCode)}>Copy code</button><button className="quiet" onClick={()=>setGeneratedCode('')}>Hide code</button></div></div>}</section>
      {station&&<StationPolicyForm station={station} busy={busy} onSave={policy=>void perform(async()=>{await updateBusinessStationPolicy(orgId,station.id,policy);await refreshStations(orgId);setMessage('Cash and printer policies saved on your business server.')})}/>}
      <section className="panel"><h3>Active employee access</h3><div className="action-row"><button className="secondary" disabled={busy} onClick={()=>void perform(async()=>{const x=await listBusinessMembers(orgId);setMembers(x.members)})}>Load employee access</button></div>
      {members.filter(m=>m.status==='active').map(m=><div className="info-line" key={m.uid}><span><b>{m.email}</b> ({m.role}) · {m.stationIds.length?m.stationIds.map(id=>stations.find(x=>x.id===id)?.name||id).join(', '):'All authorized manager stations'}</span>
        {m.uid!==user.uid&&m.role!=='owner'&&(org.role==='owner'||m.role!=='manager')&&<button className="danger-button" disabled={busy} onClick={()=>void perform(async()=>{if(!window.confirm('Revoke this employee’s business access?'))return;await revokeBusinessMember(orgId,m.uid);const x=await listBusinessMembers(orgId);setMembers(x.members);setMessage('Employee access revoked.')})}>Revoke</button>}</div>)}
      <p className="help">Revocation is enforced on new server requests. For immediate session restrictions, use short-lived authorization and incident response procedures.</p></section></>}
  </>}
 </>;
}

function StationPolicyForm({station,busy,onSave}:{station:CloudStation;busy:boolean;onSave:(policy:Policy)=>void}){
 const [draft,setDraft]=useState<Policy>(station.policy);
 useEffect(()=>setDraft(station.policy),[station.id,station.policy]);
 function updateMoney(key:'targetCents'|'toleranceCents'|'safeMinCents'|'safeMaxCents',text:string){
   const cents=parseMoney(text);if(cents===null)return;setDraft(old=>({...old,[key]:cents}));
 }
 return <section className="panel"><h3>Station rules — {station.name}</h3><p>These settings apply to this station on every device.</p>
 <div className="form-grid">{([['targetCents','Drawer target'],['toleranceCents','Allowed carry-forward'],['safeMinCents','Minimum safe drop'],['safeMaxCents','Maximum safe drop']] as const).map(([key,label])=><label className="field" key={key}>{label} (NZD)
 <input type="number" min="0" step="0.01" value={(draft[key]/100).toFixed(2)} onChange={e=>updateMoney(key,e.target.value)}/></label>)}
 <label className="field">Safe-drop check every (hours)<input type="number" min="1" max="24" value={draft.safeReminderHours} onChange={e=>setDraft(old=>({...old,safeReminderHours:Number(e.target.value)}))}/></label>
 <label className="field">Default printer paper<select value={draft.receiptWidth} onChange={e=>setDraft(old=>({...old,receiptWidth:e.target.value as ReceiptWidth}))}><option value="80mm">80 mm thermal</option><option value="58mm">58 mm thermal</option><option value="A4">A4 regular</option></select></label></div>
 <div className="action-row"><button disabled={busy||draft.safeMinCents>draft.safeMaxCents} onClick={()=>onSave(draft)}>Save station policy</button></div></section>;
}
