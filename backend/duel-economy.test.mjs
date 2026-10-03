import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticSettlementCheck,createDuelEconomics} from './duel-economy.mjs';
import * as economy from './duel-economy.mjs';
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

test('a regulation tie cannot settle as a draw when the room requires a tie-break',()=>{
 const {state,duel}=fixture();duel.result.homeScore=1;duel.result.awayScore=1;duel.matchRules={extraTime:true,penalties:true};
 for(const item of Object.values(state.evidence))item.recognition={...item.recognition,scores:{left:1,right:1}};
 assert.deepEqual(automaticSettlementCheck(state,duel,time+2000),{eligible:false,reason:'extra_time_required'});
 duel.matchRules={extraTime:false,penalties:true};
 assert.equal(automaticSettlementCheck(state,duel,time+2000).reason,'penalties_required');
});

test('structured results resolve cumulative extra time and reject impossible or disabled phases',()=>{
 assert.equal(typeof economy.normalizeDuelResult,'function');
 const rules={extraTime:true,penalties:true};
 const report={homeScore:1,awayScore:1,extraTime:{homeScore:2,awayScore:1}};
 assert.deepEqual(economy.normalizeDuelResult({...report,evidenceId:'private'},rules),report);
 assert.deepEqual(economy.duelResultOutcome(report,rules),{winner:'host',decidedBy:'extra_time',mainScore:{homeScore:2,awayScore:1},requiresReview:false,reason:null});
 for(const [bad,policy,code] of [
  [{homeScore:1,awayScore:1},rules,'extra_time_required'],
  [{homeScore:1,awayScore:1,extraTime:{homeScore:1,awayScore:1}},rules,'penalties_required'],
  [{homeScore:2,awayScore:1,extraTime:{homeScore:3,awayScore:1}},rules,'unexpected_extra_time'],
  [{homeScore:1,awayScore:1,extraTime:{homeScore:0,awayScore:1}},rules,'invalid_extra_time_score'],
  [report,{extraTime:false,penalties:false},'extra_time_disabled'],
  [{homeScore:1,awayScore:1,penalties:{homeScore:4,awayScore:3}},{extraTime:true,penalties:true},'extra_time_required'],
  [{homeScore:1,awayScore:1,penalties:{homeScore:4,awayScore:4}},{penalties:true},'penalties_tied'],
  [{homeScore:2,awayScore:1,penalties:{homeScore:4,awayScore:3}},{penalties:true},'unexpected_penalties'],
  [{homeScore:1,awayScore:1,penalties:{homeScore:4,awayScore:3}},{penalties:false},'penalties_disabled'],
  [{homeScore:1,awayScore:1,extraTime:{homeScore:2.5,awayScore:1}},rules,'invalid_score'],
  [{homeScore:1,awayScore:-1},{},'invalid_score']
 ])assert.throws(()=>economy.normalizeDuelResult(bad,policy),error=>error.code===code);
 assert.equal(economy.duelResultOutcome({homeScore:1,awayScore:1}).winner,'draw');
});

test('extra-time OCR uses the final main score while penalties always need manual review',()=>{
 const {state,duel}=fixture();duel.matchRules={extraTime:true,penalties:true};
 duel.result.homeScore=1;duel.result.awayScore=1;duel.result.extraTime={homeScore:3,awayScore:1};
 assert.deepEqual(automaticSettlementCheck(state,duel,time+2000),{eligible:true,winner:'host'});
 duel.result.extraTime={homeScore:1,awayScore:1};duel.result.penalties={homeScore:3,awayScore:5};
 assert.equal(automaticSettlementCheck(state,duel,time+2000).reason,'penalties_review_required');
 assert.equal(economy.duelResultOutcome(duel.result,duel.matchRules).winner,'guest');
});

test('orientation reverses every phase and confirmation compares the whole result',()=>{
 assert.equal(typeof economy.orientDuelResult,'function');
 const report={homeScore:1,awayScore:1,extraTime:{homeScore:2,awayScore:2},penalties:{homeScore:3,awayScore:5}};
 assert.deepEqual(economy.orientDuelResult(report,'guest'),{homeScore:1,awayScore:1,extraTime:{homeScore:2,awayScore:2},penalties:{homeScore:5,awayScore:3}});
 assert.equal(economy.sameDuelResult(report,{...report,scoreSide:'guest'}),true);
 assert.equal(economy.sameDuelResult(report,{...report,penalties:{homeScore:5,awayScore:3}}),false);
 assert.equal(economy.sameDuelResult(report,{homeScore:1,awayScore:1}),false);
 assert.throws(()=>economy.orientDuelResult(report,'invalid'),error=>error.code==='score_side_required');
});

test('historical completed draw remains verifiable with earlier score-only reports',()=>{
 const {state,duel}=fixture();duel.result.homeScore=1;duel.result.awayScore=1;duel.matchRules={extraTime:true,penalties:true};duel.settlement={winner:'draw'};
 for(const item of Object.values(state.evidence))item.recognition={...item.recognition,scores:{left:1,right:1}};
 assert.deepEqual(automaticSettlementCheck(state,duel,time+2000),{eligible:true,winner:'draw'});
});
