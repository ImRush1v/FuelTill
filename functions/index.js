'use strict';
const crypto=require('node:crypto');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
const {calculateDrop,validCounts,total}=require('./cash');
admin.initializeApp();
const db=admin.firestore(), timestamp=admin.firestore.FieldValue.serverTimestamp;
// Turn on enforceAppCheck after configuring a production App Check provider.
const endpoint={region:'australia-southeast1',maxInstances:20,enforceAppCheck:false};
const call=(fn)=>onCall(endpoint,async(req)=>{try{return await fn(req)}catch(e){if(e instanceof HttpsError)throw e;console.error('FuelTill callable failed:',e);throw new HttpsError('internal','Request failed. Please contact support.')}});
function requireUser(req){
 const a=req.auth;
 if(!a)throw new HttpsError('unauthenticated','Please sign in.');
 if(a.token.email_verified!==true)throw new HttpsError('permission-denied','Verify your email before accessing business records.');
 return {uid:a.uid,email:String(a.token.email||'').toLowerCase()};
}
const field=(x,min=1,max=80)=>{const s=String(x??'').trim();if(s.length<min||s.length>max)throw new HttpsError('invalid-argument','Invalid text field.');return s};
function checkId(x){const s=field(x,1,120);if(!/^[a-zA-Z0-9_-]+$/.test(s))throw new HttpsError('invalid-argument','Invalid ID.');return s}
function requireDate(x){const s=field(x,10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(new Date(s+'T00:00:00Z').getTime())||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw new HttpsError('invalid-argument','Invalid date.');return s}
function requireShift(x){if(!['Shift 1','Shift 2','Shift 3'].includes(x))throw new HttpsError('invalid-argument','Unknown shift.');return x}
function requireRevision(x){if(!Number.isSafeInteger(x)||x<0)throw new HttpsError('invalid-argument','Invalid revision.');return x}
const defaultPolicy=()=>({targetCents:30000,toleranceCents:499,safeMinCents:35000,safeMaxCents:50000,safeReminderHours:3,receiptWidth:'80mm'});
async function memberOf(orgId,uid){const ref=db.doc(`organizations/${checkId(orgId)}/members/${uid}`);const snap=await ref.get();if(!snap.exists||snap.data().status!=='active')throw new HttpsError('permission-denied','You are not a member of this business.');return snap.data()}
function hasStation(member,stationId){return ['owner','manager'].includes(member.role)||(Array.isArray(member.stationIds)&&member.stationIds.includes(stationId))}
async function getAccess(req,data,manage=false){const user=requireUser(req),orgId=checkId(data.orgId),stationId=checkId(data.stationId);const member=await memberOf(orgId,user.uid);
 if(!hasStation(member,stationId))throw new HttpsError('permission-denied','This station is not assigned to your account.');
 if(manage&&!['owner','manager'].includes(member.role))throw new HttpsError('permission-denied','Manager role required.');
 const stationRef=db.doc(`organizations/${orgId}/stations/${stationId}`),snap=await stationRef.get();if(!snap.exists)throw new HttpsError('not-found','Station not found.');
 return {user,member,orgId,stationId,stationRef,station:snap.data()};
}
function shiftInfo(data,station){const date=requireDate(data.date),register=field(data.register,1,30),shift=requireShift(data.shift);
 if(!Array.isArray(station.registers)||!station.registers.includes(register))throw new HttpsError('invalid-argument','Unknown register.');
 return {date,register,shift,key:`${date}_${register.replace(/[^a-zA-Z0-9]/g,'-')}_${shift.replace(/ /g,'-')}`};
}
async function shiftAccess(req,data){const access=await getAccess(req,data);const info=shiftInfo(data,access.station);return {...access,...info,ref:access.stationRef.collection('shifts').doc(info.key)}}
const eventAudit=(ref,kind,user,details)=>({ref:ref.collection('audit').doc(),data:{kind,actorUid:user.uid,actorEmail:user.email,at:timestamp(),...details}});
function displayShift(snap,drops){const state=snap.exists?snap.data():{};return {counts:state.counts||Array(10).fill(0),revision:state.revision||0,closed:Boolean(state.closed),closing:state.closing||null,drops:drops||[]}}

exports.createOrganization=call(async req=>{
 const user=requireUser(req),name=field(req.data?.name,2,100),first=field(req.data?.firstStationName,2,80);
 const org=db.collection('organizations').doc(),station=org.collection('stations').doc(),member=org.collection('members').doc(user.uid),link=db.doc(`users/${user.uid}/orgs/${org.id}`);
 const batch=db.batch();batch.create(org,{name,verificationStatus:'unverified',createdBy:user.uid,createdAt:timestamp()});batch.create(station,{name:first,registers:['POS 1','POS 2','TACC'],policy:defaultPolicy(),createdAt:timestamp()});
 batch.create(member,{role:'owner',stationIds:[],email:user.email,status:'active',joinedAt:timestamp()});batch.set(link,{name,role:'owner',joinedAt:timestamp()});await batch.commit();return {orgId:org.id,stationId:station.id};
});
exports.myOrganizations=call(async req=>{
 const user=requireUser(req),snap=await db.collection(`users/${user.uid}/orgs`).get();
 return {organizations:snap.docs.map(d=>({id:d.id,name:d.data().name,role:d.data().role}))};
});
exports.myStations=call(async req=>{
 const user=requireUser(req),orgId=checkId(req.data?.orgId),member=await memberOf(orgId,user.uid),snap=await db.collection(`organizations/${orgId}/stations`).get();
 return {role:member.role,stations:snap.docs.filter(d=>hasStation(member,d.id)).map(d=>({id:d.id,name:d.data().name,registers:d.data().registers,policy:d.data().policy}))};
});
exports.addBusinessStation=call(async req=>{
 const user=requireUser(req),orgId=checkId(req.data?.orgId),member=await memberOf(orgId,user.uid);
 if(!['owner','manager'].includes(member.role))throw new HttpsError('permission-denied','Manager role required.');
 const name=field(req.data?.name,2,80),ref=db.collection(`organizations/${orgId}/stations`).doc();
 const audit=eventAudit(ref,'station-added',user,{name});const batch=db.batch();batch.create(ref,{name,registers:['POS 1','POS 2','TACC'],policy:defaultPolicy(),createdAt:timestamp()});batch.create(audit.ref,audit.data);await batch.commit();
 return {id:ref.id,name};
});
exports.createInvitation=call(async req=>{
 const user=requireUser(req),orgId=checkId(req.data?.orgId),member=await memberOf(orgId,user.uid);
 if(!['owner','manager'].includes(member.role))throw new HttpsError('permission-denied','Manager role required.');
 const email=field(req.data?.email,5,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpsError('invalid-argument','Enter a valid employee email.');
 const role=field(req.data?.role,1,20);if(!['cashier','supervisor','manager'].includes(role)||(role==='manager'&&member.role!=='owner'))throw new HttpsError('permission-denied','Cannot assign this role.');
 const ids=Array.isArray(req.data?.stationIds)?req.data.stationIds.map(checkId):[];
 if(role!=='manager'&&ids.length===0)throw new HttpsError('invalid-argument','Assign at least one station to this employee.');
 for(const id of ids){const ref=db.doc(`organizations/${orgId}/stations/${id}`);if(!(await ref.get()).exists)throw new HttpsError('invalid-argument','A selected station does not exist.');}
 const token=crypto.randomBytes(32).toString('base64url'),hash=crypto.createHash('sha256').update(token).digest('hex');
 await db.doc(`invitations/${hash}`).create({orgId,email,role,stationIds:ids,expiresAt:admin.firestore.Timestamp.fromDate(new Date(Date.now()+48*3600000)),createdBy:user.uid,createdAt:timestamp(),used:false});
 return {code:token,expiresInHours:48}; // only shown to the inviting manager once; share privately
});
exports.acceptInvitation=call(async req=>{
 const user=requireUser(req),code=field(req.data?.code,16,128),hash=crypto.createHash('sha256').update(code).digest('hex'),invRef=db.doc(`invitations/${hash}`);
 return db.runTransaction(async tx=>{
   const inv=await tx.get(invRef);if(!inv.exists)throw new HttpsError('not-found','Invalid invite code.');const i=inv.data();
   if(i.used||i.expiresAt.toMillis()<Date.now()||i.email!==user.email)throw new HttpsError('permission-denied','Invite expired, used or assigned to a different verified email.');
   const orgRef=db.doc(`organizations/${i.orgId}`),memberRef=orgRef.collection('members').doc(user.uid),issuerRef=orgRef.collection('members').doc(i.createdBy);
   const old=await tx.get(memberRef),org=await tx.get(orgRef),issuer=await tx.get(issuerRef);
   if(!issuer.exists||issuer.data().status!=='active'||!['owner','manager'].includes(issuer.data().role))throw new HttpsError('permission-denied','The issuer no longer has permission to invite staff.');
   if(old.exists)throw new HttpsError('already-exists','You already belong to this organization.');if(!org.exists)throw new HttpsError('not-found','Business no longer exists.');
   tx.create(memberRef,{role:i.role,stationIds:i.stationIds,email:user.email,status:'active',joinedAt:timestamp()});
   tx.set(db.doc(`users/${user.uid}/orgs/${i.orgId}`),{name:org.data().name,role:i.role,joinedAt:timestamp()});tx.update(invRef,{used:true,usedBy:user.uid,usedAt:timestamp()});
   return {orgId:i.orgId};
 });
});
exports.readShift=call(async req=>{
 const a=await shiftAccess(req,req.data||{}),snap=await a.ref.get(),drops=await a.ref.collection('safeDrops').orderBy('recordedAt','asc').get();
 return {state:displayShift(snap,drops.docs.map(d=>({id:d.id,...d.data(),recordedAt:d.data().recordedAt?.toDate()?.toISOString()||''}))),station:a.station};
});
exports.saveDrawerCount=call(async req=>{
 const a=await shiftAccess(req,req.data||{}),counts=req.data?.counts,revision=requireRevision(req.data?.revision);
 if(!validCounts(counts))throw new HttpsError('invalid-argument','Invalid cash quantities.');
 await db.runTransaction(async tx=>{const snap=await tx.get(a.ref),state=snap.data()||{};
   if(state.closed)throw new HttpsError('failed-precondition','Shift already closed.');if((state.revision||0)!==revision)throw new HttpsError('aborted','Another device changed this shift. Refresh and check the count.');
   tx.set(a.ref,{date:a.date,register:a.register,shift:a.shift,counts,revision:revision+1,closed:false,updatedAt:timestamp(),updatedBy:a.user.uid},{merge:true});
   const audit=eventAudit(a.stationRef,'count-updated',a.user,{shiftKey:a.key,revision:revision+1});tx.set(audit.ref,audit.data);
 });return {revision:revision+1};
});
exports.recordCloudSafeDrop=call(async req=>{
 const a=await shiftAccess(req,req.data||{}),removed=req.data?.removed,revision=requireRevision(req.data?.revision),requestId=checkId(req.data?.requestId);
 if(!validCounts(removed)||removed.slice(0,5).some(q=>q!==0))throw new HttpsError('invalid-argument','Only available notes may be deposited.');
 const amount=total(removed),p=a.station.policy,entry=a.ref.collection('safeDrops').doc(requestId);
 if(amount<p.safeMinCents||amount>p.safeMaxCents)throw new HttpsError('failed-precondition','Safe drop outside station policy.');
 const result=await db.runTransaction(async tx=>{
   const old=await tx.get(entry);if(old.exists)return {alreadyRecorded:true};
   const snap=await tx.get(a.ref),s=snap.data();if(!s)throw new HttpsError('failed-precondition','Save and verify the drawer count first.');
   if(s.closed)throw new HttpsError('failed-precondition','Shift already closed.');if(s.revision!==revision)throw new HttpsError('aborted','Shift changed. Refresh before dropping cash.');
   if(removed.some((q,i)=>q>s.counts[i]))throw new HttpsError('failed-precondition','Not enough notes in the counted drawer.');
   const left=s.counts.map((q,i)=>q-removed[i]);if(total(left)<p.targetCents)throw new HttpsError('failed-precondition','Would leave drawer below target.');
   tx.create(entry,{id:requestId,stationId:a.stationId,date:a.date,register:a.register,shift:a.shift,amountCents:amount,removed,cashier:a.user.email,actorUid:a.user.uid,recordedAt:timestamp()});
   tx.update(a.ref,{counts:left,revision:revision+1,updatedAt:timestamp(),updatedBy:a.user.uid});
   const audit=eventAudit(a.stationRef,'safe-drop',a.user,{shiftKey:a.key,amountCents:amount,eventId:requestId});tx.set(audit.ref,audit.data);
   return {alreadyRecorded:false};
 });return result;
});
exports.closeCloudShift=call(async req=>{
 const a=await shiftAccess(req,req.data||{}),revision=requireRevision(req.data?.revision),expected=req.data?.expectedCents??null;
 if(expected!==null&&(!Number.isSafeInteger(expected)||expected<0))throw new HttpsError('invalid-argument','Invalid POS expected amount.');
 const saved=await db.runTransaction(async tx=>{
   const snap=await tx.get(a.ref),s=snap.data();if(!s)throw new HttpsError('failed-precondition','Count and save cash first.');
   if(s.closed)throw new HttpsError('failed-precondition','Already closed.');if(s.revision!==revision)throw new HttpsError('aborted','Shift changed. Refresh before closing.');
   const plan=calculateDrop(s.counts,a.station.policy.targetCents,a.station.policy.toleranceCents);
   if(!plan)throw new HttpsError('failed-precondition','Cannot form a valid end-of-shift cash drop using recorded banknotes.');
   const closing={id:a.key,stationId:a.stationId,date:a.date,register:a.register,shift:a.shift,cashier:a.user.email,recordedAt:new Date().toISOString(),counted:s.counts,removed:plan.removed,remaining:plan.remaining,totalCents:total(s.counts),dropCents:plan.dropCents,remainingCents:plan.remainingCents,carryForwardCents:plan.carryForwardCents,expectedCents:expected,varianceCents:expected===null?null:total(s.counts)-expected};
   tx.update(a.ref,{closed:true,counts:plan.remaining,revision:revision+1,closing,closedAt:timestamp(),closedBy:a.user.uid});
   const audit=eventAudit(a.stationRef,'shift-closed',a.user,{shiftKey:a.key,amountCents:plan.dropCents});tx.set(audit.ref,audit.data);
   return closing;
 });return {closing:saved};
});
exports.readDaySummary=call(async req=>{
 const a=await getAccess(req,req.data||{}),date=requireDate(req.data?.date),snap=await a.stationRef.collection('shifts').where('date','==',date).limit(250).get();
 const closings=[],drops=[];
 for(const s of snap.docs){const x=s.data();if(x.closing)closings.push(x.closing);const event=await s.ref.collection('safeDrops').get();for(const d of event.docs){const e=d.data();drops.push({...e,id:d.id,recordedAt:e.recordedAt?.toDate()?.toISOString()||''});}}
 return {closings,drops,station:a.station,date};
});

exports.updateBusinessStationPolicy=call(async req=>{
 const a=await getAccess(req,req.data||{},true),p=req.data?.policy;
 if(!p||typeof p!=='object')throw new HttpsError('invalid-argument','Invalid policy.');
 const fields=['targetCents','toleranceCents','safeMinCents','safeMaxCents','safeReminderHours'];
 for(const k of fields){if(!Number.isSafeInteger(p[k])||p[k]<0)throw new HttpsError('invalid-argument',`Invalid ${k}.`)}
 if(p.targetCents>100000000||p.toleranceCents>9999||p.safeMinCents>50000000||p.safeMaxCents>50000000||p.safeMinCents>p.safeMaxCents||p.safeReminderHours<1||p.safeReminderHours>24)
   throw new HttpsError('invalid-argument','Station policy outside permitted range.');
 if(!['58mm','80mm','A4'].includes(p.receiptWidth))throw new HttpsError('invalid-argument','Invalid receipt format.');
 const allowed={targetCents:p.targetCents,toleranceCents:p.toleranceCents,safeMinCents:p.safeMinCents,safeMaxCents:p.safeMaxCents,safeReminderHours:p.safeReminderHours,receiptWidth:p.receiptWidth};
 const audit=eventAudit(a.stationRef,'policy-updated',a.user,{});const batch=db.batch();batch.update(a.stationRef,{policy:allowed});batch.create(audit.ref,audit.data);await batch.commit();
 return {policy:allowed};
});
exports.listBusinessMembers=call(async req=>{
 const user=requireUser(req),orgId=checkId(req.data?.orgId),member=await memberOf(orgId,user.uid);
 if(!['owner','manager'].includes(member.role))throw new HttpsError('permission-denied','Manager role required.');
 const snap=await db.collection(`organizations/${orgId}/members`).limit(200).get();
 return {members:snap.docs.map(d=>({uid:d.id,email:d.data().email,role:d.data().role,stationIds:d.data().stationIds,status:d.data().status}))};
});
exports.revokeBusinessMember=call(async req=>{
 const user=requireUser(req),orgId=checkId(req.data?.orgId),member=await memberOf(orgId,user.uid),targetId=checkId(req.data?.uid);
 if(!['owner','manager'].includes(member.role)||targetId===user.uid)throw new HttpsError('permission-denied','Not allowed to revoke this account.');
 const target=db.doc(`organizations/${orgId}/members/${targetId}`);
 await db.runTransaction(async tx=>{const doc=await tx.get(target);if(!doc.exists)throw new HttpsError('not-found','Employee not found.');
  if(doc.data().role==='owner'||(doc.data().role==='manager'&&member.role!=='owner'))throw new HttpsError('permission-denied','Cannot revoke this role.');
  tx.update(target,{status:'revoked',revokedBy:user.uid,revokedAt:timestamp()});tx.delete(db.doc(`users/${targetId}/orgs/${orgId}`));
 });return {revoked:true};
});
