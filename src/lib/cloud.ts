import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail, reload, onAuthStateChanged, type User } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import type { Policy } from './records';
const config={
 apiKey:import.meta.env.VITE_FIREBASE_API_KEY as string|undefined,
 authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string|undefined,
 projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID as string|undefined,
 appId:import.meta.env.VITE_FIREBASE_APP_ID as string|undefined,
 messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string|undefined,
};
export const isCloudConfigured=Boolean(config.apiKey&&config.authDomain&&config.projectId&&config.appId);
let app:FirebaseApp|null=null;
if(isCloudConfigured){
 app=getApps()[0]??initializeApp(config);
 if(import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY){
   initializeAppCheck(app,{provider:new ReCaptchaV3Provider(import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY as string),isTokenAutoRefreshEnabled:true});
 }
}
export const cloudAuth=app?getAuth(app):null;
const fns=app?getFunctions(app,(import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string)||'australia-southeast1'):null;
export const subscribeUser=(handler:(user:User|null)=>void)=>cloudAuth?onAuthStateChanged(cloudAuth,handler):()=>{};
export async function register(email:string,password:string){if(!cloudAuth)throw Error('Cloud not configured');const {user}=await createUserWithEmailAndPassword(cloudAuth,email,password);await sendEmailVerification(user);return user;}
export async function login(email:string,password:string){if(!cloudAuth)throw Error('Cloud not configured');return (await signInWithEmailAndPassword(cloudAuth,email,password)).user;}
export async function logout(){if(cloudAuth)await signOut(cloudAuth)}
export async function verifyAgain(){if(!cloudAuth?.currentUser)throw Error('Sign in first');await reload(cloudAuth.currentUser);await cloudAuth.currentUser.getIdToken(true);return cloudAuth.currentUser.emailVerified;}
export async function resendVerification(){if(!cloudAuth?.currentUser)throw Error('Sign in first');await sendEmailVerification(cloudAuth.currentUser)}
export async function resetPassword(email:string){if(!cloudAuth)throw Error('Cloud not configured');await sendPasswordResetEmail(cloudAuth,email)}
async function call<T>(name:string,payload:Record<string,unknown>={}):Promise<T>{
 if(!fns)throw Error('Business Cloud is not configured.');
 const result=await httpsCallable<Record<string,unknown>,T>(fns,name)(payload);
 return result.data;
}
export type Organization={id:string;name:string;role:'owner'|'manager'|'cashier'|'supervisor'};
export type CloudStation={id:string;name:string;registers:string[];policy:Policy};
export type CloudSafeDrop={id:string;stationId:string;date:string;register:string;shift:string;cashier:string;recordedAt:string;amountCents:number;removed:number[]};
export type CloudClosing={id:string;stationId:string;date:string;register:string;shift:string;cashier:string;recordedAt:string;counted:number[];removed:number[];remaining:number[];totalCents:number;dropCents:number;remainingCents:number;carryForwardCents:number;expectedCents:number|null;varianceCents:number|null};
export type CloudShiftState={counts:number[];revision:number;closed:boolean;closing:CloudClosing|null;drops:CloudSafeDrop[]};
export const myOrganizations=()=>call<{organizations:Organization[]}>('myOrganizations');
export const createOrganization=(name:string,firstStationName:string)=>call<{orgId:string;stationId:string}>('createOrganization',{name,firstStationName});
export const myStations=(orgId:string)=>call<{role:Organization['role'];stations:CloudStation[]}>('myStations',{orgId});
export const addBusinessStation=(orgId:string,name:string)=>call<{id:string;name:string}>('addBusinessStation',{orgId,name});
export const createInvitation=(orgId:string,email:string,role:string,stationIds:string[])=>call<{code:string;expiresInHours:number}>('createInvitation',{orgId,email,role,stationIds});
export const acceptInvitation=(code:string)=>call<{orgId:string}>('acceptInvitation',{code});
export type ShiftContext={orgId:string;stationId:string;register:string;shift:string;date:string};
export const readShift=(context:ShiftContext)=>call<{state:CloudShiftState;station:CloudStation}>('readShift',context);
export const saveDrawerCount=(context:ShiftContext,counts:number[],revision:number)=>call<{revision:number}>('saveDrawerCount',{...context,counts,revision});
export const recordCloudSafeDrop=(context:ShiftContext,removed:number[],revision:number,requestId:string)=>call<{alreadyRecorded:boolean}>('recordCloudSafeDrop',{...context,removed,revision,requestId});
export const closeCloudShift=(context:ShiftContext,revision:number,expectedCents:number|null)=>call<{closing:CloudClosing}>('closeCloudShift',{...context,revision,expectedCents});
export const readDaySummary=(context:Pick<ShiftContext,'orgId'|'stationId'|'date'>)=>call<{closings:CloudClosing[];drops:CloudSafeDrop[];station:CloudStation;date:string}>('readDaySummary',context);

export const updateBusinessStationPolicy=(orgId:string,stationId:string,policy:Policy)=>call<{policy:Policy}>('updateBusinessStationPolicy',{orgId,stationId,policy});
export type CloudMember={uid:string;email:string;role:string;stationIds:string[];status:string};
export const listBusinessMembers=(orgId:string)=>call<{members:CloudMember[]}>('listBusinessMembers',{orgId});
export const revokeBusinessMember=(orgId:string,uid:string)=>call<{revoked:boolean}>('revokeBusinessMember',{orgId,uid});
