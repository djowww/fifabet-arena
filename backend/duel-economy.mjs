import {comparePhotoScore} from './result-verification.mjs';

export const HOUSE_FEE_BPS=900;
export const RESULT_CONFIRMATION_MS=5*60*1000;
export const OPEN_DUEL_STATUSES=['invited','awaiting_funds','in_progress','pending_review','disputed'];

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
  const checked=comparePhotoScore({recognition:evidence?.recognition,homeScore:report.homeScore,awayScore:report.awayScore,scoreSide:report.scoreSide});
  return checked.verdict==='matched'&&checked.requiresReview===false;
}

/** Every failure routes to review; expiration never awards a win. */
export function automaticSettlementCheck(state,duel,time=Date.now()){
  const report=duel.result;
  if(!report?.confirmedBy||!report.confirmationEvidenceId)return {eligible:false,reason:'awaiting_confirmation'};
  if(duel.status!=='pending_review'||(duel.issueReports||[]).some(issue=>issue.status==='open')||(duel.disputes||[]).length)return {eligible:false,reason:'open_problem'};
  const confirmedAt=Date.parse(report.confirmedAt),deadline=Date.parse(report.confirmationDeadline),submittedAt=Date.parse(report.submittedAt);
  if(report.confirmationTimedOutAt||![time,confirmedAt,deadline,submittedAt].every(Number.isFinite)||deadline<submittedAt||deadline-submittedAt>RESULT_CONFIRMATION_MS||confirmedAt<submittedAt||confirmedAt>=deadline||time>=deadline)return {eligible:false,reason:'confirmation_expired'};
  const first=state.evidence[report.evidenceId],second=state.evidence[report.confirmationEvidenceId];
  if(!first||!second||first.id===second.id||first.duelId!==duel.id||second.duelId!==duel.id||first.authorId!==report.reporterId||second.authorId!==report.confirmedBy||![duel.hostId,duel.guestId].includes(first.authorId)||![duel.hostId,duel.guestId].includes(second.authorId)||first.authorId===second.authorId)return {eligible:false,reason:'independent_evidence_required'};
  if(!first.sha256||!second.sha256||first.sha256===second.sha256||first.duplicateEvidence||second.duplicateEvidence)return {eligible:false,reason:'duplicate_evidence'};
  if(!recognitionMatchesReport(first,report)||!recognitionMatchesReport(second,{homeScore:report.homeScore,awayScore:report.awayScore,scoreSide:report.confirmationScoreSide}))return {eligible:false,reason:'recognition_review_required'};
  return {eligible:true,winner:report.homeScore===report.awayScore?'draw':report.homeScore>report.awayScore?'host':'guest'};
}

export function reservedDuelStake(duel,userId){
  return OPEN_DUEL_STATUSES.includes(duel.status)&&duelFunders(duel).includes(userId)?duel.stake:0;
}
