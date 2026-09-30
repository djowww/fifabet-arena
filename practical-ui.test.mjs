import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as M from './model.mjs';

const source=fs.readFileSync(new URL('./play.js',import.meta.url),'utf8');
const image={type:'image/jpeg',size:1000};
const photo='data:image/jpeg;base64,cGxhY2Fy';
async function harness({initial=M.emptyState(),api={},url='https://example.test/fifabet-arena/#arena',bitmapFactory}={}){
  const nodes={},listeners={},windowListeners={},stored=new Map([[M.STORAGE_KEY,JSON.stringify(initial)]]),copies=[];
  let failWrite=false;
  function node(id){return nodes[id]??={id,innerHTML:'',textContent:'',value:'',hidden:false,open:false,isConnected:true,disabled:false,files:[],dataset:{},classList:{add(){},remove(){}},focus(){document.activeElement=this;},setSelectionRange(){},showModal(){this.open=true;},close(){this.open=false;},getBoundingClientRect(){return {left:0,right:500,top:0,bottom:500};},addEventListener(name,callback){this[name]=callback;}};}
  const document={getElementById:node,activeElement:null,addEventListener(name,callback){listeners[name]=callback;},createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext(){return {drawImage(){}};},toDataURL(){return photo;}};}};
  const parsed=new URL(url),location={hash:parsed.hash,href:url,pathname:parsed.pathname,origin:parsed.origin};
  const localStorage={getItem:key=>stored.get(key)??null,setItem(key,value){if(failWrite){failWrite=false;throw Error('quota');}stored.set(key,String(value));},removeItem:key=>stored.delete(key)};
  const API={detectBackend:async()=>null,evidenceUrl:id=>`/api/v1/evidence/${id}`,...api};
  const context={M,API,document,localStorage,location,window:{addEventListener(name,callback){windowListeners[name]=callback;},scrollTo(){}},history:{replaceState(_state,_title,value){location.href=new URL(value,location.href).href;location.hash=new URL(location.href).hash;}},navigator:{clipboard:{async writeText(value){copies.push(value);}}},crypto,URL,Blob,console,clearTimeout(){},setTimeout(){return 1;},createImageBitmap:bitmapFactory||(async()=>({width:1280,height:720,close(){}})),fetch:async()=>({async blob(){return new Blob(['photo'],{type:'image/jpeg'});}}),FormData:class{constructor(form){this.fields=form.fields;}get(key){return this.fields[key]??null;}}};
  vm.createContext(context);
  const code=source.replace(/^import .*?;\r?\n/gm,'').replace(/\nstart\(\)\.catch\(/,'\nglobalThis.__boot=start().catch(');
  vm.runInContext(code+`\nglobalThis.practical={getState:()=>state,getArena:()=>arena,isOnline:()=>online,duels,render};`,context);
  await context.__boot;
  const click=async(action,id)=>{
    const button={dataset:{action,id},disabled:false,isConnected:true};
    await listeners.click({preventDefault(){},target:{closest(selector){if(selector==='.skip-link')return null;assert.equal(selector,'[data-action]');return button;}}});
  };
  const submit=async(kind,fields={},dataset={})=>{
    const button={disabled:false,isConnected:true};
    const surfaces=node('modal').open?[node('modalContent').innerHTML,node('screen').innerHTML]:[node('screen').innerHTML,node('modalContent').innerHTML];
    const tag=surfaces.flatMap(html=>[...html.matchAll(/<form\b[^>]*>/g)].map(match=>match[0])).find(tag=>tag.includes(`data-form='${kind}'`));
    const captured={};if(tag)for(const [,name,value]of tag.matchAll(/data-([a-z-]+)='([^']*)'/g))captured[name.replace(/-([a-z])/g,(_match,letter)=>letter.toUpperCase())]=value;
    const form={dataset:{form:kind,...captured,...dataset},fields,querySelector(){return button;}};
    await listeners.submit({preventDefault(){},target:{closest(selector){assert.equal(selector,'[data-form]');return form;}}});
  };
  const route=hash=>{location.hash=hash;windowListeners.hashchange();};
  const persisted=()=>M.restore(stored.get(M.STORAGE_KEY));
  return {nodes,document,listeners,windowListeners,localStorage,location,copies,click,submit,route,api:context.practical,persisted,failNextWrite(){failWrite=true;}};
}
async function twoPlayers(){
  const h=await harness();await h.click('signup');await h.submit('signup',{nickname:'Alex'});const a=h.api.getState().activeProfileId;
  await h.click('signup');await h.submit('signup',{nickname:'Bruna'});const b=h.api.getState().activeProfileId;
  await h.click('login');await h.click('select-profile',a);h.route('#criar');return {h,a,b};
}
async function reviewChallenge(h,b,stake=100){
  h.route('#criar');
  await h.submit('duel',{rivalId:h.api.getState().profiles[b].publicPlayerId,mode:'1v1',platform:'playstation'});
  await h.submit('duel',{stake:String(stake),rules:'Jogo único, seis minutos.'});
}
async function challenge(h,b,stake=100){
  const previous=new Set(Object.keys(h.persisted().duels));
  await reviewChallenge(h,b,stake);await h.submit('duel');
  const created=Object.values(h.persisted().duels).find(d=>!previous.has(d.id));assert.ok(created,'the submitted duel must be persisted');return created.id;
}
async function accept(h,b,id){await h.click('login');await h.click('select-profile',b);await h.click('accept-preview',id);assert.match(h.nodes.modalContent.innerHTML,/Aceitar desafio/);await h.click('accept',id);}

