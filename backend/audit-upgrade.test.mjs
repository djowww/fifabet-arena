import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createArenaServer} from './server.mjs';
import {TERMS_VERSION} from '../account-policy.mjs';
import {seedFixtureAdministrator} from './test-fixtures.mjs';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
async function fixture(t,extra={}){
 const dataDir=await mkdtemp(join(tmpdir(),'fifago-audit-upgrade-')),reviewerIds=[],administrator=extra.seedAdmin?await seedFixtureAdministrator(dataDir):null;
 const config={dataDir,paymentMode:'demo',reviewerIds,recognizer:{status:()=>({available:true}),recognize:async()=>({provider:'local-ocr',status:'suggested',scores:{left:3,right:1},confidence:95,finalScreen:true,requiresReview:false}),close(){}},visualInspector:{inspect:async body=>({status:'checked',hash:createHash('sha256').update(body).digest('hex').slice(0,16)}),close(){}},...extra};
 if(administrator){config.adminEmails=[administrator.email];config.reviewerIds=[administrator.id];}
 let arena,base;
 async function start(){arena=await createArenaServer(config);await new Promise(r=>arena.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${arena.server.address().port}`;}
 await start();t.after(async()=>{await arena.close();await rm(dataDir,{recursive:true,force:true});});
 const client=()=>{let cookie='',csrf='';return {get cookie(){return cookie},get csrf(){return csrf},async api(path,{method='GET',data,body,mime}={}){const headers={Origin:config.publicOrigin||base};if(cookie)headers.Cookie=cookie;if(csrf)headers['X-CSRF-Token']=csrf;if(data!==undefined){body=JSON.stringify(data);headers['Content-Type']='application/json'}if(mime)headers['Content-Type']=mime;const response=await fetch(base+'/api/v1'+path,{method,headers,body});const payload=await response.json();if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];if(Object.hasOwn(payload,'csrfToken'))csrf=payload.csrfToken;return {status:response.status,data:payload}},async register(name,coins=0){const r=await this.api('/auth/register',{method:'POST',data:{nickname:name,password:'reliability test password',countryCode:'BR',acceptedTerms:true,termsVersion:TERMS_VERSION}});assert.equal(r.status,200);if(coins){const p=await this.api('/wallet/deposits',{method:'POST',data:{amount:coins,method:'card',installments:1,idempotencyKey:randomUUID()}});assert.equal((await this.api(`/wallet/deposits/${p.data.deposit.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'approved',version:p.data.deposit.version}})).status,200)}return r.data.user},async create(stake=0,extra={}){return this.api('/duels',{method:'POST',data:{stake,mode:'1v1',platform:'pc',...extra}})}}};
 async function mutateDuel(id,fn,copies=0){await arena.close();const db=new DatabaseSync(join(dataDir,'arena.sqlite'));const row=db.prepare('SELECT data_json FROM duels WHERE id=?').get(id),duel=JSON.parse(row.data_json);fn(duel);db.prepare('UPDATE duels SET data_json=? WHERE id=?').run(JSON.stringify(duel),id);for(let i=0;i<copies;i++){const copy={...duel,id:randomUUID(),publicMatchId:'FG-'+randomUUID().replaceAll('-','').slice(0,10).toUpperCase(),inviteToken:randomUUID().replaceAll('-','')+String(i).padStart(11,'0')};db.prepare('INSERT INTO duels(id,public_match_id,invite_token,host_id,guest_id,recipient_id,data_json) VALUES(?,?,?,?,?,?,?)').run(copy.id,copy.publicMatchId,copy.inviteToken,copy.hostId,copy.guestId,copy.recipientId,JSON.stringify(copy));}db.close();await start();}
 return {client,reviewerIds,mutateDuel,administrator,dataDir,async restart(extra){await arena.close();Object.assign(config,extra);await start();},get base(){return base}};
}

