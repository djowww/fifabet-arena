import {createRenderGate,filterRooms,mergeRecords} from './room-ui.mjs';
import {createAppNotifications} from './app-notifications.mjs';
import {createAccountTools} from './account-tools.mjs';
import {renderReviewEvidence} from './review-evidence.mjs';
import * as resultPhases from './result-phases.mjs';
import * as reviewTools from './review-tools.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as M from './model.mjs';
import {COUNTRY_CODES,TERMS_VERSION} from './account-policy.mjs';
import {createAdminPanel} from './admin-panel.mjs';
import {accountArt} from './account-art.mjs';
import {uiIcon} from './ui-icons.mjs';
import {renderLobbyView} from './lobby-view.mjs';
import {renderWalletView,renderHistoryView,renderRankingView,renderProfileView} from './account-views.mjs';
import {confirmationClock,safeRoomCards,notificationKey,notificationLabel,preparationState} from './room-ui.mjs';

import {createChatState,renderChatMessages,nearChatBottom} from './chat-ui.mjs';
const source=fs.readFileSync(new URL('./play.js',import.meta.url),'utf8');
const image={type:'image/jpeg',size:1000};
const photo='data:image/jpeg;base64,cGxhY2Fy';
test('game compatibility and structured rules are visible before a room is created',async()=>{
 const {h}=await preparationHarness();h.route('#criar');assert.match(h.nodes.screen.innerHTML,/name='gameEdition'/);assert.match(h.nodes.screen.innerHTML,/name='consoleGeneration'/);assert.match(h.nodes.screen.innerHTML,/name='crossplay'/);
 await h.click('profile');assert.match(h.nodes.modalContent.innerHTML,/name='eaId'/);assert.match(h.nodes.modalContent.innerHTML,/name='psnId'/);assert.match(h.nodes.modalContent.innerHTML,/name='xboxId'/);
});
test('closing a modal flushes a rival readiness update even after an unchanged poll',async()=>{
 const {h,duel,user}=await preparationHarness();await h.click('help');duel.readyBy=[user.id];await h.intervals.find(x=>x.delay===8000).callback();await h.intervals.find(x=>x.delay===8000).callback();assert.ok(!h.nodes.screen.innerHTML.includes('Ainda não estou pronto'));await h.click('close');assert.match(h.nodes.screen.innerHTML,/Ainda não estou pronto/);
});
test('review-phase issue report remains available to the original result reporter',async()=>{
 const {h,duel,user}=await preparationHarness();duel.status='pending_review';duel.result={id:'report',reporterId:user.id,homeScore:1,awayScore:0};await h.click('refresh');assert.match(h.nodes.screen.innerHTML,/data-action='issue'/);await h.click('issue',duel.id);assert.match(h.nodes.modalContent.innerHTML,/data-form='issue'/);
});
test('wallet polling preserves an open form and applies newest transactions first on close',async()=>{
 const user={id:'wallet-owner',nickname:'Alex',publicPlayerId:'FBA-1234567890',balance:10};let revision='one',wallet={balance:10,reserved:0,transactions:[{id:'old',label:'Saldo anterior',amount:10,date:'2026-10-01T12:00:00Z'}],deposits:[],revision};
 const h=await harness({api:{detectBackend:async()=>({available:true,paymentMode:'unconfigured'}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],walletRevision:revision,stats:{reserved:0}}),getWallet:async()=>wallet},url:'https://example.test/#carteira'});await new Promise(resolve=>setImmediate(resolve));await h.click('help');const modal=h.nodes.modalContent.innerHTML;
 revision='two';wallet={...wallet,balance:30,revision,transactions:[{id:'new',label:'Crédito recebido',amount:20,date:'2026-10-02T12:00:00Z'}]};await h.intervals.find(x=>x.delay===8000).callback();assert.equal(h.nodes.modalContent.innerHTML,modal);assert.ok(!h.nodes.screen.innerHTML.includes('Crédito recebido'));await h.click('close');await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/30/);assert.ok(h.nodes.screen.innerHTML.indexOf('Crédito recebido')<h.nodes.screen.innerHTML.indexOf('Saldo anterior'));
});
test('wallet remote refresh keeps a cursor for a gap larger than the first page',async()=>{
 const user={id:'wallet-page-owner',nickname:'Alex',publicPlayerId:'FBA-1234567890',balance:10};let revision='one';const cursors=[];
 const data=()=>({balance:10,reserved:0,revision,deposits:[],transactions:[{id:revision,label:revision,amount:1,date:revision==='one'?'2026-10-01T12:00:00Z':'2026-10-02T12:00:00Z'}],transactionsNextCursor:revision==='one'?'older':'gap'});
 const h=await harness({api:{detectBackend:async()=>({available:true}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],walletRevision:revision,stats:{reserved:0}}),getWallet:async options=>{if(options?.cursor){cursors.push(options.cursor);return {...data(),transactions:[{id:'middle',label:'Movimentação entre as páginas',amount:1,date:'2026-10-01T18:00:00Z'}],transactionsNextCursor:'older'};}return data();}},url:'https://example.test/#carteira'});await new Promise(resolve=>setImmediate(resolve));revision='two';await h.intervals.find(x=>x.delay===8000).callback();await new Promise(resolve=>setImmediate(resolve));await h.click('wallet-more-transactions');assert.deepEqual(cursors,['gap']);assert.match(h.nodes.screen.innerHTML,/Movimentação entre as páginas/);
});
test('history polling updates a loaded reviewed result instead of leaving its cached score stale',async()=>{
 const {user,duel}=preparingFixture();duel.status='completed';duel.winnerId=user.id;duel.result={id:'history-result',reporterId:user.id,homeScore:1,awayScore:0};const copy=()=>structuredClone(duel);
 const h=await harness({api:{detectBackend:async()=>({available:true}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[copy()],stats:{reserved:0}}),getHistory:async()=>({items:[copy()],nextCursor:null})},url:'https://example.test/#historico'});await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/0 × 1/);duel.result.homeScore=3;await h.intervals.find(x=>x.delay===8000).callback();await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/0 × 3/);
});
test('the lobby retains an operational review notice after its toast disappears',async()=>{
 const {user,duel}=preparingFixture();const h=await harness({api:{detectBackend:async()=>({available:true}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[duel],history:[],stats:{reserved:0},notifications:[{id:'timeout',type:'review',duelId:duel.id,message:'Atendimento da equipe para sua partida atrasada.',createdAt:'2026-10-02T12:00:00Z'}]})}});assert.match(h.nodes.screen.innerHTML,/Atendimento da equipe para sua partida atrasada/);
});
test('switching accounts without logout cannot expose the previous cached history while the new history loads',async()=>{
 const a={id:'history-a',nickname:'ContaA',publicPlayerId:'FBA-AAAAAAAAAA',balance:0},b={id:'history-b',nickname:'ContaB',publicPlayerId:'FBA-BBBBBBBBBB',balance:0};let current=a,resolveB;const pendingB=new Promise(resolve=>resolveB=resolve);const match=owner=>({id:`private-${owner.id}`,hostId:owner.id,guestId:'rival',host:owner,guest:{id:'rival',nickname:owner===a?'SEGREDO-HISTORICO-A':'RivalB'},status:'completed',mode:'1v1',stake:0,platform:'pc',createdAt:'2026-10-02T12:00:00Z',result:null});
 const h=await harness({api:{detectBackend:async()=>({available:true}),loadSession:async()=>({user:current}),getArena:async()=>({user:current,duels:[],history:[],stats:{reserved:0}}),getHistory:async()=>current===a?{items:[match(a)],nextCursor:'cursor-a'}:pendingB,loginAccount:async()=>{current=b;}},url:'https://example.test/#historico'});await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/SEGREDO-HISTORICO-A/);await h.click('login');await h.submit('login',{nickname:b.nickname,password:'senha-local-longa'});assert.ok(!h.nodes.screen.innerHTML.includes('private-history-a'));assert.ok(!h.nodes.screen.innerHTML.includes('cursor-a'));resolveB({items:[match(b)],nextCursor:null});await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/RivalB/);
});
test('a late history search error from the previous account cannot appear in the new account',async()=>{
 const a={id:'search-a',nickname:'ContaA',publicPlayerId:'FBA-AAAAAAAAAA',balance:0},b={id:'search-b',nickname:'ContaB',publicPlayerId:'FBA-BBBBBBBBBB',balance:0};let current=a,rejectOld;const pending=new Promise((_resolve,reject)=>rejectOld=reject);
 const h=await harness({api:{detectBackend:async()=>({available:true}),loadSession:async()=>({user:current}),getArena:async()=>({user:current,duels:[],history:[],stats:{reserved:0}}),getHistory:async options=>current===a&&options.search?pending:{items:[],nextCursor:null},loginAccount:async()=>{current=b;}},url:'https://example.test/#historico'});await new Promise(resolve=>setImmediate(resolve));
 // Search transport is held while the human switches accounts through the real login flow.
 h.listeners.input({target:{id:'historySearch',value:'privado-a',selectionStart:9,closest:()=>null}});const searching=h.runTimeout(250);
 await h.click('login');await h.submit('login',{nickname:b.nickname,password:'senha-local-longa'});rejectOld(Error('SEGREDO-ERRO-A'));await searching;await new Promise(resolve=>setImmediate(resolve));assert.ok(![h.nodes.toast?.textContent,h.nodes.dialogError?.textContent,h.nodes.roomError?.textContent].join(' ').includes('SEGREDO-ERRO-A'));
});
test('wallet revision invalidates an older loaded deposit rather than retaining its obsolete pending status',async()=>{
 const user={id:'deposit-owner',nickname:'Alex',publicPlayerId:'FBA-1234567890',balance:0};let revision='one';const recent=Array.from({length:20},(_,i)=>({id:`recent-${i}`,amount:50,status:'approved',method:'pix',createdAt:'2026-10-02T12:00:00Z'})),old={id:'private-older-deposit',amount:100,status:'pending',method:'pix',createdAt:'2026-10-01T12:00:00Z'};
 const h=await harness({api:{detectBackend:async()=>({available:true}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],walletRevision:revision,stats:{reserved:0}}),getWallet:async options=>({balance:0,reserved:0,transactions:[],revision,deposits:options?.depositCursor?[{...old}]:recent,depositsNextCursor:options?.depositCursor?null:'older'})},url:'https://example.test/#carteira'});await new Promise(resolve=>setImmediate(resolve));await h.click('wallet-more-deposits');await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/private-older-deposit/);old.status='approved';revision='two';await h.intervals.find(x=>x.delay===8000).callback();await new Promise(resolve=>setImmediate(resolve));assert.ok(!h.nodes.screen.innerHTML.includes('private-older-deposit'));await h.click('wallet-more-deposits');await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/private-older-deposit/);assert.ok(!h.nodes.screen.innerHTML.includes('Aguardando confirmação'));
});
test('an open older Pix detail retains its actions after wallet page invalidation until its modal closes',async()=>{
 const user={id:'pix-owner',nickname:'Alex',publicPlayerId:'FBA-1234567890',balance:0};let revision='one';const calls=[],recent=Array.from({length:20},(_,i)=>({id:`recent-${i}`,amount:50,status:'approved',method:'pix',createdAt:'2026-10-02T12:00:00Z'})),old={id:'older-pix',userId:user.id,amount:100,status:'pending',method:'pix',paymentMode:'pix_manual',priceCents:1000,version:7,paymentInfo:{pixKey:'recebedor@example.test',amountCents:1000},createdAt:'2026-10-01T12:00:00Z'};
 const h=await harness({api:{detectBackend:async()=>({available:true}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],walletRevision:revision,stats:{reserved:0}}),getWallet:async options=>({balance:0,reserved:0,transactions:[],revision,deposits:options?.depositCursor?[{...old}]:recent,depositsNextCursor:options?.depositCursor?null:'older'}),uploadDepositProof:async(_file,id,version)=>{assert.equal(id,old.id);assert.equal(version,7);return {deposit:{...old,status:'review',version:8}};},cancelDeposit:async(id,version)=>{calls.push([id,version]);return {deposit:{...old,status:'cancelled',version:9}};}},url:'https://example.test/#carteira'});await new Promise(resolve=>setImmediate(resolve));await h.click('wallet-more-deposits');await h.click('deposit-details',old.id);revision='two';await h.intervals.find(x=>x.delay===8000).callback();await h.click('copy-pix',old.id);assert.deepEqual(h.copies,['recebedor@example.test']);await h.click('deposit-proof',old.id);assert.match(h.nodes.modalContent.innerHTML,/data-version='7'/);await h.submit('deposit-proof',{evidence:new Blob(['photo'],{type:'image/jpeg'})});assert.match(h.nodes.modalContent.innerHTML,/Comprovante recebido/);await h.click('deposit-cancel',old.id);assert.deepEqual(calls,[[old.id,8]]);assert.ok(!h.nodes.screen.innerHTML.includes(old.id));await h.click('close');await h.click('copy-pix',old.id);assert.equal(h.copies.length,1);
});
test('history revision invalidates an older active page after the match leaves the compact active projection',async()=>{
 const {user,duel:old}=preparingFixture();old.id='private-older-active';old.status='in_progress';const recent=Array.from({length:20},(_,i)=>({...old,id:`newer-${i}`,status:'completed',createdAt:'2026-10-03T12:00:00Z'}));
 const h=await harness({api:{detectBackend:async()=>({available:true}),loadSession:async()=>({user}),getArena:async()=>({user,duels:old.status==='in_progress'?[structuredClone(old)]:[],history:recent,stats:{reserved:0}}),getHistory:async options=>({items:options?.cursor?[structuredClone(old)]:recent,nextCursor:options?.cursor?null:'older'})},url:'https://example.test/#historico'});await new Promise(resolve=>setImmediate(resolve));await h.click('history-more');assert.match(h.nodes.screen.innerHTML,/private-older-active/);old.status='completed';await h.intervals.find(x=>x.delay===8000).callback();await new Promise(resolve=>setImmediate(resolve));assert.ok(!h.nodes.screen.innerHTML.includes('private-older-active'));await h.click('history-more');assert.match(h.nodes.screen.innerHTML,/private-older-active/);assert.ok(!h.nodes.screen.innerHTML.includes('Partida em andamento'));
});
test('compatibility and match-rule drafts survive a deferred render before their wizard step is submitted',async()=>{
 const {h,duel}=await preparationHarness();h.route('#criar');const input=(id,value)=>h.listeners.input({target:{id,value,closest:()=>null}});input('matchEdition','FC privado 26');input('matchGeneration','PS5');await h.listeners.change({target:{dataset:{},id:'matchCrossplay',value:'enabled',closest:()=>null}});duel.readyBy.push(duel.readyBy.length?duel.guestId:duel.hostId);await h.intervals.find(x=>x.delay===8000).callback();await h.click('close');assert.match(h.nodes.screen.innerHTML,/value='FC privado 26'/);assert.match(h.nodes.screen.innerHTML,/value='PS5'/);assert.match(h.nodes.screen.innerHTML,/value='enabled' selected/);
 await h.submit('duel',{rivalId:'',mode:'1v1',platform:'pc',visibility:'public',gameEdition:'FC privado 26',consoleGeneration:'PS5',crossplay:'enabled'});await h.listeners.change({target:{dataset:{},id:'matchExtraTime',checked:true,closest:()=>null}});await h.listeners.change({target:{dataset:{},id:'matchPenalties',checked:true,closest:()=>null}});duel.readyBy.push(duel.readyBy.length?duel.guestId:duel.hostId);await h.intervals.find(x=>x.delay===8000).callback();await h.click('close');assert.match(h.nodes.screen.innerHTML,/name='extraTime' checked/);assert.match(h.nodes.screen.innerHTML,/name='penalties' checked/);
});
async function harness({initial=M.emptyState(),api={},url='https://example.test/fifabet-arena/#arena',bitmapFactory}={}){
  const nodes={},listeners={},windowListeners={},stored=new Map([[M.STORAGE_KEY,JSON.stringify(initial)]]),copies=[],intervals=[],timers=new Map();let timerId=0;
  let failWrite=false;
  function node(id){return nodes[id]??={id,innerHTML:'',textContent:'',value:'',hidden:false,open:false,isConnected:true,disabled:false,files:[],dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},remove(){},append(){},insertAdjacentHTML(_position,html){this.innerHTML+=html;},contains(){return false;},querySelector(){return null;},querySelectorAll(){return [];},focus(){document.activeElement=this;},setSelectionRange(){},showModal(){this.open=true;},close(){this.open=false;},getBoundingClientRect(){return {left:0,right:500,top:0,bottom:500};},addEventListener(name,callback){this[name]=callback;}};}
  const document={getElementById:node,activeElement:null,hidden:false,querySelectorAll(){return [];},addEventListener(name,callback){listeners[name]=callback;},createElement(tag){if(tag==='button')return {...node(`button-${copies.length}`)};assert.equal(tag,'canvas');return {width:0,height:0,getContext(){return {drawImage(){},fillRect(){}};},toBlob(callback){callback(new Blob(['photo'],{type:'image/jpeg'}));},toDataURL(){return photo;}};}};
  const parsed=new URL(url),location={hash:parsed.hash,href:url,pathname:parsed.pathname,origin:parsed.origin};
  const localStorage={getItem:key=>stored.get(key)??null,setItem(key,value){if(failWrite){failWrite=false;throw Error('quota');}stored.set(key,String(value));},removeItem:key=>stored.delete(key)};
  const API={detectBackend:async()=>null,evidenceUrl:id=>`/api/v1/evidence/${id}`,listDepositRecoveries:async()=>({deposits:[]}),getDeletionRequests:async()=>({requests:[]}),getRooms:async()=>({rooms:[]}),...api};
  const context={createRenderGate,filterRooms,mergeRecords,M,API,COUNTRY_CODES,TERMS_VERSION,createAdminPanel,accountArt,uiIcon,renderLobbyView,renderWalletView,renderHistoryView,renderRankingView,renderProfileView,confirmationClock,safeRoomCards,notificationKey,notificationLabel,preparationState,createChatState,renderChatMessages,nearChatBottom,document,localStorage,sessionStorage:localStorage,location,window:{addEventListener(name,callback){windowListeners[name]=callback;},scrollTo(){}},history:{replaceState(_state,_title,value){location.href=new URL(value,location.href).href;location.hash=new URL(location.href).hash;}},navigator:{clipboard:{async writeText(value){copies.push(value);}}},crypto,URL,Blob,console,clearTimeout(id){timers.delete(id);},setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},setInterval(callback,delay){intervals.push({callback,delay});return intervals.length;},createImageBitmap:bitmapFactory||(async()=>({width:1280,height:720,close(){}})),fetch:async()=>({async blob(){return new Blob(['photo'],{type:'image/jpeg'});}}),FileReader:class{readAsDataURL(){this.result=photo;this.onload();}},FormData:class{constructor(form){this.fields=form.fields;}get(key){return this.fields[key]??null;}}};
  Object.assign(context,resultPhases,reviewTools,{AbortController,createAccountTools,renderReviewEvidence,
    createAppNotifications:options=>createAppNotifications({storage:context.localStorage,Notification:context.Notification,hidden:()=>context.document.hidden===true,onOpen:id=>{context.location.hash=`#partida/${id}`;},...options})});
  vm.createContext(context);
  context.prepareEvidencePhoto=vm.runInContext(`(()=>{${fs.readFileSync(new URL('./image-preparation.mjs',import.meta.url),'utf8').replace(/^export /gm,'')}return preparePhoto;})()`,context);
  const code=source.replace(/^import .*?;\r?\n/gm,'').replace(/\nstart\(\)\.catch\(/,'\nglobalThis.__boot=start().catch(');
  vm.runInContext(code+`\nglobalThis.practical={getState:()=>state,getArena:()=>arena,isOnline:()=>online,duels,render,getChat:()=>privateChat.current(),loadRoomChat,sendRoomChat,updateRoomWhileTyping};`,context);
  await context.__boot;
  const click=async(action,id)=>{
    const button={dataset:{action,id},disabled:false,isConnected:true};
    await listeners.click({preventDefault(){},target:{closest(selector){if(selector==='.skip-link'||selector==='.sidebar a[href]')return null;assert.equal(selector,'[data-action]');return button;}}});
  };
  const submit=async(kind,fields={},dataset={})=>{
    const button={disabled:false,isConnected:true};
    const surfaces=node('modal').open?[node('modalContent').innerHTML,node('screen').innerHTML]:[node('screen').innerHTML,node('modalContent').innerHTML];
    const tag=surfaces.flatMap(html=>[...html.matchAll(/<form\b[^>]*>/g)].map(match=>match[0])).find(tag=>tag.includes(`data-form='${kind}'`));
    const captured={};if(tag)for(const [,name,value]of tag.matchAll(/data-([a-z-]+)='([^']*)'/g))captured[name.replace(/-([a-z])/g,(_match,letter)=>letter.toUpperCase())]=value;
    const elements=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,{...node(`field-${key}`),value:typeof value==='string'?value:'',checked:value===true||value==='yes'}]));
    const form={isConnected:true,dataset:{form:kind,...captured,...dataset},fields,elements,querySelector(selector){if(selector==='#resultImage')return {files:fields.evidence?[fields.evidence]:[]};return button;},querySelectorAll(){return Object.values(elements);}};
    let selection;
    if(['result','confirm-result','dispute'].includes(kind)&&fields.evidence){selection=listeners.change({target:{dataset:{},id:'resultImage',files:[fields.evidence],isConnected:true,closest(selector){return selector==='[data-form]'?form:null;}}});}
    await listeners.submit({preventDefault(){},target:{closest(selector){assert.equal(selector,'[data-form]');return form;}}});
    await selection;
  };
  const route=hash=>{location.hash=hash;windowListeners.hashchange();};
  const persisted=()=>M.restore(stored.get(M.STORAGE_KEY));
  const runTimeout=delay=>{const found=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(found,`Expected scheduled timeout at ${delay}ms`);timers.delete(found[0]);return found[1].callback();};
  return {runTimeout,nodes,document,listeners,windowListeners,localStorage,location,copies,click,submit,route,intervals,api:context.practical,persisted,failNextWrite(){failWrite=true;}};
}
async function fundLocal(h){await h.click('deposit');await h.submit('deposit',{amount:'1000',method:'pix',installments:'1'});const deposit=M.current(h.persisted()).depositRequests[0];assert.ok(deposit,JSON.stringify({modal:h.nodes.modalContent?.innerHTML,error:h.nodes.dialogError?.textContent,room:h.nodes.roomError?.textContent,toast:h.nodes.toast?.textContent}));await h.click('deposit-confirm',deposit.id);await h.click('close');h.route('#arena');}
async function twoPlayers(){
  const h=await harness();await h.click('signup');await h.submit('signup',{nickname:'Alex'});const a=h.api.getState().activeProfileId;
  await fundLocal(h);await h.click('signup');await h.submit('signup',{nickname:'Bruna'});const b=h.api.getState().activeProfileId;await fundLocal(h);
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
  const h=await harness();assert.match(h.nodes.screen.innerHTML,/data-form='join'/);assert.match(h.nodes.screen.innerHTML,/data-action=["']create["']/);
  assert.equal([...h.nodes.screen.innerHTML.matchAll(/class="taste-home-hero"/g)].length,1);assert.equal([...h.nodes.screen.innerHTML.matchAll(/class="taste-invite-strip"/g)].length,1);
  assert.match(h.nodes.screen.innerHTML,/Criar perfil local/);assert.doesNotMatch(h.nodes.screen.innerHTML,/DISPONÍVEIS|RESERVADOS|data-action='deposit'/);assert.doesNotMatch(h.nodes.screen.innerHTML,/<form data-form='duel'/);
  assert.match(h.nodes.screen.innerHTML,/Ilustração original/);assert.doesNotMatch(h.nodes.screen.innerHTML,/lobby-game-mark/);
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
  assert.match(h.nodes.screen.innerHTML,/Partida encerrada/);assert.match(h.nodes.screen.innerHTML,/500/);
  h.route('#historico');assert.match(h.nodes.screen.innerHTML,/Alex/);assert.match(h.nodes.screen.innerHTML,/Partida em andamento/);
});

test('UI photo submission maps creator/guest scores correctly and peer confirmation keeps points reserved after reload',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b);await accept(h,b,id);
  await h.click('result',id);assert.match(h.nodes.modalContent.innerHTML,/Alex/);assert.match(h.nodes.modalContent.innerHTML,/Bruna/);
  await h.submit('result',{homeScore:'4',awayScore:'1',evidence:image},{id});
  let s=h.persisted();assert.equal(s.duels[id].report.homeScore,4);assert.equal(s.duels[id].report.awayScore,1);
  assert.equal(s.duels[id].report.submittedBy,b);assert.equal(s.duels[id].report.evidenceDataUrl,photo);
  assert.equal(s.duels[id].status,'review');assert.doesNotMatch(h.nodes.screen.innerHTML,/data-action='confirm'/);
  await h.click('login');await h.click('select-profile',a);
  assert.match(h.nodes.screen.innerHTML,/Enviar minha foto e confirmar/);await h.click('confirm',id);
  s=h.persisted();assert.equal(s.duels[id].peerConfirmed,true);assert.equal(s.profiles[a].balance,900);assert.equal(s.profiles[b].balance,900);
  assert.match(h.nodes.screen.innerHTML,/equipe|revisão/);assert.doesNotMatch(h.nodes.screen.innerHTML,/data-action='review'/);
  const reload=await harness({initial:s,url:`https://example.test/#partida/${id}`});assert.match(reload.nodes.screen.innerHTML,/4 × 1/);assert.match(reload.nodes.screen.innerHTML,/equipe|revisão/);
  assert.equal(M.duelReservedPoints(reload.persisted(),a),100);
});

