import test from 'node:test';
import assert from 'node:assert/strict';
import {renderRecoveryQueue,renderDepositRecoveryForm,renderDeletionQueue} from './review-tools.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const c={esc,fmt:String,brl:cents=>`R$ ${(cents/100).toFixed(2)}`,when:value=>`DATA ${value}`,url:id=>`/api/v1/wallet/evidence/${encodeURIComponent(id)}`};
const deposit={id:'order-a',userId:'buyer',owner:{id:'buyer',nickname:'<Comprador>',publicPlayerId:'FBA-BUYER',email:'PRIVATE@example.test',balance:99999},status:'rejected',paymentMode:'pix_manual',method:'pix',amount:100,priceCents:1000,version:3,createdAt:'2026-10-01T12:00:00Z',evidenceId:'private/proof',evidenceIds:['private/proof'],decision:{bankReference:'PRIVATE-BANK',actorId:'PRIVATE-REVIEWER'}};

test('recovery queue shows only closed Pix orders with original proof and public buyer identity',()=>{
 const html=renderRecoveryQueue([deposit,{...deposit,id:'cancelled',status:'cancelled'},{...deposit,id:'demo',paymentMode:'demo'},{...deposit,id:'pending',status:'pending'},{...deposit,id:'no-proof',evidenceId:null},{...deposit,id:'recovered',recovery:{outcome:'credit'}}],c);
 assert.match(html,/&lt;Comprador&gt;/);assert.match(html,/FBA-BUYER/);assert.match(html,/DATA 2026-10-01/);assert.match(html,/R\$ 10\.00/);assert.match(html,/data-action='deposit-recovery' data-id='order-a'/);assert.match(html,/data-id='cancelled'/);
 assert.doesNotMatch(html,/data-id='demo'|data-id='pending'|data-id='no-proof'|data-id='recovered'|PRIVATE|99999|<Comprador>/);
});
test('recovery queue explains empty eligible list without offering an invented recovery',()=>{
 const html=renderRecoveryQueue([],c);assert.match(html,/Nenhum pedido/);assert.doesNotMatch(html,/data-action='deposit-recovery'/);
});
test('recovery form preserves original order facts, version and a private proof zoom link',()=>{
 const html=renderDepositRecoveryForm(deposit,c);
 assert.match(html,/data-form='deposit-recovery' data-id='order-a' data-version='3'/);
 assert.match(html,/Pedido original/);assert.match(html,/DATA 2026-10-01T12:00:00Z/);assert.match(html,/R\$ 10\.00/);assert.match(html,/value='10\.00'/);
 assert.match(html,/href='\/api\/v1\/wallet\/evidence\/private%2Fproof'/);assert.match(html,/target='_blank' rel='noopener noreferrer'/);
 assert.doesNotMatch(html,/PRIVATE-BANK|PRIVATE-REVIEWER|PRIVATE@example|99999|<Comprador>/);
});
test('recovery decisions collect payment facts, require explicit bank confirmation and record an existing refund',()=>{
 const html=renderDepositRecoveryForm(deposit,c);
 for(const name of ['outcome','reason','bankReference','bankAmountCents','paidAt','refundBankReference','refundAmountCents','refundedAt'])assert.match(html,new RegExp(`name='${name}'`));
 assert.match(html,/value='credit'/);assert.match(html,/value='refund_recorded'/);assert.match(html,/name='confirmBank' required/);
 assert.match(html,/type='datetime-local'/);assert.match(html,/Valor recebido.*R\$/);assert.match(html,/já realizada|já conferida/);assert.match(html,/não executa|não envia/);
 assert.doesNotMatch(html,/Executar devolução|Devolver Pix automaticamente|Banco conectado/);
});
test('recovery form ignores public evidence URLs and cannot turn caller URL into an executable link',()=>{
 const html=renderDepositRecoveryForm({...deposit,evidenceUrl:'https://example.test/share'}, {...c,url:()=> 'javascript:alert(1)'});
 assert.doesNotMatch(html,/javascript:|example.test|href=/);assert.match(html,/Comprovante indisponível/);
});
test('ineligible or stale recovery form does not offer a credit action',()=>{
 for(const input of [{...deposit,status:'approved'},{...deposit,paymentMode:'demo'},{...deposit,evidenceId:null},{...deposit,version:0}])assert.doesNotMatch(renderDepositRecoveryForm(input,c),/data-form='deposit-recovery'/);
});
test('deletion queue contains a private administrator review form and preserves the request reason safely',()=>{
 const html=renderDeletionQueue([{user:{id:'account-a',nickname:'<Jogador>',publicPlayerId:'FBA-USER',email:'PRIVATE@example.test',passwordHash:'PRIVATE-HASH',balance:23456},request:{status:'pending_review',requestedAt:'2026-10-03',reason:'<script>motivo</script>'}},{user:{id:'old',nickname:'Old'},request:{status:'anonymized',reason:'handled'}}],c);
 assert.match(html,/data-form='account-deletion-review' data-id='account-a'/);assert.match(html,/value='anonymize'/);assert.match(html,/value='reject'/);assert.match(html,/name='confirmPrivacy' required/);assert.match(html,/name='reason'/);
 assert.match(html,/&lt;Jogador&gt;/);assert.match(html,/&lt;script&gt;motivo&lt;\/script&gt;/);assert.match(html,/DATA 2026-10-03/);
 assert.doesNotMatch(html,/PRIVATE|23456|data-id='old'|<script>|<Jogador>|href=/);
});
test('deletion review explains blockers and retained records without claiming everything is deleted',()=>{
 const html=renderDeletionQueue([{user:{id:'a',nickname:'User'},request:{status:'pending_review',requestedAt:'2026-10-03',reason:'Pedido pessoal.'}}],c);
 for(const pattern of [/saldos/i,/disputas/i,/financeiros/i,/país/i,/termos/i,/conversas/i,/anonimiz/i])assert.match(html,pattern);
 assert.doesNotMatch(html,/apagar todos|excluir todos|eliminação completa/i);
});
test('deletion empty state offers no administrator decision',()=>{
 const html=renderDeletionQueue([],c);assert.match(html,/Nenhuma solicitação/);assert.doesNotMatch(html,/data-form=/);
});