test('the initial lobby offers joining or creating a match and keeps the duel form on its own route',async()=>{
  const h=await harness();assert.match(h.nodes.screen.innerHTML,/data-form='join'/);assert.match(h.nodes.screen.innerHTML,/data-action='create'/);
  assert.equal([...h.nodes.screen.innerHTML.matchAll(/class='lobby-choice /g)].length,2);
  assert.match(h.nodes.screen.innerHTML,/Criar meu perfil/);assert.doesNotMatch(h.nodes.screen.innerHTML,/DISPONÍVEIS|RESERVADOS|data-action='deposit'/);assert.doesNotMatch(h.nodes.screen.innerHTML,/<form data-form='duel'/);
  assert.match(h.nodes.screen.innerHTML,/Joga aí/);assert.doesNotMatch(h.nodes.screen.innerHTML,/lobby-game-mark/);
  await h.click('signup');await h.submit('signup',{nickname:'Alex'});
  assert.ok(h.nodes.screen.innerHTML.includes(M.current(h.persisted()).publicPlayerId));
  await h.click('create');assert.equal(h.location.hash,'#criar');assert.match(h.nodes.screen.innerHTML,/<form data-form='duel'/);
});

test('practical UI creates actual local players, displays their IDs and sends a persisted invite with reserve',async()=>{
  const {h,a,b}=await twoPlayers();
  assert.match(h.nodes.screen.innerHTML,/Alex/);assert.match(h.nodes.screen.innerHTML,/Bruna/);
  assert.ok(h.nodes.screen.innerHTML.includes(h.api.getState().profiles[b].publicPlayerId));
  assert.doesNotMatch(h.nodes.screen.innerHTML,/BiaGoals|LeoPlay|Preparando sua arena/);
  await h.click('copy-id');assert.equal(h.copies[0],h.api.getState().profiles[a].publicPlayerId);
  const id=await challenge(h,b,250),s=h.persisted();
  assert.equal(s.duels[id].status,'invited');assert.equal(s.profiles[a].balance,750);assert.equal(s.profiles[b].balance,1000);
  assert.match(h.nodes.screen.innerHTML,/Cancelar convite/);assert.doesNotMatch(h.nodes.screen.innerHTML,/data-action='accept'/);
  await accept(h,b,id);assert.equal(h.persisted().duels[id].status,'active');assert.equal(h.persisted().profiles[b].balance,750);
  assert.match(h.nodes.screen.innerHTML,/Enviar placar/);assert.match(h.nodes.screen.innerHTML,/500/);
  h.route('#historico');assert.match(h.nodes.screen.innerHTML,/Alex/);assert.match(h.nodes.screen.innerHTML,/Partida confirmada/);
});

test('UI photo submission maps creator/guest scores correctly and peer confirmation keeps points reserved after reload',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b);await accept(h,b,id);
  await h.click('result',id);assert.match(h.nodes.modalContent.innerHTML,/Alex/);assert.match(h.nodes.modalContent.innerHTML,/Bruna/);
  await h.submit('result',{homeScore:'4',awayScore:'1',evidence:image},{id});
  let s=h.persisted();assert.equal(s.duels[id].report.homeScore,4);assert.equal(s.duels[id].report.awayScore,1);
  assert.equal(s.duels[id].report.submittedBy,b);assert.equal(s.duels[id].report.evidenceDataUrl,photo);
  assert.equal(s.duels[id].status,'review');assert.doesNotMatch(h.nodes.screen.innerHTML,/data-action='confirm'/);
  await h.click('login');await h.click('select-profile',a);
  assert.match(h.nodes.screen.innerHTML,/Confirmar placar/);await h.click('confirm',id);
  s=h.persisted();assert.equal(s.duels[id].peerConfirmed,true);assert.equal(s.profiles[a].balance,900);assert.equal(s.profiles[b].balance,900);
  assert.match(h.nodes.screen.innerHTML,/Aguardando a equipe/);assert.doesNotMatch(h.nodes.screen.innerHTML,/data-action='review'/);
  const reload=await harness({initial:s});assert.match(reload.nodes.screen.innerHTML,/4 × 1/);assert.match(reload.nodes.screen.innerHTML,/Aguardando a equipe/);
  assert.equal(M.duelReservedPoints(reload.persisted(),a),100);
});

test('a divergence can be submitted through the UI with its photo and bilateral cancellation remains available locally',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b);await accept(h,b,id);
  await h.submit('result',{homeScore:'2',awayScore:'0',evidence:image},{id});
  await h.click('login');await h.click('select-profile',a);await h.click('dispute',id);
  await h.submit('dispute',{reason:'A foto mostra que o resultado foi diferente.',evidence:image},{id});
  let s=h.persisted();assert.equal(s.duels[id].status,'disputed');assert.equal(s.duels[id].disputes.length,1);
  assert.equal(s.duels[id].disputes[0].evidenceDataUrl,photo);assert.match(h.nodes.screen.innerHTML,/Enviar novo placar/);
  assert.match(h.nodes.screen.innerHTML,/data-action='cancel'/,'local disputed duel must offer agreement cancellation, since there is no connected reviewer');
  await h.click('cancel',id);assert.equal(h.persisted().duels[id].cancelRequestedBy,a);
  await h.click('login');await h.click('select-profile',b);assert.match(h.nodes.screen.innerHTML,/Confirmar cancelamento/);
  await h.click('cancel',id);s=h.persisted();assert.equal(s.duels[id].status,'cancelled');assert.equal(s.profiles[a].balance,1000);assert.equal(s.profiles[b].balance,1000);
  h.route('#historico');assert.match(h.nodes.screen.innerHTML,/Cancelado/);
});

