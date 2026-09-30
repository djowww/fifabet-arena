import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as model from './model.mjs';
const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
function harness(){
 const nodes={},listeners={},windowListeners={},timers=new Map();let timerId=0;
 function node(id){return nodes[id]??={id,innerHTML:'',textContent:'',hidden:false,open:false,isConnected:true,dataset:{},classList:{add(){},remove(){},toggle(){}},focus(){document.activeElement=this;},setAttribute(){},querySelector(){return null;},addEventListener(name,fn){this[name]=fn;},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100};}};}
 const document={getElementById:node,activeElement:null,body:node('body'),querySelectorAll(){return [];},addEventListener(name,fn){listeners[name]=fn;}};
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
 const localStorage=storage(),sessionStorage=storage(),location={hash:'#arena'};
 const window={addEventListener:(n,f)=>windowListeners[n]=f,scrollTo(){}};
 const ctx={...model,document,window,location,localStorage,sessionStorage,crypto,console,requestAnimationFrame:f=>f(),setTimeout:(f,ms)=>{const id=++timerId;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),FormData:class{constructor(f){this.values=f.values;}get(k){return this.values[k];}}};
 vm.createContext(ctx);
 vm.runInContext(source.replace(/^import .*?;\r?\n/,'')+`\nglobalThis.api={getState:()=>state,getUI:()=>ui,commit,render,go,showAuth,readSlip,renderWallet,renderFriends,renderTrophies,renderBets,slipHTML,showMatch};`,ctx);
 const click=(action,data={})=>listeners.click({target:{closest(selector){if(selector==='.skip-link')return null;return {dataset:{action,...data},disabled:false};}}});
 const submit=(kind,nickname,fields={})=>listeners.submit({preventDefault(){},target:{closest(){return {dataset:{form:kind,id:fields.id},values:{nickname,...fields},reportValidity:()=>true};}}});
 const tick=ms=>{for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.f();}};
 return {api:ctx.api,nodes,click,submit,tick,document,location,localStorage,sessionStorage,listeners,windowListeners};
}
test('create/profile buttons render every route without runtime errors',()=>{
 const h=harness();assert.match(h.nodes.screen.innerHTML,/Desafie um amigo no EA SPORTS FC/);h.click('auth',{mode:'create'});assert.ok(h.nodes.modal.open);h.submit('create','Ricardo');assert.equal(model.current(h.api.getState()).nickname,'Ricardo');assert.match(h.nodes.headerActions.innerHTML,/1.000/);
 for(const view of model.VIEWS){h.api.getUI().view=view;h.api.render();assert.ok(h.nodes.screen.innerHTML.length>1000);}
 h.click('profile');h.submit('profile','RicoFC');assert.equal(model.current(h.api.getState()).nickname,'RicoFC');assert.equal(h.nodes.modal.open,false);
});
test('route aliases used by challenge and trophy buttons reach their views',()=>{
 const h=harness();h.api.go('amigos');assert.equal(h.location.hash,'amigos');h.location.hash='#arena';h.api.go('conquistas');assert.equal(h.location.hash,'trofeus');h.location.hash='#arena';h.api.go('ranking');assert.equal(h.location.hash,'ranking');
});
test('legacy bet history still records results in the account',()=>{
 const h=harness();h.submit('create','Ricardo');h.click('pick',{id:'m1',side:'away'});h.click('reviewBet');assert.match(h.nodes.modalContent.innerHTML,/220 pts/);h.click('confirmBet');assert.equal(model.current(h.api.getState()).balance,900);assert.equal(model.current(h.api.getState()).bets.length,1);assert.equal(h.api.getUI().pick,null);
 h.click('settle',{id:'m1'});h.click('settleResult',{id:'m1',side:'away'});assert.equal(model.current(h.api.getState()).balance,1120);assert.equal(model.current(h.api.getState()).bets[0].status,'won');h.api.getUI().view='bets';h.api.render();assert.match(h.nodes.screen.innerHTML,/LucasD10/);assert.match(h.nodes.screen.innerHTML,/Vencedor/);
});
test('payment rejection, retry, approval and close/cancel affect balance correctly',()=>{
 const h=harness();h.submit('create','Ricardo');h.click('deposit',{method:'card'});h.click('package',{value:'2500'});h.click('paymentReview');assert.match(h.nodes.modalContent.innerHTML,/4242/);h.click('paymentDecline');assert.equal(model.current(h.api.getState()).balance,1000);assert.match(h.nodes.modalContent.innerHTML,/recusado/);h.click('paymentRetry');h.click('paymentApprove');h.tick(650);assert.equal(model.current(h.api.getState()).balance,3500);assert.match(h.nodes.modalContent.innerHTML,/Pontos na carteira/);h.click('paymentApprove');h.tick(650);assert.equal(model.current(h.api.getState()).balance,3500);
 h.click('closeDialog');h.click('deposit');h.click('paymentReview');h.click('paymentApprove');h.click('closeDialog');h.tick(650);assert.equal(model.current(h.api.getState()).balance,3500);
});
test('slips stay isolated across profile switches and guest selection carries into login',()=>{
 const h=harness();h.click('pick',{id:'m2',side:'home'});h.click('reviewBet');h.submit('create','JogadorA');h.tick(0);assert.match(h.nodes.modalContent.innerHTML,/Confira seu palpite/);const a=h.api.getState().activeProfileId;h.click('closeDialog');h.click('amount',{value:'250'});
 h.click('logoutConfirm');assert.equal(h.api.getUI().pick,null);h.submit('create','JogadorB');const b=h.api.getState().activeProfileId;assert.equal(h.api.getUI().pick,null);h.click('pick',{id:'m4',side:'away'});h.click('amount',{value:'50'});
 h.click('login',{id:a});assert.equal(h.api.getUI().pick.matchId,'m2');assert.equal(h.api.getUI().stake,'250');h.click('login',{id:b});assert.equal(h.api.getUI().pick.matchId,'m4');assert.equal(h.api.getUI().stake,'50');
 assert.equal(h.api.readSlip(a).pick.matchId,'m2');assert.equal(h.api.readSlip(b).pick.matchId,'m4');
});
test('invalid fractional input cannot masquerade as insufficient funds; skip link keeps route',()=>{
 const h=harness();h.submit('create','Ricardo');h.click('pick',{id:'m1',side:'home'});h.api.getUI().stake='1000.5';const html=h.api.slipHTML();assert.match(html,/Use apenas pontos inteiros/);assert.match(html,/data-review disabled/);assert.doesNotMatch(html,/Adicionar saldo/);
 h.api.getUI().view='wallet';h.location.hash='#carteira';let prevented=false;h.listeners.click({preventDefault(){prevented=true;},target:{closest(selector){return selector==='.skip-link'?{}:null;}}});assert.equal(prevented,true);assert.equal(h.location.hash,'#carteira');assert.equal(h.document.activeElement.id,'screen');
});
test('friend buttons complete incoming/outgoing requests and cancel challenges',()=>{
 const h=harness();h.submit('create','Ricardo');h.click('accept',{id:'bia'});assert.ok(model.current(h.api.getState()).friends.includes('bia'));h.click('invite',{id:'leo'});h.click('simulateAccept',{id:'leo'});assert.ok(model.current(h.api.getState()).friends.includes('leo'));
 h.click('challenge',{id:'leo'});h.submit('challenge','',{id:'leo',mode:'Ultimate Team',stake:'250'});let p=model.current(h.api.getState()),challenge=p.challenges[0];assert.equal(p.challenges.length,1);assert.equal(challenge.mode,'Ultimate Team');assert.equal(challenge.stake,250);assert.equal(challenge.status,'sent');assert.equal(p.balance,1000);
 h.click('acceptChallenge',{id:challenge.id});assert.equal(model.current(h.api.getState()).challenges[0].status,'accepted');h.click('challengeResult',{id:challenge.id});h.click('challengeWinner',{id:challenge.id,side:'you'});p=model.current(h.api.getState());assert.equal(p.challenges[0].status,'completed');assert.equal(p.challenges[0].winner,'you');h.api.getUI().view='ranking';h.api.render();assert.match(h.nodes.screen.innerHTML,/Ricardo/);
 h.click('challenge',{id:'leo'});h.submit('challenge','',{id:'leo',mode:'1v1',stake:'100'});p=model.current(h.api.getState());challenge=p.challenges.find(c=>c.status==='sent');h.click('cancelChallenge',{id:challenge.id});assert.equal(model.current(h.api.getState()).challenges.some(c=>c.id===challenge.id),false);h.click('removeFriend',{id:'leo'});h.click('removeFriendConfirm',{id:'leo'});assert.equal(model.current(h.api.getState()).friends.includes('leo'),false);
});
