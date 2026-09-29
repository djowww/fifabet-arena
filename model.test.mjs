import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,current,change,restore,validStake,payout,VIEWS} from './model.mjs';
const create=(name='Ricardo')=>change(emptyState(),'create',{nickname:name});
const bet=(s,opts={})=>change(s,'bet',{matchId:'m1',side:'home',stake:100,operationId:'b1',...opts});
test('logout and login preserve account data; second profile stays isolated',()=>{
 let s=create();const a=s.activeProfileId;s=bet(s);s=change(s,'accept',{id:'bia'});s=change(s,'logout');assert.equal(current(s),null);
 s=change(s,'create',{nickname:'Jogador B'});const b=s.activeProfileId;assert.equal(current(s).balance,1000);assert.equal(current(s).bets.length,0);assert.equal(current(s).friends.length,0);
 s=change(s,'login',{id:a});assert.equal(current(s).balance,900);assert.equal(current(s).bets.length,1);assert.deepEqual(current(s).friends,['bia']);
 assert.equal(s.profiles[b].balance,1000);assert.equal(current(s).transactions.filter(t=>t.ref==='welcome').length,1);
 assert.throws(()=>change(s,'create',{nickname:' ricardo '}),/já existe/);
 assert.throws(()=>change(s,'login',{id:'constructor'}),/não encontrado/);
});
test('integer stakes validated; rejected changes leave state untouched',()=>{
 let s=create();const before=JSON.stringify(s);for(const stake of ['',9,10.5,1001,NaN,Infinity,-50])assert.throws(()=>bet(s,{stake}));assert.equal(JSON.stringify(s),before);
 assert.equal(validStake(10,10),'');assert.equal(payout(101,1.72),174);
 s=bet(s,{stake:101});assert.equal(current(s).balance,899);assert.equal(current(s).bets[0].potential,174);
});
test('demo credit only accepts packages/methods and is idempotent',()=>{
 let s=create();s=change(s,'deposit',{amount:2500,method:'pix',paymentId:'pay1'});assert.equal(current(s).balance,3500);
 const after=JSON.stringify(s);s=change(s,'deposit',{amount:2500,method:'pix',paymentId:'pay1'});assert.equal(JSON.stringify(s),after);
 assert.throws(()=>change(s,'deposit',{amount:-1000,method:'pix',paymentId:'pay2'}));
 assert.throws(()=>change(s,'deposit',{amount:1000,method:'real',paymentId:'pay2'}));
 s=change(s,'deposit',{amount:500,method:'card',paymentId:'pay2'});assert.equal(current(s).balance,4000);assert.equal(current(s).transactions.filter(t=>t.kind==='deposit').length,2);
});
test('bet operation and settlement are atomic and idempotent across profiles',()=>{
 let s=create();const a=s.activeProfileId;s=bet(s);s=bet(s);assert.equal(current(s).balance,900);assert.equal(current(s).bets.length,1);
 s=change(s,'create',{nickname:'BiaTeste'});const b=s.activeProfileId;s=bet(s,{side:'away',operationId:'b2'});
 s=change(s,'settle',{matchId:'m1',winner:'home'});assert.equal(s.profiles[a].balance,1072);assert.equal(s.profiles[a].bets[0].status,'won');assert.equal(s.profiles[b].balance,900);assert.equal(s.profiles[b].bets[0].status,'lost');
 const after=JSON.stringify(s);s=change(s,'settle',{matchId:'m1',winner:'home'});assert.equal(JSON.stringify(s),after);
 assert.throws(()=>change(s,'settle',{matchId:'m1',winner:'away'}),/resultado definido/);
 assert.throws(()=>bet(s,{operationId:'b3'}),/encerrado/);assert.equal(s.profiles[a].transactions.filter(t=>t.kind==='payout').length,1);
 assert.ok(s.profiles[a].achievements.winner);assert.equal(s.profiles[b].achievements.winner,undefined);
});
test('friends, invites, challenges and trophies update consistently',()=>{
 let s=create();s=change(s,'decline',{id:'bia'});assert.equal(current(s).requests.length,0);
 s=change(s,'invite',{id:'leo'});assert.throws(()=>change(s,'invite',{id:'leo'}));
 s=change(s,'simulateAccept',{id:'leo'});assert.deepEqual(current(s).friends,['leo']);assert.equal(current(s).requests.length,0);assert.ok(current(s).achievements.friend);
 s=change(s,'challenge',{id:'leo'});assert.equal(current(s).challenges.length,1);assert.equal(current(s).balance,1000);assert.throws(()=>change(s,'challenge',{id:'leo'}));
 s=change(s,'removeFriend',{id:'leo'});assert.equal(current(s).friends.length,0);assert.equal(current(s).challenges.length,0);
 s=change(s,'favorite',{id:'m4'});s=change(s,'reminder',{id:'m4'});assert.ok(current(s).achievements.favorite);
 for(const view of VIEWS)s=change(s,'visit',{view});assert.ok(current(s).achievements.explorer);
 s=change(s,'readActivity');assert.equal(current(s).unread,0);
});
test('persisted state rehydrates safely, preserving key account values',()=>{
 let s=create();s=bet(s);s=change(s,'favorite',{id:'m2'});const out=restore(JSON.stringify(s));assert.equal(out.activeProfileId,s.activeProfileId);assert.equal(current(out).balance,900);assert.equal(current(out).bets.length,1);assert.equal(current(out).transactions.length,2);assert.deepEqual(current(out).favorites,['m2']);
 assert.deepEqual(restore('{broken'),emptyState());
 const malformed={version:2,profiles:{invalid:{id:'__proto__',nickname:'Nope'},normal:{id:'good',nickname:'Demo',balance:Infinity,bets:[{stake:100,odd:Infinity}],friends:['unlisted'],activity:[null],requests:[null]}},activeProfileId:'constructor'};
 const repaired=restore(malformed);assert.equal(current(repaired),null);assert.equal(repaired.profiles.good.balance,0);assert.equal(repaired.profiles.good.bets.length,0);assert.deepEqual(repaired.profiles.good.friends,[]);
});
test('legacy migration preserves balance and history, orphan history is unassigned',()=>{
 const old=JSON.stringify({nickname:'OldPlayer',balance:720});const bets=JSON.stringify([{id:10,home:'NandoFC',away:'LucasD10',selection:'LucasD10',event:'Copa',stake:100,odds:2.2}]);
 let s=restore(null,old,bets);assert.equal(current(s).balance,720);assert.equal(current(s).bets[0].matchId,'m1');assert.equal(current(s).bets[0].side,'away');assert.equal(current(s).bets[0].potential,220);
 s=change(s,'settle',{matchId:'m1',winner:'away'});assert.equal(current(s).balance,940);
 for(const bad of [null,'null','{broken']){const archive=restore(null,bad,bets);assert.equal(current(archive),null);assert.equal(archive.legacyArchive.length,1);const later=change(archive,'create',{nickname:'New'});assert.equal(current(later).bets.length,0);assert.equal(later.legacyArchive.length,1);}
});
