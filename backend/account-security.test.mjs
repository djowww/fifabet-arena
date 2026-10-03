import test from 'node:test';
import assert from 'node:assert/strict';
import {generateRecoveryCodes,consumeRecoveryCode,createAccountThrottle,sessionList,revokeSessions} from './account-security.mjs';

test('recovery codes are private hashes, one use, no reset by nickname alone',()=>{
 const user={id:'u'},made=generateRecoveryCodes(user);
 assert.equal(made.codes.length,8);assert.equal(user.recoveryCodes.length,8);
 assert.ok(!JSON.stringify(user).includes(made.codes[0]));
 assert.equal(consumeRecoveryCode(user,'bad'),false);
 assert.equal(consumeRecoveryCode(user,made.codes[0]),true);
 assert.equal(consumeRecoveryCode(user,made.codes[0]),false);
 assert.equal(user.recoveryCodes.length,7);
});
test('account throttle follows account across IPs and expires without permanent account lock',()=>{
 let time=0;const throttle=createAccountThrottle({now:()=>time,max:3,windowMs:1000});
 for(let i=0;i<3;i++)throttle.check('CAdo');
 assert.throws(()=>throttle.check('cado'),/Muitas/);
 throttle.check('another');time=1001;assert.doesNotThrow(()=>throttle.check('cado'));
});
test('session list and revocation are scoped to owner and expose no cookie or CSRF',()=>{
 const state={sessions:{a:{userId:'u',createdAt:1,expiresAt:5000,csrfToken:'secret'},b:{userId:'u',createdAt:2,expiresAt:5000},c:{userId:'v',createdAt:3,expiresAt:5000}}};
 const rows=sessionList(state,'u','a',0);assert.equal(rows.length,2);assert.equal(rows.filter(s=>s.current).length,1);assert.ok(!JSON.stringify(rows).includes('secret'));
 assert.throws(()=>revokeSessions(state,'u','a',{id:sessionList(state,'v','c',0)[0].id}),/não encontrada/);
 revokeSessions(state,'u','a',{allOthers:true});assert.ok(state.sessions.a);assert.ok(state.sessions.c);assert.equal(state.sessions.b,undefined);
});
