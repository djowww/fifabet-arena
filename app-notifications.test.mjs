import test from 'node:test';
import assert from 'node:assert/strict';
import * as notices from './app-notifications.mjs';

const ALICE='10000000-0000-0000-0000-000000000001',BOB='10000000-0000-0000-0000-000000000002',ROOM='20000000-0000-0000-0000-000000000001';
function fixture({permission='default',answer='granted',hidden=true}={}){
  const emitted=[],opened=[],values=new Map();let requests=0,isHidden=hidden;
  class BrowserNotification{static permission=permission;static async requestPermission(){requests++;this.permission=answer;return answer;}constructor(title,options){Object.assign(this,{title,options});emitted.push(this);}close(){this.closed=true;}}
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const app=notices.createAppNotifications({Notification:BrowserNotification,storage,hidden:()=>isHidden,onOpen:id=>opened.push(id)});
  return {app,emitted,opened,values,BrowserNotification,get requests(){return requests},hide:value=>{isHidden=value;}};
}
const event=(id='new',extra={})=>({id,duelId:ROOM,...extra});

test('permission is requested only by explicit toggle and denied consent never enables notices',async()=>{
  const h=fixture({answer:'denied'});assert.deepEqual(h.app.status(ALICE),{supported:true,enabled:false,permission:'default'});
  h.app.feed(ALICE,[event('historical')]);assert.equal(h.requests,0);assert.equal(h.emitted.length,0);
  assert.deepEqual(await h.app.toggle(ALICE),{supported:true,enabled:false,permission:'denied'});
  await h.app.toggle(ALICE);assert.equal(h.requests,1);h.app.feed(ALICE,[event()]);assert.equal(h.emitted.length,0);
});

test('only new hidden-page events notify and disabling never replays missed events',async()=>{
  const h=fixture();await h.app.toggle(ALICE);h.app.feed(ALICE,[event('historical')]);assert.equal(h.emitted.length,0);
  h.app.feed(ALICE,[event('historical'),event('second')]);assert.equal(h.emitted.length,1);
  h.app.feed(ALICE,[event('second')]);assert.equal(h.emitted.length,1);
  h.hide(false);h.app.feed(ALICE,[event('visible')]);h.hide(true);h.app.feed(ALICE,[event('visible')]);assert.equal(h.emitted.length,1);
  assert.equal((await h.app.toggle(ALICE)).enabled,false);h.app.feed(ALICE,[event('disabled')]);await h.app.toggle(ALICE);h.app.feed(ALICE,[event('disabled')]);assert.equal(h.emitted.length,1);
  h.app.feed(ALICE,[event('fresh')]);assert.equal(h.emitted.length,2);assert.equal(h.requests,1);
});

test('notice contains no private payload and opens only its validated room for the current owner',async()=>{
  const h=fixture({permission:'granted'});await h.app.toggle(ALICE);h.app.feed(ALICE,[]);
  h.app.feed(ALICE,[event('private-token',{message:'Alice won R$ 999',amount:999,evidenceUrl:'secret-photo'})]);
  assert.equal(h.emitted[0].title,'Fifa GO');assert.equal(h.emitted[0].options.body,'Há uma atualização na sua partida. Abra a arena para conferir.');
  assert.equal(JSON.stringify(h.emitted[0].options).includes('private-token'),false);h.emitted[0].onclick();assert.deepEqual(h.opened,[ROOM]);
  h.app.feed(ALICE,[event('unsafe',{duelId:'../secret'}),event('token',{duelId:'token-invite'}),event('html',{duelId:'<script>'})]);assert.equal(h.emitted.length,1);
});

test('account changes and reset prevent previous-account callbacks and preserve separate preferences',async()=>{
  const h=fixture({permission:'granted'});await h.app.toggle(ALICE);h.app.feed(ALICE,[]);h.app.feed(ALICE,[event('alice')]);const old=h.emitted[0];
  assert.equal(h.app.status(BOB).enabled,false);old.onclick();assert.equal(h.opened.length,0);
  await h.app.toggle(BOB);h.app.feed(BOB,[event('bob-history')]);assert.equal(h.emitted.length,1);
  h.app.feed(BOB,[event('bob-new')]);assert.equal(h.emitted.length,2);h.app.reset();h.emitted[1].onclick();assert.equal(h.opened.length,0);
  assert.equal(h.app.status(ALICE).enabled,true);h.app.feed(ALICE,[event('after-reset-history')]);assert.equal(h.emitted.length,2);
  assert.equal(h.values.size,2);assert.ok([...h.values.keys()].every(key=>!key.includes('@')));
});

test('pending consent cannot enable a different account or restore a logged-out owner',async()=>{
  const h=fixture();let resolve;h.BrowserNotification.requestPermission=()=>new Promise(r=>{resolve=r;});
  const consent=h.app.toggle(ALICE);h.app.status(BOB);h.BrowserNotification.permission='granted';resolve('granted');await consent;
  assert.equal(h.app.status(ALICE).enabled,false);assert.equal(h.app.status(BOB).enabled,false);
  h.BrowserNotification.permission='default';const second=h.app.toggle(ALICE);h.app.reset();h.BrowserNotification.permission='granted';resolve('granted');await second;assert.equal(h.app.status(ALICE).enabled,false);
});

test('missing browser support, invalid owners and blocked preference storage fail safely',async()=>{
  const unavailable=notices.createAppNotifications({Notification:null,storage:null});assert.equal((await unavailable.toggle(ALICE)).supported,false);
  const h=fixture();assert.equal((await h.app.toggle('email@example.com')).enabled,false);assert.equal(h.requests,0);
  const blocked=notices.createAppNotifications({Notification:h.BrowserNotification,storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},hidden:()=>true,onOpen(){}});
  assert.doesNotThrow(()=>blocked.status(ALICE));await assert.doesNotReject(blocked.toggle(ALICE));assert.doesNotThrow(()=>blocked.feed(ALICE,[]));
});

test('deduplication stays bounded while duplicate IDs in one feed emit once',async()=>{
  const h=fixture({permission:'granted'});await h.app.toggle(ALICE);h.app.feed(ALICE,[]);
  h.app.feed(ALICE,[event('same'),event('same')]);assert.equal(h.emitted.length,1);
  h.app.feed(ALICE,Array.from({length:250},(_,i)=>event(`number-${i}`)));const before=h.emitted.length;
  h.app.feed(ALICE,[event('number-249')]);assert.equal(h.emitted.length,before);
  h.app.feed(ALICE,[event('number-0')]);assert.equal(h.emitted.length,before+1);
});

test('browser defaults tolerate blocked storage and focus a verified room without external dependencies',async t=>{
  const h=fixture({permission:'granted'}),descriptors=new Map();let focused=0;
  for(const [key,value]of Object.entries({Notification:h.BrowserNotification,document:{hidden:true},location:{hash:''},focus:()=>{focused++;}})){
    descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  descriptors.set('localStorage',Object.getOwnPropertyDescriptor(globalThis,'localStorage'));Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('storage blocked');}});
  t.after(()=>{for(const [key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const app=notices.createAppNotifications();await app.toggle(ALICE);app.feed(ALICE,[]);app.feed(ALICE,[event('real-defaults')]);
  h.emitted[0].onclick();assert.equal(focused,1);assert.equal(globalThis.location.hash,'#partida/'+ROOM);
});