test('the invited opponent can decline and the other player can refuse an active cancellation without losing points',async()=>{
  const {h,a,b}=await twoPlayers();let id=await challenge(h,b,250);
  await h.click('login');await h.click('select-profile',b);await h.click('decline',id);
  assert.equal(h.persisted().duels[id].status,'rejected');assert.equal(h.persisted().profiles[a].balance,1000);
  await h.click('login');await h.click('select-profile',a);id=await challenge(h,b,250);await accept(h,b,id);
  await h.click('cancel',id);assert.equal(h.persisted().duels[id].cancelRequestedBy,b);
  await h.click('login');await h.click('select-profile',a);
  assert.match(h.nodes.screen.innerHTML,/Recusar cancelamento/,'recipient of the cancellation request must be able to keep playing');
  await h.click('withdraw-cancel',id);assert.equal(h.persisted().duels[id].cancelRequestedBy,null);
  assert.match(h.nodes.screen.innerHTML,/Enviar placar/);assert.equal(h.persisted().profiles[a].balance,750);assert.equal(h.persisted().profiles[b].balance,750);
});

test('failed persistence keeps the rendered/session state unchanged and a stale tab cannot reserve another profile points',async()=>{
  const {h,a,b}=await twoPlayers(),before=JSON.stringify(h.api.getState());
  await reviewChallenge(h,b);h.failNextWrite();await h.submit('duel');
  assert.equal(JSON.stringify(h.api.getState()),before,'the in-memory state must not install an unsaved duel');
  assert.equal(h.persisted().profiles[a].balance,1000);assert.equal(Object.keys(h.persisted().duels).length,0);
  assert.match(h.nodes.toast.textContent,/salvar|espaço/);assert.equal(h.nodes.storageWarning.hidden,false);
  const switched=M.change(h.persisted(),'login',{id:b});h.localStorage.setItem(M.STORAGE_KEY,JSON.stringify(switched));
  await h.submit('duel');
  assert.match(h.nodes.toast.textContent,/perfil mudou|conta mudou/i);assert.equal(h.persisted().activeProfileId,b);assert.equal(h.persisted().profiles[b].balance,1000);
});

test('server invite prompts authentication and becomes accepted only from the authenticated guest account',async()=>{
  const calls=[];let loggedIn=false,accepted=false;
  const user={id:'guest-account',nickname:'Bruna',publicPlayerId:'FBA-BBBBBBBBBB',balance:1000,isReviewer:false};
  const duel={id:'server-duel',hostId:'host-account',guestId:null,recipientId:user.id,host:{id:'host-account',nickname:'Alex',publicPlayerId:'FBA-AAAAAAAAAA'},recipient:user,stake:100,mode:'1v1',rules:'Jogo único.',status:'invited',createdAt:'2026-09-30T12:00:00.000Z'};
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user:null}),loginAccount:async data=>{calls.push(['login',data]);loggedIn=true;return {user};},getArena:async()=>({user:loggedIn?{...user,balance:accepted?900:1000}:null,duels:accepted?[{...duel,guestId:user.id,guest:user,status:'in_progress'}]:[],history:[],stats:{reserved:accepted?100:0}}),getInvite:async token=>{assert.equal(loggedIn,true);calls.push(['invite',token]);return {invite:duel};},acceptInvite:async token=>{assert.equal(loggedIn,true);calls.push(['accept',token]);accepted=true;return {};}};
  const h=await harness({api,url:`https://example.test/?convite=${'t'.repeat(43)}#arena`});
  assert.equal(h.api.isOnline(),true);assert.match(h.nodes.modalContent.innerHTML,/Entre ou crie/);assert.deepEqual(calls,[]);
  await h.click('login');assert.match(h.nodes.modalContent.innerHTML,/Apelido ou ID Fifa GO/);await h.submit('login',{nickname:'Bruna',password:'a secure passphrase'});
  assert.equal(h.nodes.modal.open,true);assert.match(h.nodes.modalContent.innerHTML,/Alex te chamou/);assert.match(h.nodes.modalContent.innerHTML,/Aceitar desafio/);
  await h.click('accept-invite');assert.equal(accepted,true);assert.equal(h.location.href,'https://example.test/#arena');
  assert.equal(h.nodes.modal.open,false);assert.match(h.nodes.screen.innerHTML,/Enviar placar/);assert.deepEqual(calls.map(x=>x[0]),['login','invite','accept']);
});

