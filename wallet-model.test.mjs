import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,current,change,restore,depositRequestsForProfile,pendingDemoDepositPoints,duelReservedPoints} from './model.mjs';

const create=()=>change(emptyState(),'create',{nickname:'Jogador A'});
const receipt='data:image/jpeg;base64,Y29tcHJvdmFudGU=';
const replacement='data:image/png;base64,Y29tcHJvdmFudGUy';
const request=(s,options={})=>change(s,'createDemoDeposit',{amount:250,method:'pix',installments:1,operationId:'wallet-operation-1',...options});
const newest=s=>current(s).depositRequests[0];
// A funded migration fixture records an explicit demo purchase instead of a signup bonus.
const fund=s=>{
  const pending=request(s,{amount:1000,operationId:`fixture-funding-${s.activeProfileId}`});
  return change(pending,'confirmDemoDeposit',{id:newest(pending).id});
};

test('creating demo payment requests preserves the available balance and never stores real payment details',()=>{
  let s=create();
  for(const [method,amount,installments]of [['card',100,6],['pix',250,1],['transfer',500,1]]){
    s=request(s,{method,amount,installments,operationId:`request-${method}`,cardNumber:'4111111111111111',cvv:'123',bankAccount:'not a bank account',pixKey:'not a real key'});
    assert.equal(current(s).balance,0);assert.equal(newest(s).status,'pending');assert.equal(newest(s).installments,installments);
    assert.equal(current(s).transactions.length,0);
    for(const field of ['cardNumber','cvv','bankAccount','pixKey'])assert.equal(newest(s)[field],undefined);
  }
  assert.equal(pendingDemoDepositPoints(s),850);assert.equal(depositRequestsForProfile(s).length,3);
  assert.equal(depositRequestsForProfile(s,'unknown').length,0);
});

test('card and Pix require an explicit simulation confirmation, credit once and survive restore without duplicate credits',()=>{
  for(const method of ['card','pix']){
    let s=request(create(),{method,amount:1000,installments:method==='card'?3:1});const id=newest(s).id;
    const once=JSON.stringify(s);s=request(s,{method,amount:1000,installments:method==='card'?3:1});assert.equal(JSON.stringify(s),once);
    s=change(s,'confirmDemoDeposit',{id});assert.equal(current(s).balance,1000);assert.equal(newest(s).status,'confirmed');
    assert.equal(pendingDemoDepositPoints(s),0);assert.equal(current(s).transactions.filter(t=>t.ref===`demo-deposit:${id}`).length,1);
    assert.equal(current(s).transactions[0].amount,1000);
    assert.match(current(s).transactions[0].label,/simulado/);
    s=restore(JSON.stringify(s));const settled=JSON.stringify(s);
    s=change(s,'confirmDemoDeposit',{id});assert.equal(JSON.stringify(s),settled);
    assert.throws(()=>change(s,'cancelDemoDeposit',{id}),/pendente/);assert.equal(current(s).balance,1000);
  }
});

test('transfer receipts preserve photo history, enter review and cannot be credited by a regular local profile',()=>{
  let s=request(create(),{method:'transfer',amount:500});const id=newest(s).id;
  assert.throws(()=>change(s,'confirmDemoDeposit',{id}),/equipe.*servidor/);
  const before=JSON.stringify(s);
  for(const evidenceDataUrl of ['',undefined,'https://example.test/receipt.jpg','data:image/svg+xml;base64,YWJjZA==','data:image/jpeg;base64,'+'A'.repeat(450000)])assert.throws(()=>change(s,'attachDemoReceipt',{id,evidenceDataUrl}),/foto válida/);
  assert.equal(JSON.stringify(s),before);
  s=change(s,'attachDemoReceipt',{id,evidenceDataUrl:receipt,evidenceName:'comprovante-demo.jpg',bankAccount:'discarded'});
  assert.equal(newest(s).status,'review');assert.equal(current(s).balance,0);assert.equal(current(s).transactions.length,0);
  assert.equal(newest(s).receipt.evidenceDataUrl,receipt);assert.equal(newest(s).receipt.bankAccount,undefined);
  s=change(s,'attachDemoReceipt',{id,evidenceDataUrl:replacement,evidenceName:'foto-legivel.png'});
  assert.equal(newest(s).receipts.length,2);assert.equal(newest(s).receipts[0].evidenceDataUrl,receipt);assert.equal(newest(s).receipt.evidenceDataUrl,replacement);
  const saved=restore(JSON.stringify(s));assert.equal(newest(saved).status,'review');assert.equal(current(saved).balance,0);
  assert.equal(newest(saved).receipt.evidenceDataUrl,replacement);assert.equal(newest(saved).receipts[0].evidenceName,'comprovante-demo.jpg');
  assert.throws(()=>change(saved,'confirmDemoDeposit',{id}),/equipe.*servidor/);
  assert.equal(pendingDemoDepositPoints(saved),500);
});

