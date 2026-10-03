import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createArenaServer} from './server.mjs';
import {openArenaDatabase} from './database.mjs';
import {TERMS_VERSION} from '../account-policy.mjs';
import {automaticSettlementCheck} from './duel-economy.mjs';
import {seedFixtureAdministrator,grantFixtureCredits} from './test-fixtures.mjs';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
const GOOD_READING={status:'suggested',provider:'local-ocr',scores:{left:3,right:1},confidence:94,requiresReview:false,finalScreen:true};

async function harness(t,{recognition=GOOD_READING,paymentMode='unconfigured'}={}){
  const dataDir=await mkdtemp(join(tmpdir(),'fifago-rooms-test-')),reviewerIds=[];
  const administrator=await seedFixtureAdministrator(dataDir),adminEmails=[administrator.email];
  const recognizer={status:()=>({available:true,provider:'local-ocr',requiresReview:true}),recognize:async()=>structuredClone(recognition),close(){}};
  const visualInspector={inspect:async body=>({status:'checked',hash:createHash('sha256').update(body).digest('hex').slice(0,16)}),close(){}};
  let currentMode=paymentMode,arena=await createArenaServer({dataDir,paymentMode,adminEmails,reviewerIds,recognizer,visualInspector});
  await new Promise(resolve=>arena.server.listen(0,'127.0.0.1',resolve));
  const port=arena.server.address().port,base=`http://127.0.0.1:${port}`;
  t.after(async()=>{if(arena)await arena.close();await rm(dataDir,{recursive:true,force:true});});
  async function restart(update=()=>{},nextMode=currentMode){
    if(arena)await arena.close();arena=null;
    const storage=await openArenaDatabase(dataDir);
    try{const state=storage.load();update(state);storage.save(state);}finally{storage.close();}
    arena=await createArenaServer({dataDir,paymentMode:nextMode,adminEmails,reviewerIds,recognizer,visualInspector});
    await new Promise(resolve=>arena.server.listen(port,'127.0.0.1',resolve));
    currentMode=nextMode;
  }
  function client(){
    let cookie='',csrfToken=null;
    return {
      async api(path,{method='GET',data,body,mime,csrf=true,origin=base}={}){
        const headers={Origin:origin};if(cookie)headers.Cookie=cookie;if(csrf&&csrfToken)headers['X-CSRF-Token']=csrfToken;
        if(data!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(data);}if(mime)headers['Content-Type']=mime;
        const response=await fetch(`${base}/api/v1${path}`,{method,headers,body});
        const payload=await response.json();const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];if(Object.hasOwn(payload,'csrfToken'))csrfToken=payload.csrfToken;
        return {status:response.status,data:payload};
      },
      async register(name,credits=0){
        const response=await this.api('/auth/register',{method:'POST',data:{nickname:name,password:'rooms testing password',countryCode:'BR',acceptedTerms:true,termsVersion:TERMS_VERSION}});assert.equal(response.status,200);
        if(credits&&currentMode==='demo'){
          const order=await this.api('/wallet/deposits',{method:'POST',data:{amount:credits,method:'card',installments:1,idempotencyKey:randomUUID()}});assert.equal(order.status,200);
          const approved=await this.api(`/wallet/deposits/${order.data.deposit.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'approved',version:order.data.deposit.version}});assert.equal(approved.status,200);
        }else if(credits)await grantFixtureCredits(base,administrator,response.data.user.id,credits);
        return response.data.user;
      },
      async create(stake=100,extra={}){return this.api('/duels',{method:'POST',data:{stake,mode:'1v1',platform:'playstation',...extra}});},
      async upload(duelId,variant='a'){
        // Distinct bounded files for a recognizer stub; no real OCR/authenticity assertion.
        const result=await this.api(`/evidence?duelId=${duelId}`,{method:'POST',body:Buffer.concat([PNG,Buffer.from(variant)]),mime:'image/png'});assert.equal(result.status,200);return result.data.evidence.id;
      },
      async recognize(duelId,evidenceId){const result=await this.api(`/duels/${duelId}/recognize`,{method:'POST',data:{evidenceId}});assert.equal(result.status,200);return result;},
      async me(){return (await this.api('/me')).data;}
    };
  }
  return {client,restart,reviewerIds,dataDir,base};
}

async function joinedRoom(h,{stake=100,start=true}={}){
  const host=h.client(),guest=h.client(),reviewer=h.client();
  const hostUser=await host.register('Host',1000),guestUser=await guest.register('Guest',1000),reviewerUser=await reviewer.register('Reviewer');h.reviewerIds.push(reviewerUser.id);
  await h.restart();
  const created=await host.create(stake);assert.equal(created.status,200);
  const joined=await guest.api(`/invites/code/${created.data.duel.publicMatchId}/accept`,{method:'POST',data:{}});
  assert.equal(joined.status,200);
  if(start){
    assert.equal((await host.api(`/duels/${joined.data.duel.id}/start`,{method:'POST',data:{}})).status,200);
    const started=await guest.api(`/duels/${joined.data.duel.id}/start`,{method:'POST',data:{}});assert.equal(started.status,200);joined.data.duel=started.data.duel;
  }
  return {host,guest,reviewer,hostUser,guestUser,duel:joined.data.duel};
}

async function reportPair({host,guest,duel},{duplicate=false,read=true,score=3}={}){
  const evidenceId=await host.upload(duel.id,'host-photo');if(read)await host.recognize(duel.id,evidenceId);
  const sent=await host.api(`/duels/${duel.id}/result`,{method:'POST',data:{evidenceId,homeScore:score,awayScore:1,scoreSide:'host'}});assert.equal(sent.status,200);
  const confirmationEvidenceId=await guest.upload(duel.id,duplicate?'host-photo':'guest-photo');if(read)await guest.recognize(duel.id,confirmationEvidenceId);
  return {result:sent.data.duel.result,evidenceId,confirmationEvidenceId};
}

test('arena rooms expose bounded public data only and enforce both balances before starting',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),poor=h.client(),outsider=h.client();
  await host.register('Host',1000);await guest.register('Guest',1000);await poor.register('Poor');const other=await outsider.register('Other');await h.restart();
  const created=await host.create(100,{rules:'Private rule context',operationId:randomUUID()});assert.equal(created.status,200);
  const room=created.data.duel;assert.equal(room.fundingVersion,2);assert.equal(room.creditMode,'coins');assert.deepEqual(room.fundedBy,[room.hostId]);
  assert.equal((await host.me()).user.balance,900);assert.equal((await host.me()).stats.reserved,100);
  await host.create(0,{visibility:'private'});await host.create(0,{opponentPlayerId:other.publicPlayerId});
  const listed=await guest.api('/rooms');assert.equal(listed.status,200);assert.equal(listed.data.rooms.length,1);
  assert.deepEqual(Object.keys(listed.data.rooms[0]).sort(),['publicMatchId','host','stake','creditMode','economics','mode','platform','expiresAt'].sort());
  assert.deepEqual(Object.keys(listed.data.rooms[0].host).sort(),['nickname','clubId'].sort());
  assert.ok(!JSON.stringify(listed.data).includes(room.id));assert.ok(!JSON.stringify(listed.data).includes(created.data.inviteToken));assert.ok(!JSON.stringify(listed.data).includes('Private rule'));
  const rejected=await poor.api(`/invites/code/${room.publicMatchId}/accept`,{method:'POST',data:{}});assert.equal(rejected.status,409);assert.equal(rejected.data.code,'insufficient_balance');
  assert.equal((await guest.api('/rooms')).data.rooms.length,1);
  const joined=await guest.api(`/invites/code/${room.publicMatchId}/accept`,{method:'POST',data:{}});assert.equal(joined.status,200);assert.equal(joined.data.duel.status,'waiting_start');
  assert.equal((await guest.me()).user.balance,900);assert.equal((await guest.me()).stats.reserved,100);assert.equal((await poor.api('/rooms')).data.rooms.length,0);
  const status=await guest.api('/status');assert.equal(status.data.paymentsAvailable,false);assert.equal(status.data.paymentMode,'unconfigured');
});

test('creation and simultaneous join reserve only once and cannot spend another room reserve',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client(),other=h.client();await host.register('Host',100);await guest.register('Guest',100);await other.register('Other',100);await h.restart();
  const operationId=randomUUID(),created=await host.create(100,{operationId});assert.equal(created.status,200);
  const retried=await host.create(100,{operationId});assert.equal(retried.status,200);assert.equal(retried.data.duel.id,created.data.duel.id);assert.equal((await host.me()).user.balance,0);
  assert.equal((await host.create(10)).data.code,'insufficient_balance');
  const path=`/invites/code/${created.data.duel.publicMatchId}/accept`,joined=await Promise.all([guest.api(path,{method:'POST',data:{}}),other.api(path,{method:'POST',data:{}})]);
  assert.deepEqual(joined.map(value=>value.status).sort(),[200,409]);
  assert.equal((await guest.me()).user.balance+(await other.me()).user.balance,100);
  assert.equal((await host.me()).notifications.some(item=>item.type==='joined'),true);
});

test('waiting alerts reach only the rival and cannot be repeated within a minute',async t=>{
  const h=await harness(t),room=await joinedRoom(h,{stake:0}),{host,guest,duel}=room,outsider=h.client();await outsider.register('Outside');
  assert.equal((await host.api(`/duels/${duel.id}/nudge`,{method:'POST',data:{}})).status,200);
  assert.equal((await host.api(`/duels/${duel.id}/nudge`,{method:'POST',data:{}})).status,429);
  assert.equal((await host.me()).notifications.some(item=>item.type==='waiting'),false);
  assert.equal((await guest.me()).notifications.some(item=>item.type==='waiting'),true);
  assert.deepEqual((await outsider.me()).notifications,[]);
  assert.equal((await outsider.api(`/duels/${duel.id}/nudge`,{method:'POST',data:{}})).status,404);
});

test('two matching independent photos settle exactly once with the agreed nine-percent fee',async t=>{
  const h=await harness(t),room=await joinedRoom(h),{host,guest,duel}=room,pair=await reportPair(room);
  assert.equal(Date.parse(pair.result.confirmationDeadline)-Date.parse(pair.result.submittedAt),300_000);
  assert.equal((await guest.me()).notifications.some(item=>item.type==='result_confirmation'),true);
  const premature=await room.reviewer.api(`/reviews/${duel.id}`,{method:'POST',data:{reportId:pair.result.id,winner:'host',reason:'Resultado ainda aguardando a confirmação do rival.'}});assert.equal(premature.status,409);assert.equal(premature.data.code,'confirmation_pending');
  assert.equal((await guest.api(`/duels/${duel.id}/confirm`,{method:'POST',data:{reportId:pair.result.id}})).status,400);
  const data={reportId:pair.result.id,evidenceId:pair.confirmationEvidenceId,homeScore:3,awayScore:1,scoreSide:'host'};
  const responses=await Promise.all([guest.api(`/duels/${duel.id}/confirm`,{method:'POST',data}),guest.api(`/duels/${duel.id}/confirm`,{method:'POST',data})]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  const complete=responses.find(response=>response.status===200).data.duel;assert.equal(complete.status,'completed');assert.equal(complete.review.source,'bilateral_verified');assert.equal(complete.review.reviewerId,null);
  assert.equal(complete.settlement.prize,182);assert.equal(complete.settlement.fee,18);assert.equal((await host.me()).user.balance,1082);assert.equal((await guest.me()).user.balance,900);
  assert.equal((await host.me()).user.transactions.filter(item=>item.reference===`settlement:${duel.id}`).length,1);
});

test('duplicate photos, OCR failures and conflicting reports always hold coins for review',async t=>{
  for(const scenario of ['duplicate','unavailable','unreadable','mismatch'])await t.test(scenario,async sub=>{
    const h=await harness(sub,{recognition:scenario==='unavailable'?{status:'unavailable',scores:null,requiresReview:true}:scenario==='unreadable'?{...GOOD_READING,requiresReview:true,confidence:48}:GOOD_READING}),room=await joinedRoom(h),pair=await reportPair(room,{duplicate:scenario==='duplicate',read:true});
    const confirmation={reportId:pair.result.id,evidenceId:pair.confirmationEvidenceId,homeScore:scenario==='mismatch'?2:3,awayScore:1,scoreSide:'host'};
    const confirmed=await room.guest.api(`/duels/${room.duel.id}/confirm`,{method:'POST',data:confirmation});
    assert.equal(confirmed.status,200);assert.equal(confirmed.data.duel.settlement,undefined);assert.equal(confirmed.data.duel.status,scenario==='mismatch'?'disputed':'pending_review');
    assert.equal((await room.host.me()).user.balance,900);assert.equal((await room.guest.me()).user.balance,900);
    if(scenario==='duplicate'){
      const repeated=await room.guest.api(`/duels/${room.duel.id}/confirm`,{method:'POST',data:confirmation});assert.equal(repeated.status,200);
      const changed=await room.guest.api(`/duels/${room.duel.id}/confirm`,{method:'POST',data:{...confirmation,scoreSide:'guest'}});
      assert.equal(changed.status,409);assert.equal(changed.data.code,'already_confirmed');
      assert.equal((await room.guest.me()).duels[0].result.confirmationScoreSide,'host');
    }
  });
});

test('the five-minute timeout never awards a win and late matching evidence needs review',async t=>{
  const h=await harness(t),room=await joinedRoom(h),pair=await reportPair(room);
  await h.restart(state=>{state.duels[room.duel.id].result.confirmationDeadline=new Date(Date.now()-1).toISOString();});
  const snapshot=await room.host.me();assert.ok(snapshot.duels[0].result.confirmationTimedOutAt);assert.equal(snapshot.duels[0].reviewReason,'confirmation_expired');
  const confirmed=await room.guest.api(`/duels/${room.duel.id}/confirm`,{method:'POST',data:{reportId:pair.result.id,evidenceId:pair.confirmationEvidenceId,homeScore:3,awayScore:1,scoreSide:'host'}});assert.equal(confirmed.status,200);assert.equal(confirmed.data.duel.status,'pending_review');assert.equal(confirmed.data.duel.settlement,undefined);
  assert.equal((await room.host.me()).user.balance,900);
  const reviewed=await room.reviewer.api(`/reviews/${room.duel.id}`,{method:'POST',data:{reportId:pair.result.id,winner:'host',reason:'Resultado conferido após o prazo de confirmação.'}});assert.equal(reviewed.status,200);assert.equal(reviewed.data.duel.status,'completed');assert.equal((await room.host.me()).user.balance,1082);
});

test('old private invitations retain explicit two-step funding and never appear in arena discovery',async t=>{
  const h=await harness(t,{paymentMode:'demo'}),host=h.client(),guest=h.client();await host.register('Host',1000);await guest.register('Guest',1000);
  const created=await host.create(100);await h.restart(state=>{
    const duel=state.duels[created.data.duel.id],owner=state.users[duel.hostId];owner.balance+=100;owner.transactions=owner.transactions.filter(tx=>tx.reference!==`reserve:${duel.id}`);duel.fundingVersion=1;duel.fundedBy=[];delete duel.lobbyVersion;delete duel.readyBy;delete duel.visibility;
  },'demo');
  assert.deepEqual((await guest.api('/rooms')).data.rooms,[]);
  const accepted=await guest.api(`/invites/${created.data.inviteToken}/accept`,{method:'POST',data:{}});assert.equal(accepted.status,200);assert.equal(accepted.data.duel.status,'awaiting_funds');
  assert.equal((await host.api(`/duels/${created.data.duel.id}/fund`,{method:'POST',data:{stake:100}})).status,200);
  const funded=await guest.api(`/duels/${created.data.duel.id}/fund`,{method:'POST',data:{stake:100}});assert.equal(funded.status,200);assert.equal(funded.data.duel.status,'in_progress');
});

test('cancellation and expiry refund the host reservation once before another player joins',async t=>{
  const h=await harness(t),host=h.client();await host.register('Host',1000);await h.restart();
  const first=await host.create(100),path=`/duels/${first.data.duel.id}/cancel`;
  assert.equal((await host.api(path,{method:'POST',data:{}})).status,200);assert.equal((await host.api(path,{method:'POST',data:{}})).status,409);assert.equal((await host.me()).user.balance,1000);
  const second=await host.create(100);await h.restart(state=>{state.duels[second.data.duel.id].expiresAt=new Date(Date.now()-1).toISOString();});
  const me=await host.me();assert.equal(me.user.balance,1000);assert.equal(me.history.find(duel=>duel.id===second.data.duel.id).status,'expired');assert.equal((await host.me()).user.balance,1000);
});

test('revised reports keep the original deadline and invalidate the prior confirmation',async t=>{
  const h=await harness(t,{recognition:{status:'unavailable',scores:null,requiresReview:true}}),room=await joinedRoom(h),pair=await reportPair(room);
  const confirmation={reportId:pair.result.id,evidenceId:pair.confirmationEvidenceId,homeScore:3,awayScore:1,scoreSide:'host'};
  assert.equal((await room.guest.api(`/duels/${room.duel.id}/confirm`,{method:'POST',data:confirmation})).status,200);
  const evidenceId=await room.host.upload(room.duel.id,'revised'),revised=await room.host.api(`/duels/${room.duel.id}/result`,{method:'POST',data:{evidenceId,homeScore:4,awayScore:1,scoreSide:'host'}});
  assert.equal(revised.status,200);assert.equal(revised.data.duel.result.confirmationDeadline,pair.result.confirmationDeadline);assert.equal(revised.data.duel.result.confirmedBy,null);
  assert.equal((await room.guest.api(`/duels/${room.duel.id}/confirm`,{method:'POST',data:confirmation})).data.code,'stale_result');
});

test('preparation requires two idempotent confirmations and never charges at start',async t=>{
  const h=await harness(t),room=await joinedRoom(h,{start:false}),{host,guest,duel}=room;
  assert.equal(duel.status,'waiting_start');assert.equal(duel.lobbyVersion,1);assert.deepEqual(duel.readyBy,[]);assert.equal(duel.startedAt,undefined);assert.equal(duel.chatMessages,undefined);
  assert.equal((await host.me()).notifications.find(item=>item.type==='joined').message,'Seu adversário entrou. Preparem a partida.');
  assert.equal((await host.api(`/duels/${duel.id}/nudge`,{method:'POST',data:{}})).status,200);
  assert.equal((await host.api(`/duels/${duel.id}/nudge`,{method:'POST',data:{}})).status,429);
  assert.equal((await guest.me()).notifications.some(item=>item.type==='waiting'),true);
  assert.equal((await host.api(`/duels/${duel.id}/result`,{method:'POST',data:{}})).status,409);
  const first=await host.api(`/duels/${duel.id}/start`,{method:'POST',data:{}});assert.equal(first.status,200);assert.equal(first.data.duel.status,'waiting_start');assert.deepEqual(first.data.duel.readyBy,[duel.hostId]);
  const replies=await Promise.all([guest.api(`/duels/${duel.id}/start`,{method:'POST',data:{}}),guest.api(`/duels/${duel.id}/start`,{method:'POST',data:{}})]);
  assert.deepEqual(replies.map(r=>r.status),[200,200]);assert.equal(replies[0].data.duel.status,'in_progress');assert.equal(replies[0].data.duel.startedAt,replies[1].data.duel.startedAt);
  assert.equal((await host.me()).user.balance,900);assert.equal((await guest.me()).user.balance,900);
});

test('preparation cancellation and expiry return both reserves once',async t=>{
  for(const expiry of [false,true])await t.test(String(expiry),async sub=>{
    const h=await harness(sub),{host,guest,duel}=await joinedRoom(h,{start:false});
    if(expiry)await h.restart(s=>{s.duels[duel.id].expiresAt=new Date(Date.now()-1).toISOString();});
    else {const replies=await Promise.all([host.api(`/duels/${duel.id}/cancel`,{method:'POST',data:{}}),guest.api(`/duels/${duel.id}/cancel`,{method:'POST',data:{}})]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);}
    assert.equal((await host.me()).user.balance,1000);assert.equal((await guest.me()).user.balance,1000);assert.equal((await host.me()).stats.reserved,0);
  });
});

test('private chat is joined-member only, bounded, idempotent, durable and absent from snapshots',async t=>{
  const h=await harness(t),{host,guest,reviewer,duel}=await joinedRoom(h,{start:false}),outsider=h.client();await outsider.register('Outside');const path=`/duels/${duel.id}/chat`;
  assert.deepEqual((await host.api(path)).data,{messages:[],lastSequence:0,closed:false});
  for(const client of [reviewer,outsider])assert.equal((await client.api(path)).status,404);
  const operationId=randomUUID(),data={operationId,text:'<b>Vamos jogar?</b>'};
  const sent=await host.api(path,{method:'POST',data});assert.equal(sent.status,200);assert.equal(sent.data.messages[0].authorId,duel.hostId);assert.equal(sent.data.messages[0].sequence,1);assert.equal(sent.data.messages[0].text,data.text);
  assert.deepEqual((await host.api(path,{method:'POST',data})).data,sent.data);
  assert.equal((await host.api(path,{method:'POST',data:{...data,text:'Outro texto'}})).status,409);
  for(const text of ['', ' ', 'x'.repeat(1001),'a\u0000b'])assert.equal((await guest.api(path,{method:'POST',data:{operationId:randomUUID(),text}})).status,400);
  assert.equal((await guest.api(path+'?after=no')).status,400);
  assert.equal((await host.api(path,{method:'POST',data:{...data,authorId:duel.guestId}})).status,400);
  assert.deepEqual((await guest.api(path+'?after=1')).data,{messages:[],lastSequence:1,closed:false});
  assert.ok(!JSON.stringify(await host.me()).includes(data.text));assert.ok(!JSON.stringify(await guest.me()).includes('chatMessages'));
  await h.restart();assert.equal((await guest.api(path)).data.messages[0].text,data.text);
  await guest.api(`/duels/${duel.id}/cancel`,{method:'POST',data:{}});assert.equal((await host.api(path)).data.closed,true);
  assert.equal((await host.api(path,{method:'POST',data:{operationId:randomUUID(),text:'Depois'}})).status,409);
});

test('an invitation recipient cannot access chat before joining',async t=>{
  const h=await harness(t),host=h.client(),guest=h.client();await host.register('Host');const u=await guest.register('Guest');
  const created=await host.create(0,{opponentPlayerId:u.publicPlayerId});assert.equal((await guest.api(`/duels/${created.data.duel.id}/chat`)).status,404);assert.equal((await host.api(`/duels/${created.data.duel.id}/chat`)).status,404);
});

test('chat canonicalizes surrounding whitespace before idempotency comparison',async t=>{
  const h=await harness(t),{host,duel}=await joinedRoom(h,{stake:0,start:false}),path=`/duels/${duel.id}/chat`,operationId=randomUUID();
  const first=await host.api(path,{method:'POST',data:{operationId,text:'  Vamos jogar? \n'}});assert.equal(first.status,200);assert.equal(first.data.messages[0].text,'Vamos jogar?');
  assert.deepEqual((await host.api(path,{method:'POST',data:{operationId,text:'Vamos jogar?'}})).data,first.data);
});

test('chat stays private throughout result review and writes become closed after settlement',async t=>{
  const h=await harness(t),room=await joinedRoom(h),{host,guest,reviewer,duel}=room,path=`/duels/${duel.id}/chat`,text='Conversa privada durante a análise';
  const sent=await host.api(path,{method:'POST',data:{operationId:randomUUID(),text}});assert.equal(sent.status,200);
  const pair=await reportPair(room);assert.equal((await guest.api(path,{method:'POST',data:{operationId:randomUUID(),text:'Foto enviada'}})).status,200);
  assert.equal((await reviewer.api(path)).status,404);assert.ok(!JSON.stringify((await reviewer.api('/reviews')).data).includes(text));assert.ok(!JSON.stringify((await reviewer.api('/reviews')).data).includes('chatMessages'));
  await guest.api(`/duels/${duel.id}/confirm`,{method:'POST',data:{reportId:pair.result.id,evidenceId:pair.confirmationEvidenceId,homeScore:3,awayScore:1,scoreSide:'host'}});
  assert.equal((await guest.api(path)).data.closed,true);assert.equal((await guest.api(path,{method:'POST',data:{operationId:randomUUID(),text:'Encerrada'}})).data.code,'chat_closed');
});

test('chat enforces origin, CSRF, per-author rate and the 200-message room bound',async t=>{
  const h=await harness(t),{host,guest,duel}=await joinedRoom(h,{stake:0,start:false}),path=`/duels/${duel.id}/chat`;
  for(const guard of [{csrf:false},{origin:'https://attacker.example'}])assert.equal((await host.api(path,{method:'POST',data:{operationId:randomUUID(),text:'Olá'},...guard})).status,403);
  for(let i=0;i<30;i++)assert.equal((await host.api(path,{method:'POST',data:{operationId:randomUUID(),text:`Mensagem ${i}`}})).status,200);
  assert.equal((await host.api(path,{method:'POST',data:{operationId:randomUUID(),text:'Limitada'}})).status,429);
  await h.restart(state=>{const messages=state.duels[duel.id].chatMessages;for(let i=messages.length;i<199;i++)messages.push({id:randomUUID(),sequence:i+1,authorId:duel.hostId,authorNickname:'Host',text:`Histórico ${i}`,createdAt:new Date().toISOString(),operationId:randomUUID()});});
  const data={operationId:randomUUID(),text:'x'.repeat(1000)},last=await guest.api(path,{method:'POST',data});assert.equal(last.status,200);assert.equal(last.data.lastSequence,200);
  assert.equal((await guest.api(path,{method:'POST',data:{operationId:randomUUID(),text:'Excedente'}})).data.code,'chat_full');
  assert.deepEqual((await guest.api(path,{method:'POST',data})).data,last.data);assert.equal((await host.api(path)).data.messages.length,200);
});

test('legacy v2 rooms still begin on entry and started rooms survive restart',async t=>{
  const h=await harness(t,{paymentMode:'demo'}),host=h.client(),guest=h.client();await host.register('Host',1000);await guest.register('Guest',1000);const created=await host.create(100);
  await h.restart(state=>{const duel=state.duels[created.data.duel.id];delete duel.lobbyVersion;delete duel.readyBy;delete duel.chatMessages;},'demo');
  const joined=await guest.api(`/invites/${created.data.inviteToken}/accept`,{method:'POST',data:{}});assert.equal(joined.status,200);assert.equal(joined.data.duel.status,'in_progress');
  await h.restart();const duel=(await host.me()).duels[0];assert.equal(duel.startedAt,joined.data.duel.startedAt);assert.equal(duel.status,'in_progress');assert.equal((await host.api(`/duels/${duel.id}/start`,{method:'POST',data:{}})).status,409);
});

test('simultaneous start and cancel never strand reserves or create duplicate ledger entries',async t=>{
  const h=await harness(t),{host,guest,duel}=await joinedRoom(h,{start:false});
  await host.api(`/duels/${duel.id}/start`,{method:'POST',data:{}});
  const replies=await Promise.all([guest.api(`/duels/${duel.id}/start`,{method:'POST',data:{}}),host.api(`/duels/${duel.id}/cancel`,{method:'POST',data:{}})]);assert.ok(replies.every(r=>[200,409].includes(r.status)));
  let snapshot=await host.me();if(snapshot.duels.length)await guest.api(`/duels/${duel.id}/cancel`,{method:'POST',data:{}});
  for(const player of [host,guest]){snapshot=await player.me();assert.equal(snapshot.user.balance,1000);assert.equal(snapshot.user.transactions.filter(tx=>tx.reference===`reserve:${duel.id}`).length,1);assert.equal(snapshot.user.transactions.filter(tx=>tx.reference===`cancel:${duel.id}`).length,1);}
});

test('automatic settlement fails closed for stale, missing or weak recognition metadata',()=>{
  const now=Date.now(),first={id:'a',duelId:'d',authorId:'host',sha256:'a',recognition:GOOD_READING},second={id:'b',duelId:'d',authorId:'guest',sha256:'b',recognition:GOOD_READING};
  const state={evidence:{a:first,b:second}},duel={id:'d',hostId:'host',guestId:'guest',status:'pending_review',result:{id:'r',reporterId:'host',confirmedBy:'guest',evidenceId:'a',confirmationEvidenceId:'b',homeScore:3,awayScore:1,scoreSide:'host',confirmationScoreSide:'host',submittedAt:new Date(now).toISOString(),confirmedAt:new Date(now).toISOString(),confirmationDeadline:new Date(now+300_000).toISOString()}};
  assert.equal(automaticSettlementCheck(state,duel,now).eligible,true);
  for(const patch of [{confirmationTimedOutAt:new Date(now).toISOString()},{confirmationScoreSide:undefined},{confirmationEvidenceId:'a'},{confirmationDeadline:new Date(now-1).toISOString()},{confirmationDeadline:'not-a-date'},{confirmedAt:'not-a-date'},{submittedAt:'not-a-date'}])assert.equal(automaticSettlementCheck(state,{...duel,result:{...duel.result,...patch}},now).eligible,false);
  second.recognition={...GOOD_READING,requiresReview:true};assert.equal(automaticSettlementCheck(state,duel,now).eligible,false);
});

// This verifies the room fixture funding contract without changing the financial guard.
test('connected room fixtures use authorized ledger grants rather than converting demo deposits',async t=>{
 const h=await harness(t),player=h.client();await player.register('FundedPlayer',1000);
 const account=(await player.me()).user;
 assert.equal(account.balance,1000);
 assert.equal(account.transactions.length,1);
 assert.equal(account.transactions[0].source,'admin_adjustment');
 assert.equal(account.transactions[0].demo,undefined);
 assert.equal((await player.api('/status')).data.paymentMode,'unconfigured');
 await h.restart();assert.equal((await player.me()).user.balance,1000);
 const storage=await openArenaDatabase(h.dataDir);
 try{const state=storage.load(),user=state.users[account.id];assert.equal(state.walletEnvironment,'online');assert.equal(user.walletOpeningBalance,0);assert.equal(user.balance,user.transactions.reduce((total,entry)=>total+entry.amount,0));assert.equal(Object.keys(state.adminOperations).length,1);assert.equal(Object.keys(state.deposits).length,0);}finally{storage.close();}
});

test('demo fixture cannot restart as online and its original test ledger survives rejection',async t=>{
 const h=await harness(t,{paymentMode:'demo'}),player=h.client();await player.register('DemoPlayer',1000);
 await assert.rejects(h.restart(()=>{},'unconfigured'),error=>error.code==='payment_environment_migration_required');
 await h.restart(()=>{},'demo');
 const account=(await player.me()).user;assert.equal(account.balance,1000);assert.equal(account.transactions[0].demo,true);
});

test('test administrator setup stays outside the production public file list',async t=>{
 const h=await harness(t);
 const response=await fetch(`${h.base}/backend/test-fixtures.mjs`);
 assert.equal(response.status,404);
 assert.doesNotMatch(await response.text(),/seedFixtureAdministrator|grantFixtureCredits/);
});