test('only a server reviewer gets review navigation and decisions carry the photo report revision to the API',async()=>{
  const calls=[];
  const user={id:'reviewer-account',nickname:'Equipe',publicPlayerId:'FBA-CCCCCCCCCC',balance:1000,isReviewer:true};
  const duel={id:'review-duel',hostId:'host-account',guestId:'guest-account',host:{id:'host-account',nickname:'Alex'},guest:{id:'guest-account',nickname:'Bruna'},stake:100,mode:'1v1',status:'pending_review',createdAt:'2026-09-30T12:00:00.000Z',result:{id:'report-current',reporterId:'host-account',homeScore:3,awayScore:1,evidenceId:'photo-current',confirmedBy:'guest-account'},disputes:[]};
  let completed=false;
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],stats:{reserved:0}}),listReviews:async()=>({duels:completed?[]:[duel]}),listDepositReviews:async()=>({deposits:[]}),reviewDuel:async(id,data)=>{calls.push({id,...data});completed=true;return {};}};
  const h=await harness({api});assert.match(h.nodes.navigation.innerHTML,/Revisão/);h.route('#revisao');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/photo-current/);await h.click('review',duel.id);
  assert.match(h.nodes.modalContent.innerHTML,/data-report='report-current'/);
  await h.submit('review',{winner:'host',reason:'Foto e placar conferidos pela equipe.'},{id:duel.id,report:'report-current'});
  assert.deepEqual(calls,[{id:duel.id,reportId:'report-current',winner:'host',reason:'Foto e placar conferidos pela equipe.'}]);
  assert.match(h.nodes.toast.textContent,/revisado e créditos distribuídos/);
});

test('a server cancellation request keeps a path to continue the match instead of trapping both accounts',async()=>{
  const user={id:'guest-account',nickname:'Bruna',publicPlayerId:'FBA-BBBBBBBBBB',balance:900,isReviewer:false};
  const duel={id:'active-duel',hostId:'host-account',guestId:user.id,host:{id:'host-account',nickname:'Alex'},guest:user,stake:100,mode:'1v1',status:'in_progress',createdAt:'2026-09-30T12:00:00.000Z',result:null,cancellationRequestedBy:['host-account']};
  const withdrawals=[];
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[duel],history:[],stats:{reserved:100}}),withdrawCancellation:async id=>{withdrawals.push(id);duel.cancellationRequestedBy=[];return {};}};
  const h=await harness({api});assert.match(h.nodes.screen.innerHTML,/Confirmar cancelamento/);
  assert.match(h.nodes.screen.innerHTML,/Enviar placar|Recusar cancelamento/,'an account must be able to continue when it does not agree to cancel');
  if(h.nodes.screen.innerHTML.includes("data-action='withdraw-cancel'")){await h.click('withdraw-cancel',duel.id);assert.deepEqual(withdrawals,[duel.id]);assert.match(h.nodes.screen.innerHTML,/Enviar placar/);}
});

test('a proposal changed in another tab while the contestation photo is prepared is never contested without a new check',async()=>{
  let s=M.change(M.emptyState(),'create',{nickname:'Alex'});const a=s.activeProfileId;
  s=M.change(s,'create',{nickname:'Bruna'});const b=s.activeProfileId;
  s=M.change(M.change(s,'login',{id:a}),'createDuel',{opponentId:b,stake:100,mode:'1v1'});const id=M.duelsForProfile(s)[0].id;
  s=M.change(M.change(s,'login',{id:b}),'acceptDuel',{id});
  s=M.change(s,'submitDuelResult',{id,homeScore:2,awayScore:0,evidenceDataUrl:photo});const oldReport=s.duels[id].report.id;
  s=M.change(s,'login',{id:a});let releaseBitmap;
  const h=await harness({initial:s,bitmapFactory:()=>new Promise(resolve=>{releaseBitmap=()=>resolve({width:1280,height:720,close(){}});})});
  await h.click('dispute',id);
  const submitting=h.submit('dispute',{reason:'Esta foto corresponde ao placar antigo.',evidence:image},{id,report:oldReport});
  let updated=M.change(s,'disputeDuelResult',{id,reportId:oldReport,reason:'Uma contestação já foi enviada em outra aba.',evidenceDataUrl:photo});
  updated=M.change(M.change(updated,'login',{id:b}),'submitDuelResult',{id,homeScore:1,awayScore:1,evidenceDataUrl:photo});
  updated=M.change(updated,'login',{id:a});const newReport=updated.duels[id].report.id;
  h.localStorage.setItem(M.STORAGE_KEY,JSON.stringify(updated));h.windowListeners.storage({key:M.STORAGE_KEY});releaseBitmap();await submitting;
  const saved=h.persisted();assert.equal(saved.duels[id].report.id,newReport);assert.equal(saved.duels[id].status,'review');
  assert.equal(saved.duels[id].disputes.length,1,'the obsolete form must not add a dispute against the newer proposal');
  assert.match(h.nodes.toast.textContent,/mudou|atual|reabra|Reabra/);
});