test('cancelling a transfer in review preserves its photos through restore and never credits the account',()=>{
  let s=request(create(),{method:'transfer',amount:500});const id=newest(s).id;
  s=change(s,'attachDemoReceipt',{id,evidenceDataUrl:receipt,evidenceName:'comprovante-demo.jpg'});
  s=change(s,'attachDemoReceipt',{id,evidenceDataUrl:replacement,evidenceName:'foto-legivel.png'});
  const transactions=JSON.stringify(current(s).transactions);
  s=change(s,'cancelDemoDeposit',{id});assert.equal(newest(s).status,'cancelled');assert.ok(newest(s).cancelledAt);
  assert.equal(current(s).balance,0);assert.equal(pendingDemoDepositPoints(s),0);assert.equal(JSON.stringify(current(s).transactions),transactions);
  s=restore(JSON.stringify(s));assert.equal(newest(s).status,'cancelled');assert.equal(current(s).balance,0);
  assert.equal(newest(s).receipt.evidenceDataUrl,replacement);assert.deepEqual(newest(s).receipts.map(item=>item.evidenceDataUrl),[receipt,replacement]);
  const once=JSON.stringify(s);s=change(s,'cancelDemoDeposit',{id});assert.equal(JSON.stringify(s),once);
  assert.throws(()=>change(s,'attachDemoReceipt',{id,evidenceDataUrl:receipt}));assert.throws(()=>change(s,'confirmDemoDeposit',{id}));
});

test('cancelling an unconfirmed request is idempotent and never credits the account',()=>{
  for(const method of ['card','pix','transfer']){
    let s=request(create(),{method});const id=newest(s).id;
    s=change(s,'cancelDemoDeposit',{id});assert.equal(newest(s).status,'cancelled');assert.equal(current(s).balance,0);
    const after=JSON.stringify(s);s=change(s,'cancelDemoDeposit',{id});assert.equal(JSON.stringify(s),after);
    assert.equal(pendingDemoDepositPoints(s),0);assert.equal(current(s).transactions.length,0);
    assert.throws(()=>change(s,'confirmDemoDeposit',{id}));assert.throws(()=>change(s,'attachDemoReceipt',{id,evidenceDataUrl:receipt}));
    const saved=restore(JSON.stringify(s));assert.equal(newest(saved).status,'cancelled');assert.equal(current(saved).balance,0);
  }
});

test('simulated card and Pix rejection never credits, survives restore and cannot later be confirmed',()=>{
  for(const method of ['card','pix']){
    let s=request(create(),{method});const id=newest(s).id;
    s=change(s,'rejectDemoDeposit',{id});assert.equal(newest(s).status,'rejected');assert.ok(newest(s).rejectedAt);
    assert.equal(current(s).balance,0);assert.equal(current(s).transactions.length,0);assert.equal(pendingDemoDepositPoints(s),0);
    s=restore(JSON.stringify(s));assert.equal(newest(s).status,'rejected');const after=JSON.stringify(s);
    s=change(s,'rejectDemoDeposit',{id});assert.equal(JSON.stringify(s),after);
    assert.throws(()=>change(s,'confirmDemoDeposit',{id}),/pendente/);assert.throws(()=>change(s,'cancelDemoDeposit',{id}),/pendente/);
    assert.equal(current(s).balance,0);
    let confirmed=request(create(),{method});const confirmedId=newest(confirmed).id;confirmed=change(confirmed,'confirmDemoDeposit',{id:confirmedId});
    assert.throws(()=>change(confirmed,'rejectDemoDeposit',{id:confirmedId}),/pendente/);assert.equal(current(confirmed).balance,250);
  }
  const transfer=request(create(),{method:'transfer'});assert.throws(()=>change(transfer,'rejectDemoDeposit',{id:newest(transfer).id}),/cartão e Pix/);
});