test('a divergence can be submitted through the UI with its photo and bilateral cancellation remains available locally',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b);await accept(h,b,id);
  await h.submit('result',{homeScore:'2',awayScore:'0',evidence:image},{id});
  await h.click('login');await h.click('select-profile',a);await h.click('dispute',id);
  await h.submit('dispute',{reason:'A foto mostra que o resultado foi diferente.',evidence:image},{id});
  let s=h.persisted();assert.equal(s.duels[id].status,'disputed');assert.equal(s.duels[id].disputes.length,1);
  assert.equal(s.duels[id].disputes[0].evidenceDataUrl,photo);assert.match(h.nodes.screen.innerHTML,/Enviar novo placar/);
  h.route('#salas');await h.click('arena-tab','mine');
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
  assert.match(h.nodes.screen.innerHTML,/Partida encerrada/);assert.equal(h.persisted().profiles[a].balance,750);assert.equal(h.persisted().profiles[b].balance,750);
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
  assert.equal(h.nodes.modal.open,true);assert.match(h.nodes.modalContent.innerHTML,/Alex te chamou/);assert.match(h.nodes.modalContent.innerHTML,/Aceitar e entrar na sala/);
  await h.click('accept-invite');assert.equal(accepted,true);assert.equal(h.location.href,'https://example.test/#arena');
  assert.equal(h.nodes.modal.open,false);assert.match(h.nodes.screen.innerHTML,/1 partida em andamento/);assert.deepEqual(calls.map(x=>x[0]),['login','invite','accept']);
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
  assert.match(h.nodes.modalContent.innerHTML,/name='confirmEvidence' required/);
  await h.submit('review',{winner:'host',reason:'Foto e placar conferidos pela equipe.'},{id:duel.id,report:'report-current'});
  assert.deepEqual(calls,[]);assert.match(h.nodes.dialogError.textContent,/Confirme a conferência/);
  await h.submit('review',{winner:'host',reason:'Foto e placar conferidos pela equipe.',confirmEvidence:'yes'},{id:duel.id,report:'report-current'});
  assert.deepEqual(calls,[{id:duel.id,reportId:'report-current',winner:'host',reason:'Foto e placar conferidos pela equipe.'}]);
  assert.match(h.nodes.toast.textContent,/Resultado revisado e registrado/);
});

