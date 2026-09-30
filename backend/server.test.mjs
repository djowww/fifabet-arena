import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createArenaServer} from './server.mjs';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
async function harness(t){
  const dataDir=await mkdtemp(join(tmpdir(),'fifabet-backend-test-'));
  const arena=await createArenaServer({dataDir});
  await new Promise(resolve=>arena.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${arena.server.address().port}`;
  t.after(async()=>{await arena.close();await rm(dataDir,{recursive:true,force:true});});
  function client(){
    let cookie='',csrfToken=null;
    return {
      get cookie(){return cookie;},
      async api(path,{method='GET',data,body,mime,csrf=true,origin=base}={}){
        const headers={Origin:origin};
        if(cookie)headers.Cookie=cookie;
        if(csrf&&csrfToken)headers['X-CSRF-Token']=csrfToken;
        if(data!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(data);}
        if(mime)headers['Content-Type']=mime;
        const response=await fetch(`${base}/api/v1${path}`,{method,headers,body});
        const payload=String(response.headers.get('content-type')).startsWith('application/json')?await response.json():Buffer.from(await response.arrayBuffer());
        const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
        if(payload&&Object.hasOwn(payload,'csrfToken'))csrfToken=payload.csrfToken;
        return {status:response.status,data:payload};
      },
      async register(name){const result=await this.api('/auth/register',{method:'POST',data:{nickname:name,password:'a robust testing passphrase'}});assert.equal(result.status,200);return result.data.user;},
      async upload(duelId){const result=await this.api(`/evidence?duelId=${duelId}`,{method:'POST',body:PNG,mime:'image/png'});assert.equal(result.status,200);return result.data.evidence;}
    };
  }
  return {arena,dataDir,base,client};
}

test('authenticated sessions, origin and CSRF protect mutations; users cannot change server balances',async t=>{
  const h=await harness(t),alice=h.client(),visitor=h.client();
  assert.equal((await visitor.api('/me')).status,401);
  const user=await alice.register('Alice');
  assert.match(user.publicPlayerId,/^FBA-[A-F0-9]{10}$/);
  assert.equal(user.balance,1000);assert.equal(user.isReviewer,false);
  assert.equal((await alice.api('/me',{method:'PATCH',csrf:false,data:{nickname:'Alice2'}})).status,403);
  assert.equal((await alice.api('/me',{method:'PATCH',origin:'https://attacker.example',data:{nickname:'Alice2'}})).status,403);
  const profile=await alice.api('/me',{method:'PATCH',data:{nickname:'Alice2',clubId:'internacional',balance:9000000,isReviewer:true}});
  assert.equal(profile.status,200);assert.equal(profile.data.user.balance,1000);assert.equal(profile.data.user.isReviewer,false);
  assert.equal(profile.data.user.publicPlayerId,user.publicPlayerId);assert.equal(profile.data.user.clubId,'internacional');
  const stored=await readFile(join(h.dataDir,'state.json'),'utf8');
  assert.ok(!stored.includes('a robust testing passphrase'));
  assert.ok(!stored.includes(alice.cookie.split('=')[1]));
  assert.equal((await alice.api('/auth/logout',{method:'POST',data:{}})).status,200);
  assert.equal((await alice.api('/me')).status,401);
  assert.equal((await alice.api('/auth/login',{method:'POST',data:{identifier:user.publicPlayerId,password:'wrong password'}})).status,401);
  const login=await alice.api('/auth/login',{method:'POST',data:{identifier:user.publicPlayerId,password:'a robust testing passphrase'}});
  assert.equal(login.status,200);assert.equal(login.data.user.nickname,'Alice2');
});

test('only invited player accepts a direct challenge; point reserves cannot overspend concurrently',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),other=h.client();
  const hostUser=await host.register('Host'),guestUser=await guest.register('Guest');await other.register('Other');
  const created=await host.api('/duels',{method:'POST',data:{stake:200,mode:'1v1',platform:'pc',opponentPlayerId:guestUser.publicPlayerId,rules:'Seis minutos, sem prorrogação.'}});
  const duel=created.data.duel;
  assert.equal((await host.api('/me')).data.user.balance,800);
  assert.equal((await other.api(`/invites/${created.data.inviteToken}/accept`,{method:'POST',data:{}})).status,403);
  const accepted=await guest.api(`/duels/${duel.id}/accept`,{method:'POST',data:{}});
  assert.equal(accepted.status,200);assert.equal(accepted.data.duel.status,'in_progress');
  assert.equal((await guest.api('/me')).data.user.balance,800);
  assert.equal((await guest.api(`/duels/${duel.id}/accept`,{method:'POST',data:{}})).status,409);
  assert.equal((await guest.api('/me')).data.user.balance,800);
  const results=await Promise.all(Array.from({length:6},()=>host.api('/duels',{method:'POST',data:{stake:200,mode:'1v1',platform:'pc'}})));
  assert.equal(results.filter(r=>r.status===200).length,4);
  assert.equal(results.filter(r=>r.status===409).length,2);
  const arena=(await host.api('/me')).data;
  assert.equal(arena.user.balance,0);assert.equal(arena.stats.reserved,1000);
  assert.equal(arena.user.friends[0].id,guestUser.id);
  assert.equal((await guest.api(`/players/${hostUser.publicPlayerId}`)).data.player.id,hostUser.id);
});

test('invite previews require authentication and expose only the authorized invitation terms',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),other=h.client(),visitor=h.client();
  const hostUser=await host.register('Host'),guestUser=await guest.register('Guest');await other.register('Other');
  const created=await host.api('/duels',{method:'POST',data:{stake:100,mode:'1v1',platform:'pc',opponentPlayerId:guestUser.publicPlayerId,rules:'Seis minutos, sem prorrogação.'}});
  const path=`/invites/${created.data.inviteToken}`;
  assert.equal((await visitor.api(path)).status,401);
  const wrongRecipient=await other.api(path);
  assert.equal(wrongRecipient.status,403);assert.equal(wrongRecipient.data.code,'invite_wrong_recipient');
  assert.deepEqual(Object.keys(wrongRecipient.data).sort(),['code','error']);
  const preview=await guest.api(path);
  assert.equal(preview.status,200);
  assert.deepEqual(Object.keys(preview.data),['invite']);
  assert.deepEqual(Object.keys(preview.data.invite).sort(),['expiresAt','host','mode','platform','rules','stake','status']);
  assert.deepEqual(preview.data.invite.host,{nickname:'Host'});
  assert.equal(preview.data.invite.status,'invited');assert.equal(preview.data.invite.stake,100);
  assert.ok(!JSON.stringify(preview.data).includes(hostUser.id));assert.ok(!JSON.stringify(preview.data).includes(hostUser.publicPlayerId));
  assert.ok(!JSON.stringify(preview.data).includes(created.data.duel.id));
  const own=await host.api(`${path}/accept`,{method:'POST',data:{}});
  assert.equal(own.status,409);assert.equal(own.data.code,'invite_own');
  const accepted=await guest.api(`${path}/accept`,{method:'POST',data:{}});
  assert.equal(accepted.status,200);
  const photo=await host.upload(created.data.duel.id);
  assert.equal((await host.api(`/duels/${created.data.duel.id}/result`,{method:'POST',data:{homeScore:3,awayScore:1,evidenceId:photo.id}})).status,200);
  for(const client of [host,guest]){
    const consumed=await client.api(path);
    assert.equal(consumed.status,409);assert.equal(consumed.data.code,'invite_already_accepted');
    assert.deepEqual(Object.keys(consumed.data).sort(),['code','error']);
  }
});

test('invalid, missing, consumed and cancelled invite codes have clear errors without exposing match data',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),other=h.client();
  await host.register('Host');await guest.register('Guest');await other.register('Other');
  for(const client of [host,guest]){
    const invalid=await client.api('/invites/not-a-valid-code');
    assert.equal(invalid.status,400);assert.equal(invalid.data.code,'invite_invalid');
    const missing=await client.api(`/invites/${'Z'.repeat(43)}`);
    assert.equal(missing.status,404);assert.equal(missing.data.code,'invite_not_found');
  }
  const created=await host.api('/duels',{method:'POST',data:{stake:100,mode:'1v1',platform:'pc'}});
  const path=`/invites/${created.data.inviteToken}`;
  assert.equal((await guest.api(path)).status,200);
  assert.equal((await guest.api(`${path}/accept`,{method:'POST',data:{}})).status,200);
  for(const method of ['GET','POST']){
    const response=await other.api(`${path}${method==='POST'?'/accept':''}`,{method,...(method==='POST'?{data:{}}:{})});
    assert.equal(response.status,409);assert.equal(response.data.code,'invite_already_accepted');
    assert.deepEqual(Object.keys(response.data).sort(),['code','error']);
  }
  const second=await host.api('/duels',{method:'POST',data:{stake:100,mode:'1v1',platform:'pc'}});
  await host.api(`/duels/${second.data.duel.id}/cancel`,{method:'POST',data:{}});
  const cancelled=await guest.api(`/invites/${second.data.inviteToken}`);
  assert.equal(cancelled.status,410);assert.equal(cancelled.data.code,'invite_cancelled');
  assert.equal((await guest.api('/me')).data.user.balance,900);
});

test('expired invite links reject previews and acceptance and return the host reserve once',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client();await host.register('Host');await guest.register('Guest');
  const created=await host.api('/duels',{method:'POST',data:{stake:100,mode:'1v1',platform:'pc'}});
  const future=Date.now()+8*86_400_000;
  t.mock.method(Date,'now',()=>future);
  const path=`/invites/${created.data.inviteToken}`;
  for(const method of ['GET','POST']){
    const response=await guest.api(`${path}${method==='POST'?'/accept':''}`,{method,...(method==='POST'?{data:{}}:{})});
    assert.equal(response.status,410);assert.equal(response.data.code,'invite_expired');
    assert.deepEqual(Object.keys(response.data).sort(),['code','error']);
  }
  const arena=(await host.api('/me')).data;
  assert.equal(arena.user.balance,1000);assert.equal(arena.stats.reserved,0);assert.equal(arena.history[0].status,'expired');
  assert.equal((await host.api('/me')).data.user.balance,1000);
  assert.equal(arena.user.transactions.filter(tx=>tx.reference===`expiry:${created.data.duel.id}`).length,1);
  assert.equal((await guest.api('/me')).data.user.balance,1000);
});

test('a stable creation operation reserves credits once despite concurrent retries and rejects changed terms',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client();const hostUser=await host.register('Host'),guestUser=await guest.register('Guest');
  const payload={operationId:randomUUID(),expectedHostId:hostUser.id,stake:250,mode:'1v1',platform:'pc',rules:'Seis minutos.',opponentPlayerId:guestUser.publicPlayerId};
  const results=await Promise.all([host.api('/duels',{method:'POST',data:payload}),host.api('/duels',{method:'POST',data:payload})]);
  for(const result of results){assert.equal(result.status,200);assert.equal(result.data.duel.operationId,payload.operationId);assert.ok(!Object.hasOwn(result.data.duel,'creationOperationId'));assert.ok(!Object.hasOwn(result.data.duel,'creationOperationSignature'));}
  assert.equal(results[0].data.duel.id,results[1].data.duel.id);assert.equal(results[0].data.inviteToken,results[1].data.inviteToken);
  const arena=(await host.api('/me')).data;
  assert.equal(arena.user.balance,750);assert.equal(arena.stats.reserved,250);assert.equal(arena.duels.length,1);
  assert.equal(arena.duels[0].operationId,payload.operationId);
  assert.ok(!Object.hasOwn((await guest.api('/me')).data.duels[0],'operationId'));
  assert.equal(arena.user.transactions.filter(tx=>tx.reference===`reserve:${results[0].data.duel.id}`).length,1);
  const differentSession=await guest.api('/duels',{method:'POST',data:payload});
  assert.equal(differentSession.status,409);assert.equal(differentSession.data.code,'account_changed');
  const guestArena=(await guest.api('/me')).data;
  assert.equal(guestArena.user.balance,1000);assert.equal(guestArena.stats.reserved,0);
  assert.equal(guestArena.duels.filter(duel=>duel.hostId===guestUser.id).length,0);
  assert.equal((await host.api('/me')).data.duels.length,1);
  const conflict=await host.api('/duels',{method:'POST',data:{...payload,stake:100}});
  assert.equal(conflict.status,409);assert.equal(conflict.data.code,'operation_conflict');
  assert.equal((await host.api('/me')).data.user.balance,750);
  const invalid=await host.api('/duels',{method:'POST',data:{...payload,operationId:'not-a-uuid'}});
  assert.equal(invalid.status,400);assert.equal(invalid.data.code,'invalid_operation_id');
  const accepted=await guest.api(`/invites/${results[0].data.inviteToken}/accept`,{method:'POST',data:{}});
  assert.equal(accepted.status,200);assert.ok(!Object.hasOwn(accepted.data.duel,'operationId'));
  const retryAfterAcceptance=await host.api('/duels',{method:'POST',data:payload});
  assert.equal(retryAfterAcceptance.status,200);assert.equal(retryAfterAcceptance.data.duel.status,'in_progress');
  assert.ok(!Object.hasOwn(retryAfterAcceptance.data,'inviteToken'));assert.equal((await host.api('/me')).data.user.balance,750);
});

test('a direct invite recipient may decline before accepting; only the host reserve is refunded once',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),outsider=h.client();
  const hostUser=await host.register('Host'),guestUser=await guest.register('Guest');await outsider.register('Outsider');
  const created=await host.api('/duels',{method:'POST',data:{stake:250,mode:'1v1',platform:'pc',opponentPlayerId:guestUser.publicPlayerId}});
  const id=created.data.duel.id;
  assert.equal((await host.api('/me')).data.user.balance,750);
  assert.equal((await guest.api('/me')).data.user.balance,1000);
  assert.equal((await outsider.api(`/duels/${id}/cancel`,{method:'POST',data:{}})).status,404);
  const attempts=await Promise.all([guest.api(`/duels/${id}/cancel`,{method:'POST',data:{}}),guest.api(`/duels/${id}/cancel`,{method:'POST',data:{}})]);
  assert.equal(attempts.filter(result=>result.status===200).length,1);
  assert.equal(attempts.filter(result=>result.status===409).length,1);
  const declined=attempts.find(result=>result.status===200).data.duel;
  assert.equal(declined.status,'cancelled');assert.equal(declined.cancellationReason,'declined');assert.equal(declined.cancelledBy,guestUser.id);assert.equal(declined.guestId,null);
  assert.equal((await host.api(`/duels/${id}/cancel`,{method:'POST',data:{}})).status,409);
  const acceptDeclined=await guest.api(`/duels/${id}/accept`,{method:'POST',data:{}});
  assert.equal(acceptDeclined.status,410);assert.equal(acceptDeclined.data.code,'invite_cancelled');
  const hostArena=(await host.api('/me')).data,guestArena=(await guest.api('/me')).data;
  assert.equal(hostArena.user.balance,1000);assert.equal(guestArena.user.balance,1000);
  assert.equal(hostArena.stats.reserved,0);assert.equal(guestArena.stats.reserved,0);
  assert.equal(hostArena.user.transactions.filter(tx=>tx.reference===`cancel:${id}`).length,1);
  assert.equal(guestArena.user.transactions.filter(tx=>tx.reference===`cancel:${id}`).length,0);
  assert.equal(hostArena.history[0].id,id);assert.equal(guestArena.history[0].id,id);
  assert.equal(hostArena.history[0].host.id,hostUser.id);
});

test('stake API accepts integers from 10 to 5000, while always enforcing available server balance',async t=>{
  const h=await harness(t),host=h.client();await host.register('Host');
  const create=stake=>host.api('/duels',{method:'POST',data:{stake,mode:'1v1',platform:'pc'}});
  for(const invalid of [0,9,10.5,5001,-100,'100'])assert.equal((await create(invalid)).status,400);
  assert.equal((await create(5000)).status,409); // Valid limit, but this account has only 1000 points.
  const minimum=await create(10);assert.equal(minimum.status,200);
  assert.equal((await host.api('/me')).data.user.balance,990);
  assert.equal((await host.api(`/duels/${minimum.data.duel.id}/cancel`,{method:'POST',data:{}})).status,200);
  const available=await create(1000);assert.equal(available.status,200);
  assert.equal((await host.api('/me')).data.user.balance,0);
  assert.equal((await create(10)).status,409);
});

test('private result photos and team review release points exactly once; peer agreement never settles',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),outsider=h.client(),reviewer=h.client();
  const hostUser=await host.register('Host'),guestUser=await guest.register('Guest');await outsider.register('Outsider');const team=await reviewer.register('ReviewTeam');
  h.arena.reviewerIds.add(team.id);h.arena.reviewerIds.add(hostUser.id);
  const created=await host.api('/duels',{method:'POST',data:{stake:100,mode:'Ultimate Team',platform:'playstation'}});
  const id=created.data.duel.id;
  assert.equal((await guest.api(`/invites/${created.data.inviteToken}/accept`,{method:'POST',data:{}})).status,200);
  const photo=await host.upload(id);
  assert.equal((await outsider.api(`/evidence/${photo.id}`)).status,404);
  assert.equal((await guest.api(`/evidence/${photo.id}`)).status,200);
  assert.equal((await reviewer.api(`/evidence/${photo.id}`)).status,200);
  const forged=await host.api(`/evidence?duelId=${id}`,{method:'POST',body:Buffer.from('<svg onload="alert(1)"></svg>'),mime:'image/png'});
  assert.equal(forged.status,400);
  const result=await host.api(`/duels/${id}/result`,{method:'POST',data:{homeScore:3,awayScore:1,evidenceId:photo.id}});
  assert.equal(result.status,200);assert.equal(result.data.duel.status,'pending_review');
  const reportId=result.data.duel.result.id;
  assert.equal((await host.api(`/duels/${id}/confirm`,{method:'POST',data:{reportId}})).status,403);
  assert.equal((await guest.api(`/duels/${id}/confirm`,{method:'POST',data:{reportId}})).status,200);
  assert.equal((await host.api('/me')).data.user.balance,900);assert.equal((await guest.api('/me')).data.user.balance,900);
  const review={winner:'host',reason:'Conferi a foto e o placar está correto.',reportId};
  assert.equal((await outsider.api(`/reviews/${id}`,{method:'POST',data:review})).status,403);
  assert.equal((await host.api(`/reviews/${id}`,{method:'POST',data:review})).status,403);
  assert.equal((await reviewer.api(`/reviews/${id}`,{method:'POST',data:review})).status,200);
  assert.equal((await reviewer.api(`/reviews/${id}`,{method:'POST',data:review})).status,409);
  const closed=(await host.api('/me')).data;
  assert.equal(closed.user.balance,1100);assert.equal((await guest.api('/me')).data.user.balance,900);
  assert.equal(closed.stats.played,1);assert.equal(closed.stats.wins,1);assert.equal(closed.stats.reserved,0);
  assert.equal(closed.history[0].winnerId,hostUser.id);assert.equal(closed.history[0].guest.id,guestUser.id);
  assert.equal(closed.user.transactions.filter(tx=>tx.reference===`settlement:${id}`).length,1);
});

test('disputes preserve evidence and revisions; stale confirmations or reviews cannot approve a changed report',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),reviewer=h.client();
  await host.register('Host');await guest.register('Guest');const team=await reviewer.register('ReviewTeam');h.arena.reviewerIds.add(team.id);
  const created=await host.api('/duels',{method:'POST',data:{stake:50,mode:'1v1',platform:'xbox'}}),id=created.data.duel.id;
  await guest.api(`/invites/${created.data.inviteToken}/accept`,{method:'POST',data:{}});
  const one=await host.upload(id),two=await guest.upload(id);
  const first=await host.api(`/duels/${id}/result`,{method:'POST',data:{homeScore:2,awayScore:0,evidenceId:one.id}});
  const oldId=first.data.duel.result.id;
  const disputed=await guest.api(`/duels/${id}/dispute`,{method:'POST',data:{reason:'O placar final da minha tela é outro.',evidenceId:two.id,reportId:oldId}});
  assert.equal(disputed.status,200);assert.equal(disputed.data.duel.status,'disputed');
  assert.equal((await guest.api(`/duels/${id}/confirm`,{method:'POST',data:{reportId:oldId}})).status,409);
  const corrected=await guest.api(`/duels/${id}/result`,{method:'POST',data:{homeScore:1,awayScore:1,evidenceId:two.id}});
  assert.equal(corrected.data.duel.reports.length,2);assert.equal(corrected.data.duel.disputes.length,1);
  assert.equal((await host.api(`/duels/${id}/confirm`,{method:'POST',data:{reportId:oldId}})).status,409);
  assert.equal((await reviewer.api(`/reviews/${id}`,{method:'POST',data:{winner:'draw',reason:'A revisão considera a foto corrigida.',reportId:oldId}})).status,409);
  assert.equal((await reviewer.api(`/reviews/${id}`,{method:'POST',data:{winner:'draw',reason:'A revisão considera a foto corrigida.',reportId:corrected.data.duel.result.id}})).status,200);
  assert.equal((await host.api('/me')).data.user.balance,1000);assert.equal((await guest.api('/me')).data.user.balance,1000);
});

test('cancellation after acceptance requires both participants, preserves history and refunds each reserve once',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client();await host.register('Host');await guest.register('Guest');
  const created=await host.api('/duels',{method:'POST',data:{stake:100,mode:'Clubes',platform:'pc'}}),id=created.data.duel.id;
  await guest.api(`/invites/${created.data.inviteToken}/accept`,{method:'POST',data:{}});
  const first=await host.api(`/duels/${id}/cancel`,{method:'POST',data:{}});
  assert.equal(first.data.duel.status,'in_progress');assert.equal((await host.api('/me')).data.user.balance,900);
  const second=await guest.api(`/duels/${id}/cancel`,{method:'POST',data:{}});
  assert.equal(second.data.duel.status,'cancelled');assert.equal((await guest.api('/me')).data.user.balance,1000);assert.equal((await host.api('/me')).data.user.balance,1000);
  assert.equal((await host.api(`/duels/${id}/cancel`,{method:'POST',data:{}})).status,409);
  assert.equal((await host.api('/me')).data.history.length,1);
});

test('a participant can withdraw or decline cancellation without releasing reserves, and a result clears pending cancellation',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),outsider=h.client();
  await host.register('Host');await guest.register('Guest');await outsider.register('Outsider');
  const created=await host.api('/duels',{method:'POST',data:{stake:100,mode:'1v1',platform:'pc'}}),id=created.data.duel.id;
  await guest.api(`/invites/${created.data.inviteToken}/accept`,{method:'POST',data:{}});
  await host.api(`/duels/${id}/cancel`,{method:'POST',data:{}});
  assert.equal((await outsider.api(`/duels/${id}/cancel-withdraw`,{method:'POST',data:{}})).status,404);
  const withdrawn=await host.api(`/duels/${id}/cancel-withdraw`,{method:'POST',data:{}});
  assert.equal(withdrawn.status,200);assert.equal(withdrawn.data.duel.status,'in_progress');assert.deepEqual(withdrawn.data.duel.cancellationRequestedBy,[]);
  assert.equal((await host.api(`/duels/${id}/cancel-withdraw`,{method:'POST',data:{}})).status,409);
  await host.api(`/duels/${id}/cancel`,{method:'POST',data:{}});
  const declined=await guest.api(`/duels/${id}/cancel-withdraw`,{method:'POST',data:{}});
  assert.equal(declined.status,200);assert.equal(declined.data.duel.status,'in_progress');assert.deepEqual(declined.data.duel.cancellationRequestedBy,[]);
  for(const player of [host,guest]){
    const arena=(await player.api('/me')).data;
    assert.equal(arena.user.balance,900);assert.equal(arena.stats.reserved,100);
    assert.equal(arena.user.transactions.filter(tx=>tx.reference===`cancel:${id}`).length,0);
  }
  await host.api(`/duels/${id}/cancel`,{method:'POST',data:{}});
  const photo=await host.upload(id);
  const result=await host.api(`/duels/${id}/result`,{method:'POST',data:{homeScore:1,awayScore:0,evidenceId:photo.id}});
  assert.equal(result.status,200);assert.equal(result.data.duel.status,'pending_review');assert.deepEqual(result.data.duel.cancellationRequestedBy,[]);
  assert.equal((await host.api(`/duels/${id}/cancel-withdraw`,{method:'POST',data:{}})).status,409);
  assert.equal((await host.api('/me')).data.user.balance,900);assert.equal((await guest.api('/me')).data.user.balance,900);
});

test('shared leaderboard counts only reviewed settlements, orders victories/draws/nickname, and exposes no private account data',async t=>{
  const h=await harness(t),alice=h.client(),bob=h.client(),carol=h.client(),dan=h.client(),team=h.client(),visitor=h.client();
  const aliceUser=await alice.register('Alice'),bobUser=await bob.register('Bob'),carolUser=await carol.register('Carol'),danUser=await dan.register('Dan'),reviewer=await team.register('ReviewTeam');
  h.arena.reviewerIds.add(reviewer.id);
  assert.equal((await visitor.api('/leaderboard')).status,401);
  assert.deepEqual((await alice.api('/leaderboard')).data.entries,[]);
  async function report(host,guest,homeScore,awayScore){
    const created=await host.api('/duels',{method:'POST',data:{stake:10,mode:'1v1',platform:'pc'}}),id=created.data.duel.id;
    assert.equal((await guest.api(`/invites/${created.data.inviteToken}/accept`,{method:'POST',data:{}})).status,200);
    const image=await host.upload(id);
    const submitted=await host.api(`/duels/${id}/result`,{method:'POST',data:{homeScore,awayScore,evidenceId:image.id}});
    assert.equal(submitted.status,200);
    return {id,reportId:submitted.data.duel.result.id};
  }
  async function approve(reported,winner){
    const result=await team.api(`/reviews/${reported.id}`,{method:'POST',data:{winner,reason:'Conferi os jogadores e a foto do placar.',reportId:reported.reportId}});
    assert.equal(result.status,200);
  }
  const first=await report(alice,bob,2,1);
  assert.deepEqual((await alice.api('/leaderboard')).data.entries,[]); // pending_review is not a played match.
  const counterPhoto=await bob.upload(first.id);
  assert.equal((await bob.api(`/duels/${first.id}/dispute`,{method:'POST',data:{reason:'Quero que a equipe confira esta divergência.',evidenceId:counterPhoto.id,reportId:first.reportId}})).status,200);
  assert.deepEqual((await alice.api('/leaderboard')).data.entries,[]); // disputed is not a played match either.
  await approve(first,'host');
  await approve(await report(bob,carol,1,1),'draw');
  await approve(await report(alice,dan,3,0),'host');
  const response=await carol.api('/leaderboard');assert.equal(response.status,200);
  const entries=response.data.entries;
  assert.deepEqual(entries.map(entry=>entry.player.nickname),['Alice','Bob','Carol','Dan']);
  assert.deepEqual(entries.map(({player,...counts})=>({id:player.id,...counts})),[
    {id:aliceUser.id,played:2,wins:2,draws:0,losses:0},
    {id:bobUser.id,played:2,wins:0,draws:1,losses:1},
    {id:carolUser.id,played:1,wins:0,draws:1,losses:0},
    {id:danUser.id,played:1,wins:0,draws:0,losses:1}
  ]);
  assert.ok(!entries.some(entry=>entry.player.id===reviewer.id)); // An account with no completed games does not appear.
  for(const entry of entries){
    assert.deepEqual(Object.keys(entry).sort(),['draws','losses','played','player','wins']);
    assert.deepEqual(Object.keys(entry.player).sort(),['clubId','createdAt','gameAccount','id','nickname','publicPlayerId']);
  }
  const serialized=JSON.stringify(response.data);
  for(const sensitive of ['balance','passwordHash','passwordSalt','csrfToken','transactions','isReviewer','a robust testing passphrase',alice.cookie.split('=')[1]])assert.ok(!serialized.includes(sensitive));
});

test('demo deposits are idempotent pending orders; card approval credits once and never accepts card/bank details',async t=>{
  const h=await harness(t),owner=h.client(),other=h.client();await owner.register('Owner');await other.register('Other');
  const status=(await owner.api('/status')).data;assert.equal(status.paymentMode,'demo');assert.equal(status.realMoney,false);assert.equal(status.noRealMoney,true);
  const wallet=(await owner.api('/wallet')).data;assert.deepEqual(wallet.catalog,[100,250,500,1000]);assert.deepEqual(wallet.methods,['card','pix','transfer']);assert.equal(wallet.balance,1000);assert.equal(wallet.reserved,0);
  const data={amount:250,method:'card',installments:3,idempotencyKey:'test-card-operation-0001'};
  const parallel=await Promise.all(Array.from({length:5},()=>owner.api('/wallet/deposits',{method:'POST',data})));
  assert.ok(parallel.every(result=>result.status===200));assert.equal(new Set(parallel.map(result=>result.data.deposit.id)).size,1);
  const deposit=parallel[0].data.deposit;assert.equal(deposit.status,'pending');assert.equal(deposit.version,1);assert.equal(deposit.installments,3);assert.ok(!Object.hasOwn(deposit,'idempotencyKey'));
  assert.equal((await owner.api('/wallet')).data.balance,1000);assert.equal((await owner.api('/wallet')).data.deposits.length,1);
  assert.equal((await other.api('/wallet')).data.deposits.length,0);
  assert.equal((await owner.api('/wallet/deposits',{method:'POST',data:{...data,amount:500}})).status,409);
  for(const invalid of [{...data,amount:'250'},{...data,amount:300},{...data,installments:0},{...data,installments:7},{...data,method:'pix',installments:2},{...data,cardNumber:'never-persist-this-card'},{...data,cvv:'never-persist-this-cvv'},{...data,bankAccount:'never-persist-this-bank'}])assert.equal((await owner.api('/wallet/deposits',{method:'POST',data:invalid})).status,400);
  assert.equal((await other.api(`/wallet/deposits/${deposit.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'approved',version:1}})).status,404);
  assert.equal((await owner.api(`/wallet/deposits/${deposit.id}/simulate`,{method:'POST',data:{mode:'live',outcome:'approved',version:1}})).status,400);
  const approval=await owner.api(`/wallet/deposits/${deposit.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'approved',version:1}});
  assert.equal(approval.status,200);assert.equal(approval.data.balance,1250);assert.equal(approval.data.deposit.status,'approved');assert.equal(approval.data.deposit.version,2);assert.equal(approval.data.deposit.decision.kind,'simulation');assert.equal(approval.data.deposit.decision.provider,'fifabet-demo');
  assert.equal((await owner.api(`/wallet/deposits/${deposit.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'approved',version:1}})).status,409);
  const after=(await owner.api('/wallet')).data;assert.equal(after.balance,1250);
  const credits=after.transactions.filter(tx=>tx.reference===`deposit:${deposit.id}`);assert.equal(credits.length,1);assert.equal(credits[0].amount,250);assert.equal(credits[0].demo,true);assert.match(credits[0].label,/\[DEMO\]/);
  assert.equal((await owner.api('/wallet/deposits',{method:'POST',data})).data.deposit.status,'approved'); // Retry after settlement never creates a second order.
  assert.deepEqual((await owner.api('/leaderboard')).data.entries,[]); // Buying demo credits does not create match statistics.
  const stored=await readFile(join(h.dataDir,'state.json'),'utf8');
  for(const forbidden of ['never-persist-this-card','never-persist-this-cvv','never-persist-this-bank'])assert.ok(!stored.includes(forbidden));
});

