import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from './game-policy.mjs';

test('lifecycle defaults and bounded environment overrides',()=>{
  assert.equal(typeof policy.lifecyclePolicy,'function');
  assert.deepEqual(policy.lifecyclePolicy({env:{}}),{inviteMs:86400000,preparationMs:600000,readyMs:120000,matchMs:3600000,reviewMs:86400000,highStake:500});
  assert.equal(policy.lifecyclePolicy({env:{FIFABET_HIGH_STAKE:800}}).highStake,800);
  assert.throws(()=>policy.lifecyclePolicy({env:{FIFABET_MATCH_MS:'-1'}}));
});
test('stored lifecycle retains the agreed deadlines and anchors each phase',()=>{
  assert.equal(typeof policy.storedLifecycle,'function');
  const time=Date.parse('2026-10-02T00:00:00Z'),p=policy.lifecyclePolicy({env:{}});
  assert.equal(policy.storedLifecycle({status:'invited',createdAt:new Date(time).toISOString()},time,p).inviteDeadline,new Date(time+p.inviteMs).toISOString());
  const room={status:'waiting_start',acceptedAt:new Date(time).toISOString(),preparationDeadline:'2026-10-03T00:00:00Z'};
  assert.equal(policy.storedLifecycle(room,time,p).preparationDeadline,room.preparationDeadline);
  assert.equal(policy.storedLifecycle({status:'in_progress',startedAt:new Date(time).toISOString()},time,p).matchDeadline,new Date(time+p.matchMs).toISOString());
  assert.equal(policy.storedLifecycle({status:'disputed',reviewStartedAt:new Date(time).toISOString()},time,p).reviewDeadline,new Date(time+p.reviewMs).toISOString());
});
test('readiness expires at its deadline and excludes nonparticipants',()=>{
  assert.equal(typeof policy.readinessState,'function');
  const time=Date.parse('2026-10-02T00:00:00Z');
  const duel={hostId:'h',guestId:'g',readyBy:['h','g','stranger'],readyAtBy:{h:new Date(time-120000).toISOString(),g:new Date(time-119999).toISOString()},lifecyclePolicy:{readyMs:120000}};
  assert.deepEqual(policy.readinessState(duel,time).readyBy,['g']);
  assert.deepEqual(policy.readinessState(duel,time).expiredBy,['h']);
  assert.deepEqual(duel.readyBy,['h','g','stranger']);
});
test('compatibility and declared identities normalize without inventing legacy agreements',()=>{
  assert.equal(typeof policy.normalizeCompatibility,'function');
  assert.deepEqual(policy.normalizeCompatibility({}),{});
  assert.deepEqual(policy.normalizeGameAccount({eaId:' EA-player ',psnId:'',gameEdition:' FC 26 ',crossplay:'enabled'}),{eaId:'EA-player',gameEdition:'FC 26',crossplay:'enabled'});
  const rules={extraTime:true,penalties:false,disconnectPolicy:'review'};
  assert.deepEqual(policy.normalizeCompatibility({matchRules:rules}),{matchRules:rules});
  for(const data of [{gameEdition:'a'.repeat(41)},{consoleGeneration:5},{crossplay:'yes'},{matchRules:{extraTime:1,penalties:false,disconnectPolicy:'review'}}])assert.throws(()=>policy.normalizeCompatibility(data));
  assert.throws(()=>policy.normalizeGameAccount({xboxId:'a'.repeat(65)}));
});
test('visual fingerprint comparison is bounded, hexadecimal and uses hamming distance',()=>{
  assert.equal(typeof policy.visualHashesSimilar,'function');
  assert.equal(policy.visualHashesSimilar('0000000000000000','000000000000003f'),true);
  assert.equal(policy.visualHashesSimilar('0000000000000000','000000000000007f'),false);
  for(const other of ['',null,'z'.repeat(16),'0'.repeat(100000),'0'.repeat(8)])assert.equal(policy.visualHashesSimilar('0'.repeat(16),other),false);
});
