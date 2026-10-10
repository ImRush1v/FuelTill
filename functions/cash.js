'use strict';
const VALUES=[10,20,50,100,200,500,1000,2000,5000,10000];
function validCounts(v){return Array.isArray(v)&&v.length===10&&v.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)&&Number.isSafeInteger(total(v))}
function total(v){return v.reduce((s,q,i)=>s+q*VALUES[i],0)}
/** Same bounded note-only knapsack as the tested client, using integer cents. */
function calculateDrop(counts,target=30000,tolerance=499){
 if(!validCounts(counts)||!Number.isSafeInteger(target)||target<0||!Number.isSafeInteger(tolerance)||tolerance<0)return null;
 const sum=total(counts);if(sum<target)return null;
 const cap=Math.floor((sum-target)/500);
 if(cap>2000000) throw Error('Drop planning exceeds operational bounds. Split into smaller drops.');
 const reach=new Uint8Array(cap+1),prev=new Int32Array(cap+1),used=new Int8Array(cap+1),qty=new Int32Array(cap+1);
 reach[0]=1;let highest=0;
 for(const i of [9,8,7,6,5]){
   const noteUnits=VALUES[i]/500;let count=counts[i],batch=1;
   while(count>0){const take=Math.min(batch,count),weight=take*noteUnits;
     for(let n=Math.min(cap,highest+weight);n>=weight;n--){if(!reach[n]&&reach[n-weight]){reach[n]=1;prev[n]=n-weight;used[n]=i;qty[n]=take}}
     highest=Math.min(cap,highest+weight);count-=take;batch*=2;
   }
 }
 let best=cap;while(best>0&&!reach[best])best--;
 const removed=Array(10).fill(0);for(let n=best;n>0;n=prev[n])removed[used[n]]+=qty[n];
 const remaining=counts.map((q,i)=>q-removed[i]);const dropCents=total(removed),remainingCents=total(remaining);
 if(remainingCents>target+tolerance||remainingCents<target||dropCents!==500*best||remaining.some(n=>n<0))return null;
 return {removed,remaining,dropCents,remainingCents,carryForwardCents:remainingCents-target};
}
module.exports={VALUES,validCounts,total,calculateDrop};