test('a server cancellation request keeps a path to continue the match instead of trapping both accounts',async()=>{
  const user={id:'guest-account',nickname:'Bruna',publicPlayerId:'FBA-BBBBBBBBBB',balance:900,isReviewer:false};
  const duel={id:'active-duel',hostId:'host-account',guestId:user.id,host:{id:'host-account',nickname:'Alex'},guest:user,stake:100,mode:'1v1',status:'in_progress',createdAt:'2026-09-30T12:00:00.000Z',result:null,cancellationRequestedBy:['host-account']};
  const withdrawals=[];
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[duel],history:[],stats:{reserved:100}}),withdrawCancellation:async id=>{withdrawals.push(id);duel.cancellationRequestedBy=[];return {};}};
  const h=await harness({api,url:'https://example.test/#partida/active-duel'});assert.match(h.nodes.screen.innerHTML,/Confirmar cancelamento/);
  assert.match(h.nodes.screen.innerHTML,/Enviar placar|Recusar cancelamento/,'an account must be able to continue when it does not agree to cancel');
  if(h.nodes.screen.innerHTML.includes("data-action='withdraw-cancel'")){await h.click('withdraw-cancel',duel.id);assert.deepEqual(withdrawals,[duel.id]);h.route(`#partida/${duel.id}`);assert.match(h.nodes.screen.innerHTML,/Partida encerrada/);}
});

