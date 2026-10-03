import test from 'node:test';
import assert from 'node:assert/strict';
import {rankingFor} from './ranking-policy.mjs';
const users={a:{id:'a',publicPlayerId:'A',nickname:'A'},b:{id:'b',publicPlayerId:'B',nickname:'B'},c:{id:'c',publicPlayerId:'C',nickname:'C'}};
const match=(id,winner='host',date='2026-10-02T00:00:00Z')=>({id,hostId:'a',guestId:'b',status:'completed',winner,winnerId:winner==='draw'?null:winner==='host'?'a':'b',result:{id:'r'+id},review:{resultId:'r'+id,approvedAt:date},settlement:{date}});
test('only verified current results count and rating changes by Elo',()=>{
  assert.equal(typeof rankingFor,'function');
  const ranked=rankingFor({users,duels:{x:match('x'),y:{...match('y'),review:{resultId:'stale',approvedAt:'2026-10-02'}}}},'a');
  assert.equal(ranked.personal.rating,1012);assert.equal(ranked.personal.points,3);assert.equal(ranked.personal.wins,1);assert.equal(ranked.personal.position,1);
  assert.equal(ranked.entries.find(e=>e.player.publicPlayerId==='B').rating,988);
  assert.equal(Object.hasOwn(ranked.entries[0].player,'balance'),false);
});
test('pair daily cap affects ranking only, resets UTC day and draws give one point',()=>{
  assert.equal(typeof rankingFor,'function');
  const duels=Object.fromEntries(Array.from({length:4},(_,i)=>['m'+i,match('m'+i)]));
  duels.next=match('next','draw','2026-10-03T00:00:00Z');
  const ranked=rankingFor({users,duels},'a');
  assert.equal(ranked.personal.played,4);assert.equal(ranked.personal.points,10);assert.equal(ranked.personal.draws,1);assert.equal(Object.values(duels).length,5);
  assert.equal(ranked.policy.maxPairResultsPerUtcDay,3);
});
test('ranking ties resolve by stable user ID and personal position remains global',()=>{
  assert.equal(typeof rankingFor,'function');
  const duels={x:match('x','draw'),y:{...match('y','draw'),hostId:'b',guestId:'c'},z:{...match('z','draw'),hostId:'a',guestId:'c'}};
  const ranked=rankingFor({users,duels},'c',{limit:1});
  assert.equal(ranked.entries.length,1);assert.equal(ranked.entries[0].player.publicPlayerId,'A');assert.equal(ranked.personal.position,3);
  assert.equal(rankingFor({users,duels:{}},'missing').personal,null);
});
test('personal rank is explicit and inactive complete accounts are marked unranked',()=>{
 const ranked=rankingFor({users,duels:{x:match('x')}},'c',{limit:1});
 assert.equal(ranked.personal.rank,null);assert.equal(ranked.personal.position,null);assert.equal(ranked.personal.unranked,true);
 assert.deepEqual(rankingFor({users,duels:{}},'c').entries,[]);
 assert.equal(ranked.personal.rating,1000);
 assert.equal(rankingFor({users,duels:{x:match('x')}},'a').personal.unranked,false);
});