test('skip link focuses the current content without navigating away from history',async()=>{
  const h=await harness();h.route('#historico');const html=h.nodes.screen.innerHTML;let prevented=false;
  await h.listeners.click({preventDefault(){prevented=true;},target:{closest(selector){if(selector==='.skip-link')return {};if(selector==='[data-action]')return null;assert.fail(`Unexpected selector ${selector}`);}}});
  assert.equal(prevented,true);assert.equal(h.location.hash,'#historico');assert.equal(h.document.activeElement,h.nodes.screen);
  assert.equal(h.nodes.screen.innerHTML,html);assert.match(h.nodes.breadcrumb.textContent,/Histórico/);
});

test('shared ranking renders server entries and an obsolete asynchronous response cannot overwrite history',async()=>{
  const user={id:'guest-account',nickname:'Bruna',publicPlayerId:'FBA-BBBBBBBBBB',balance:1000,isReviewer:false};
  const ranking={entries:[{player:user,played:3,wins:2,draws:1,losses:0}]};
  let releaseRanking,requests=0;
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],stats:{reserved:0}}),getLeaderboard:async()=>{requests++;return requests===1?new Promise(resolve=>{releaseRanking=()=>resolve(ranking);}):ranking;}};
  const h=await harness({api});h.route('#ranking');assert.match(h.nodes.screen.innerHTML,/Carregando/);
  h.route('#historico');releaseRanking();await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/Histórico das partidas/);assert.doesNotMatch(h.nodes.screen.innerHTML,/Bruna · você/);
  h.route('#ranking');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/Ranking dos jogadores/);assert.match(h.nodes.screen.innerHTML,/Bruna · você/);
  assert.match(h.nodes.screen.innerHTML,/<td>3<\/td><td>2<\/td><td>1<\/td><td>0<\/td>/);assert.equal(requests,2);
});

test('joining by a local code shows the actual invitation and requires a separate acceptance from its recipient',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b,250),code=h.persisted().duels[id].publicDuelId;
  assert.equal(h.location.hash,'#arena');assert.match(h.nodes.modalContent.innerHTML,/Código da partida/);
  assert.match(h.nodes.modalContent.innerHTML,new RegExp(code));assert.doesNotMatch(h.nodes.modalContent.innerHTML,new RegExp(id));
  await h.click('copy-code',code);assert.equal(h.copies.at(-1),code);
  await h.click('join');await h.submit('join',{code});assert.match(h.nodes.dialogError.textContent,/próprio convite/);
  assert.equal(h.persisted().duels[id].status,'invited');assert.equal(h.persisted().profiles[a].balance,750);
  await h.click('login');await h.click('select-profile',b);await h.click('join');await h.submit('join',{code:code.toLowerCase()});
  assert.match(h.nodes.modalContent.innerHTML,/Alex × Bruna/);assert.match(h.nodes.modalContent.innerHTML,/Aceitar desafio/);
  assert.equal(h.persisted().duels[id].status,'invited');assert.equal(h.persisted().profiles[b].balance,1000);
  await h.click('accept',id);assert.equal(h.persisted().duels[id].status,'active');assert.equal(h.persisted().profiles[b].balance,750);
  await h.click('join');await h.submit('join',{code:id});assert.match(h.nodes.dialogError.textContent,/etapa de convite/);
});

test('the guest can validate an inline invitation before authentication and bad inputs never call the API',async()=>{
  const calls=[];
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user:null}),getInvite:async token=>{calls.push(token);return {};}};
  const h=await harness({api});assert.match(h.nodes.screen.innerHTML,/data-form='join'/);assert.equal(h.nodes.modal.open,false);
  for(const [code,message] of [
    ['',/Cole um link/],['ABC',/Código inválido/],['https://[',/link não é um convite válido/],
    [`https://other.test/?convite=${'a'.repeat(43)}`,/mesmo endereço/],
    ['https://example.test/?convite=short-token',/não contém um convite válido/]
  ]){
    await h.submit('join',{code});assert.equal(h.nodes.modal.open,false);
    assert.equal(h.nodes.joinError.hidden,false);assert.match(h.nodes.joinError.textContent,message);
    assert.equal(h.api.getArena(),null);assert.deepEqual(calls,[]);
  }
});

