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
  const parsed=new URL(url),location={hash:parsed.hash,href:url,pathname:parsed.pathname};
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
    const tag=[...node('modalContent').innerHTML.matchAll(/<form\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes(`data-form='${kind}'`));
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
  await h.click('login');await h.click('select-profile',a);return {h,a,b};
}
async function challenge(h,b,stake=100){
  await h.submit('duel',{rivalId:h.api.getState().profiles[b].publicPlayerId,stake:String(stake),mode:'1v1',rules:'Jogo único, seis minutos.'});
  return M.duelsForProfile(h.persisted())[0].id;
}
async function accept(h,b,id){await h.click('login');await h.click('select-profile',b);await h.click('accept',id);}

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
  h.route('#historico');assert.match(h.nodes.screen.innerHTML,/Alex/);assert.match(h.nodes.screen.innerHTML,/Em jogo/);
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
  h.failNextWrite();await h.submit('duel',{rivalId:h.api.getState().profiles[b].publicPlayerId,stake:'100',mode:'1v1',rules:''});
  assert.equal(JSON.stringify(h.api.getState()),before,'the in-memory state must not install an unsaved duel');
  assert.equal(h.persisted().profiles[a].balance,1000);assert.equal(Object.keys(h.persisted().duels).length,0);
  assert.match(h.nodes.toast.textContent,/salvar|espaço/);assert.equal(h.nodes.storageWarning.hidden,false);
  const switched=M.change(h.persisted(),'login',{id:b});h.localStorage.setItem(M.STORAGE_KEY,JSON.stringify(switched));
  await h.submit('duel',{rivalId:h.api.getState().profiles[b].publicPlayerId,stake:'100',mode:'1v1',rules:''});
  assert.match(h.nodes.toast.textContent,/perfil mudou/);assert.equal(h.persisted().activeProfileId,b);assert.equal(h.persisted().profiles[b].balance,1000);
});

test('server invite prompts authentication and becomes accepted only from the authenticated guest account',async()=>{
  const calls=[];let loggedIn=false,accepted=false;
  const user={id:'guest-account',nickname:'Bruna',publicPlayerId:'FBA-BBBBBBBBBB',balance:1000,isReviewer:false};
  const duel={id:'server-duel',hostId:'host-account',guestId:null,recipientId:user.id,host:{id:'host-account',nickname:'Alex',publicPlayerId:'FBA-AAAAAAAAAA'},recipient:user,stake:100,mode:'1v1',rules:'Jogo único.',status:'invited',createdAt:'2026-09-30T12:00:00.000Z'};
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user:null}),loginAccount:async data=>{calls.push(['login',data]);loggedIn=true;return {user};},getArena:async()=>({user:loggedIn?{...user,balance:accepted?900:1000}:null,duels:accepted?[{...duel,guestId:user.id,guest:user,status:'in_progress'}]:[],history:[],stats:{reserved:accepted?100:0}}),getInvite:async token=>{assert.equal(loggedIn,true);calls.push(['invite',token]);return {invite:duel};},acceptInvite:async token=>{assert.equal(loggedIn,true);calls.push(['accept',token]);accepted=true;return {};}};
  const h=await harness({api,url:'https://example.test/?convite=secret-token#arena'});
  assert.equal(h.api.isOnline(),true);assert.match(h.nodes.modalContent.innerHTML,/Entre ou crie/);assert.deepEqual(calls,[]);
  await h.click('login');assert.match(h.nodes.modalContent.innerHTML,/Apelido ou ID FifaBet/);await h.submit('login',{nickname:'Bruna',password:'a secure passphrase'});
  assert.equal(h.nodes.modal.open,true);assert.match(h.nodes.modalContent.innerHTML,/Alex te chamou/);assert.match(h.nodes.modalContent.innerHTML,/Aceitar desafio/);
  await h.click('accept-invite');assert.equal(accepted,true);assert.equal(h.location.href,'https://example.test/#arena');
  assert.equal(h.nodes.modal.open,false);assert.match(h.nodes.screen.innerHTML,/Enviar placar/);assert.deepEqual(calls.map(x=>x[0]),['login','invite','accept']);
});

test('only a server reviewer gets review navigation and decisions carry the photo report revision to the API',async()=>{
  const calls=[];
  const user={id:'reviewer-account',nickname:'Equipe',publicPlayerId:'FBA-CCCCCCCCCC',balance:1000,isReviewer:true};
  const duel={id:'review-duel',hostId:'host-account',guestId:'guest-account',host:{id:'host-account',nickname:'Alex'},guest:{id:'guest-account',nickname:'Bruna'},stake:100,mode:'1v1',status:'pending_review',createdAt:'2026-09-30T12:00:00.000Z',result:{id:'report-current',reporterId:'host-account',homeScore:3,awayScore:1,evidenceId:'photo-current',confirmedBy:'guest-account'},disputes:[]};
  let completed=false;
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],stats:{reserved:0}}),listReviews:async()=>({duels:completed?[]:[duel]}),reviewDuel:async(id,data)=>{calls.push({id,...data});completed=true;return {};}};
  const h=await harness({api});assert.match(h.nodes.navigation.innerHTML,/Revisão/);h.route('#revisao');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/photo-current/);await h.click('review',duel.id);
  assert.match(h.nodes.modalContent.innerHTML,/data-report='report-current'/);
  await h.submit('review',{winner:'host',reason:'Foto e placar conferidos pela equipe.'},{id:duel.id,report:'report-current'});
  assert.deepEqual(calls,[{id:duel.id,reportId:'report-current',winner:'host',reason:'Foto e placar conferidos pela equipe.'}]);
  assert.match(h.nodes.toast.textContent,/revisado e pontos distribuídos/);
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
