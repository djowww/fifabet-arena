import {comparePhotoScore} from './result-verification.mjs';
import {visualHashesSimilar} from './game-policy.mjs';

export const HOUSE_FEE_BPS=900;
export const RESULT_CONFIRMATION_MS=5*60*1000;
export const OPEN_DUEL_STATUSES=['invited','awaiting_funds','waiting_start','in_progress','pending_review','disputed'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const invalidResult=(code,message)=>{const error=Error(message);error.status=400;error.code=code;throw error;};
function scorePair(value){
  if(!plain(value)||![value.homeScore,value.awayScore].every(score=>Number.isSafeInteger(score)&&score>=0&&score<=99))invalidResult('invalid_score','Informe placares inteiros de 0 a 99.');
  return {homeScore:value.homeScore,awayScore:value.awayScore};
}
const tied=pair=>pair.homeScore===pair.awayScore;
const winnerFor=pair=>tied(pair)?'draw':pair.homeScore>pair.awayScore?'host':'guest';

/** homeScore/awayScore describe regulation; extraTime is the cumulative final score, penalties a separate shootout. */
export function normalizeDuelResult(report,matchRules={}){
  const result=scorePair(report),extra=report.extraTime!==undefined,penalties=report.penalties!==undefined;
  if(extra){
    if(matchRules.extraTime!==true)invalidResult('extra_time_disabled','Esta sala não permite prorrogação.');
    if(!tied(result))invalidResult('unexpected_extra_time','A prorrogação exige empate no tempo regulamentar.');
    result.extraTime=scorePair(report.extraTime);
    if(result.extraTime.homeScore<result.homeScore||result.extraTime.awayScore<result.awayScore)invalidResult('invalid_extra_time_score','O placar final da prorrogação deve incluir os gols do tempo regulamentar.');
  }else if(tied(result)&&matchRules.extraTime===true)invalidResult('extra_time_required','Informe o placar final após a prorrogação.');
  const main=result.extraTime||result;
  if(penalties){
    if(matchRules.penalties!==true)invalidResult('penalties_disabled','Esta sala não permite disputa de pênaltis.');
    if(!tied(main))invalidResult('unexpected_penalties','A disputa de pênaltis exige empate no placar final.');
    result.penalties=scorePair(report.penalties);
    if(tied(result.penalties))invalidResult('penalties_tied','A disputa de pênaltis precisa definir um vencedor.');
  }else if(tied(main)&&matchRules.penalties===true)invalidResult('penalties_required','Informe o resultado da disputa de pênaltis.');
  return result;
}

export function duelResultOutcome(report,matchRules={}){
  const result=normalizeDuelResult(report,matchRules),mainScore=scorePair(result.extraTime||result);
  return {winner:winnerFor(result.penalties||mainScore),decidedBy:result.penalties?'penalties':result.extraTime?'extra_time':'regulation',mainScore,requiresReview:Boolean(result.penalties),reason:result.penalties?'penalties_review_required':null};
}

/** Convert a displayed left/right score pair (including both tie-break phases) into host/guest order. */
export function orientDuelResult(report,scoreSide){
  if(!['host','guest'].includes(scoreSide))invalidResult('score_side_required','Informe qual jogador aparece à esquerda da foto.');
  const orient=pair=>{const checked=scorePair(pair);return scoreSide==='host'?checked:{homeScore:checked.awayScore,awayScore:checked.homeScore};};
  return {...orient(report),...(report.extraTime!==undefined?{extraTime:orient(report.extraTime)}:{}),...(report.penalties!==undefined?{penalties:orient(report.penalties)}:{})};
}

/** Compare score facts only; the two independent photographs may have different orientations. */
export function sameDuelResult(first,second){
  if(!first||!second)return false;
  const equal=(a,b)=>a?.homeScore===b?.homeScore&&a?.awayScore===b?.awayScore;
  return equal(first,second)&&['extraTime','penalties'].every(phase=>Boolean(first[phase])===Boolean(second[phase])&&(!first[phase]||equal(first[phase],second[phase])));
}

/** Wallet credits are whole units; quote and retain the rounding rule with the room. */
export function createDuelEconomics(stake,feeBps=HOUSE_FEE_BPS){
  if(!Number.isSafeInteger(stake)||stake<0||stake>5000||![0,HOUSE_FEE_BPS].includes(feeBps))throw Error('Condições financeiras da partida inválidas.');
  const pot=2*stake,houseFee=Math.round(pot*feeBps/10_000);
  return {pot,feeBps,houseFee,winnerPayout:pot-houseFee,rounding:'nearest_credit'};
}

/** Older rooms retain their original payout agreement. */
export function duelEconomics(duel){
  return duel.economics||createDuelEconomics(duel.stake,[1,2].includes(duel.fundingVersion)?HOUSE_FEE_BPS:0);
}

export function duelFunders(duel){
  if([1,2].includes(duel.fundingVersion))return duel.fundedBy||[];
  return [duel.hostId,...(duel.guestId?[duel.guestId]:[])];
}

/** OCR checks the bounded score pair. It does not authenticate a photograph or a match. */
export function recognitionMatchesReport(evidence,report){
  const main=report.extraTime||report;
  const checked=comparePhotoScore({recognition:evidence?.recognition,homeScore:main.homeScore,awayScore:main.awayScore,scoreSide:report.scoreSide});
  return checked.verdict==='matched'&&checked.requiresReview===false;
}

/** Every failure routes to review; expiration never awards a win. */
export function automaticSettlementCheck(state,duel,time=Date.now()){
  const report=duel.result;
  if(!report?.confirmedBy||!report.confirmationEvidenceId)return {eligible:false,reason:'awaiting_confirmation'};
  let outcome;
  try{
    // Old completed agreements used a single score pair even when a room had tie-break rules.
    const historical=duel.settlement&&!report.extraTime&&!report.penalties&&report.resultVersion!==1;
    outcome=duelResultOutcome(report,historical?{}:duel.matchRules||{});
  }catch(error){return {eligible:false,reason:error.code||'invalid_result'};}
  if(outcome.requiresReview)return {eligible:false,reason:outcome.reason};
  if(duel.status!=='pending_review'||(duel.issueReports||[]).some(issue=>issue.status==='open')||(duel.disputes||[]).length)return {eligible:false,reason:'open_problem'};
  // Database validation projects completed settlements into pending_review; preserve those historical records.
  if(duel.matchTimedOutAt&&!duel.settlement)return {eligible:false,reason:'match_timeout'};
  const confirmedAt=Date.parse(report.confirmedAt),deadline=Date.parse(report.confirmationDeadline),submittedAt=Date.parse(report.submittedAt);
  if(report.confirmationTimedOutAt||![time,confirmedAt,deadline,submittedAt].every(Number.isFinite)||deadline<submittedAt||deadline-submittedAt>RESULT_CONFIRMATION_MS||confirmedAt<submittedAt||confirmedAt>=deadline||time>=deadline)return {eligible:false,reason:'confirmation_expired'};
  const first=state.evidence[report.evidenceId],second=state.evidence[report.confirmationEvidenceId];
  if(!first||!second||first.id===second.id||first.duelId!==duel.id||second.duelId!==duel.id||first.authorId!==report.reporterId||second.authorId!==report.confirmedBy||![duel.hostId,duel.guestId].includes(first.authorId)||![duel.hostId,duel.guestId].includes(second.authorId)||first.authorId===second.authorId)return {eligible:false,reason:'independent_evidence_required'};
  if(!first.sha256||!second.sha256||first.sha256===second.sha256||first.duplicateEvidence||second.duplicateEvidence)return {eligible:false,reason:'duplicate_evidence'};
  if(duel.riskPolicyVersion===1){
    const threshold=duel.lifecyclePolicy?.highStake??duel.highStakeThreshold??500;
    if(duel.stake>=threshold)return {eligible:false,reason:'high_stake'};
    if(duel.matchRisk||duel.manualReviewReason)return {eligible:false,reason:'match_risk_review'};
    if(first.visualCheck?.status!=='checked'||second.visualCheck?.status!=='checked'||!/^[a-f0-9]{16}$/i.test(first.visualHash||'')||!/^[a-f0-9]{16}$/i.test(second.visualHash||''))return {eligible:false,reason:'visual_check_unavailable'};
    if(first.visualCheck.requiresReview||second.visualCheck.requiresReview||first.visualCheck.similarEvidence||second.visualCheck.similarEvidence||visualHashesSimilar(first.visualHash,second.visualHash))return {eligible:false,reason:'visual_similarity'};
  }
  if(!recognitionMatchesReport(first,report)||!recognitionMatchesReport(second,{...report,scoreSide:report.confirmationScoreSide}))return {eligible:false,reason:'recognition_review_required'};
  return {eligible:true,winner:outcome.winner};
}

export function reservedDuelStake(duel,userId){
  return OPEN_DUEL_STATUSES.includes(duel.status)&&duelFunders(duel).includes(userId)?duel.stake:0;
}
