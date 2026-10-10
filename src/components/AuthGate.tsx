import {useEffect,useState, type FormEvent} from 'react';
import type {User} from 'firebase/auth';
import CashCalculator from './CashCalculator';
import {isCloudConfigured, cloudAuth, subscribeUser, register, login, logout, resendVerification, verifyAgain, resetPassword} from '../lib/cloud';

type View='signin'|'register'|'reset';
export default function AuthGate(){
 const [user,setUser]=useState<User|null>(cloudAuth?.currentUser??null);
 const [loading,setLoading]=useState(true);
 const [view,setView]=useState<View>('signin');
 const [accountType,setAccountType]=useState<'company'|'employee'>('employee');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!isCloudConfigured){setLoading(false);return}
  return subscribeUser(u=>{setUser(u);setLoading(false)});
 },[]);
 async function run(op:()=>Promise<void>){
  setBusy(true);setError('');setStatus('');
  try{await op()}catch(e){setError(e instanceof Error?e.message:'Authentication failed.')}
  finally{setBusy(false)}
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  await run(async()=>{
   if(view==='reset'){await resetPassword(email.trim());setStatus('If an account exists, check your inbox for password reset instructions.');return}
   if(view==='register'){await register(email.trim(),password);setStatus('Account created. Check your inbox for the verification link.');return}
   await login(email.trim(),password);
  });
 }
 if(!isCloudConfigured)return <div className="auth-wrapper"><section className="auth-panel"><div className="logo"><span className="logo-mark">F</span><span>FuelTill<small>BUSINESS CASH OPERATIONS</small></span></div><h1>Account setup in progress</h1><p>FuelTill requires verified accounts. The Firebase connection has not been configured for this deployment, so login and financial records are disabled.</p><p>Administrators: follow <code>docs/FIREBASE-AUTH-LAUNCH.md</code> to connect your Firebase project. This page does not offer an insecure bypass.</p></section></div>;
 if(loading)return <div className="auth-wrapper"><section className="auth-panel"><p>Checking your sign-in session…</p></section></div>;
 if(user && !user.emailVerified)return <div className="auth-wrapper"><section className="auth-panel"><h1>Verify your email</h1><p>We've signed in as <strong>{user.email}</strong>. Open the verification link in your inbox to continue.</p>{error&&<p role="alert">{error}</p>}{status&&<p role="status">{status}</p>}<div className="action-row"><button disabled={busy} onClick={()=>void run(async()=>{const ok=await verifyAgain();setUser(cloudAuth?.currentUser??null);if(!ok)setStatus('Your email is not verified yet.')})}>I've verified — Continue</button><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{await resendVerification();setStatus('Verification email sent.')})}>Resend email</button><button className="quiet" onClick={()=>void logout()}>Sign out</button></div></section></div>;
 if(user)return <CashCalculator/>;
 return <div className="auth-wrapper"><section className="auth-panel"><div className="logo"><span className="logo-mark">F</span><span>FuelTill<small>BUSINESS CASH OPERATIONS</small></span></div><h1>{view==='signin'?'Sign in to FuelTill':view==='register'?'Create a FuelTill account':'Reset your password'}</h1><p>{view==='signin'?'Every cashier and company owner signs in with their own verified account.':view==='register'?'Your account does not automatically grant access to a company or station.':'Use the email address associated with your FuelTill account.'}</p>{view==='register'&&<div className="action-row" role="group" aria-label="Account purpose"><button className={accountType==='employee'?'':'secondary'} type="button" onClick={()=>setAccountType('employee')}>Employee</button><button className={accountType==='company'?'':'secondary'} type="button" onClick={()=>setAccountType('company')}>Company owner</button></div>}{view==='register'&&<p className="help">{accountType==='company'?'After verifying your email, go to Business Cloud → Create business. Company ownership must be independently verified.':'After verifying your email, ask your manager for a private station invitation code.'}</p>}<form onSubmit={e=>void submit(e)}><label className="field">Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>{view!=='reset'&&<label className="field">Password<input type="password" minLength={8} autoComplete={view==='register'?'new-password':'current-password'} required value={password} onChange={e=>setPassword(e.target.value)}/></label>}<div className="action-row"><button disabled={busy} type="submit">{busy?'Working…':view==='signin'?'Sign in':view==='register'?'Create account':'Send reset email'}</button></div></form>{error&&<p role="alert" className="notice danger">{error}</p>}{status&&<p role="status" className="notice">{status}</p>}<div className="action-row">{view!=='signin'&&<button type="button" className="quiet" onClick={()=>{setView('signin');setError('');setStatus('')}}>Back to sign in</button>}{view!=='register'&&<button type="button" className="quiet" onClick={()=>{setView('register');setError('');setStatus('')}}>Create account</button>}{view!=='reset'&&<button type="button" className="quiet" onClick={()=>{setView('reset');setError('');setStatus('')}}>Forgot password?</button>}</div><p className="help">Business access is assigned through verified invitations and checked again on the server. Do not share passwords or invitation codes publicly.</p></section></div>;
}