test('a proposal changed in another tab while the contestation photo is prepared is never contested without a new check',async()=>{
  let s=M.change(M.emptyState(),'create',{nickname:'Alex'});const a=s.activeProfileId;
  s=M.change(s,'create',{nickname:'Bruna'});const b=s.activeProfileId;
  s.profiles[a].balance=1000;s.profiles[b].balance=1000;
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
  assert.match(h.nodes.roomError?.textContent||h.nodes.toast?.textContent,/mudou|atual|reabra|Reabra/);
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
  assert.match(h.nodes.screen.innerHTML,/Seu jogo tem história/);assert.doesNotMatch(h.nodes.screen.innerHTML,/ranking-you/);
  h.route('#ranking');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/Faça seu nome/);assert.match(h.nodes.screen.innerHTML,/Bruna<span class='ranking-you'>você/);
  assert.match(h.nodes.screen.innerHTML,/<td>3<\/td><td>2<\/td><td>1<\/td><td>0<\/td>/);assert.equal(requests,2);
});

test('joining by a local code shows the actual invitation and requires a separate acceptance from its recipient',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b,250),code=h.persisted().duels[id].publicDuelId;
  assert.equal(h.location.hash,`#partida/${id}`);assert.match(h.nodes.modalContent.innerHTML,/Código da partida/);
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
  assert.match(h.nodes.screen.innerHTML,/Confira o convite/);h.route('#salas');await h.click('arena-tab','mine');assert.match(h.nodes.screen.innerHTML,/Recebidos \(1\)/);
  await h.click('accept',id);assert.equal(h.persisted().duels[id].status,'active');
  assert.equal(h.persisted().profiles[a].balance,750);assert.equal(h.persisted().profiles[b].balance,750);
  assert.match(h.nodes.screen.innerHTML,/Partida em andamento/);assert.match(h.nodes.toast.textContent,/atualizado|aceito/);
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
    assert.match(h.nodes.modalContent.innerHTML,/Nenhum Coin foi reservado/);assert.equal(h.api.getArena().user.balance,1000);assert.equal(accepts,0);
  }
});

