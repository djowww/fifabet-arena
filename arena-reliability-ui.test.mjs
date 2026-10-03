import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from './room-ui.mjs';
import * as api from './backend-client.mjs';
import {renderRankingView,renderWalletView,renderProfileView} from './account-views.mjs';
const context={user:{nickname:'Rival',publicPlayerId:'FBA-ME',gameAccount:{eaId:'RivalEA',gameEdition:'FC 26'}},online:true,esc:x=>String(x??'').replaceAll('<','&lt;'),fmt:String,when:String,brl:String,avatar:()=>'',btn:(a,id,label)=>`<button data-action='${a}'>${label}</button>`,intro:()=>'',empty:()=>'',guest:()=>'',legacyDemoView:()=>''};
test('ranking includes personal rank outside top list and daily pair policy',()=>{
 const html=renderRankingView({...context,entries:[],personal:{rank:123,rating:1010,points:9,played:4,wins:3,draws:0,losses:1},policy:{pairDailyLimit:3}});
 assert.match(html,/123/);assert.match(html,/1010/);assert.match(html,/mesmo par/);
});
test('wallet renders full loaded pages, matching public ID and next-page controls',()=>{
 const transactions=Array.from({length:45},(_,i)=>({id:String(i),label:`movimento-${i}`,amount:1,publicMatchId:'FG-1234567890',balanceAfter:i+1,date:'date'}));
 const html=renderWalletView({...context,wallet:{balance:45,reserved:0,transactions,deposits:[],transactionsNextCursor:'next'}});
 assert.match(html,/movimento-44/);assert.match(html,/FG-1234567890/);assert.match(html,/wallet-more-transactions/);
});
test('profile displays manually declared game identity without claiming integration',()=>{
 const html=renderProfileView(context);assert.match(html,/RivalEA/);assert.match(html,/FC 26/);assert.match(html,/declarad/);
});

test('deferred renders retain changes across unchanged polls until safe to flush',()=>{
 const gate=ui.createRenderGate();gate.mark(true);assert.equal(gate.flush(false),false);gate.mark(false);assert.equal(gate.flush(true),true);assert.equal(gate.flush(true),false);
});
test('arena filters combine entry, available balance, mode and platform',()=>{
 const rooms=[{platform:'pc',mode:'1v1',stake:50},{platform:'xbox',mode:'1v1',stake:0},{platform:'pc',mode:'Clubes',stake:100}];
 assert.deepEqual(ui.filterRooms(rooms,{platform:'pc',mode:'1v1',affordable:true,maxStake:'75'},60),[rooms[0]]);
});
test('notification labels preserve actual expired phase messages as plain text',()=>{
 assert.equal(ui.notificationLabel({type:'result_confirmation',message:'O prazo terminou. Aguarde a equipe.'}),'O prazo terminou. Aguarde a equipe.');
 assert.notEqual(ui.notificationKey({id:'result',createdAt:'date',message:'Envie sua foto.'}),ui.notificationKey({id:'result',createdAt:'date',message:'O prazo terminou.'}));
});
test('readiness presentation expires individual confirmations without mutating the server room',()=>{
 const now=Date.parse('2026-10-02T12:00:00Z'),room={hostId:'host',guestId:'guest',readyBy:['host','guest'],readyAtBy:{host:new Date(now-120001).toISOString(),guest:new Date(now-60000).toISOString()},lifecyclePolicy:{readyMs:120000}};
 assert.deepEqual(ui.preparationState(room,'host',now),{ownReady:false,rivalReady:true});assert.deepEqual(room.readyBy,['host','guest']);
});
test('cursor transport retains old defaults and supports compact arena, independent wallet pages and unready',async t=>{
 const original=globalThis.fetch,calls=[];t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response('{}',{headers:{'Content-Type':'application/json'}});};
 await api.getArena({compact:true});await api.getWallet({cursor:'a/b',depositCursor:'c',limit:20});await api.getHistory({cursor:'d',limit:20});await api.unreadyDuel('room/a');
 assert.equal(calls[0].url,'/api/v1/me?compact=1');assert.match(calls[1].url,/cursor=a%2Fb/);assert.match(calls[1].url,/depositCursor=c/);assert.equal(calls[2].url,'/api/v1/history?cursor=d&limit=20');assert.equal(calls[3].url,'/api/v1/duels/room%2Fa/unready');assert.equal(calls[3].options.body,'{}');
});
