import test from 'node:test';
import assert from 'node:assert/strict';

import {createPendingFlow as pending,createResultDraftStore as drafts} from './flow-continuity.mjs';
function storage() {
  const values = new Map();
  return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}

test('pending flows survive a new instance without persisting unrelated private fields',()=>{
  const session=storage(),flow=pending({storage:session,now:()=>1000});
  assert.equal(flow.save({action:'rematch',draft:{mode:'1v1',platform:'playstation',rival:'fba-aabbccddee',rules:'Jogo único',visibility:'private',stake:'100',gameEdition:'FC 26',consoleGeneration:'PS5',crossplay:'enabled',extraTime:true,penalties:false,owner:'private-owner',balance:1000,file:new Blob(['photo'])},password:'secret',session:'private-session'}),true);
  const expected={action:'rematch',draft:{mode:'1v1',platform:'playstation',rival:'FBA-AABBCCDDEE',rules:'Jogo único',visibility:'private',stake:'100',gameEdition:'FC 26',consoleGeneration:'PS5',crossplay:'enabled',extraTime:true,penalties:false}};
  assert.deepEqual(pending({storage:session,now:()=>1001}).read(),expected);
  assert.deepEqual(flow.read(),expected);
  const serialized=[...session.values.values()].join('');
  assert.doesNotMatch(serialized,/private-owner|balance|photo|secret|private-session/);
  flow.clear();assert.equal(flow.read(),null);assert.equal(pending({storage:session,now:()=>1001}).read(),null);
});

test('pending invite code is normalized and reading does not consume it',()=>{
  const flow=pending({storage:storage(),now:()=>0});
  assert.equal(flow.save({action:'join-code',joinCode:' fg-aabbccddee '}),true);
  assert.deepEqual(flow.read(),{action:'join-code',joinCode:'FG-AABBCCDDEE'});
  assert.deepEqual(flow.read(),{action:'join-code',joinCode:'FG-AABBCCDDEE'});
});

test('pending flows expire at the boundary and reject malformed storage',()=>{
  let time=100;const session=storage(),flow=pending({storage:session,now:()=>time,ttlMs:50});
  flow.save({action:'create',draft:{stake:0,rival:''}});
  time=149;assert.deepEqual(flow.read(),{action:'create',draft:{stake:0,rival:''}});
  time=150;assert.equal(flow.read(),null);assert.equal(session.values.size,0);
  flow.save({action:'deposit'});
  const key=[...session.values.keys()][0];session.values.set(key,'{invalid');
  assert.equal(flow.read(),null);assert.equal(session.values.size,0);
  session.values.set(key,JSON.stringify({version:1,expiresAt:9999999999,intent:{action:'create',draft:{stake:0}}}));
  assert.equal(flow.read(),null);
});

test('pending flows reject unsupported actions and invalid recognized field values',()=>{
  const flow=pending({storage:storage(),now:()=>100});
  for(const intent of [
    {action:'settle'}, {action:'create',draft:[]}, {action:'create',draft:{mode:'other'}},
    {action:'create',draft:{platform:'invalid'}}, {action:'create',draft:{rival:'internal-uuid'}},
    {action:'create',draft:{stake:-1}}, {action:'create',draft:{stake:'2.5'}},
    {action:'create',draft:{stake:5001}}, {action:'create',draft:{stake:'Infinity'}},
    {action:'create',draft:{rules:'x'.repeat(241)}}, {action:'create',draft:{gameEdition:'x'.repeat(41)}},
    {action:'create',draft:{extraTime:'true'}}, {action:'create',draft:{crossplay:'maybe'}},
    {action:'join-code',joinCode:'https://example.test/?secret=token'},
    {action:'join-code',joinCode:'FG-invalid'},
  ]) {
    flow.save({action:'deposit'});
    assert.equal(flow.save(intent),false,JSON.stringify(intent));
    assert.equal(flow.read(),null,'Invalid saves must not leave an older intent.');
  }
});