test('password recovery needs an authenticated setup, consumes code and revokes stolen sessions',async t=>{
 const h=await fixture(t,{paymentMode:'unconfigured'}),a=h.client(),b=h.client(),stranger=h.client();const user=await a.register('Cado');
 assert.equal((await b.api('/auth/login',{method:'POST',data:{nickname:'Cado',password:'reliability test password'}})).status,200);
 assert.equal((await stranger.api('/auth/security')).status,401);
 assert.equal((await a.api('/auth/security/recovery-codes',{method:'POST',data:{password:'wrong'}})).status,401);
 const setup=await a.api('/auth/security/recovery-codes',{method:'POST',data:{password:'reliability test password'}});
 assert.equal(setup.status,200);assert.equal(setup.data.codes.length,8);
 const invalid=await stranger.api('/auth/recover',{method:'POST',data:{identifier:'Cado',recoveryCode:'invalid',newPassword:'new secure password'}});assert.equal(invalid.status,401);
 const reset=await stranger.api('/auth/recover',{method:'POST',data:{identifier:user.publicPlayerId,recoveryCode:setup.data.codes[0],newPassword:'new secure password'}});
 assert.equal(reset.status,200);assert.equal(reset.data.user.id,user.id);
 assert.equal((await a.api('/auth/security')).status,401);assert.equal((await b.api('/auth/security')).status,401);
 assert.equal((await stranger.api('/auth/recover',{method:'POST',data:{identifier:'Cado',recoveryCode:setup.data.codes[0],newPassword:'another password'}})).status,401);
 assert.equal((await stranger.api('/auth/security')).data.recoveryCodesRemaining,7);
});
test('session revocation and password change preserve account and reject foreign sessions',async t=>{
 const h=await fixture(t,{paymentMode:'unconfigured'}),a=h.client(),b=h.client();await a.register('Alice');await b.api('/auth/login',{method:'POST',data:{nickname:'Alice',password:'reliability test password'}});
 const list=await a.api('/auth/security');assert.equal(list.status,200);assert.equal(list.data.sessions.length,2);
 assert.equal((await a.api('/auth/security/revoke',{method:'POST',data:{allOthers:true}})).status,200);
 assert.equal((await b.api('/wallet')).status,401);
 assert.equal((await a.api('/auth/security/password',{method:'POST',data:{currentPassword:'wrong',newPassword:'new correct password'}})).status,401);
 const oldCookie=a.cookie;
 assert.equal((await a.api('/auth/security/password',{method:'POST',data:{currentPassword:'reliability test password',newPassword:'new correct password'}})).status,200);
 assert.equal((await fetch(h.base+'/api/v1/wallet',{headers:{Cookie:oldCookie}})).status,401);
 assert.equal((await a.api('/wallet')).data.balance,0);
});
test('joining cannot bypass the 50-active-room limit through any admission endpoint',async t=>{
 const h=await fixture(t,{paymentMode:'unconfigured'}),a=h.client(),b=h.client();const player=await a.register('BusyPlayer');await b.register('Host');
 const first=await a.create();assert.equal(first.status,200);await h.mutateDuel(first.data.duel.id,()=>{},49);
 const room=(await b.create(0,{opponentPlayerId:player.publicPlayerId})).data.duel;
 for(const path of ['/duels/'+room.id+'/accept','/invites/code/'+room.publicMatchId+'/accept','/invites/'+room.inviteToken+'/accept']){const r=await a.api(path,{method:'POST',data:{}});assert.equal(r.status,409);assert.equal(r.data.code,'room_admission_limit');}
 assert.equal((await b.api('/me')).data.duels[0].guestId,null);
});

