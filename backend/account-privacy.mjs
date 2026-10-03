import {OPEN_DUEL_STATUSES} from './duel-economy.mjs';
import {randomBytes} from 'node:crypto';
const fail=(status,code,message)=>{const error=Error(message);error.status=status;error.code=code;throw error;};
const compareIds=(a,b)=>a<b?-1:a>b?1:0;
function anonymizedNickname(state,target){
  const normalized=value=>String(value).normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
  const occupied=new Set(Object.values(state.users||{}).filter(user=>user.id!==target.id).map(user=>normalized(user.nickname)));
  let nickname=`Removido_${target.publicPlayerId.slice(-10)}`;
  while(occupied.has(normalized(nickname)))nickname=`Removido_${randomBytes(5).toString('hex').toUpperCase()}`;
  return nickname;
}

/** Earned timestamps come from actual current-result approvals, never the account's older creation date. */
export function achievementsFor(state,userId){
  if(!state.users?.[userId])return [];
  const matches=Object.values(state.duels||{}).filter(duel=>duel.status==='completed'&&duel.hostId!==duel.guestId&&[duel.hostId,duel.guestId].includes(userId)&&duel.result?.id&&duel.review?.resultId===duel.result.id&&Number.isFinite(Date.parse(duel.review.approvedAt))&&['host','guest','draw'].includes(duel.winner)&&duel.winnerId===(duel.winner==='draw'?null:duel.winner==='host'?duel.hostId:duel.guestId));
  matches.sort((a,b)=>Date.parse(a.review.approvedAt)-Date.parse(b.review.approvedAt)||compareIds(a.id,b.id));
  if(!matches.length)return [];
  const wins=matches.filter(duel=>duel.winnerId===userId),result=[{id:'first_validated_match',title:'Primeiro apito final',description:'Sua primeira partida com resultado validado.',earnedAt:matches[0].review.approvedAt}];
  if(wins.length)result.push({id:'first_win',title:'Primeira vitória',description:'Sua primeira vitória com resultado validado.',earnedAt:wins[0].review.approvedAt});
  if(wins.length>=5)result.push({id:'five_wins',title:'Cinco vitórias',description:'Cinco partidas vencidas com resultados validados.',earnedAt:wins[4].review.approvedAt});
  return result;
}

/** The caller authorizes the administrator. Review retains financial records, evidence, country and terms for accounting and schema invariants. */
export function reviewAccountDeletion(state,target,actor,{decision,reason}={},time=Date.now()){
  if(!target?.id||state.users?.[target.id]!==target)fail(404,'not_found','Conta não encontrada.');
  if(!actor?.id||state.users?.[actor.id]!==actor||actor.id===target.id)fail(403,'independent_admin_required','Uma pessoa da administração precisa revisar o pedido de outra conta.');
  const request=target.deletionRequest;
  if(request?.status!=='pending_review')fail(409,'account_deletion_not_pending','Esta conta não possui solicitação de remoção pendente.');
  if(!['anonymize','reject'].includes(decision))fail(400,'invalid_account_deletion_decision','Escolha anonimizar a conta ou rejeitar a solicitação.');
  const text=typeof reason==='string'?reason.trim():'';
  if(text.length<10||text.length>1000)fail(400,'invalid_account_deletion_reason','Descreva o motivo da revisão com 10 a 1.000 caracteres.');
  if(!Number.isFinite(time))fail(400,'invalid_account_deletion_date','Data da revisão inválida.');
  const date=new Date(time).toISOString();
  if(decision==='anonymize'){
    const openRoom=Object.values(state.duels||{}).some(duel=>[duel.hostId,duel.guestId,duel.recipientId].includes(target.id)&&OPEN_DUEL_STATUSES.includes(duel.status));
    const openDeposit=Object.values(state.deposits||{}).some(deposit=>deposit.userId===target.id&&['pending','review'].includes(deposit.status));
    if(target.balance>0||target.demoBalance>0||openRoom||openDeposit)fail(409,'account_deletion_pending_financial','Resolva saldos, convites, partidas e pedidos pendentes antes de anonimizar a conta.');
    const nickname=anonymizedNickname(state,target);
    target.disabledAt=date;target.nickname=nickname;target.clubId=null;target.gameAccount=null;target.friends=[];
    for(const field of ['passwordHash','passwordSalt','recoveryCodes','recoveryCodesCreatedAt','email'])delete target[field];
    for(const user of Object.values(state.users||{}))if(Array.isArray(user.friends))user.friends=user.friends.filter(id=>id!==target.id);
    for(const [key,session]of Object.entries(state.sessions||{}))if(session.userId===target.id)delete state.sessions[key];
    for(const [key,identity]of Object.entries(state.authIdentities||{}))if(identity.userId===target.id)delete state.authIdentities[key];
  }
  target.deletionRequest={...request,status:decision==='anonymize'?'anonymized':'rejected',decision:{outcome:decision,actorId:actor.id,reason:text,date}};
  return target.deletionRequest;
}