test('a valid inline invitation is retained through login and requires a separate recipient confirmation',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b,250),code=h.persisted().duels[id].publicDuelId;
  await h.click('logout');assert.equal(M.current(h.persisted()),null);assert.equal(h.nodes.modal.open,false);
  await h.submit('join',{code:code.toLowerCase()});assert.match(h.nodes.modalContent.innerHTML,/Escolha um perfil/);
  assert.equal(h.persisted().duels[id].status,'invited');assert.equal(h.persisted().profiles[b].balance,1000);
  await h.click('select-profile',b);
  assert.match(h.nodes.modalContent.innerHTML,/Confira o convite/);assert.match(h.nodes.modalContent.innerHTML,/Alex × Bruna/);
  assert.match(h.nodes.modalContent.innerHTML,/PlayStation/);assert.match(h.nodes.modalContent.innerHTML,/Jogo único, seis minutos/);
  assert.match(h.nodes.modalContent.innerHTML,/data-action='accept'/);assert.equal(h.persisted().duels[id].status,'invited');
  assert.match(h.nodes.screen.innerHTML,/Você recebeu um convite/);assert.match(h.nodes.screen.innerHTML,/Recebidos \(1\)/);
  await h.click('accept',id);assert.equal(h.persisted().duels[id].status,'active');
  assert.equal(h.persisted().profiles[a].balance,750);assert.equal(h.persisted().profiles[b].balance,750);
  assert.match(h.nodes.screen.innerHTML,/Partida confirmada/);assert.match(h.nodes.toast.textContent,/atualizado|aceito/);
});

test('sharing a server invitation copies only its application path and opaque token',async()=>{
  const token='a'.repeat(43),user={id:'private-owner-id',nickname:'PrivateName',publicPlayerId:'FBA-AAAAAAAAAA',email:'private@example.test',balance:750,isReviewer:false};
  const duel={id:'internal-duel-id',hostId:user.id,host:user,guestId:null,recipientId:null,stake:250,mode:'1v1',platform:'pc',rules:'Regra privada.',status:'invited',inviteToken:token,createdAt:'2026-09-30T12:00:00.000Z',result:null};
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[duel],history:[],stats:{reserved:250}})};
  const h=await harness({api,url:'https://example.test/fifabet-arena/?email=private%40example.test&balance=750&result=3-1#arena'});
  await h.click('share',duel.id);const shared=new URL(h.copies.at(-1));
  assert.equal(shared.origin,'https://example.test');assert.equal(shared.pathname,'/fifabet-arena/');assert.equal(shared.hash,'#arena');
  assert.deepEqual([...shared.searchParams.entries()],[['convite',token]]);
  assert.doesNotMatch(shared.href,/private|balance|result|internal-duel|750|3-1/);
  assert.match(h.nodes.toast.textContent,/convite copiado/i);
});

test('expired, cancelled and accepted server invitations explain their status without an acceptance action',async()=>{
  for(const [status,expiresAt,message] of [
    ['expired','2020-01-01T00:00:00.000Z',/expirou/],['cancelled',null,/cancelado/],
    ['in_progress',null,/já foi aceito/],['completed',null,/já foi aceito/],
    ['invited','2020-01-01T00:00:00.000Z',/expirou/]
  ]){
    const user={id:'recipient',nickname:'Bruna',balance:1000,isReviewer:false};let accepts=0;
    const invite={host:{nickname:'Alex'},stake:100,mode:'1v1',platform:'pc',status,expiresAt};
    const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],stats:{reserved:0}}),getInvite:async()=>({invite}),acceptInvite:async()=>{accepts++;return {};}};
    const h=await harness({api,url:`https://example.test/?convite=${'b'.repeat(43)}#arena`});
    assert.match(h.nodes.modalContent.innerHTML,message);assert.doesNotMatch(h.nodes.modalContent.innerHTML,/data-action='accept-invite'/);
    assert.match(h.nodes.modalContent.innerHTML,/Nenhum crédito foi reservado/);assert.equal(h.api.getArena().user.balance,1000);assert.equal(accepts,0);
  }
});

test('the invite owner and an account without enough credits cannot accept from the displayed invitation',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b,500);
  await h.click('close');
  await h.submit('join',{code:h.persisted().duels[id].publicDuelId});assert.match(h.nodes.joinError.textContent,/próprio convite/);
  await h.click('login');await h.click('select-profile',b);
  const depleted=M.change(h.persisted(),'purchaseSticker',{id:'cristiano-ronaldo'});h.localStorage.setItem(M.STORAGE_KEY,JSON.stringify(depleted));h.windowListeners.storage({key:M.STORAGE_KEY});
  const before=JSON.stringify(h.persisted());await h.click('accept-preview',id);
  assert.match(h.nodes.modalContent.innerHTML,/Saldo insuficiente/);assert.match(h.nodes.modalContent.innerHTML,/Adicionar créditos de teste/);
  assert.doesNotMatch(h.nodes.modalContent.innerHTML,/data-action='accept'/);assert.equal(JSON.stringify(h.persisted()),before);
  await h.click('accept',id);assert.match(h.nodes.dialogError.textContent,/insuficiente/);
  assert.equal(JSON.stringify(h.persisted()),before);assert.equal(h.persisted().profiles[a].balance,500);assert.equal(h.persisted().profiles[b].balance,300);
  assert.equal(h.persisted().duels[id].status,'invited');assert.equal(M.duelReservedPoints(h.persisted(),b),0);
});