async function teamApi(h,path,data,origin=h.base){
 const headers={Origin:origin,Cookie:'fifabet_session='+h.administrator.sessionToken,'X-CSRF-Token':h.administrator.csrfToken};
 if(data)headers['Content-Type']='application/json';
 const response=await fetch(h.base+'/api/v1'+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined});
 return {status:response.status,data:await response.json()};
}
test('shootout must be recorded, both photos are private and manual review sees both',async t=>{
 const h=await fixture(t,{paymentMode:'unconfigured'}),a=h.client(),b=h.client(),review=h.client(),outsider=h.client();await a.register('Host');await b.register('Guest');await outsider.register('Outsider');const r=await review.register('Reviewer');h.reviewerIds.push(r.id);await h.restart({});
 const duel=(await a.create(0,{matchRules:{extraTime:false,penalties:true,disconnectPolicy:'review'}})).data.duel;
 await b.api('/invites/code/'+duel.publicMatchId+'/accept',{method:'POST',data:{}});for(const p of [a,b])await p.api('/duels/'+duel.id+'/start',{method:'POST',data:{}});
 const photos=[];for(const [i,p]of [a,b].entries()){const sent=await p.api('/evidence?duelId='+duel.id,{method:'POST',body:Buffer.concat([PNG,Buffer.from(String(i))]),mime:'image/png'});assert.equal(sent.status,200);photos.push(sent.data.evidence.id);}
 const plain={homeScore:1,awayScore:1,scoreSide:'host',evidenceId:photos[0]};assert.equal((await a.api('/duels/'+duel.id+'/result',{method:'POST',data:plain})).data.code,'penalties_required');
 const result=await a.api('/duels/'+duel.id+'/result',{method:'POST',data:{...plain,penalties:{homeScore:4,awayScore:3}}});assert.equal(result.status,200);
 const confirmed=await b.api('/duels/'+duel.id+'/confirm',{method:'POST',data:{...plain,evidenceId:photos[1],reportId:result.data.duel.result.id,penalties:{homeScore:4,awayScore:3}}});assert.equal(confirmed.status,200);assert.equal(confirmed.data.duel.reviewReason,'penalties_review_required');
 assert.equal((await outsider.api('/duels/'+duel.id)).status,404);assert.equal((await fetch(h.base+'/api/v1/evidence/'+photos[1],{headers:{Cookie:outsider.cookie}})).status,404);
 const queue=await review.api('/reviews');assert.equal(queue.status,200);assert.equal(queue.data.duels[0].evidence.length,2);assert.deepEqual(new Set(queue.data.duels[0].evidence.map(e=>e.id)),new Set(photos));
 assert.equal((await review.api('/reviews/'+duel.id,{method:'POST',data:{reportId:result.data.duel.result.id,winner:'draw',reason:'Conferência do desempate e das evidências'}})).data.code,'tiebreak_review_required');
 assert.equal((await review.api('/reviews/'+duel.id,{method:'POST',data:{reportId:result.data.duel.result.id,winner:'host',reason:'Conferência do desempate e das duas evidências'}})).data.duel.status,'completed');
 const achievements=(await a.api('/me')).data.achievements;assert.equal(achievements.length,2);
});
test('closed paid Pix order is recoverable once, bank references cannot be reused and pending total ignores page size',async t=>{
 const origin='https://fifago.local-test',h=await fixture(t,{seedAdmin:true,paymentMode:'pix_manual',publicOrigin:origin,pixKey:'test@example.com',reviewerIds:[],pixPackages:Object.fromEntries([100,250,500,1000].map(amount=>[amount,{amount,priceCents:amount*10}]))});
 const a=h.client();const user=await a.register('Alice');
 async function order(amount){return (await a.api('/wallet/deposits',{method:'POST',data:{amount,method:'pix',idempotencyKey:randomUUID()}})).data.deposit;}
 const first=await order(100),second=await order(250);const wallet=(await a.api('/wallet?limit=1')).data;assert.equal(wallet.deposits.length,1);assert.equal(wallet.pendingDepositAmount,350);
 const proof=await a.api('/wallet/deposits/'+first.id+'/proof?version=1',{method:'POST',body:PNG,mime:'image/png'});assert.equal(proof.status,200);
 const closed=await a.api('/wallet/deposits/'+first.id+'/cancel',{method:'POST',data:{version:2}});assert.equal(closed.status,200);
 const payload={version:3,outcome:'credit',reason:'Recebimento confirmado no extrato original do pedido.',bankReference:'E-ORIGINAL-0001',bankAmountCents:1000,paidAt:new Date().toISOString()};
 assert.equal((await a.api('/wallet/recoveries/'+first.id,{method:'POST',data:payload})).status,403);
 const proofPath=join(h.dataDir,'wallet-evidence',proof.data.evidence.id),savedProof=proofPath+'.fixture-backup';await rename(proofPath,savedProof);
 const missing=await teamApi(h,'/wallet/recoveries/'+first.id,payload,origin);assert.equal(missing.status,409);assert.equal(missing.data.code,'deposit_proof_unavailable');assert.equal((await a.api('/wallet')).data.balance,0);
 await rename(savedProof,proofPath);
 const recovery=await teamApi(h,'/wallet/recoveries/'+first.id,payload,origin);assert.equal(recovery.status,200);assert.equal(recovery.data.deposit.recovery.previousDecision.kind,'owner');
 assert.equal((await teamApi(h,'/wallet/recoveries/'+first.id,payload,origin)).data.replayed,true);assert.equal((await a.api('/wallet')).data.balance,100);
 await a.api('/wallet/deposits/'+second.id+'/proof?version=1',{method:'POST',body:PNG,mime:'image/png'});
 const duplicate=await teamApi(h,'/wallet/reviews/'+second.id,{decision:'approve',version:2,reason:'Conferência bancária sintética deste pagamento',bankReference:payload.bankReference,bankAmountCents:2500,paidAt:new Date().toISOString()},origin);assert.equal(duplicate.status,409);assert.equal(duplicate.data.code,'bank_reference_used');
 assert.equal((await a.api('/wallet')).data.transactions.filter(tx=>tx.reference==='deposit:'+first.id).length,1);
 assert.equal((await teamApi(h,'/admin/users?search='+user.publicPlayerId,undefined,origin)).status,200);
});
test('privacy request requires independent admin and anonymization revokes account access',async t=>{
 const h=await fixture(t,{seedAdmin:true,paymentMode:'unconfigured'}),a=h.client();const user=await a.register('Alice');
 const request=await a.api('/auth/security/delete-request',{method:'POST',data:{reason:'Quero anonimizar meu perfil nesta aplicação.'}});assert.equal(request.status,200);
 const rejection=await teamApi(h,'/admin/deletion-requests/'+user.id,{decision:'reject',reason:'Solicitação precisa ser conferida novamente.'});assert.equal(rejection.status,200);
 const retry=await a.api('/auth/security/delete-request',{method:'POST',data:{reason:'Resolvi minhas pendências e renovo o pedido.'}});assert.equal(retry.data.request.status,'pending_review');assert.equal(retry.data.request.reason,'Resolvi minhas pendências e renovo o pedido.');
 const body={decision:'anonymize',reason:'Pendências conferidas. Perfil pode ser anonimizado.'};assert.equal((await a.api('/admin/deletion-requests/'+user.id,{method:'POST',data:body})).status,403);
 assert.equal((await teamApi(h,'/admin/deletion-requests')).data.requests.length,1);
 assert.equal((await teamApi(h,'/admin/deletion-requests/'+user.id,body)).status,200);assert.equal((await a.api('/session')).data.user,null);
 const find=await teamApi(h,'/admin/users?search='+user.publicPlayerId);assert.match(find.data.users[0].nickname,/Removido_/);assert.equal(find.data.users[0].balance,0);
 const other=h.client();await other.register('Bob');assert.equal((await other.create(0,{opponentPlayerId:user.publicPlayerId})).status,404);
});