test('demo Pix rejection and cancellation never credit; wallet reservations continue to come exclusively from duels',async t=>{
  const h=await harness(t),owner=h.client();await owner.register('Owner');
  const created=await owner.api('/duels',{method:'POST',data:{stake:100,mode:'1v1',platform:'pc'}});assert.equal(created.status,200);
  const pix=(await owner.api('/wallet/deposits',{method:'POST',data:{amount:100,method:'pix',idempotencyKey:'test-pix-operation-0001'}})).data.deposit;
  const before=(await owner.api('/wallet')).data;assert.equal(before.balance,900);assert.equal(before.reserved,100);
  assert.equal((await owner.api(`/wallet/deposits/${pix.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'rejected',version:1}})).status,200);
  const card=(await owner.api('/wallet/deposits',{method:'POST',data:{amount:1000,method:'card',installments:6,idempotencyKey:'test-card-operation-0002'}})).data.deposit;
  assert.equal((await owner.api(`/wallet/deposits/${card.id}/cancel`,{method:'POST',data:{version:0}})).status,409);
  assert.equal((await owner.api(`/wallet/deposits/${card.id}/cancel`,{method:'POST',data:{version:1}})).status,200);
  assert.equal((await owner.api(`/wallet/deposits/${card.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'approved',version:1}})).status,409);
  const after=(await owner.api('/wallet')).data;assert.equal(after.balance,900);assert.equal(after.reserved,100);assert.equal(after.transactions.filter(tx=>tx.source==='deposit').length,0);
  assert.ok(after.deposits.some(deposit=>deposit.status==='rejected'));assert.ok(after.deposits.some(deposit=>deposit.status==='cancelled'));
});