test('the invite owner and an account without enough credits cannot accept from the displayed invitation',async()=>{
  const {h,a,b}=await twoPlayers(),id=await challenge(h,b,500);
  await h.click('close');
  await h.submit('join',{code:h.persisted().duels[id].publicDuelId});assert.match(h.nodes.joinError.textContent,/próprio convite/);
  await h.click('login');await h.click('select-profile',b);
  const depleted=M.change(h.persisted(),'purchaseSticker',{id:'cristiano-ronaldo'});h.localStorage.setItem(M.STORAGE_KEY,JSON.stringify(depleted));h.windowListeners.storage({key:M.STORAGE_KEY});
  const before=JSON.stringify(h.persisted());await h.click('accept-preview',id);
  assert.match(h.nodes.modalContent.innerHTML,/Saldo insuficiente/);assert.match(h.nodes.modalContent.innerHTML,/Adicionar Joga aí Coin de teste/);
  assert.doesNotMatch(h.nodes.modalContent.innerHTML,/data-action='accept'/);assert.equal(JSON.stringify(h.persisted()),before);
  await h.click('accept',id);assert.match(h.nodes.dialogError.textContent,/insuficiente/);
  assert.equal(JSON.stringify(h.persisted()),before);assert.equal(h.persisted().profiles[a].balance,500);assert.equal(h.persisted().profiles[b].balance,300);
  assert.equal(h.persisted().duels[id].status,'invited');assert.equal(M.duelReservedPoints(h.persisted(),b),0);
});

test('the empty wallet distinguishes a guest, a zero available balance and credits already reserved',async()=>{
  const guest=await harness();assert.match(guest.nodes.screen.innerHTML,/começa com saldo zero/);
  assert.doesNotMatch(guest.nodes.screen.innerHTML,/DISPONÍVEIS|RESERVADOS|Seu saldo está zerado/);
  const empty=M.change(M.emptyState(),'create',{nickname:'Sem saldo'});M.current(empty).balance=0;
  const zero=await harness({initial:empty});assert.match(zero.nodes.screen.innerHTML,/Seu saldo está zerado/);
  assert.match(zero.nodes.screen.innerHTML,/Adicione Joga aí Coin de teste/);assert.match(zero.nodes.screen.innerHTML,/reservados em partidas/);
  zero.route('#carteira');await new Promise(resolve=>setImmediate(resolve));
  assert.match(zero.nodes.screen.innerHTML,/Seu saldo começa em zero/);assert.match(zero.nodes.screen.innerHTML,/recarga de teste/);
  const {h,a,b}=await twoPlayers();await challenge(h,b,1000);
  h.route('#arena');assert.match(h.nodes.screen.innerHTML,/Seu saldo está reservado em partidas/);assert.doesNotMatch(h.nodes.screen.innerHTML,/Seu saldo está zerado/);
  assert.equal(h.persisted().profiles[a].balance,0);assert.equal(M.duelReservedPoints(h.persisted(),a),1000);
  h.route('#carteira');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/Seu saldo em Joga aí Coin está reservado em partidas/);assert.match(h.nodes.screen.innerHTML,/sem valor financeiro/);
});

test('a guest choosing to create or add credits resumes the requested screen after account creation',async()=>{
  const creator=await harness();await creator.click('create');assert.match(creator.nodes.modalContent.innerHTML,/Crie um perfil de demonstração/);
  await creator.submit('signup',{nickname:'Alex'});assert.equal(creator.location.hash,'#criar');assert.match(creator.nodes.screen.innerHTML,/<form data-form='duel'/);
  const payer=await harness();await payer.click('deposit');assert.match(payer.nodes.modalContent.innerHTML,/Crie um perfil de demonstração/);
  await payer.submit('signup',{nickname:'Bruna'});assert.match(payer.nodes.modalContent.innerHTML,/data-form='deposit'/);
  assert.equal(payer.nodes.modal.open,true);assert.match(payer.nodes.modalContent.innerHTML,/nenhuma chave Pix|Não é gerada uma chave Pix/);
});

test('local wallet binds card installment selection, refusal, Pix approval and pending cancellation without real payment inputs',async()=>{
  const h=await harness();await h.click('signup');await h.submit('signup',{nickname:'Alex'});
  await h.click('deposit');h.document.getElementById('depositAmount').value='500';
  await h.click('payment-method','card');assert.match(h.nodes.modalContent.innerHTML,/6 parcelas/);
  assert.doesNotMatch(h.nodes.modalContent.innerHTML,/<input[^>]*(?:cvv|cardNumber|card-number|pan|accountNumber)/i);
  await h.submit('deposit',{amount:'500',method:'card',installments:'6'});let d=M.current(h.persisted()).depositRequests[0];
  assert.equal(d.installments,6);assert.equal(d.status,'pending');assert.equal(M.current(h.persisted()).balance,0);assert.equal(h.location.hash,'#carteira');
  assert.match(h.nodes.modalContent.innerHTML,/Simular aprovação/);await h.click('deposit-reject',d.id);
  assert.equal(M.current(h.persisted()).depositRequests[0].status,'rejected');assert.equal(M.current(h.persisted()).balance,0);
  await h.click('deposit');await h.submit('deposit',{amount:'250',method:'pix',installments:'1'});d=M.current(h.persisted()).depositRequests[0];
  await h.click('deposit-confirm',d.id);await h.click('deposit-confirm',d.id);
  assert.equal(M.current(h.persisted()).balance,250);assert.equal(M.current(h.persisted()).transactions.filter(t=>t.ref===`demo-deposit:${d.id}`).length,1);
  assert.match(h.nodes.modalContent.innerHTML,/Joga aí Coin adicionados/);
  await h.click('deposit');await h.submit('deposit',{amount:'100',method:'card',installments:'1'});d=M.current(h.persisted()).depositRequests[0];await h.click('deposit-cancel',d.id);
  assert.equal(M.current(h.persisted()).depositRequests[0].status,'cancelled');assert.equal(M.current(h.persisted()).balance,250);
  await h.click('close');h.route('#carteira');await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.screen.innerHTML,/Extrato/);assert.match(h.nodes.screen.innerHTML,/Crédito simulado/);assert.match(h.nodes.screen.innerHTML,/250/);
});

