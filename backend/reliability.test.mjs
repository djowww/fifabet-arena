import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createArenaServer} from './server.mjs';
import {TERMS_VERSION} from '../account-policy.mjs';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
async function fixture(t,extra={}){
 const dataDir=await mkdtemp(join(tmpdir(),'fifago-reliability-')),reviewerIds=[];
 const config={dataDir,paymentMode:'demo',reviewerIds,recognizer:{status:()=>({available:true}),recognize:async()=>({provider:'local-ocr',status:'suggested',scores:{left:3,right:1},confidence:95,finalScreen:true,requiresReview:false}),close(){}},visualInspector:{inspect:async body=>({status:'checked',hash:createHash('sha256').update(body).digest('hex').slice(0,16)}),close(){}},...extra};
 let arena,base;
 async function start(){arena=await createArenaServer(config);await new Promise(r=>arena.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${arena.server.address().port}`;}
 await start();t.after(async()=>{await arena.close();await rm(dataDir,{recursive:true,force:true});});
 const client=()=>{let cookie='',csrf='';return {get cookie(){return cookie},get csrf(){return csrf},async api(path,{method='GET',data,body,mime}={}){const headers={Origin:config.publicOrigin||base};if(cookie)headers.Cookie=cookie;if(csrf)headers['X-CSRF-Token']=csrf;if(data!==undefined){body=JSON.stringify(data);headers['Content-Type']='application/json'}if(mime)headers['Content-Type']=mime;const response=await fetch(base+'/api/v1'+path,{method,headers,body});const payload=await response.json();if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];if(Object.hasOwn(payload,'csrfToken'))csrf=payload.csrfToken;return {status:response.status,data:payload}},async register(name,coins=0){const r=await this.api('/auth/register',{method:'POST',data:{nickname:name,password:'reliability test password',countryCode:'BR',acceptedTerms:true,termsVersion:TERMS_VERSION}});assert.equal(r.status,200);if(coins){const p=await this.api('/wallet/deposits',{method:'POST',data:{amount:coins,method:'card',installments:1,idempotencyKey:randomUUID()}});assert.equal((await this.api(`/wallet/deposits/${p.data.deposit.id}/simulate`,{method:'POST',data:{mode:'demo',outcome:'approved',version:p.data.deposit.version}})).status,200)}return r.data.user},async create(stake=0,extra={}){return this.api('/duels',{method:'POST',data:{stake,mode:'1v1',platform:'pc',...extra}})}}};
 async function mutateDuel(id,fn){await arena.close();const db=new DatabaseSync(join(dataDir,'arena.sqlite'));const row=db.prepare('SELECT data_json FROM duels WHERE id=?').get(id),duel=JSON.parse(row.data_json);fn(duel);db.prepare('UPDATE duels SET data_json=? WHERE id=?').run(JSON.stringify(duel),id);db.close();await start();}
 return {client,reviewerIds,mutateDuel,async restart(extra){await arena.close();Object.assign(config,extra);await start();},get base(){return base}};
}
async function joined(h,stake=100){const host=h.client(),guest=h.client();await host.register('Host',1000);await guest.register('Guest',1000);const r=await host.create(stake);assert.equal(r.status,200);assert.equal((await guest.api(`/invites/code/${r.data.duel.publicMatchId}/accept`,{method:'POST',data:{}})).status,200);return {host,guest,duel:r.data.duel};}

test('compact snapshots and cursor pages are private and retain all history',async t=>{
 const h=await fixture(t),a=h.client(),b=h.client();await a.register('Alice',1000);await b.register('Bob');
 for(let i=0;i<3;i++){const r=await a.create(10);assert.equal(r.status,200);assert.equal((await a.api(`/duels/${r.data.duel.id}/cancel`,{method:'POST',data:{}})).status,200)}
 const me=await a.api('/me?compact=1');assert.equal(me.status,200);assert.equal(me.data.user.transactions.length,0);assert.equal(typeof me.data.walletRevision,'string');
 const first=await a.api('/history?limit=2');assert.equal(first.status,200);assert.equal(first.data.items.length,2);assert.ok(first.data.nextCursor);
 const second=await a.api('/history?limit=2&cursor='+encodeURIComponent(first.data.nextCursor));assert.equal(second.data.items.length,1);assert.equal(new Set([...first.data.items,...second.data.items].map(d=>d.id)).size,3);
 assert.equal((await b.api('/history')).data.items.length,0);
 const wallet=await a.api('/wallet?limit=2');assert.equal(wallet.data.transactions.length,2);assert.ok(wallet.data.transactionsNextCursor);assert.equal(typeof wallet.data.revision,'string');
 assert.equal((await b.api('/wallet?limit=2&cursor='+encodeURIComponent(wallet.data.transactionsNextCursor))).status,400);
});
test('profile records declared game identity and rooms retain structured compatibility',async t=>{
 const h=await fixture(t),a=h.client();await a.register('Alice');const account={eaId:'EA_Alice',psnId:'AlicePS',xboxId:'',gameEdition:'FC 26',consoleGeneration:'PS5',crossplay:'enabled'};
 const edit=await a.api('/me',{method:'PATCH',data:{gameAccount:account}});assert.equal(edit.status,200);assert.equal(edit.data.user.gameAccount.eaId,'EA_Alice');
 assert.equal((await a.api('/me',{method:'PATCH',data:{gameAccount:{eaId:'x'.repeat(65)}}})).status,400);
 const made=await a.create(0,{gameEdition:'FC 26',consoleGeneration:'PC',crossplay:'enabled',matchRules:{extraTime:true,penalties:true,disconnectPolicy:'review'}});assert.equal(made.status,200);assert.equal(made.data.duel.gameEdition,'FC 26');assert.equal(made.data.duel.matchRules.penalties,true);assert.ok(made.data.duel.inviteDeadline);
});
test('readiness can be withdrawn and preparation expiry refunds exactly once',async t=>{
 const h=await fixture(t),{host,guest,duel}=await joined(h);
 assert.equal((await host.api(`/duels/${duel.id}/start`,{method:'POST',data:{}})).status,200);
 const withdrawn=await host.api(`/duels/${duel.id}/unready`,{method:'POST',data:{}});assert.equal(withdrawn.status,200);assert.deepEqual(withdrawn.data.duel.readyBy,[]);
 const g=await guest.api(`/duels/${duel.id}/start`,{method:'POST',data:{}});assert.equal(g.data.duel.status,'waiting_start');
 await h.mutateDuel(duel.id,d=>{d.preparationDeadline=new Date(Date.now()-1000).toISOString();d.expiresAt=d.preparationDeadline});
 await host.api('/me');const x=await host.api('/me');assert.equal(x.data.history.find(d=>d.id===duel.id).status,'expired');assert.equal(x.data.user.balance,1000);assert.equal((await guest.api('/me')).data.user.balance,1000);
});
test('late matches escalate without awarding a win and permit independent abandonment resolution',async t=>{
 const h=await fixture(t),{host,guest,duel}=await joined(h),review=h.client(),r=await review.register('Reviewer');h.reviewerIds.push(r.id);
 await host.api(`/duels/${duel.id}/start`,{method:'POST',data:{}});await guest.api(`/duels/${duel.id}/start`,{method:'POST',data:{}});
 await h.mutateDuel(duel.id,d=>{d.matchDeadline=new Date(Date.now()-1000).toISOString()});
 const me=await host.api('/me'),current=me.data.duels.find(d=>d.id===duel.id);assert.ok(current.matchTimedOutAt);assert.equal(me.data.user.balance,900);assert.equal(current.settlement,undefined);
 assert.equal((await host.api(`/reviews/${duel.id}/abandon`,{method:'POST',data:{decision:'cancel',reason:'Adversário desconectado sem resultado'}})).status,403);
 assert.equal((await review.api(`/reviews/${duel.id}/abandon`,{method:'POST',data:{decision:'cancel',reason:'Abandono conferido pela equipe responsável'}})).status,200);
 assert.equal((await host.api('/me')).data.user.balance,1000);assert.equal((await guest.api('/me')).data.user.balance,1000);
});
test('uploads outside the writer do not delay another player snapshot',async t=>{
 const h=await fixture(t),{host,guest,duel}=await joined(h,0);await host.api(`/duels/${duel.id}/start`,{method:'POST',data:{}});await guest.api(`/duels/${duel.id}/start`,{method:'POST',data:{}});
 let upload;const done=new Promise((resolve,reject)=>{upload=httpRequest(`${h.base}/api/v1/evidence?duelId=${duel.id}`,{method:'POST',headers:{Origin:h.base,Cookie:host.cookie,'X-CSRF-Token':host.csrf,'Content-Type':'image/png','Content-Length':PNG.length}},response=>{response.resume();response.on('end',resolve)});upload.on('error',reject)});
 upload.write(PNG.subarray(0,24));const finish=setTimeout(()=>upload.end(PNG.subarray(24)),800);t.after(()=>clearTimeout(finish));
 await new Promise(r=>setTimeout(r,80));const began=Date.now();const other=await guest.api('/me?compact=1');const elapsed=Date.now()-began;await done;assert.equal(other.status,200);assert.ok(elapsed<450,`snapshot delayed ${elapsed}ms by unrelated upload`);
});

async function confirmedResult(host,guest,duel){
 for(const client of [host,guest])assert.equal((await client.api(`/duels/${duel.id}/start`,{method:'POST',data:{}})).status,200);
 const photos=[];
 for(const [index,client] of [host,guest].entries()){
  const sent=await client.api(`/evidence?duelId=${duel.id}`,{method:'POST',body:Buffer.concat([PNG,Buffer.from(String(index))]),mime:'image/png'});assert.equal(sent.status,200);
  photos.push(sent.data.evidence.id);assert.equal((await client.api(`/duels/${duel.id}/recognize`,{method:'POST',data:{evidenceId:photos[index]}})).status,200);
 }
 const result=await host.api(`/duels/${duel.id}/result`,{method:'POST',data:{homeScore:3,awayScore:1,scoreSide:'host',evidenceId:photos[0]}});assert.equal(result.status,200);
 return guest.api(`/duels/${duel.id}/confirm`,{method:'POST',data:{reportId:result.data.duel.result.id,homeScore:3,awayScore:1,scoreSide:'host',evidenceId:photos[1]}});
}
for(const [name,stake,inspector,expected] of [
 ['high stake',500,null,'high_stake'],
 ['similar images',100,{inspect:async()=>({status:'checked',hash:'1111111111111111'}),close(){}},'visual_similarity'],
 ['failed image analysis',100,{inspect:async()=>({status:'unavailable'}),close(){}},'visual_check_unavailable']
])test(`${name} keeps bilateral OCR-confirmed prizes reserved for independent review`,async t=>{
 const h=await fixture(t,inspector?{visualInspector:inspector}:{}),{host,guest,duel}=await joined(h,stake),confirmation=await confirmedResult(host,guest,duel);
 assert.equal(confirmation.status,200);assert.equal(confirmation.data.duel.status,'pending_review');assert.equal(confirmation.data.duel.reviewReason,expected);
 assert.equal((await host.api('/me')).data.user.balance,1000-stake);assert.equal((await guest.api('/me')).data.user.balance,1000-stake);
});
test('an operationally overdue match remains human review even when both later submit matching OCR scores',async t=>{
 const h=await fixture(t),{host,guest,duel}=await joined(h);
 for(const client of [host,guest])await client.api(`/duels/${duel.id}/start`,{method:'POST',data:{}});
 await h.mutateDuel(duel.id,d=>{d.matchDeadline=new Date(Date.now()-1000).toISOString()});
 // The room is already active; repeated readiness calls are intentionally omitted.
 const photos=[];
 for(const [i,client]of [host,guest].entries()){const sent=await client.api(`/evidence?duelId=${duel.id}`,{method:'POST',body:Buffer.concat([PNG,Buffer.from(String(i))]),mime:'image/png'});assert.equal(sent.status,200);photos.push(sent.data.evidence.id);await client.api(`/duels/${duel.id}/recognize`,{method:'POST',data:{evidenceId:photos[i]}});}
 const report=await host.api(`/duels/${duel.id}/result`,{method:'POST',data:{homeScore:3,awayScore:1,scoreSide:'host',evidenceId:photos[0]}});
 const confirmation=await guest.api(`/duels/${duel.id}/confirm`,{method:'POST',data:{reportId:report.data.duel.result.id,homeScore:3,awayScore:1,scoreSide:'host',evidenceId:photos[1]}});
 assert.equal(confirmation.status,200);assert.equal(confirmation.data.duel.status,'pending_review');assert.equal(confirmation.data.duel.reviewReason,'match_timeout');assert.equal((await host.api('/me')).data.user.balance,900);
});
test('manual Pix needs bank value/date/reference and the same transfer cannot fund two accounts',async t=>{
 const h=await fixture(t),a=h.client(),b=h.client(),team=h.client();await a.register('Alice');await b.register('Bob');const reviewer=await team.register('Reviewer');h.reviewerIds.push(reviewer.id);
 await h.restart({paymentMode:'pix_manual',publicOrigin:'https://fifago.local-test',pixKey:'test@example.com',pixPackages:Object.fromEntries([100,250,500,1000].map(amount=>[amount,{amount,priceCents:amount*10}]))});
 async function proof(client){const order=await client.api('/wallet/deposits',{method:'POST',data:{amount:100,method:'pix',idempotencyKey:randomUUID()}});assert.equal(order.status,200);const sent=await client.api(`/wallet/deposits/${order.data.deposit.id}/proof?version=1`,{method:'POST',body:PNG,mime:'image/png'});assert.equal(sent.status,200);return sent.data.deposit;}
 const one=await proof(a),two=await proof(b),decision={decision:'approve',reason:'Conferência sintética de extrato em teste local.',version:2,bankReference:'E1234567890TEST',bankAmountCents:1000,paidAt:new Date().toISOString()};
 assert.equal((await team.api(`/wallet/reviews/${one.id}`,{method:'POST',data:{...decision,bankReference:''}})).status,400);
 assert.equal((await team.api(`/wallet/reviews/${one.id}`,{method:'POST',data:{...decision,bankAmountCents:999}})).status,400);
 assert.equal((await a.api(`/wallet/reviews/${one.id}`,{method:'POST',data:decision})).status,403);
 assert.equal((await team.api(`/wallet/reviews/${one.id}`,{method:'POST',data:decision})).status,200);
 const duplicate=await team.api(`/wallet/reviews/${two.id}`,{method:'POST',data:{...decision,bankReference:decision.bankReference.toLowerCase()}});assert.equal(duplicate.status,409);assert.equal(duplicate.data.code,'bank_reference_used');
 assert.equal((await a.api('/wallet')).data.balance,100);assert.equal((await b.api('/wallet')).data.balance,0);
 await h.restart({});assert.equal((await a.api('/wallet')).data.balance,100);assert.equal((await b.api('/wallet')).data.balance,0);
});
test('finishing legacy room funding stores an operational match deadline',async t=>{
 const h=await fixture(t),host=h.client(),guest=h.client();const owner=await host.register('Host',1000),rival=await guest.register('Guest',1000);
 const created=await host.create(100);assert.equal(created.status,200);const duel=created.data.duel;
 await h.mutateDuel(duel.id,d=>{d.fundingVersion=1;d.creditMode='demo';d.fundedBy=[owner.id];d.status='awaiting_funds';d.guestId=rival.id;d.acceptedAt=new Date().toISOString();d.preparationDeadline=new Date(Date.now()+600_000).toISOString();d.expiresAt=d.preparationDeadline;delete d.matchDeadline;delete d.lobbyVersion;});
 const funded=await guest.api(`/duels/${duel.id}/fund`,{method:'POST',data:{stake:100}});assert.equal(funded.status,200);assert.equal(funded.data.duel.status,'in_progress');
 assert.equal(Date.parse(funded.data.duel.matchDeadline)-Date.parse(funded.data.duel.startedAt),60*60_000);
});
