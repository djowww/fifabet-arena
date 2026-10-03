import {OPEN_DUEL_STATUSES} from './duel-economy.mjs';

const invalid=(status,code,message)=>{const error=Error(message);error.status=status;error.code=code;throw error;};
const environmentFor=mode=>{
  if(!['demo','unconfigured','pix_manual'].includes(mode))invalid(400,'invalid_payment_environment','Modo de pagamento inválido.');
  return mode==='demo'?'demo':'online';
};

/** Check before startup migrations, then persist the returned environment with the unchanged ledger. */
export function assertPaymentEnvironment(state,paymentMode){
  const target=environmentFor(paymentMode),stored=state.walletEnvironment;
  if(stored!==undefined&&!['demo','online'].includes(stored))invalid(409,'invalid_payment_environment','O banco possui um ambiente financeiro inválido.');
  const demoRecords=Object.values(state.users||{}).some(user=>(user.transactions||[]).some(tx=>tx.demo===true))||
    Object.values(state.duels||{}).some(duel=>duel.creditMode==='demo')||
    Object.values(state.deposits||{}).some(deposit=>(deposit.paymentMode||'demo')==='demo'&&deposit.legacyDepositLedger!=='demo');
  const onlineRecords=Object.values(state.users||{}).some(user=>(user.transactions||[]).some(tx=>tx.realMoneyPayment===true))||
    Object.values(state.duels||{}).some(duel=>['coins','pix_manual'].includes(duel.creditMode))||
    Object.values(state.deposits||{}).some(deposit=>deposit.paymentMode==='pix_manual');
  if(stored&&stored!==target||target==='online'&&demoRecords||target==='demo'&&onlineRecords)invalid(409,'payment_environment_migration_required','Este banco pertence a um ambiente financeiro diferente. Use outro banco ou realize uma migração explícita revisada antes de mudar o ambiente.');
  return target;
}

/** Sum the full account collection, never the cursor page returned to the client. */
export function pendingDepositTotals(state,userId,paymentMode){
  const environment=environmentFor(paymentMode),totals={count:0,amount:0,pendingCount:0,reviewCount:0};
  for(const deposit of Object.values(state.deposits||{})){
    if(deposit.userId!==userId||!['pending','review'].includes(deposit.status)||(environment==='demo'?(deposit.paymentMode||'demo')!=='demo':deposit.paymentMode!=='pix_manual'))continue;
    if(!Number.isSafeInteger(deposit.amount)||deposit.amount<=0||!Number.isSafeInteger(totals.amount+deposit.amount))invalid(409,'invalid_pending_deposit','O total dos pedidos pendentes é inválido.');
    totals.count++;totals.amount+=deposit.amount;totals[deposit.status==='pending'?'pendingCount':'reviewCount']++;
  }
  return totals;
}

/** Apply on creation and admission before any reserve. Recipients have no room membership until acceptance. */
export function assertRoomAdmission(state,userId,{limit=50,duelId}={}){
  if(!Number.isSafeInteger(limit)||limit<1)invalid(400,'invalid_room_limit','Limite de salas inválido.');
  const count=Object.values(state.duels||{}).filter(duel=>duel.id!==duelId&&[duel.hostId,duel.guestId].includes(userId)&&OPEN_DUEL_STATUSES.includes(duel.status)).length;
  if(count>=limit)invalid(409,'room_admission_limit','Conclua desafios em andamento antes de entrar em mais salas.');
  return count;
}
