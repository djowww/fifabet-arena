export const HOUSE_FEE_BPS=900;
export const OPEN_DUEL_STATUSES=['invited','awaiting_funds','in_progress','pending_review','disputed'];

/** Wallet credits are whole units; quote and retain the rounding rule with the room. */
export function createDuelEconomics(stake,feeBps=HOUSE_FEE_BPS){
  if(!Number.isSafeInteger(stake)||stake<0||stake>5000||![0,HOUSE_FEE_BPS].includes(feeBps))throw Error('Condições financeiras da partida inválidas.');
  const pot=2*stake,houseFee=Math.round(pot*feeBps/10_000);
  return {pot,feeBps,houseFee,winnerPayout:pot-houseFee,rounding:'nearest_credit'};
}

/** Older rooms retain their original payout agreement. */
export function duelEconomics(duel){
  return duel.economics||createDuelEconomics(duel.stake,duel.fundingVersion===1?HOUSE_FEE_BPS:0);
}

export function duelFunders(duel){
  if(duel.fundingVersion===1)return duel.fundedBy||[];
  return [duel.hostId,...(duel.guestId?[duel.guestId]:[])];
}

export function reservedDuelStake(duel,userId){
  return OPEN_DUEL_STATUSES.includes(duel.status)&&duelFunders(duel).includes(userId)?duel.stake:0;
}
