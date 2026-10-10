const {test}=require('node:test');const assert=require('node:assert/strict');
const {total,calculateDrop}=require('../cash');
test('original $461.50 count leaves $301.50',()=>{
 const c=[0,0,1,1,0,0,30,3,2,0];assert.equal(total(c),46150);
 const p=calculateDrop(c,30000,499);assert.ok(p);assert.equal(p.dropCents,16000);assert.equal(p.remainingCents,30150);assert.equal(total(p.removed),p.dropCents);
});
test('drop over $5000',()=>{
 const c=[0,0,0,3,0,0,0,0,0,63];const p=calculateDrop(c,30000,499);assert.equal(p.dropCents,600000);assert.equal(p.remainingCents,30300);
});
test('does not remove more denominations than counted',()=>{
 const c=[5,1,1,2,5,10,8,10,8,5];const p=calculateDrop(c);if(p)p.removed.forEach((n,i)=>assert.ok(n<=c[i]));
});