test('tampered pending envelopes cannot extend expiry or restore invalid fields',()=>{
  const session=storage(),flow=pending({storage:session,now:()=>1000});
  flow.save({action:'create'});const key=[...session.values.keys()][0];
  for(const envelope of [
    {version:1,createdAt:1000,expiresAt:901001,intent:{action:'deposit'}},
    {version:1,createdAt:1001,expiresAt:2000,intent:{action:'deposit'}},
    {version:1,createdAt:1000,expiresAt:2000,intent:{action:'create',draft:{stake:{amount:100}}}},
    {version:1,createdAt:1000,expiresAt:2000,intent:{action:'join-code',joinCode:'private-token'}},
    {version:2,createdAt:1000,expiresAt:2000,intent:{action:'deposit'}},
  ]) {
    session.values.set(key,JSON.stringify(envelope));assert.equal(flow.read(),null);assert.equal(session.values.size,0);
  }
});

test('pending storage failure is nonthrowing and fallback does not cross helper instances',()=>{
  const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Denied');},removeItem(){throw Error('Denied');}};
  const flow=pending({storage:denied,now:()=>100});
  assert.equal(flow.save({action:'create',draft:{stake:'250'}}),true);
  assert.deepEqual(flow.read(),{action:'create',draft:{stake:'250'}});
  assert.equal(pending({storage:denied,now:()=>100}).read(),null);
  flow.clear();assert.equal(flow.read(),null);
});

test('a failed storage write uses the current fallback rather than an older stored intent',()=>{
  const session=storage(),flow=pending({storage:session,now:()=>100});
  flow.save({action:'deposit'});
  session.setItem=()=>{throw Error('Full');};
  flow.save({action:'create',draft:{stake:'0'}});
  assert.deepEqual(flow.read(),{action:'create',draft:{stake:'0'}});
});

test('private result drafts retain file reference and are isolated by account and room',()=>{
  const store=drafts({now:()=>100}),file=new Blob(['private-photo']),value={file,photo:null,scores:{own:2,rival:1}};
  assert.equal(store.put('alice','room-1',value),true);
  assert.equal(store.get('alice','room-1'),value);
  assert.equal(store.get('alice','room-1').file,file);
  assert.equal(store.get('bob','room-1'),null);assert.equal(store.get('alice','room-2'),null);
  assert.equal(store.delete('bob','room-1'),false);assert.equal(store.get('alice','room-1'),value);
  assert.equal(store.delete('alice','room-1'),true);assert.equal(store.get('alice','room-1'),null);
});

test('private result drafts reject missing identity and expire without renewing on read',()=>{
  let time=100;const store=drafts({now:()=>time,ttlMs:50}),value={scores:{own:0,rival:0}};
  for(const [owner,id] of [[null,'r'],['','r'],['a',null],['a',''],['  ','r']])assert.equal(store.put(owner,id,value),false);
  assert.equal(store.put('a','r',value),true);
  time=149;assert.equal(store.get('a','r'),value);
  time=150;assert.equal(store.get('a','r'),null);
});

test('private result draft capacity evicts the oldest write and clear removes all owners',()=>{
  const store=drafts({now:()=>100,maxEntries:2}),one={file:'one'},two={file:'two'},three={file:'three'};
  store.put('a','one',one);store.put('b','two',two);store.put('a','one',one);store.put('a','three',three);
  assert.equal(store.get('b','two'),null);assert.equal(store.get('a','one'),one);assert.equal(store.get('a','three'),three);
  store.clear();assert.equal(store.get('a','one'),null);assert.equal(store.get('a','three'),null);
});

test('separate result draft stores cannot access another instance private drafts',()=>{
  const one=drafts({now:()=>100}),two=drafts({now:()=>100});
  one.put('a','r',{photo:'private'});assert.equal(two.get('a','r'),null);
});
