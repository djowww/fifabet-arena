import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
  assert.equal((await guest.api(`/duels/${id}/accept`,{method:'POST',data:{}})).status,409);
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

test('persistent accounts survive restart and private backend files never appear through static HTTP',async t=>{
  const dataDir=await mkdtemp(join(tmpdir(),'fifabet-persistence-test-'));
  let arena=await createArenaServer({dataDir});
  await new Promise(resolve=>arena.server.listen(0,'127.0.0.1',resolve));
  let base=`http://127.0.0.1:${arena.server.address().port}`;
  const registered=await fetch(`${base}/api/v1/auth/register`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({nickname:'Persistent',password:'a persistent passphrase'})});
  const user=(await registered.json()).user;assert.ok(user);
  await arena.close();
  arena=await createArenaServer({dataDir});
  await new Promise(resolve=>arena.server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${arena.server.address().port}`;
  t.after(async()=>{await arena.close();await rm(dataDir,{recursive:true,force:true});});
  const loggedIn=await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({identifier:user.publicPlayerId,password:'a persistent passphrase'})});
  assert.equal(loggedIn.status,200);assert.equal((await loggedIn.json()).user.id,user.id);
  for(const path of ['/backend/server.mjs','/.env','/docs/SERVIDOR.md','/state.json'])assert.equal((await fetch(`${base}${path}`)).status,404);
  assert.equal((await fetch(`${base}/backend-client.mjs`)).status,200);
  assert.equal((await fetch(`${base}/assets/kits/internacional.jpg`)).status,200);
});
