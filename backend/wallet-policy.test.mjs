import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from './wallet-policy.mjs';
const state=()=>({users:{a:{id:'a',balance:100,transactions:[{reference:'admin:g',amount:100,source:'admin_adjustment',administrative:true}]}},duels:{},deposits:{},adminOperations:{g:{type:'credit_grant',userId:'a',amount:100}}});

test('unmarked explicit online records cannot be reopened as demo',()=>{
 for(const customize of [db=>db.deposits.real={paymentMode:'pix_manual',status:'approved'},db=>db.duels.real={creditMode:'coins'},db=>db.duels.real={creditMode:'pix_manual'},db=>db.users.a.transactions.push({realMoneyPayment:true,amount:100})]){
  const db=state();customize(db);const before=structuredClone(db);assert.throws(()=>policy.assertPaymentEnvironment(db,'demo'),e=>e.code==='payment_environment_migration_required');assert.deepEqual(db,before);assert.equal(policy.assertPaymentEnvironment(db,'unconfigured'),'online');
 }
});

test('payment environment rejects demo activation as online before any ledger changes',()=>{
 assert.equal(typeof policy.assertPaymentEnvironment,'function');
 const database={...state(),walletLedgerVersion:1,walletEnvironment:'demo'},before=structuredClone(database);
 for(const mode of ['unconfigured','pix_manual'])assert.throws(()=>policy.assertPaymentEnvironment(database,mode),error=>error.code==='payment_environment_migration_required');
 assert.deepEqual(database,before);
 assert.equal(policy.assertPaymentEnvironment(database,'demo'),'demo');
});

test('unmarked demo financial records cannot become real coins by changing configuration',()=>{
 assert.equal(typeof policy.assertPaymentEnvironment,'function');
 for(const customize of [
  db=>db.users.a.transactions.push({demo:true,amount:100}),
  db=>db.deposits.d={userId:'a',amount:100,status:'pending',paymentMode:'demo'},
  db=>db.deposits.d={userId:'a',amount:100,status:'approved'},
  db=>db.duels.d={creditMode:'demo',status:'completed'}
 ]){const db=state();customize(db);assert.throws(()=>policy.assertPaymentEnvironment(db,'unconfigured'),error=>error.code==='payment_environment_migration_required');}
});

test('existing online administrative grants and isolated legacy demo history retain their ledgers',()=>{
 assert.equal(typeof policy.assertPaymentEnvironment,'function');
 const db=state();db.users.a.demoBalance=300;db.users.a.demoTransactions=[{demo:true,amount:300}];db.duels.d={creditMode:'legacy_demo'};db.deposits.d={userId:'a',amount:300,status:'approved',paymentMode:'demo',legacyDepositLedger:'demo'};
 const before=structuredClone(db);
 assert.equal(policy.assertPaymentEnvironment(db,'unconfigured'),'online');
 assert.equal(policy.assertPaymentEnvironment({...db,walletEnvironment:'online'},'pix_manual'),'online');
 assert.deepEqual(db,before);
 assert.throws(()=>policy.assertPaymentEnvironment({...db,walletEnvironment:'online'},'demo'),error=>error.code==='payment_environment_migration_required');
 assert.throws(()=>policy.assertPaymentEnvironment({...db,walletEnvironment:'typo'},'unconfigured'),error=>error.code==='invalid_payment_environment');
});

test('pending deposit totals cover every order and exclude demo orders from online totals',()=>{
 assert.equal(typeof policy.pendingDepositTotals,'function');
 const deposits=Object.fromEntries(Array.from({length:26},(_,i)=>['p'+i,{userId:'a',status:i<20?'pending':'review',amount:100,paymentMode:'pix_manual'}]));
 Object.assign(deposits,{demo:{userId:'a',status:'pending',amount:1000,paymentMode:'demo'},oldDemo:{userId:'a',status:'review',amount:250},other:{userId:'b',status:'pending',amount:500,paymentMode:'pix_manual'},approved:{userId:'a',status:'approved',amount:500,paymentMode:'pix_manual'},cancelled:{userId:'a',status:'cancelled',amount:500,paymentMode:'pix_manual'}});
 for(const mode of ['unconfigured','pix_manual'])assert.deepEqual(policy.pendingDepositTotals({deposits},'a',mode),{count:26,amount:2600,pendingCount:20,reviewCount:6});
 assert.deepEqual(policy.pendingDepositTotals({deposits},'a','demo'),{count:2,amount:1250,pendingCount:1,reviewCount:1});
 assert.deepEqual(policy.pendingDepositTotals({deposits},'missing','unconfigured'),{count:0,amount:0,pendingCount:0,reviewCount:0});
});

test('room admission caps joined memberships but ignores recipient-only and terminal rooms',()=>{
 assert.equal(typeof policy.assertRoomAdmission,'function');
 const duels=Object.fromEntries(Array.from({length:49},(_,i)=>['m'+i,{id:'m'+i,hostId:i%2?'b':'a',guestId:i%2?'a':'b',status:'in_progress'}]));
 Object.assign(duels,{invite:{id:'invite',hostId:'b',recipientId:'a',status:'invited'},closed:{id:'closed',hostId:'a',status:'completed'},cancelled:{id:'cancelled',hostId:'a',status:'cancelled'},expired:{id:'expired',guestId:'a',status:'expired'}});
 assert.equal(policy.assertRoomAdmission({duels},'a'),49);
 duels.last={id:'last',hostId:'a',status:'invited'};
 assert.throws(()=>policy.assertRoomAdmission({duels},'a'),error=>error.status===409&&error.code==='room_admission_limit');
 assert.equal(policy.assertRoomAdmission({duels},'a',{duelId:'m0'}),49);
 assert.throws(()=>policy.assertRoomAdmission({duels},'a',{duelId:'invite'}),error=>error.code==='room_admission_limit');
});