test('an extra-time draw without shootout may still be approved as a draw',async t=>{
 const h=await fixture(t,{paymentMode:'unconfigured'}),a=h.client(),b=h.client(),review=h.client();await a.register('Host');await b.register('Guest');const r=await review.register('Reviewer');h.reviewerIds.push(r.id);await h.restart({});
 const duel=(await a.create(0,{matchRules:{extraTime:true,penalties:false,disconnectPolicy:'review'}})).data.duel;
 await b.api('/invites/code/'+duel.publicMatchId+'/accept',{method:'POST',data:{}});for(const p of [a,b])await p.api('/duels/'+duel.id+'/start',{method:'POST',data:{}});
 const photos=[];for(const [i,p]of [a,b].entries())photos.push((await p.api('/evidence?duelId='+duel.id,{method:'POST',body:Buffer.concat([PNG,Buffer.from(String(i))]),mime:'image/png'})).data.evidence.id);
 const data={homeScore:1,awayScore:1,extraTime:{homeScore:2,awayScore:2},scoreSide:'host',evidenceId:photos[0]};
 const reported=await a.api('/duels/'+duel.id+'/result',{method:'POST',data});assert.equal(reported.status,200);
 await b.api('/duels/'+duel.id+'/confirm',{method:'POST',data:{...data,evidenceId:photos[1],reportId:reported.data.duel.result.id}});
 const approved=await review.api('/reviews/'+duel.id,{method:'POST',data:{reportId:reported.data.duel.result.id,winner:'draw',reason:'As duas fotos mostram empate após a prorrogação.'}});assert.equal(approved.status,200);assert.equal(approved.data.duel.winner,'draw');
});
