import test from 'node:test';
import assert from 'node:assert/strict';
import * as recovery from './deposit-recovery.mjs';
const time=Date.parse('2026-10-03T12:00:00Z');
function fixture(){
 const deposit={id:'d',userId:'owner',status:'cancelled',paymentMode:'pix_manual',method:'pix',priceCents:1000,amount:100,version:4,createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-03T11:00:00Z',evidenceId:'proof',evidenceIds:['proof'],decision:{outcome:'cancelled',actorId:'owner'}};
 const state={deposits:{d:deposit},walletEvidence:{proof:{id:'proof',depositId:'d',authorId:'owner',sha256:'original-photo',createdAt:'2026-10-01T13:00:00Z'}},users:{owner:{id:'owner'},reviewer:{id:'reviewer'}}};
 const input={version:4,outcome:'credit',bankReference:'  e00000001.pix  ',bankAmountCents:1000,paidAt:'2026-10-01T13:00:00Z'};
 return {state,deposit,input};
}
const check=(data,options={})=>{assert.equal(typeof recovery.validatePaidDepositRecovery,'function');return recovery.validatePaidDepositRecovery(data.state,data.deposit,'reviewer',data.input,{paymentMode:'pix_manual',time,...options});};

test('a disabled account cannot receive new credits but a verified bank refund may be recorded',()=>{
 const data=fixture();data.state.users.owner.disabledAt='2026-10-03T11:00:00Z';
 assert.throws(()=>check(data),error=>error.status===409&&error.code==='account_disabled');
 Object.assign(data.input,{outcome:'refund_recorded',refundBankReference:'refund-0001',refundAmountCents:1000,refundedAt:'2026-10-03T11:00:00Z'});
 assert.equal(check(data).outcome,'refund_recorded');
});

test('closed paid Pix recovery validates original proof and paid date without rewriting the original decision',()=>{
 const data=fixture(),before=structuredClone(data);
 assert.deepEqual(check(data),{outcome:'credit',evidenceId:'proof',bankReference:'E00000001.PIX',bankAmountCents:1000,paidAt:'2026-10-01T13:00:00.000Z'});
 assert.deepEqual(data,before);
 data.deposit.status='rejected';assert.equal(check(data).outcome,'credit');
});

test('recovery cannot bypass payment mode, closed status, proof ownership or independent review',()=>{
 for(const mode of ['unconfigured','demo'])assert.throws(()=>check(fixture(),{paymentMode:mode}),error=>error.status===503&&error.code==='payments_unavailable');
 for(const [mutate,code] of [
  [data=>data.deposit.paymentMode='demo','deposit_recovery_unavailable'],
  [data=>data.deposit.method='transfer','deposit_recovery_unavailable'],
  [data=>data.deposit.status='review','deposit_recovery_unavailable'],
  [data=>data.deposit.status='approved','deposit_recovery_unavailable'],
  [data=>delete data.state.walletEvidence.proof,'deposit_recovery_proof_required'],
  [data=>data.state.walletEvidence.proof.depositId='other','deposit_recovery_proof_required'],
  [data=>data.state.walletEvidence.proof.authorId='reviewer','deposit_recovery_proof_required'],
  [data=>data.deposit.evidenceIds=[],'deposit_recovery_proof_required'],
  [data=>data.deposit.recovery={outcome:'refund_recorded'},'deposit_recovery_already_recorded'],
  [data=>data.input.version=3,'stale_deposit'],
  [data=>data.input.version='4','stale_deposit'],
  [data=>data.input.outcome='approved','invalid_recovery_outcome']
 ]){const data=fixture();mutate(data);assert.throws(()=>check(data),error=>error.code===code);}
 const data=fixture();assert.throws(()=>recovery.validatePaidDepositRecovery(data.state,data.deposit,'owner',data.input,{paymentMode:'pix_manual',time}),error=>error.status===403&&error.code==='independent_reviewer_required');
});

test('bank payment references are canonical and unique across approved deposits and recovered payments and refunds',()=>{
 for(const record of [
  {status:'approved',decision:{bankReference:'e00000001.pix'}},
  {status:'cancelled',recovery:{outcome:'credit',bankReference:' e00000001.pix '}},
  {status:'rejected',recovery:{outcome:'refund_recorded',refundBankReference:'E00000001.PIX'}}
 ]){const data=fixture();data.state.deposits.other=record;assert.throws(()=>check(data),error=>error.status===409&&error.code==='bank_reference_used');}
 for(const ref of ['', 'short', 'with spaces', 'E00000001/PIX', 'X'.repeat(129)]){const data=fixture();data.input.bankReference=ref;assert.throws(()=>check(data),error=>error.code==='invalid_bank_reference');}
 const data=fixture();data.state.deposits.other={status:'rejected',decision:{bankReference:'E00000001.PIX'}};assert.equal(check(data).outcome,'credit');
});

test('payment amount and dates use original order bounds and reject incomplete financial data',()=>{
 for(const amount of [999,1001,'1000',1000.5]){const data=fixture();data.input.bankAmountCents=amount;assert.throws(()=>check(data),error=>error.code==='bank_amount_mismatch');}
 for(const paidAt of ['invalid','2026-09-30T11:59:59Z','2026-10-03T12:05:01Z',null,0]){const data=fixture();data.input.paidAt=paidAt;assert.throws(()=>check(data),error=>error.code==='invalid_bank_date');}
 for(const paidAt of ['2026-09-30T12:00:00Z','2026-10-03T12:05:00Z']){const data=fixture();data.input.paidAt=paidAt;assert.equal(check(data).paidAt,new Date(paidAt).toISOString());}
 const data=fixture();data.deposit.createdAt='invalid';assert.throws(()=>check(data),error=>error.code==='invalid_bank_date');
});

test('recording a bank refund requires the actual separate refund reference, amount and date',()=>{
 const data=fixture();Object.assign(data.input,{outcome:'refund_recorded',refundBankReference:' bank-refund-0001 ',refundAmountCents:1000,refundedAt:'2026-10-03T11:00:00Z'});
 assert.deepEqual(check(data),{outcome:'refund_recorded',evidenceId:'proof',bankReference:'E00000001.PIX',bankAmountCents:1000,paidAt:'2026-10-01T13:00:00.000Z',refundBankReference:'BANK-REFUND-0001',refundAmountCents:1000,refundedAt:'2026-10-03T11:00:00.000Z'});
 for(const [key,value,code]of [
  ['refundBankReference',undefined,'invalid_bank_reference'],
  ['refundBankReference','E00000001.PIX','bank_reference_used'],
  ['refundAmountCents',999,'refund_amount_mismatch'],
  ['refundAmountCents',undefined,'refund_amount_mismatch'],
  ['refundedAt',undefined,'invalid_refund_date'],
  ['refundedAt','2026-10-01T12:59:59Z','invalid_refund_date'],
  ['refundedAt','2026-10-03T12:05:01Z','invalid_refund_date']
 ]){const changed=structuredClone(data);changed.input[key]=value;assert.throws(()=>check(changed),error=>error.code===code);}
 data.state.deposits.other={status:'approved',decision:{bankReference:'BANK-REFUND-0001'}};assert.throws(()=>check(data),error=>error.code==='bank_reference_used');
});

test('the shared duplicate check protects normal approvals from payment and refund reference reuse',()=>{
 assert.equal(typeof recovery.bankReferenceAlreadyUsed,'function');
 const data=fixture();data.deposit.recovery={bankReference:' payment-0001 ',refundBankReference:' refund-0001 '};
 assert.equal(recovery.bankReferenceAlreadyUsed(data.state,'PAYMENT-0001'),true);
 assert.equal(recovery.bankReferenceAlreadyUsed(data.state,'REFUND-0001'),true);
 assert.equal(recovery.bankReferenceAlreadyUsed(data.state,'PAYMENT-0001',{excludeDepositId:'d'}),false);
 assert.equal(recovery.bankReferenceAlreadyUsed(data.state,'OTHER-000001'),false);
 data.state.deposits.approved={id:'approved',status:'approved',decision:{bankReference:' approved-001 '}};
 assert.equal(recovery.bankReferenceAlreadyUsed(data.state,'APPROVED-001'),true);
});