test('transfer proof remains private and only a different authorized reviewer can approve demo credits exactly once',async t=>{
  const h=await harness(t),owner=h.client(),other=h.client(),team=h.client(),visitor=h.client();
  const ownerUser=await owner.register('Owner');await other.register('Other');const reviewer=await team.register('ReviewTeam');h.arena.reviewerIds.add(reviewer.id);h.arena.reviewerIds.add(ownerUser.id);
  const order=(await owner.api('/wallet/deposits',{method:'POST',data:{amount:500,method:'transfer',idempotencyKey:'test-transfer-operation-0001'}})).data.deposit;
  assert.equal((await owner.api(`/wallet/deposits/${order.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'approved',version:1}})).status,403);
  assert.equal((await team.api(`/wallet/reviews/${order.id}`,{method:'POST',data:{decision:'approve',reason:'Esta conta não enviou comprovante ainda.',version:1}})).status,409);
  assert.equal((await other.api(`/wallet/deposits/${order.id}/proof?version=1`,{method:'POST',body:PNG,mime:'image/png'})).status,404);
  const uploaded=await owner.api(`/wallet/deposits/${order.id}/proof?version=1`,{method:'POST',body:PNG,mime:'image/png'});
  assert.equal(uploaded.status,200);const deposit=uploaded.data.deposit,evidenceId=uploaded.data.evidence.id;assert.equal(deposit.status,'review');assert.equal(deposit.version,2);
  assert.equal((await visitor.api(`/wallet/evidence/${evidenceId}`)).status,401);assert.equal((await other.api(`/wallet/evidence/${evidenceId}`)).status,404);assert.equal((await owner.api(`/wallet/evidence/${evidenceId}`)).status,200);assert.equal((await team.api(`/wallet/evidence/${evidenceId}`)).status,200);
  assert.equal((await owner.api(`/evidence/${evidenceId}`)).status,404); // A wallet proof cannot be used as a match photo.
  assert.equal((await other.api('/wallet/reviews')).status,403);assert.equal((await owner.api('/wallet/reviews')).data.deposits.length,0);assert.equal((await team.api('/wallet/reviews')).data.deposits[0].id,deposit.id);
  const decision={decision:'approve',reason:'Conferi o comprovante fictício para o teste.',version:2};
  assert.equal((await owner.api(`/wallet/reviews/${deposit.id}`,{method:'POST',data:decision})).status,403);assert.equal((await other.api(`/wallet/reviews/${deposit.id}`,{method:'POST',data:decision})).status,403);
  assert.equal((await team.api(`/wallet/reviews/${deposit.id}`,{method:'POST',data:decision})).status,200);assert.equal((await team.api(`/wallet/reviews/${deposit.id}`,{method:'POST',data:decision})).status,409);
  const wallet=(await owner.api('/wallet')).data;assert.equal(wallet.balance,1500);assert.equal(wallet.transactions.filter(tx=>tx.reference===`deposit:${deposit.id}`).length,1);assert.equal(wallet.deposits[0].decision.kind,'team_review');
});

test('replacing a transfer proof invalidates stale decisions; rejection and cancellation preserve the balance',async t=>{
  const h=await harness(t),owner=h.client(),team=h.client();await owner.register('Owner');const reviewer=await team.register('ReviewTeam');h.arena.reviewerIds.add(reviewer.id);
  const order=(await owner.api('/wallet/deposits',{method:'POST',data:{amount:1000,method:'transfer',idempotencyKey:'test-transfer-operation-0002'}})).data.deposit;
  assert.equal((await owner.api(`/wallet/deposits/${order.id}/proof?version=1`,{method:'POST',body:Buffer.from('<svg></svg>'),mime:'image/png'})).status,400);
  await owner.api(`/wallet/deposits/${order.id}/proof?version=1`,{method:'POST',body:PNG,mime:'image/png'});
  const replacement=await owner.api(`/wallet/deposits/${order.id}/proof?version=2`,{method:'POST',body:PNG,mime:'image/png'});assert.equal(replacement.data.deposit.version,3);assert.equal(replacement.data.deposit.evidenceIds.length,2);
  assert.equal((await team.api(`/wallet/reviews/${order.id}`,{method:'POST',data:{decision:'approve',reason:'A equipe precisa revisar a versão atual.',version:2}})).status,409);
  assert.equal((await team.api(`/wallet/reviews/${order.id}`,{method:'POST',data:{decision:'reject',reason:'Comprovante fictício rejeitado neste teste.',version:3}})).status,200);
  assert.equal((await owner.api('/wallet')).data.balance,1000);
  const another=(await owner.api('/wallet/deposits',{method:'POST',data:{amount:100,method:'transfer',idempotencyKey:'test-transfer-operation-0003'}})).data.deposit;
  await owner.api(`/wallet/deposits/${another.id}/proof?version=1`,{method:'POST',body:PNG,mime:'image/png'});
  assert.equal((await owner.api(`/wallet/deposits/${another.id}/cancel`,{method:'POST',data:{version:2}})).status,200);
  assert.equal((await team.api(`/wallet/reviews/${another.id}`,{method:'POST',data:{decision:'approve',reason:'Não podemos aprovar um pedido cancelado.',version:2}})).status,409);
  assert.equal((await owner.api('/wallet')).data.balance,1000);assert.equal((await owner.api('/wallet')).data.transactions.filter(tx=>tx.source==='deposit').length,0);
});

test('persistent accounts survive restart and private backend files never appear through static HTTP',async t=>{
  const dataDir=await mkdtemp(join(tmpdir(),'fifabet-persistence-test-'));
  let arena=await createArenaServer({dataDir});
  await new Promise(resolve=>arena.server.listen(0,'127.0.0.1',resolve));
  let base=`http://127.0.0.1:${arena.server.address().port}`;
  const registered=await fetch(`${base}/api/v1/auth/register`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({nickname:'Persistent',password:'a persistent passphrase'})});
  const registration=await registered.json(),user=registration.user;assert.ok(user);
  const headers={Origin:base,'Content-Type':'application/json',Cookie:registered.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':registration.csrfToken};
  const depositResponse=await fetch(`${base}/api/v1/wallet/deposits`,{method:'POST',headers,body:JSON.stringify({amount:100,method:'pix',idempotencyKey:'persistent-demo-operation-0001'})});
  const deposit=(await depositResponse.json()).deposit;assert.ok(deposit);
  assert.equal((await fetch(`${base}/api/v1/wallet/deposits/${deposit.id}/simulate`,{method:'POST',headers,body:JSON.stringify({mode:'demo',outcome:'approved',version:1})})).status,200);
  await arena.close();
  arena=await createArenaServer({dataDir});
  await new Promise(resolve=>arena.server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${arena.server.address().port}`;
  t.after(async()=>{await arena.close();await rm(dataDir,{recursive:true,force:true});});
  const loggedIn=await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({identifier:user.publicPlayerId,password:'a persistent passphrase'})});
  assert.equal(loggedIn.status,200);const loggedPayload=await loggedIn.json();assert.equal(loggedPayload.user.id,user.id);assert.equal(loggedPayload.user.balance,1100);
  const persistedWallet=await fetch(`${base}/api/v1/wallet`,{headers:{Cookie:loggedIn.headers.get('set-cookie').split(';')[0]}});
  const wallet=await persistedWallet.json();assert.equal(wallet.deposits[0].id,deposit.id);assert.equal(wallet.deposits[0].status,'approved');assert.equal(wallet.transactions.filter(tx=>tx.reference===`deposit:${deposit.id}`).length,1);
  for(const path of ['/backend/server.mjs','/.env','/docs/SERVIDOR.md','/state.json'])assert.equal((await fetch(`${base}${path}`)).status,404);
  assert.equal((await fetch(`${base}/backend-client.mjs`)).status,200);
  const wizardStyles=await fetch(`${base}/wizard.css?v=17`);
  assert.equal(wizardStyles.status,200);assert.match(wizardStyles.headers.get('content-type'),/text\/css/);assert.match(await wizardStyles.text(),/duel-wizard-steps/);
  assert.equal((await fetch(`${base}/assets/kits/internacional.jpg`)).status,200);
});
