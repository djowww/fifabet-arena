const DAY=86_400_000,FUTURE_ALLOWANCE=300_000;
const fail=(status,code,message)=>{const error=Error(message);error.status=status;error.code=code;throw error;};
function bankReference(value){
  const reference=typeof value==='string'?value.trim().toUpperCase():'';
  if(reference.length<8||reference.length>128||!/^[-A-Z0-9._]+$/.test(reference))fail(400,'invalid_bank_reference','Informe o identificador único da transferência no extrato bancário.');
  return reference;
}
const comparableReference=value=>typeof value==='string'?value.trim().toUpperCase():null;

/** Normal approvals and closed-order recovery share the same bank-reference namespace. */
export function bankReferenceAlreadyUsed(state,reference,{excludeDepositId}={}){
  const normalized=bankReference(reference);
  return Object.entries(state.deposits||{}).some(([id,deposit])=>{
    if((deposit.id||id)===excludeDepositId)return false;
    const references=[deposit.status==='approved'?deposit.decision?.bankReference:null,deposit.recovery?.bankReference,deposit.recovery?.refundBankReference];
    return references.some(value=>comparableReference(value)===normalized);
  });
}

/** Validate staff-entered bank facts only. This helper neither verifies a bank nor executes a refund. */
export function validatePaidDepositRecovery(state,deposit,reviewerId,input,{paymentMode,time=Date.now()}={}){
  if(paymentMode!=='pix_manual')fail(503,'payments_unavailable','A recuperação exige Pix manual configurado.');
  if(!deposit||deposit.paymentMode!=='pix_manual'||deposit.method!=='pix'||!['cancelled','rejected'].includes(deposit.status))fail(409,'deposit_recovery_unavailable','Somente pedidos Pix cancelados ou rejeitados podem ser recuperados.');
  if(typeof reviewerId!=='string'||!reviewerId||reviewerId===deposit.userId)fail(403,'independent_reviewer_required','Um revisor independente precisa conferir este pedido.');
  if(deposit.recovery)fail(409,'deposit_recovery_already_recorded','Este pedido já possui uma recuperação registrada.');
  if(!Number.isSafeInteger(input?.version)||input.version!==deposit.version)fail(409,'stale_deposit','O pedido mudou. Atualize a carteira antes de continuar.');
  const proof=state.walletEvidence?.[deposit.evidenceId];
  if(!proof||proof.id!==deposit.evidenceId||proof.depositId!==deposit.id||proof.authorId!==deposit.userId||!Array.isArray(deposit.evidenceIds)||!deposit.evidenceIds.includes(proof.id))fail(409,'deposit_recovery_proof_required','O pedido precisa manter o comprovante original do comprador.');
  if(!['credit','refund_recorded'].includes(input.outcome))fail(400,'invalid_recovery_outcome','Escolha entre creditar a compra e registrar uma devolução bancária já conferida.');
  if(input.outcome==='credit'&&(!state.users?.[deposit.userId]||state.users[deposit.userId].disabledAt))fail(409,'account_disabled','Esta conta não pode receber novos créditos. Confira uma devolução bancária.');
  const reference=bankReference(input.bankReference);
  if(!Number.isSafeInteger(deposit.priceCents)||deposit.priceCents<=0||!Number.isSafeInteger(input.bankAmountCents)||input.bankAmountCents!==deposit.priceCents)fail(400,'bank_amount_mismatch','O valor recebido precisa corresponder ao pacote em centavos.');
  const created=Date.parse(deposit.createdAt),paid=typeof input.paidAt==='string'?Date.parse(input.paidAt):NaN;
  if(![created,paid,time].every(Number.isFinite)||paid<created-DAY||paid>time+FUTURE_ALLOWANCE)fail(400,'invalid_bank_date','A data do pagamento precisa corresponder ao pedido original e não pode estar no futuro.');
  if(bankReferenceAlreadyUsed(state,reference))fail(409,'bank_reference_used','Esta transferência já foi vinculada a uma recarga ou devolução.');
  const validated={outcome:input.outcome,evidenceId:proof.id,bankReference:reference,bankAmountCents:input.bankAmountCents,paidAt:new Date(paid).toISOString()};
  if(input.outcome==='refund_recorded'){
    const refundReference=bankReference(input.refundBankReference);
    if(refundReference===reference||bankReferenceAlreadyUsed(state,refundReference))fail(409,'bank_reference_used','A referência da devolução já foi utilizada ou coincide com o pagamento.');
    if(!Number.isSafeInteger(input.refundAmountCents)||input.refundAmountCents!==deposit.priceCents)fail(400,'refund_amount_mismatch','O valor devolvido precisa corresponder ao pagamento em centavos.');
    const refunded=typeof input.refundedAt==='string'?Date.parse(input.refundedAt):NaN;
    if(!Number.isFinite(refunded)||refunded<paid||refunded>time+FUTURE_ALLOWANCE)fail(400,'invalid_refund_date','Informe a data da devolução bancária já conferida, após o pagamento.');
    Object.assign(validated,{refundBankReference:refundReference,refundAmountCents:input.refundAmountCents,refundedAt:new Date(refunded).toISOString()});
  }
  return validated;
}