test('the empty wallet distinguishes a guest, a zero available balance and credits already reserved',async()=>{
  const guest=await harness();assert.match(guest.nodes.screen.innerHTML,/comece com 1\.000 créditos de teste/);
  assert.doesNotMatch(guest.nodes.screen.innerHTML,/DISPONÍVEIS|RESERVADOS|Seu saldo está zerado/);
  const empty=M.change(M.emptyState(),'create',{nickname:'Sem saldo'});M.current(empty).balance=0;
  const zero=await harness({initial:empty});assert.match(zero.nodes.screen.innerHTML,/Seu saldo está zerado/);
  assert.match(zero.nodes.screen.innerHTML,/Adicionar créditos de teste/);assert.match(zero.nodes.screen.innerHTML,/RESERVADOS/);
  zero.route('#carteira');await new Promise(resolve=>setImmediate(resolve));
  assert.match(zero.nodes.screen.innerHTML,/Seu saldo está zerado/);assert.match(zero.nodes.screen.innerHTML,/confirme a simulação/);
  const {h,a,b}=await twoPlayers();await challenge(h,b,1000);
  assert.match(h.nodes.screen.innerHTML,/Seu saldo está reservado em partidas/);assert.doesNotMatch(h.nodes.screen.innerHTML,/Seu saldo está zerado/);
  assert.equal(h.persisted().profiles[a].balance,0);assert.equal(M.duelReservedPoints(h.persisted(),a),1000);
  h.route('#carteira');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/Seus créditos estão reservados em partidas/);assert.match(h.nodes.screen.innerHTML,/Sem valor financeiro/);
});

test('a guest choosing to create or add credits resumes the requested screen after account creation',async()=>{
  const creator=await harness();await creator.click('create');assert.match(creator.nodes.modalContent.innerHTML,/Criar conta/);
  await creator.submit('signup',{nickname:'Alex'});assert.equal(creator.location.hash,'#criar');assert.match(creator.nodes.screen.innerHTML,/<form data-form='duel'/);
  const payer=await harness();await payer.click('deposit');assert.match(payer.nodes.modalContent.innerHTML,/Criar conta/);
  await payer.submit('signup',{nickname:'Bruna'});assert.match(payer.nodes.modalContent.innerHTML,/data-form='deposit'/);
  assert.equal(payer.nodes.modal.open,true);assert.match(payer.nodes.modalContent.innerHTML,/nenhuma chave Pix|Não é gerada uma chave Pix/);
});

test('local wallet binds card installment selection, refusal, Pix approval and pending cancellation without real payment inputs',async()=>{
  const h=await harness();await h.click('signup');await h.submit('signup',{nickname:'Alex'});
  await h.click('deposit');h.document.getElementById('depositAmount').value='500';
  await h.click('payment-method','card');assert.match(h.nodes.modalContent.innerHTML,/6 parcelas/);
  assert.doesNotMatch(h.nodes.modalContent.innerHTML,/<input[^>]*(?:cvv|cardNumber|card-number|pan|accountNumber)/i);
  await h.submit('deposit',{amount:'500',method:'card',installments:'6'});let d=M.current(h.persisted()).depositRequests[0];
  assert.equal(d.installments,6);assert.equal(d.status,'pending');assert.equal(M.current(h.persisted()).balance,1000);assert.equal(h.location.hash,'#carteira');
  assert.match(h.nodes.modalContent.innerHTML,/Simular aprovação/);await h.click('deposit-reject',d.id);
  assert.equal(M.current(h.persisted()).depositRequests[0].status,'rejected');assert.equal(M.current(h.persisted()).balance,1000);
  await h.click('deposit');await h.submit('deposit',{amount:'250',method:'pix',installments:'1'});d=M.current(h.persisted()).depositRequests[0];
  await h.click('deposit-confirm',d.id);await h.click('deposit-confirm',d.id);
  assert.equal(M.current(h.persisted()).balance,1250);assert.equal(M.current(h.persisted()).transactions.filter(t=>t.ref===`demo-deposit:${d.id}`).length,1);
  assert.match(h.nodes.modalContent.innerHTML,/Créditos adicionados/);
  await h.click('deposit');await h.submit('deposit',{amount:'100',method:'card',installments:'1'});d=M.current(h.persisted()).depositRequests[0];await h.click('deposit-cancel',d.id);
  assert.equal(M.current(h.persisted()).depositRequests[0].status,'cancelled');assert.equal(M.current(h.persisted()).balance,1250);
  await h.click('close');h.route('#carteira');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/Extrato/);assert.match(h.nodes.screen.innerHTML,/Crédito simulado/);assert.match(h.nodes.screen.innerHTML,/1\.250/);
});

