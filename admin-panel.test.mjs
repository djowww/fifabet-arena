import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminPanel} from './admin-panel.mjs';

function harness() {
  let current = {id:'admin-test', nickname:'Administrador de teste', isAdmin:true}, renders = 0, grants = [], failure = null;
  const memory = new Map(), storage = {getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  const target = {id:'target-test', publicPlayerId:'FBA-TEST000001', nickname:'Jogador de teste', balance:0, reserved:0, verifiedEmails:[]};
  const other = {id:'other-test', publicPlayerId:'FBA-TEST000002', nickname:'Outro jogador', balance:0, reserved:0, verifiedEmails:[]};
  const entries = [];
  const api = {
    async getAdminOverview() { return {stats:{users:2,activeMatches:0,pendingResults:0,pendingDeposits:0},paymentsAvailable:false,authProviders:{google:{available:true}}}; },
    async getAdminUsers() { return {users:[{...target},{...other}],total:2}; },
    async getAdminAudit() { return {entries:[...entries]}; },
    async addAdminCredits(payload) {
      grants.push({...payload});
      if (failure) { const problem = failure; failure = null; throw problem; }
      target.balance += payload.amount;
      entries.push({id:'test-operation',amount:payload.amount,reason:payload.reason,actor:{nickname:current.nickname},target:{nickname:target.nickname,publicPlayerId:target.publicPlayerId},balanceBefore:0,balanceAfter:target.balance,createdAt:'2026-10-01T03:00:00Z'});
      return {user:{...target},replayed:false};
    }
  };
  const makePanel = () => createAdminPanel({api,getUser:()=>current,render(){renders++;},async syncAccount(){},avatar:()=>'<span class="test-avatar"></span>',storage});
  let panel = makePanel();
  const form = kind => ({dataset:{form:kind},querySelector:()=>({setAttribute(){}})});
  const submit = (kind,fields={}) => panel.handleForm(form(kind),{get:key=>fields[key]??null});
  return {get panel(){return panel;},target,other,grants,submit,api,storage,memory,setUser(user){current=user;},reload(){panel=makePanel();},failNextGrant(problem=Object.assign(Error('Connection interrupted'),{status:0})){failure=problem;},get renders(){return renders;}};
}

test('non-admin UI does not query private endpoints even with a direct admin route',async()=>{
  const h=harness();h.setUser({id:'ordinary',isAdmin:false});
  for(const name of ['getAdminOverview','getAdminUsers','getAdminAudit'])h.api[name]=()=>{throw Error('Private data requested');};
  assert.match(await h.panel.view(),/restrito à administração/);
  await assert.rejects(h.panel.handleAction('admin-select','target-test'),/administradora/);
  assert.equal(h.grants.length,0);
});

test('credit additions require review and show the actual server balance after confirmation',async()=>{
  const h=harness();await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  await h.submit('admin-credit',{amount:'100',reason:'Créditos para teste acompanhado.'});
  const confirmation=await h.panel.view();assert.match(confirmation,/Confirme a adição/);assert.match(confirmation,/Saldo previsto/);assert.equal(h.grants.length,0);
  await h.submit('admin-credit-confirm');assert.equal(h.grants.length,1);assert.equal(h.target.balance,100);
  const result=await h.panel.view();assert.match(result,/100 em Joga aí Coin adicionados ao saldo/);assert.match(result,/Atividade administrativa/);assert.match(result,/Pagamentos: em configuração/);assert.doesNotMatch(result,/Pix confirmado/);
});

test('uncertain responses reuse the operation key and prevent recipient switching',async()=>{
  const h=harness();await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  await h.submit('admin-credit',{amount:'250',reason:'Créditos para uma operação acompanhada.'});h.failNextGrant();
  await h.submit('admin-credit-confirm');assert.equal(h.grants.length,1);
  let html=await h.panel.view();assert.match(html,/mesma operação será aplicada uma única vez/);assert.doesNotMatch(html,/Voltar e editar/);
  await h.panel.handleAction('admin-select',h.other.id);html=await h.panel.view();assert.match(html,/Confirme a operação pendente/);
  await h.submit('admin-credit-confirm');assert.equal(h.grants.length,2);assert.equal(h.grants[0].idempotencyKey,h.grants[1].idempotencyKey);assert.equal(h.grants[1].userId,h.target.id);assert.equal(h.target.balance,250);
});

test('user switching clears private drafts and names/reasons are escaped in HTML',async()=>{
  const h=harness();h.target.nickname='<img src=x onerror=alert(1)>';await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  await h.submit('admin-credit',{amount:'100',reason:'<script>alert("x")</script> razão de teste.'});
  const html=await h.panel.view();assert.doesNotMatch(html,/<script>|<img src=x/);assert.match(html,/&lt;script&gt;/);
  h.setUser({id:'new-admin',nickname:'Novo admin',isAdmin:true});const next=await h.panel.view();assert.match(next,/Selecione um jogador/);assert.doesNotMatch(next,/Confirme a adição/);
});

test('administrative fields survive background refresh without losing the draft',async()=>{
  const h=harness();await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  h.panel.handleInput({id:'adminAmount',value:'500'});h.panel.handleInput({id:'adminReason',value:'Créditos de teste com motivo preenchido.'});
  const refreshed=await h.panel.view();assert.match(refreshed,/value="500"/);assert.match(refreshed,/motivo preenchido/);assert.equal(h.grants.length,0);
});

test('a pending operation survives reload with the same key and stays private to its administrator',async()=>{
  const h=harness();await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  await h.submit('admin-credit',{amount:'100',reason:'Adição interrompida durante confirmação.'});h.failNextGrant();await h.submit('admin-credit-confirm');
  h.reload();assert.match(await h.panel.view(),/adição anterior ficou sem confirmação/);
  h.setUser({id:'another-admin',isAdmin:true});assert.doesNotMatch(await h.panel.view(),/Confirme a adição/);
  h.setUser({id:'admin-test',isAdmin:true});await h.panel.view();await h.submit('admin-credit-confirm');
  assert.equal(h.grants.length,2);assert.equal(h.grants[0].idempotencyKey,h.grants[1].idempotencyKey);assert.equal(h.memory.size,0);
});

test('an invalid success response retains the operation key for a safe replay',async()=>{
  const h=harness();await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  await h.submit('admin-credit',{amount:'100',reason:'Resposta inválida após uma requisição.'});
  h.failNextGrant(Object.assign(Error('Invalid response'),{status:200,code:'invalid_response'}));await h.submit('admin-credit-confirm');
  assert.match(await h.panel.view(),/Consultar e confirmar operação/);h.reload();await h.panel.view();await h.submit('admin-credit-confirm');
  assert.equal(h.grants[0].idempotencyKey,h.grants[1].idempotencyKey);
});

test('a blocked session store prevents submission rather than risking an unrecoverable operation',async()=>{
  const h=harness();await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  await h.submit('admin-credit',{amount:'100',reason:'Teste com armazenamento bloqueado.'});h.storage.setItem=()=>{throw Error('Blocked');};await h.submit('admin-credit-confirm');
  assert.equal(h.grants.length,0);const html=await h.panel.view();assert.match(html,/Habilite o armazenamento/);assert.match(html,/Voltar e editar/);
});

test('a throwing default sessionStorage getter does not prevent rendering the panel',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  try {
    Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw Error('Storage denied by browser policy');}});
    const h=harness();const panel=createAdminPanel({api:h.api,getUser:()=>({id:'admin-test',isAdmin:true}),render(){},async syncAccount(){},avatar:()=>''});
    assert.match(await panel.view(),/Bem-vindo, administrador/);
    await panel.handleAction('admin-select',h.target.id);
    await panel.handleForm({dataset:{form:'admin-credit'}},{get:key=>({amount:'100',reason:'Verificação de política de armazenamento.'})[key]});
    await panel.handleForm({dataset:{form:'admin-credit-confirm'},querySelector:()=>null},{get:()=>null});
    assert.equal(h.grants.length,0);assert.match(await panel.view(),/Habilite o armazenamento/);
  } finally {
    if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;
  }
});

test('a definitive rejection of a first submission does not restore a blocked operation after reload',async()=>{
  const h=harness();await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  await h.submit('admin-credit',{amount:'100',reason:'Verificação de rejeição definitiva.'});
  h.failNextGrant(Object.assign(Error('Saldo excede o limite permitido.'),{status:409}));await h.submit('admin-credit-confirm');
  assert.equal(h.memory.size,0);assert.match(await h.panel.view(),/Voltar e editar/);h.reload();assert.doesNotMatch(await h.panel.view(),/adição anterior ficou sem confirmação/);
});

test('a rejection during an uncertain retry retains the first operation until its outcome is known',async()=>{
  const h=harness();await h.panel.view();await h.panel.handleAction('admin-select',h.target.id);
  await h.submit('admin-credit',{amount:'100',reason:'Verificação de retentativa interrompida.'});h.failNextGrant();await h.submit('admin-credit-confirm');
  h.failNextGrant(Object.assign(Error('Muitas tentativas.'),{status:429}));await h.submit('admin-credit-confirm');
  assert.equal(h.memory.size,1);h.reload();assert.match(await h.panel.view(),/adição anterior ficou sem confirmação/);
});
