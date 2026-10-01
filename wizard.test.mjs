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

const source=fs.readFileSync(new URL('./play.js',import.meta.url),'utf8');
function players(){
 let state=M.change(M.emptyState(),'create',{nickname:'Alex'});const host=state.activeProfileId;
 // New profiles start at zero; this fixture explicitly buys local test credits.
 assert.equal(M.current(state).balance,0);
 state=M.change(state,'deposit',{amount:1000,method:'pix',paymentId:'wizard-host-fixture'});
 state=M.change(state,'create',{nickname:'Bruna'});const guest=state.activeProfileId;
 state=M.change(state,'deposit',{amount:1000,method:'pix',paymentId:'wizard-guest-fixture'});
 return {state:M.change(state,'login',{id:host}),host,guest};
}
async function harness({initial=M.emptyState(),api={}}={}){
 const nodes={},listeners={},windowListeners={},stored=new Map([[M.STORAGE_KEY,JSON.stringify(initial)]]);
 let lastMarkup='',liveForm;
 function element(tagName='div',attributes={}){
  let markup='',children=[];const attrs=new Map(Object.entries(attributes));
  const result={id:attributes.id||'',tagName:tagName.toUpperCase(),textContent:'',value:'',hidden:Object.hasOwn(attributes,'hidden'),open:false,isConnected:true,disabled:false,dataset:{},classList:{add(){},remove(){},toggle(){}},focus(){document.activeElement=this;},showModal(){this.open=true;},close(){this.open=false;},setSelectionRange(){},closest(){return null;},setAttribute(name,value){attrs.set(name,String(value));},getAttribute(name){return attrs.get(name)??null;},removeAttribute(name){attrs.delete(name);},remove(){this.isConnected=false;if(nodes[this.id]===this)delete nodes[this.id];},scrollIntoView(){},
   querySelector(selector){if(this.id==='screen'&&selector==="[data-form='duel']")return wizardForm();return this.querySelectorAll(selector)[0]??null;},
   querySelectorAll(selector){return children.filter(child=>selector.startsWith('.')?(child.getAttribute('class')||'').split(/\s+/).includes(selector.slice(1)):child.tagName.toLowerCase()===selector);},
   insertAdjacentHTML(position,html){assert.equal(position,'afterend');const opening=html.match(/^<div\b([^>]*)>/);assert.ok(opening);const panel=element('div',readAttributes(opening[1]));nodes[panel.id]=panel;panel.innerHTML=html.slice(opening[0].length,-6);},addEventListener(name,callback){this[name]=callback;}};
  for(const[name,value]of attrs)if(name.startsWith('data-'))result.dataset[name.slice(5).replace(/-([a-z])/g,(_m,c)=>c.toUpperCase())]=value;
  Object.defineProperty(result,'innerHTML',{get:()=>markup,set(value){markup=String(value);children.forEach(child=>{child.isConnected=false;});children=[...markup.matchAll(/<(a|button)\b([^>]*)>/g)].map(([,tag,attributes])=>element(tag,readAttributes(attributes)));}});return result;
 }
 function readAttributes(markup){return Object.fromEntries([...markup.matchAll(/([\w-]+)(?:=(?:'([^']*)'|"([^"]*)"))?/g)].map(([,name,single,double])=>[name,single??double??'']));}
 function node(id){return nodes[id]??=element('div',{id});}
 const document={getElementById:id=>['roomError','mobileMoreNav'].includes(id)?nodes[id]??null:node(id),activeElement:null,querySelector:()=>null,addEventListener(name,callback){listeners[name]=callback;}};
 const location={href:'https://example.test/#criar',hash:'#criar',pathname:'/',origin:'https://example.test'};
 const localStorage={getItem:key=>stored.get(key)??null,setItem(key,value){stored.set(key,String(value));}};
 function wizardForm(){
  const markup=node('screen').innerHTML;
  if(markup!==lastMarkup){
   lastMarkup=markup;const tag=markup.match(/<form\b[^>]*data-form='duel'[^>]*>/)?.[0];
   liveForm=null;if(tag){const dataset={};for(const [,key,value]of tag.matchAll(/data-([a-z-]+)='([^']*)'/g))dataset[key.replace(/-([a-z])/g,(_m,c)=>c.toUpperCase())]=value;liveForm={dataset};}
  }
  return liveForm;
 }
 const context={M,COUNTRY_CODES,TERMS_VERSION,createAdminPanel,accountArt,uiIcon,renderLobbyView,renderWalletView,renderHistoryView,renderRankingView,renderProfileView,API:{detectBackend:async()=>null,...api},document,localStorage,location,window:{addEventListener(name,callback){windowListeners[name]=callback;},scrollTo(){}},history:{replaceState(_state,_title,value){location.href=new URL(value,location.href).href;location.hash=new URL(location.href).hash;}},navigator:{clipboard:{async writeText(){}}},crypto,URL,console,setTimeout(){return 1;},clearTimeout(){},setInterval(){return 2;},clearInterval(){},FormData:class{constructor(form){this.fields=form.fields;}get(key){return this.fields[key]??null;}}};
 vm.createContext(context);
 vm.runInContext(source.replace(/^import .*?;\r?\n/gm,'').replace(/\nstart\(\)\.catch\(/,'\nglobalThis.__boot=start().catch(')+`\nglobalThis.wizard={getUI:()=>ui,getState:()=>state,render};`,context);
 await context.__boot;
 const click=async(action,id)=>listeners.click({preventDefault(){},target:{closest(selector){return selector==='[data-action]'?{dataset:{action,id},disabled:false,isConnected:true}:null;}}});
 const formData=()=>({...wizardForm()?.dataset});
 const submit=async(fields={},dataset=formData())=>{
  const form={dataset:{...dataset,form:'duel'},fields,querySelector(){return {disabled:false,isConnected:true};}};
  return listeners.submit({preventDefault(){},target:{closest(){return form;}}});
 };
 const input=(id,value)=>{const field=node(id);field.value=value;listeners.input({target:field});};
 const persisted=()=>M.restore(stored.get(M.STORAGE_KEY));
 return {nodes,listeners,windowListeners,localStorage,location,click,submit,input,formData,persisted,ui:context.wizard.getUI,render:context.wizard.render};
}
const nextMatch=(h,rivalId)=>h.submit({rivalId,mode:'Ultimate Team',platform:'playstation'});
const nextCredits=(h,stake='250',rules='Jogo único, seis minutos.')=>h.submit({stake,rules});

test('wizard reserves credits only after the reviewed third step and creates one local challenge',async()=>{
 const {state,host,guest}=players(),h=await harness({initial:state});
 assert.match(h.nodes.screen.innerHTML,/ETAPA 1 DE 3/);
 await nextMatch(h,state.profiles[guest].publicPlayerId);
 assert.equal(h.ui().duelStep,2);assert.equal(Object.keys(h.persisted().duels).length,0);
 await nextCredits(h);
 assert.equal(h.ui().duelStep,3);assert.equal(h.persisted().profiles[host].balance,1000);
 assert.match(h.nodes.screen.innerHTML,/Bruna/);assert.match(h.nodes.screen.innerHTML,/Ultimate Team · PlayStation/);
 assert.match(h.nodes.screen.innerHTML,/Confirmar e criar convite/);assert.match(h.nodes.screen.innerHTML,/250 créditos de teste serão reservados/);
 const confirmation=h.formData();await Promise.all([h.submit({},confirmation),h.submit({},confirmation)]);
 const saved=h.persisted(),duels=Object.values(saved.duels);assert.equal(duels.length,1);
 assert.equal(saved.profiles[host].balance,750);assert.equal(saved.profiles[guest].balance,1000);
 assert.equal(duels[0].stake,250);assert.equal(duels[0].mode,'Ultimate Team');assert.equal(duels[0].rules,'Jogo único, seis minutos.');
 assert.equal(duels[0].operationId,confirmation.operation);assert.equal(h.ui().duelStep,1);
 await h.submit({},confirmation);assert.equal(Object.keys(h.persisted().duels).length,1);
});

test('returning to edit keeps the draft and generates a new operation only for a new summary',async()=>{
 const {state,guest}=players(),h=await harness({initial:state});
 await nextMatch(h,state.profiles[guest].publicPlayerId);await nextCredits(h,'500','Sem times personalizados.');
 const firstOperation=h.ui().duelOperation;
 await h.click('duel-back');assert.equal(h.ui().duelStep,2);
 assert.equal(h.ui().stake,'500');assert.equal(h.ui().rules,'Sem times personalizados.');
 assert.match(h.nodes.screen.innerHTML,/value='500'/);assert.match(h.nodes.screen.innerHTML,/Sem times personalizados/);
 await h.click('duel-back');assert.equal(h.ui().duelStep,1);
 assert.equal(h.ui().rival,state.profiles[guest].publicPlayerId);assert.equal(h.ui().mode,'Ultimate Team');assert.equal(h.ui().platform,'playstation');
 await nextMatch(h,state.profiles[guest].publicPlayerId);await nextCredits(h,'100','Jogo único.');
 assert.notEqual(h.ui().duelOperation,firstOperation);assert.equal(h.ui().stake,'100');
 assert.equal(Object.keys(h.persisted().duels).length,0);
});

test('local rival and balance validation explain the next step without reserving credits',async()=>{
 const {state,host,guest}=players(),h=await harness({initial:state});
 await nextMatch(h,state.profiles[host].publicPlayerId);assert.equal(h.ui().duelStep,1);assert.match(h.nodes.composerError.textContent,/outro jogador/);
 await nextMatch(h,'FBA-00000000');assert.equal(h.ui().duelStep,1);assert.match(h.nodes.composerError.textContent,/cadastrado neste navegador/);
 await nextMatch(h,state.profiles[guest].publicPlayerId);
 await nextCredits(h,'1001');assert.equal(h.ui().duelStep,2);assert.match(h.nodes.composerError.textContent,/insuficientes/);
 await nextCredits(h,'10.5');assert.match(h.nodes.composerError.textContent,/sem casas decimais/);
 assert.equal(h.persisted().profiles[host].balance,1000);assert.equal(Object.keys(h.persisted().duels).length,0);
});

test('a confirmation captured from another account cannot create a challenge',async()=>{
 const {state,host,guest}=players(),h=await harness({initial:state});
 await nextMatch(h,state.profiles[guest].publicPlayerId);await nextCredits(h);const confirmation=h.formData();
 const switched=M.change(h.persisted(),'login',{id:guest});h.localStorage.setItem(M.STORAGE_KEY,JSON.stringify(switched));
 await h.submit({},confirmation);
 assert.match(h.nodes.composerError.textContent,/perfil mudou/);
 assert.equal(Object.keys(h.persisted().duels).length,0);assert.equal(h.persisted().profiles[host].balance,1000);
 h.windowListeners.storage({key:M.STORAGE_KEY});assert.equal(h.ui().duelStep,1);assert.equal(h.ui().rival,'');
});

test('online draft changed during a rival lookup does not advance with an obsolete recipient',async()=>{
 const user={id:'host',nickname:'Alex',publicPlayerId:'FBA-AAAAAAAAAA',balance:1000};let release;
 const api={detectBackend:async()=>({available:true}),loadSession:async()=>({user}),getArena:async()=>({user,duels:[],history:[],stats:{reserved:0}}),findPlayer:async()=>new Promise(resolve=>{release=()=>resolve({player:{id:'guest',nickname:'Bruna',publicPlayerId:'FBA-BBBBBBBBBB'}});})};
 const h=await harness({api});const pending=nextMatch(h,'FBA-BBBBBBBBBB');
 h.input('rivalId','FBA-CCCCCCCCCC');release();await pending;
 assert.equal(h.ui().duelStep,1);assert.match(h.nodes.composerError.textContent,/dados mudaram/);assert.equal(h.ui().rival,'FBA-CCCCCCCCCC');
});

test('retry after an ambiguous server response recovers the same host operation despite the reduced balance',async()=>{
 const user={id:'host',nickname:'Alex',publicPlayerId:'FBA-AAAAAAAAAA',balance:1000};let duel=null,calls=0;
 const api={detectBackend:async()=>({available:true,paymentMode:'demo',paymentsAvailable:true}),loadSession:async()=>({user}),getArena:async()=>({user,duels:duel?[duel]:[],history:[],stats:{reserved:duel?1000:0}}),createDuel:async data=>{calls++;duel={id:'server-duel',hostId:user.id,host:user,recipientId:null,guestId:null,stake:data.stake,mode:data.mode,platform:data.platform,rules:data.rules,operationId:data.operationId,inviteToken:'a'.repeat(43),status:'invited',createdAt:new Date().toISOString()};user.balance=0;throw Error('Conexão interrompida.');}};
 const h=await harness({api});await nextMatch(h,'');await nextCredits(h,'1000','');const confirmation=h.formData();
 await h.submit({},confirmation);assert.equal(calls,1);assert.equal(h.ui().duelStep,3);assert.equal(h.ui().duelOperation,confirmation.operation);
 await h.submit({},confirmation);assert.equal(calls,1);assert.equal(user.balance,0);assert.equal(h.ui().duelStep,1);assert.equal(h.location.hash,'#partida/server-duel');
 assert.match(h.nodes.modalContent.innerHTML,/Partida criada|convite/i);
});