test('local transfer proof enters review, is shown to the owner and remains uncredited after reloading the wallet',async()=>{
  const h=await harness();await h.click('signup');await h.submit('signup',{nickname:'Alex'});
  await h.click('deposit');await h.submit('deposit',{amount:'1000',method:'transfer',installments:'1'});const id=M.current(h.persisted()).depositRequests[0].id;
  await h.click('deposit-proof',id);assert.match(h.nodes.modalContent.innerHTML,/Não envie dados bancários reais/);
  await h.submit('deposit-proof',{evidence:image});let s=h.persisted(),d=M.current(s).depositRequests[0];
  assert.equal(d.status,'review');assert.equal(d.receipt.evidenceDataUrl,photo);assert.equal(M.current(s).balance,0);
  assert.match(h.nodes.modalContent.innerHTML,/Comprovante em análise/);assert.match(h.nodes.modalContent.innerHTML,/neste navegador/);
  assert.doesNotMatch(h.nodes.modalContent.innerHTML,/data-action='deposit-confirm'/);
  const reload=await harness({initial:s,url:'https://example.test/fifabet-arena/#carteira'});await new Promise(resolve=>setImmediate(resolve));
  assert.match(reload.nodes.screen.innerHTML,/Comprovante em análise/);assert.equal(M.current(reload.persisted()).balance,0);
  await reload.click('deposit-details',id);assert.match(reload.nodes.modalContent.innerHTML,/data:image\/jpeg/);
  assert.match(reload.nodes.modalContent.innerHTML,/data-action='deposit-cancel'/);
  await reload.click('deposit-cancel',id);s=reload.persisted();d=M.current(s).depositRequests[0];
  assert.equal(d.status,'cancelled');assert.equal(d.receipt.evidenceDataUrl,photo);assert.equal(d.receipts.length,1);assert.equal(M.current(s).balance,0);
  const cancelled=await harness({initial:s,url:'https://example.test/fifabet-arena/#carteira'});await new Promise(resolve=>setImmediate(resolve));
  await cancelled.click('deposit-details',id);assert.match(cancelled.nodes.modalContent.innerHTML,/Cancelado/);assert.match(cancelled.nodes.modalContent.innerHTML,/data:image\/jpeg/);
  assert.doesNotMatch(cancelled.nodes.modalContent.innerHTML,/data-action='deposit-confirm'/);assert.equal(M.current(cancelled.persisted()).balance,0);
});

test('server Pix creation keeps idempotency and buyers cannot approve their own real payment',async()=>{
  const calls=[];let deposit=null,balance=1000;
  const user={id:'payer-account',nickname:'Bruna',publicPlayerId:'FBA-BBBBBBBBBB',balance:1000,isReviewer:false};
  const api={detectBackend:async()=>({available:true,apiVersion:1,paymentMode:'pix_manual',paymentsAvailable:true}),loadSession:async()=>({user}),getArena:async()=>({user:{...user,balance},duels:[],history:[],stats:{reserved:0}}),getWallet:async()=>({paymentMode:'pix_manual',paymentsAvailable:true,catalog:[{amount:250,priceCents:2500}],balance,reserved:0,transactions:[],deposits:deposit?[{...deposit}]:[]}),createDeposit:async data=>{calls.push(['create',{...data}]);deposit={id:'deposit-server',userId:user.id,paymentMode:'pix_manual',priceCents:2500,...data,status:'pending',version:1,createdAt:'2026-09-30T12:00:00.000Z'};return {deposit:{...deposit}};},simulateDeposit:async()=>{assert.fail('A buyer must never call payment simulation in the connected application.');}};
  const h=await harness({api});await h.click('deposit');const key=/data-operation='([^']+)'/.exec(h.nodes.modalContent.innerHTML)[1];
  await h.submit('deposit',{amount:'250',method:'pix',installments:'1'});assert.equal(balance,1000);assert.equal(h.location.hash,'#carteira');
  assert.deepEqual(calls[0],['create',{amount:250,method:'pix',installments:1,idempotencyKey:key}]);
  assert.doesNotMatch(h.nodes.modalContent.innerHTML,/data-action='deposit-confirm'/);
  await h.click('deposit-confirm','deposit-server');assert.match(h.nodes.dialogError.textContent,/não pode ser aprovada pelo comprador/);assert.equal(calls.length,1);
  assert.equal(balance,1000);assert.match(h.nodes.modalContent.innerHTML,/saldo só muda depois da conferência no banco/);assert.match(h.nodes.headerActions.innerHTML,/Bruna/);
});

test('server Pix review binds the authorized reviewer decision to the shown receipt version',async()=>{
  const calls=[];let reviewed=false;
  const user={id:'reviewer-account',nickname:'Equipe',publicPlayerId:'FBA-CCCCCCCCCC',balance:1000,isReviewer:true};
  const deposit={id:'transfer-server',userId:'payer-account',paymentMode:'pix_manual',priceCents:5000,owner:{id:'payer-account',nickname:'Bruna'},amount:500,method:'pix',installments:1,status:'review',version:3,evidenceId:'receipt-private',createdAt:'2026-09-30T12:00:00.000Z'};
  const api={detectBackend:async()=>({available:true,apiVersion:1}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],stats:{reserved:0}}),listReviews:async()=>({duels:[]}),listDepositReviews:async()=>({deposits:reviewed?[]:[deposit]}),depositEvidenceUrl:id=>`/api/v1/wallet/evidence/${id}`,reviewDeposit:async(id,data)=>{calls.push({id,...data});reviewed=true;return {};}};
  const h=await harness({api});h.route('#revisao');await new Promise(resolve=>setImmediate(resolve));assert.match(h.nodes.screen.innerHTML,/receipt-private/);
  await h.click('deposit-review',deposit.id);assert.match(h.nodes.modalContent.innerHTML,/data-version='3'/);
  await h.submit('deposit-review',{decision:'approve',reason:'Comprovante fictício conferido pela equipe.',bankReference:'BANK-TEST-123',bankAmountCents:'50',paidAt:'2026-09-30T12:00:00Z'});
  assert.deepEqual(calls,[{id:'transfer-server',decision:'approve',reason:'Comprovante fictício conferido pela equipe.',version:3,bankReference:'BANK-TEST-123',bankAmountCents:5000,paidAt:'2026-09-30T12:00:00.000Z'}]);
  assert.match(h.nodes.toast.textContent,/Pix confirmado/);
});