test('invalid packs, methods, installments and changed replay parameters fail without partial requests or balance changes',()=>{
  const s=create(),before=JSON.stringify(s);
  for(const amount of ['',undefined,-100,0,99,101,250.5,NaN,Infinity,5000])assert.throws(()=>request(s,{amount}),/pacote demo/);
  for(const method of ['unknown','cash',null,undefined])assert.throws(()=>request(s,{method}),/demonstração/);
  for(const installments of [0,7,1.5,NaN,Infinity])assert.throws(()=>request(s,{method:'card',installments}),/parcelas/);
  for(const method of ['pix','transfer'])assert.throws(()=>request(s,{method,installments:2}),/parcelamento/);
  for(const operationId of ['',undefined,'with space','A'.repeat(81)])assert.throws(()=>request(s,{operationId}),/Identificador/);
  assert.equal(JSON.stringify(s),before);
  const created=request(s);const ready=JSON.stringify(created);
  assert.throws(()=>request(created,{amount:500}),/outros dados/);assert.throws(()=>request(created,{method:'card',installments:2}),/outros dados/);
  assert.equal(JSON.stringify(created),ready);
});

test('wallet requests remain isolated across profiles and migration preserves duel reserves and existing balances',()=>{
  let s=request(fund(create()));const a=s.activeProfileId,id=newest(s).id;
  s=change(s,'create',{nickname:'Jogador B'});const b=s.activeProfileId;
  assert.deepEqual(current(s).depositRequests,[]);assert.throws(()=>change(s,'confirmDemoDeposit',{id}),/neste perfil/);
  assert.equal(current(s).balance,0);s=fund(s);
  s=request(s,{operationId:'wallet-operation-1',amount:100,method:'card'});const secondId=newest(s).id;
  s=change(s,'confirmDemoDeposit',{id:secondId});assert.equal(current(s).balance,1100);
  s=change(s,'login',{id:a});s=change(s,'createDuel',{opponentId:b,stake:250,mode:'1v1'});
  assert.equal(current(s).balance,750);assert.equal(duelReservedPoints(s,a),250);
  s=change(s,'confirmDemoDeposit',{id});assert.equal(current(s).balance,1000);assert.equal(duelReservedPoints(s,a),250);
  const saved=restore(JSON.stringify(s));assert.equal(saved.profiles[a].balance,1000);assert.equal(saved.profiles[b].balance,1100);
  assert.equal(duelReservedPoints(saved,a),250);assert.equal(saved.profiles[a].depositRequests[0].id,id);assert.equal(saved.profiles[b].depositRequests[0].id,secondId);
  for(const version of [2,3,4,5,6,7]){
    const old=JSON.parse(JSON.stringify(saved));old.version=version;delete old.profiles[a].depositRequests;
    const migrated=restore(old);assert.deepEqual(migrated.profiles[a].depositRequests,[]);assert.equal(migrated.profiles[a].balance,1000);
    assert.equal(duelReservedPoints(migrated,a),250);assert.equal(migrated.profiles[b].depositRequests[0].id,secondId);
  }
});

test('restoration uses the deposit transaction to prevent replay and strips untrusted payment metadata',()=>{
  let s=request(create(),{method:'pix'});const id=newest(s).id;s=change(s,'confirmDemoDeposit',{id});
  newest(s).status='pending';newest(s).cardNumber='4111111111111111';newest(s).cvv='123';
  s=restore(s);assert.equal(newest(s).status,'confirmed');assert.equal(newest(s).cardNumber,undefined);assert.equal(newest(s).cvv,undefined);
  const before=JSON.stringify(s);s=change(s,'confirmDemoDeposit',{id});assert.equal(JSON.stringify(s),before);assert.equal(current(s).balance,250);
  s=request(s,{method:'transfer',operationId:'transfer-new'});const transferId=newest(s).id;
  s=change(s,'attachDemoReceipt',{id:transferId,evidenceDataUrl:receipt});newest(s).status='confirmed';newest(s).reviewerId='fake-reviewer';
  const restored=restore(s);assert.equal(newest(restored).status,'review');assert.equal(newest(restored).reviewerId,undefined);assert.equal(current(restored).balance,250);
  assert.throws(()=>change(restored,'confirmDemoDeposit',{id:transferId}),/equipe.*servidor/);
});