test('local transfer proof enters review, is shown to the owner and remains uncredited after reloading the wallet',async()=>{
  const h=await harness();await h.click('signup');await h.submit('signup',{nickname:'Alex'});
  await h.click('deposit');await h.submit('deposit',{amount:'1000',method:'transfer',installments:'1'});const id=M.current(h.persisted()).depositRequests[0].id;
  await h.click('deposit-proof',id);assert.match(h.nodes.modalContent.innerHTML,/Não envie dados bancários reais/);
  await h.submit('deposit-proof',{evidence:image});let s=h.persisted(),d=M.current(s).depositRequests[0];
  assert.equal(d.status,'review');assert.equal(d.receipt.evidenceDataUrl,photo);assert.equal(M.current(s).balance,1000);
  assert.match(h.nodes.modalContent.innerHTML,/Comprovante em análise/);assert.match(h.nodes.modalContent.innerHTML,/neste navegador/);
  assert.doesNotMatch(h.nodes.modalContent.innerHTML,/data-action='deposit-confirm'/);
  const reload=await harness({initial:s,url:'https://example.test/fifabet-arena/#carteira'});await new Promise(resolve=>setImmediate(resolve));
  assert.match(reload.nodes.screen.innerHTML,/Comprovante em análise/);assert.equal(M.current(reload.persisted()).balance,1000);
  await reload.click('deposit-details',id);assert.match(reload.nodes.modalContent.innerHTML,/data:image\/jpeg/);
  assert.match(reload.nodes.modalContent.innerHTML,/data-action='deposit-cancel'/);
  await reload.click('deposit-cancel',id);s=reload.persisted();d=M.current(s).depositRequests[0];
  assert.equal(d.status,'cancelled');assert.equal(d.receipt.evidenceDataUrl,photo);assert.equal(d.receipts.length,1);assert.equal(M.current(s).balance,1000);
  const cancelled=await harness({initial:s,url:'https://example.test/fifabet-arena/#carteira'});await new Promise(resolve=>setImmediate(resolve));
  await cancelled.click('deposit-details',id);assert.match(cancelled.nodes.modalContent.innerHTML,/Cancelado/);assert.match(cancelled.nodes.modalContent.innerHTML,/data:image\/jpeg/);
  assert.doesNotMatch(cancelled.nodes.modalContent.innerHTML,/data-action='deposit-confirm'/);assert.equal(M.current(cancelled.persisted()).balance,1000);
});

test('server wallet approval sends the displayed version and deposit creation uses the form idempotency key',async()=>{
  const calls=[];let deposit=null,balance=1000;
  const user={id:'payer-account',nickname:'Bruna',publicPlayerId:'FBA-BBBBBBBBBB',balance:1000,isReviewer:false};
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user:{...user,balance},duels:[],history:[],stats:{reserved:0}}),getWallet:async()=>({balance,reserved:0,transactions:[],deposits:deposit?[{...deposit}]:[]}),createDeposit:async data=>{calls.push(['create',{...data}]);deposit={id:'deposit-server',...data,status:'pending',version:1,createdAt:'2026-09-30T12:00:00.000Z'};return {deposit:{...deposit}};},simulateDeposit:async(id,data)=>{calls.push(['simulate',id,{...data}]);deposit.status='approved';deposit.version=2;balance+=deposit.amount;return {deposit:{...deposit}};}};
  const h=await harness({api});await h.click('deposit');const key=/data-operation='([^']+)'/.exec(h.nodes.modalContent.innerHTML)[1];
  await h.submit('deposit',{amount:'250',method:'pix',installments:'1'});assert.equal(balance,1000);assert.equal(h.location.hash,'#carteira');
  assert.deepEqual(calls[0],['create',{amount:250,method:'pix',installments:1,idempotencyKey:key}]);
  await h.click('deposit-confirm','deposit-server');assert.deepEqual(calls[1],['simulate','deposit-server',{mode:'demo',outcome:'approved',version:1}]);
  assert.equal(balance,1250);assert.match(h.nodes.modalContent.innerHTML,/Créditos adicionados/);assert.match(h.nodes.headerActions.innerHTML,/Bruna/);
});

test('server transfer review binds the authorized reviewer decision to the shown receipt version',async()=>{
  const calls=[];let reviewed=false;
  const user={id:'reviewer-account',nickname:'Equipe',publicPlayerId:'FBA-CCCCCCCCCC',balance:1000,isReviewer:true};
  const deposit={id:'transfer-server',owner:{id:'payer-account',nickname:'Bruna'},amount:500,method:'transfer',installments:1,status:'review',version:3,evidenceId:'receipt-private',createdAt:'2026-09-30T12:00:00.000Z'};
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],stats:{reserved:0}}),listReviews:async()=>({duels:[]}),listDepositReviews:async()=>({deposits:reviewed?[]:[deposit]}),depositEvidenceUrl:id=>`/api/v1/wallet/evidence/${id}`,reviewDeposit:async(id,data)=>{calls.push({id,...data});reviewed=true;return {};}};
  const h=await harness({api});h.route('#revisao');await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/receipt-private/);
  await h.click('deposit-review',deposit.id);assert.match(h.nodes.modalContent.innerHTML,/data-version='3'/);
  await h.submit('deposit-review',{decision:'approve',reason:'Comprovante fictício conferido pela equipe.'});
  assert.deepEqual(calls,[{id:'transfer-server',decision:'approve',reason:'Comprovante fictício conferido pela equipe.',version:3}]);
  assert.match(h.nodes.toast.textContent,/Transferência de teste aprovada/);
});