test('a polling response from the previous account cannot restore private rooms or alerts after logout',async()=>{
  const user={id:'private-player',nickname:'PrivatePlayer',publicPlayerId:'FBA-AAAAAAAAAA',balance:500,isReviewer:false};
  let calls=0,release;
  const api={detectBackend:async()=>({available:true,apiVersion:1,paymentMode:'unconfigured'}),loadSession:async()=>({user}),getArena:async()=>{calls++;return calls===1?{user,duels:[],history:[],stats:{reserved:0},notifications:[]}:new Promise(resolve=>{release=()=>resolve({user,duels:[{id:'private-duel',hostId:user.id,guestId:'rival',host:user,guest:{id:'rival',nickname:'PrivateRival'},stake:100,mode:'1v1',status:'in_progress',createdAt:new Date().toISOString()}],history:[],stats:{reserved:100},notifications:[{id:'private-notification',type:'waiting',duelId:'private-duel',createdAt:new Date().toISOString()}]});});},logoutAccount:async()=>({})};
  const h=await harness({api}),poll=h.intervals.find(item=>item.delay===8000);assert.ok(poll);
  const polling=poll.callback();await h.click('logout');release();await polling;
  assert.equal(h.api.getArena(),null);assert.doesNotMatch(h.nodes.screen.innerHTML,/PrivatePlayer|PrivateRival|private-duel/);assert.doesNotMatch(h.nodes.toast?.textContent||'',/esperando|private-notification/);
});
function preparingFixture(){
 const user={id:'guest',nickname:'Bruna',balance:200,publicPlayerId:'FBA-BBBBBBBBBB'};
 const duel={id:'prep-room',hostId:'host',host:{id:'host',nickname:'Alex'},guestId:user.id,guest:user,stake:100,mode:'1v1',platform:'pc',status:'waiting_start',lobbyVersion:1,readyBy:[],fundedBy:['host',user.id],createdAt:'2026-10-02T12:00:00Z',result:null};
 return {user,duel};
}
async function preparationHarness(extra={}){
 const {user,duel}=preparingFixture();const calls=[];
 const api={detectBackend:async()=>({available:true,paymentMode:'demo'}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[{...duel,readyBy:[...duel.readyBy]}],history:[],stats:{reserved:100}}),getDuelChat:async()=>({messages:[],lastSequence:0,closed:false}),startDuel:async id=>{calls.push(id);duel.readyBy.push(user.id);if(duel.readyBy.includes(duel.hostId))duel.status='in_progress';},logoutAccount:async()=>{},...extra};
 const h=await harness({api,url:'https://example.test/#partida/prep-room'});await new Promise(resolve=>setImmediate(resolve));return {h,user,duel,calls};
}
test('joined preparation shows both readiness states and starts the existing match view only with both confirmations',async()=>{
 const {h,duel,calls}=await preparationHarness();
 assert.equal(h.api.duels()[0].status,'preparing');assert.match(h.nodes.screen.innerHTML,/Conversa da sala/);assert.match(h.nodes.screen.innerHTML,/Iniciar partida/);
 assert.ok(!h.nodes.screen.innerHTML.includes('Partida encerrada'));
 await h.click('start-match',duel.id);assert.deepEqual(calls,[duel.id]);assert.match(h.nodes.screen.innerHTML,/Aguardando o rival/);assert.equal(duel.status,'waiting_start');
 duel.readyBy.push(duel.hostId);duel.status='in_progress';await h.click('refresh');assert.match(h.nodes.screen.innerHTML,/Partida encerrada/);assert.match(h.nodes.screen.innerHTML,/Conversa da sala/);
});
test('late private chat responses cannot restore messages after logout',async()=>{
 let resolve;const pending=new Promise(done=>{resolve=done;});const {h}=await preparationHarness({getDuelChat:()=>pending});
 await h.click('logout');resolve({messages:[{id:'secret',sequence:1,text:'private conversation',authorNickname:'Alex'}],lastSequence:1,closed:false});await new Promise(done=>setImmediate(done));
 assert.equal(h.api.getChat(),undefined);assert.ok(!h.nodes.screen.innerHTML.includes('private conversation'));
});
test('failed chat sends retain draft and retry with the same operation; successful sends clear only the sent draft',async()=>{
 const operations=[];let attempt=0;const {h,user,duel}=await preparationHarness({sendDuelChat:async(id,payload)=>{operations.push({...payload});if(++attempt===1)throw Error('Conexão interrompida');return {messages:[{id:'sent',sequence:1,authorId:user.id,authorNickname:user.nickname,text:payload.text,createdAt:'2026-10-02T12:00:00Z'}],lastSequence:1,closed:false};}});
 h.listeners.input({target:{id:'chatText',value:'Vamos jogar?'}});
 const form={dataset:{owner:user.id,id:duel.id}},data={get:()=> 'Vamos jogar?'};
 await h.api.sendRoomChat(form,data);assert.equal(h.api.getChat().draft,'Vamos jogar?');assert.match(h.api.getChat().error,/Conexão/);
 await h.api.sendRoomChat(form,data);assert.equal(operations[0].operationId,operations[1].operationId);assert.equal(h.api.getChat().draft,'');assert.equal(h.api.getChat().messages.length,1);
 assert.ok(![...Object.keys(h.persisted())].includes('messages'));
});
test('typing receives readiness updates without replacing the composer or moving its cursor',async()=>{
 const {h,duel}=await preparationHarness();let replaced=0;
 const main={innerHTML:''},composer={value:'Meu rascunho',selectionStart:3,selectionEnd:5,id:'chatText',dataset:{},matches:()=>true};
 h.document.activeElement=composer;h.nodes.screen.contains=()=>true;
 h.nodes.screen.querySelector=selector=>selector==='#roomMainState'?main:null;
 Object.defineProperty(h.nodes.screen,'innerHTML',{get(){return 'original composer';},set(){replaced++;}});
 duel.readyBy=[duel.hostId];await h.intervals.find(x=>x.delay===8000).callback();
 assert.match(main.innerHTML,/Pronto para jogar/);assert.equal(replaced,0);assert.equal(h.document.activeElement,composer);assert.equal(composer.selectionStart,3);assert.equal(composer.selectionEnd,5);assert.equal(composer.value,'Meu rascunho');
});
test('chat access rejection clears private memory and removes the conversation without retry looping',async()=>{
 let reads=0;const {h}=await preparationHarness({getDuelChat:async()=>{reads++;const error=Error('Forbidden');error.status=403;throw error;}});
 assert.equal(h.api.getChat(),undefined);assert.ok(!h.nodes.screen.innerHTML.includes('Conversa da sala'));assert.equal(reads,1);
});
test('typing defers cancelled room details until the next poll after blur without detaching a pointer target',async()=>{
 const {h,duel}=await preparationHarness();const main={innerHTML:''};
 h.listeners.input({target:{id:'chatText',value:'Meu ID no jogo'}});
 const field={id:'chatText',dataset:{},value:'Meu ID no jogo',matches:()=>true};h.document.activeElement=field;h.nodes.screen.contains=()=>true;h.nodes.screen.querySelector=selector=>selector==='#roomMainState'?main:null;
 duel.status='cancelled';await h.intervals.find(x=>x.delay===8000).callback();assert.match(main.innerHTML,/Cancelado/);
 const pointerTarget={dataset:{action:'cancel',id:duel.id},matches:()=>false};h.document.activeElement=pointerTarget;assert.equal(typeof h.listeners.focusout,'function');assert.equal(h.document.activeElement,pointerTarget);assert.ok(!h.nodes.screen.innerHTML.includes('Devolução dos Joga aí Coin'));
 await h.intervals.find(x=>x.delay===8000).callback();assert.match(h.nodes.screen.innerHTML,/Devolução dos Joga aí Coin/);assert.match(h.nodes.screen.innerHTML,/Somente leitura/);assert.equal(h.api.getChat().draft,'Meu ID no jogo');
});
test('chat submit awaits a slow POST and handles blank validation in the existing error surface',async()=>{
 let release,markStarted;const started=new Promise(resolve=>{markStarted=resolve;});const pending=new Promise(done=>{release=done;});const {h,user,duel}=await preparationHarness({sendDuelChat:()=>{markStarted();return pending;}});
 const button={disabled:false,isConnected:true,textContent:'Enviar mensagem',removeAttribute(){}},field={value:'Vamos?',disabled:false};
 const form={dataset:{form:'chat',owner:user.id,id:duel.id},fields:{text:'Vamos?'},querySelector:selector=>selector==='textarea'?field:button};
 h.nodes.screen.querySelector=selector=>selector==='[data-form=chat]'?form:null;
 const sending=h.listeners.submit({preventDefault(){},target:{closest:()=>form}});await started;assert.equal(h.api.getChat().sending,true);assert.equal(button.disabled,true);assert.equal(button.textContent,'Enviando…');
 release({messages:[],lastSequence:0,closed:true});await sending;assert.equal(h.api.getChat().sending,false);assert.equal(button.disabled,true);
 // Use an open room for validation and ensure rejected text never escapes the listener.
 h.api.getChat().closed=false;form.fields.text='   ';await h.listeners.submit({preventDefault(){},target:{closest:()=>form}});assert.match(h.nodes.roomError.textContent,/Escreva uma mensagem/);
});
function directoryFixture(){
 const user={id:'host',nickname:'Alex',balance:500,publicPlayerId:'FBA-AAAAAAAAAA'};
 const own={id:'own-open',publicMatchId:'FG-1111111111',hostId:user.id,host:user,guestId:null,recipientId:null,visibility:'public',stake:250,mode:'1v1',platform:'playstation',status:'invited',fundingVersion:2,lobbyVersion:1,createdAt:'2026-10-02T12:00:00Z',expiresAt:'2099-01-01T00:00:00Z'};
 const secret={...own,id:'own-private',publicMatchId:'FG-2222222222',visibility:'private',rules:'Privada para meu amigo'};
 const available={publicMatchId:'FG-3333333333',host:{nickname:'Rival público'},stake:100,mode:'1v1',platform:'pc',expiresAt:'2099-01-01T00:00:00Z'};
 const api={detectBackend:async()=>({available:true,paymentMode:'unconfigured'}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[own,secret],history:[],stats:{reserved:500}}),getRooms:async()=>({rooms:[available]})};
 return {user,own,secret,available,api};
}
test('Arena shows public rivals separately from own rooms without the home hero',async()=>{
 const {api}=directoryFixture(),h=await harness({api,url:'https://example.test/#salas'}),html=h.nodes.screen.innerHTML;
 assert.equal(h.nodes.breadcrumb.textContent,'Arena');assert.match(html,/<h1[^>]*>Arena<\/h1>/);
 assert.doesNotMatch(html,/taste-home-hero|lobby-footballer|FG-1111111111|FG-2222222222|arena-owned-section/);
 assert.match(html,/100/);assert.match(html,/Rival público/);assert.match(html,/Joga aí Coin por jogador/);
 assert.doesNotMatch(html,/data-action='room' data-id='own-open'/);assert.match(html,/data-action='public-room' data-id='FG-3333333333'/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
});
test('Arena personal tab preserves private rooms and their actions while home offers a short directory link',async()=>{
 const {api}=directoryFixture(),h=await harness({api});
 assert.match(h.nodes.screen.innerHTML,/data-action='browse-arena'/);assert.doesNotMatch(h.nodes.screen.innerHTML,/data-action='cancel'|arena-room-grid/);
 await h.click('browse-arena');assert.equal(h.location.hash,'#salas');await h.click('arena-tab','mine');
 assert.match(h.nodes.screen.innerHTML,/data-action='room' data-id='own-private'/);assert.match(h.nodes.screen.innerHTML,/data-action='cancel' data-id='own-private'/);assert.doesNotMatch(h.nodes.screen.innerHTML,/data-action='public-room'|arena-room-code/);
 assert.match(h.nodes.screen.innerHTML,/250 <span>Joga aí Coin por jogador/);
 await h.click('room','own-open');assert.equal(h.location.hash,'#partida/own-open');assert.match(h.nodes.screen.innerHTML,/href='#salas'/);assert.match(h.nodes.screen.innerHTML,/FG-1111111111/);
});
test('Arena updates available rooms on polling and keeps its selected personal tab',async()=>{
 const {api,available}=directoryFixture();let rooms=[available];api.getRooms=async()=>({rooms});
 const h=await harness({api,url:'https://example.test/#salas'});rooms=[];
 await h.intervals.find(x=>x.delay===8000).callback();assert.doesNotMatch(h.nodes.screen.innerHTML,/Rival público|data-action='room' data-id='own-open'/);assert.match(h.nodes.screen.innerHTML,/A próxima sala pode ser a sua/);
 await h.click('arena-tab','mine');rooms=[available];await h.intervals.find(x=>x.delay===8000).callback();
 assert.match(h.nodes.screen.innerHTML,/data-action='room' data-id='own-private'/);assert.doesNotMatch(h.nodes.screen.innerHTML,/Rival público/);
});
test('Arena guest view asks for login without rendering member rooms or personal counts',async()=>{
 const {api}=directoryFixture();api.loadSession=async()=>({user:null});api.getArena=async()=>{assert.fail('Guest must not load personal arena');};
 const h=await harness({api,url:'https://example.test/#salas'});
 assert.equal(h.nodes.breadcrumb.textContent,'Arena');assert.match(h.nodes.screen.innerHTML,/data-action='login'/);assert.doesNotMatch(h.nodes.screen.innerHTML,/FG-1111111111|FG-2222222222|Rival público|data-action='arena-tab'/);
});
test('Arena does not claim a Coin reservation for an own free room and omits expired own rooms',async()=>{
 const {api,own,secret}=directoryFixture();own.stake=0;secret.visibility='public';secret.expiresAt='2000-01-01T00:00:00Z';secret.status='expired';
 const h=await harness({api,url:'https://example.test/#salas'});await h.click('arena-tab','mine');const html=h.nodes.screen.innerHTML;
 assert.match(html,/Grátis <span>amistosa sem Coin/);assert.match(html,/data-action='room' data-id='own-open'/);assert.doesNotMatch(html,/Sua parte já está reservada|data-action='room' data-id='own-private'/);
 await h.click('room','own-open');assert.match(h.nodes.screen.innerHTML,/sem Joga aí Coin/);assert.doesNotMatch(h.nodes.screen.innerHTML,/Sua parte em Coin já foi reservada/);
});
test('Arena shows a polling room failure even if the last room and account data are unchanged',async()=>{
 const {api,available}=directoryFixture();let failed=false;api.getRooms=async()=>{if(failed)throw Error('Private diagnostic');return {rooms:[available]};};
 const h=await harness({api,url:'https://example.test/#salas'});failed=true;await h.intervals.find(x=>x.delay===8000).callback();
 assert.match(h.nodes.screen.innerHTML,/Não foi possível atualizar as salas/);assert.match(h.nodes.screen.innerHTML,/Rival público/);assert.doesNotMatch(h.nodes.screen.innerHTML,/Private diagnostic/);
});
test('logging in from Arena loads available rooms immediately without waiting for a poll',async()=>{
 const {api}=directoryFixture();api.loadSession=async()=>({user:null});api.loginAccount=async()=>({});
 const h=await harness({api,url:'https://example.test/#salas'});await h.click('login');await h.submit('login',{nickname:'Alex',password:'fixture login password'});
 assert.match(h.nodes.screen.innerHTML,/Rival público/);assert.match(h.nodes.screen.innerHTML,/data-action='public-room' data-id='FG-3333333333'/);assert.doesNotMatch(h.nodes.screen.innerHTML,/data-action='room' data-id='own-open'/);
});
