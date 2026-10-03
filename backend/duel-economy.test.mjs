import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticSettlementCheck,createDuelEconomics} from './duel-economy.mjs';
const time=Date.parse('2026-10-02T00:00:00Z');
function fixture(){
 const recognition={provider:'local-ocr',status:'suggested',finalScreen:true,confidence:95,requiresReview:false,scores:{left:3,right:1}};
 const evidence={a:{id:'a',duelId:'d',authorId:'h',sha256:'a',recognition,visualHash:'0000000000000000',visualCheck:{status:'checked'}},b:{id:'b',duelId:'d',authorId:'g',sha256:'b',recognition,visualHash:'ffffffffffffffff',visualCheck:{status:'checked'}}};
 const duel={id:'d',hostId:'h',guestId:'g',stake:100,status:'pending_review',riskPolicyVersion:1,result:{reporterId:'h',confirmedBy:'g',evidenceId:'a',confirmationEvidenceId:'b',homeScore:3,awayScore:1,scoreSide:'host',confirmationScoreSide:'host',submittedAt:new Date(time).toISOString(),confirmedAt:new Date(time+1000).toISOString(),confirmationDeadline:new Date(time+300000).toISOString()}};
 return {state:{evidence},duel};
}
test('new policy routes high stakes and visual uncertainty to human review',()=>{
 const {state,duel}=fixture();assert.equal(automaticSettlementCheck(state,duel,time+2000).eligible,true);
 assert.equal(automaticSettlementCheck(state,{...duel,stake:500},time+2000).reason,'high_stake');
 delete state.evidence.b.visualCheck;
 assert.equal(automaticSettlementCheck(state,duel,time+2000).reason,'visual_check_unavailable');
});
test('new policy blocks visually reused images and match risks without changing legacy settlement',()=>{
 const {state,duel}=fixture();state.evidence.b.visualHash='000000000000003f';
 assert.equal(automaticSettlementCheck(state,duel,time+2000).reason,'visual_similarity');
 assert.equal(automaticSettlementCheck(state,{...duel,riskPolicyVersion:undefined},time+2000).eligible,true);
 state.evidence.b.visualHash='ffffffffffffffff';
 assert.equal(automaticSettlementCheck(state,{...duel,matchRisk:{reason:'match_expired'}},time+2000).eligible,false);
 assert.equal(automaticSettlementCheck(state,{...duel,manualReviewReason:'reuse'},time+2000).eligible,false);
 assert.deepEqual(createDuelEconomics(100),{pot:200,feeBps:900,houseFee:18,winnerPayout:182,rounding:'nearest_credit'});
});
test('operational match timeout blocks automatic settlement for open new and legacy rooms',()=>{
 const {state,duel}=fixture();
 for(const version of [1,undefined]){
  const timedOut={...duel,riskPolicyVersion:version,matchTimedOutAt:new Date(time).toISOString()};
  assert.equal(automaticSettlementCheck(state,timedOut,time+2000).reason,'match_timeout');
 }
});
test('historical completed settlements retain validation when a timeout marker is present',()=>{
 const {state,duel}=fixture();
 const historical={...duel,riskPolicyVersion:undefined,matchTimedOutAt:new Date(time).toISOString(),settlement:{date:new Date(time+1000).toISOString()},review:{source:'bilateral_verified'}};
 assert.equal(automaticSettlementCheck(state,historical,time+2000).eligible,true);
});
