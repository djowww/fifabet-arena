import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createArenaServer} from './server.mjs';
import {openArenaDatabase} from './database.mjs';

const ADMIN_EMAIL='operator@example.test';
const PASSWORD_SENTINEL='private-password-hash';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');

async function harness(t,{adminEmails=[ADMIN_EMAIL],paymentMode='unconfigured',customize}={}){
  const dataDir=await mkdtemp(join(tmpdir(),'fifago-admin-test-'));
  const state={version:1,walletLedgerVersion:1,users:{},duels:{},sessions:{},deposits:{},evidence:{},walletEvidence:{},authIdentities:{}};
  const accounts={};
  for(const [name,emailVerified,email]of [['admin',true,ADMIN_EMAIL.toUpperCase()],['unverified',false,ADMIN_EMAIL],['stringClaim','true',ADMIN_EMAIL],['ordinary',true,'player@example.test'],['forged',null,null]]){
    const id=randomUUID(),sessionToken=randomBytes(32).toString('base64url'),csrfToken=randomBytes(32).toString('base64url');
    const user={id,publicPlayerId:`FBA-${randomBytes(5).toString('hex').toUpperCase()}`,nickname:name,clubId:null,gameAccount:null,createdAt:new Date().toISOString(),balance:0,transactions:[],friends:[],passwordHash:PASSWORD_SENTINEL,passwordSalt:'private-salt',...(name==='forged'?{isAdmin:true,isReviewer:true,email:ADMIN_EMAIL}:{})};
    state.users[id]=user;
    state.sessions[createHash('sha256').update(sessionToken).digest('hex')]={userId:id,csrfToken,createdAt:Date.now(),expiresAt:Date.now()+86400000};
    if(email){const subject=randomUUID();state.authIdentities[`google:${subject}`]={provider:'google',subject,userId:id,email,emailVerified,createdAt:new Date().toISOString()};}
    accounts[name]={user,sessionToken,csrfToken};
  }
  customize?.(state,accounts);
  const database=await openArenaDatabase(dataDir);database.save(state);database.close();
  let arena,base,configuredAdmins=adminEmails;
  async function start(){arena=await createArenaServer({dataDir,paymentMode,adminEmails:configuredAdmins,env:{}});await new Promise(resolve=>arena.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${arena.server.address().port}`;}
  await start();
  t.after(async()=>{if(arena)await arena.close();await rm(dataDir,{recursive:true,force:true});});
  async function api(name,path,{method='GET',data,csrf=true,origin,body,mime}={}){
    const account=accounts[name],headers={Origin:origin||base};
    if(account){headers.Cookie=`fifabet_session=${account.sessionToken}`;if(csrf)headers['X-CSRF-Token']=account.csrfToken;}
    if(data!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(data);}
    if(mime)headers['Content-Type']=mime;
    const response=await fetch(`${base}/api/v1${path}`,{method,headers,body});
    const payload=response.headers.get('content-type')?.startsWith('application/json')?await response.json():Buffer.from(await response.arrayBuffer());
    return {status:response.status,data:payload};
  }
  return {api,accounts,dataDir,async restart(nextAdminEmails=configuredAdmins){await arena.close();arena=null;configuredAdmins=nextAdminEmails;await start();}};
}

test('administration requires an allowlisted server-verified OAuth e-mail and never trusts user fields',async t=>{
  const h=await harness(t);
  for(const path of ['/admin/overview','/admin/users','/admin/audit']){
    assert.equal((await h.api('visitor',path)).status,401);
    for(const name of ['ordinary','unverified','stringClaim','forged']){
      const denied=await h.api(name,path);assert.equal(denied.status,403);assert.equal(denied.data.code,'admin_required');
    }
  }
  for(const name of ['ordinary','unverified','stringClaim','forged']){
    const session=await h.api(name,'/session');assert.equal(session.data.user.isAdmin,false);assert.equal(session.data.user.isReviewer,false);
    assert.equal((await h.api(name,'/admin/credits',{method:'POST',data:{}})).status,403);
  }
  const session=await h.api('admin','/session');assert.equal(session.data.user.isAdmin,true);assert.equal(session.data.user.isReviewer,true);
  assert.equal((await h.api('admin','/me')).data.user.isAdmin,true);
  const patched=await h.api('forged','/me',{method:'PATCH',data:{nickname:'operator',isAdmin:true,email:ADMIN_EMAIL}});
  assert.equal(patched.status,200);assert.equal(patched.data.user.isAdmin,false);
  const overview=await h.api('admin','/admin/overview');assert.equal(overview.status,200);assert.equal(overview.data.stats.users,5);assert.equal(overview.data.paymentsAvailable,false);assert.equal(overview.data.paymentMode,'unconfigured');
});

test('admin directory minimizes sensitive data and supports case-insensitive public ID and verified e-mail search',async t=>{
  const h=await harness(t);
  const all=await h.api('admin','/admin/users');assert.equal(all.data.total,5);assert.equal(all.data.limit,50);
  for(const user of all.data.users)assert.deepEqual(Object.keys(user).sort(),['balance','clubId','createdAt','id','nickname','publicPlayerId','reserved','verifiedEmails']);
  assert.ok(!JSON.stringify(all.data).includes(PASSWORD_SENTINEL));assert.ok(!JSON.stringify(all.data).includes('private-salt'));assert.ok(!JSON.stringify(all.data).includes(h.accounts.admin.sessionToken));
  const found=await h.api('admin',`/admin/users?search=${encodeURIComponent(ADMIN_EMAIL.toUpperCase())}`);
  assert.equal(found.data.users.length,1);assert.equal(found.data.users[0].id,h.accounts.admin.user.id);assert.deepEqual(found.data.users[0].verifiedEmails,[ADMIN_EMAIL]);
  const publicId=await h.api('admin',`/admin/users?search=${h.accounts.ordinary.user.publicPlayerId.toLowerCase()}`);assert.equal(publicId.data.users[0].id,h.accounts.ordinary.user.id);
  assert.equal((await h.api('admin',`/admin/users?search=${'x'.repeat(101)}`)).status,400);
});

test('credit grants enforce origin, CSRF, integer bounds, recipient and explicit reason',async t=>{
  const h=await harness(t),data={userId:h.accounts.ordinary.user.id,amount:250,reason:'Créditos autorizados para teste acompanhado.',idempotencyKey:randomUUID()};
  for(const options of [{csrf:false},{origin:'https://attacker.example'}])assert.equal((await h.api('admin','/admin/credits',{method:'POST',data,...options})).status,403);
  for(const invalid of [{amount:0},{amount:-1},{amount:1.5},{amount:'100'},{amount:100001},{reason:'curto'},{reason:'x'.repeat(1001)},{idempotencyKey:'bad-key'},{unexpected:true}])assert.equal((await h.api('admin','/admin/credits',{method:'POST',data:{...data,...invalid}})).status,400);
  assert.equal((await h.api('admin','/admin/credits',{method:'POST',data:{...data,userId:randomUUID()}})).status,404);
  assert.equal((await h.api('ordinary','/wallet')).data.balance,0);
  assert.deepEqual((await h.api('admin','/admin/audit')).data.entries,[]);
});

test('concurrent retries grant credits once and persist an auditable ledger without approving any payment',async t=>{
  const h=await harness(t),data={userId:h.accounts.ordinary.user.id,amount:250,reason:'Créditos para testar o fluxo administrativo.',idempotencyKey:randomUUID()};
  const results=await Promise.all([h.api('admin','/admin/credits',{method:'POST',data}),h.api('admin','/admin/credits',{method:'POST',data})]);
  assert.deepEqual(results.map(result=>result.status),[200,200]);assert.deepEqual(results.map(result=>result.data.replayed).sort(),[false,true]);
  assert.equal(results[0].data.operation.id,results[1].data.operation.id);assert.equal(results[0].data.operation.balanceBefore,0);assert.equal(results[0].data.operation.balanceAfter,250);
  const wallet=(await h.api('ordinary','/wallet')).data;assert.equal(wallet.balance,250);assert.equal(wallet.transactions.length,1);assert.equal(wallet.transactions[0].source,'admin_adjustment');assert.equal(wallet.transactions[0].administrative,true);assert.equal(wallet.paymentsAvailable,false);assert.equal(wallet.paymentMode,'unconfigured');assert.deepEqual(wallet.deposits,[]);
  const audit=(await h.api('admin','/admin/audit')).data;assert.equal(audit.entries.length,1);assert.equal(audit.entries[0].actor.publicPlayerId,h.accounts.admin.user.publicPlayerId);assert.equal(audit.entries[0].target.publicPlayerId,h.accounts.ordinary.user.publicPlayerId);assert.equal(audit.entries[0].reason,data.reason);assert.ok(!JSON.stringify(audit).includes(data.idempotencyKey));
  for(const different of [{amount:300},{reason:'Um motivo diferente para o mesmo pedido.'},{userId:h.accounts.unverified.user.id}]){
    const conflict=await h.api('admin','/admin/credits',{method:'POST',data:{...data,...different}});assert.equal(conflict.status,409);assert.equal(conflict.data.code,'idempotency_conflict');
  }
  await h.restart();
  const replay=await h.api('admin','/admin/credits',{method:'POST',data});assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);assert.equal(replay.data.user.balance,250);assert.equal((await h.api('ordinary','/wallet')).data.transactions.length,1);assert.equal((await h.api('admin','/admin/audit')).data.entries.length,1);
});

test('safe integer overflow rolls back both balance and administrative operation',async t=>{
  const h=await harness(t,{customize:(state,accounts)=>{state.users[accounts.ordinary.user.id].balance=Number.MAX_SAFE_INTEGER;}});
  const result=await h.api('admin','/admin/credits',{method:'POST',data:{userId:h.accounts.ordinary.user.id,amount:1,reason:'Teste de rejeição por limite de saldo.',idempotencyKey:randomUUID()}});
  assert.equal(result.status,409);assert.equal((await h.api('ordinary','/wallet')).data.balance,Number.MAX_SAFE_INTEGER);assert.deepEqual((await h.api('admin','/admin/audit')).data.entries,[]);
});

test('admins can review existing matches but cannot settle their own result',async t=>{
  const h=await harness(t);
  const created=await h.api('admin','/duels',{method:'POST',data:{stake:0,mode:'1v1',platform:'pc',opponentPlayerId:h.accounts.ordinary.user.publicPlayerId}});assert.equal(created.status,200);
  const duelId=created.data.duel.id;
  assert.equal((await h.api('ordinary',`/duels/${duelId}/accept`,{method:'POST',data:{}})).status,200);
  for(const player of ['admin','ordinary'])assert.equal((await h.api(player,`/duels/${duelId}/start`,{method:'POST',data:{}})).status,200);
  const uploaded=await h.api('admin',`/evidence?duelId=${duelId}`,{method:'POST',body:PNG,mime:'image/png'});assert.equal(uploaded.status,200);
  const result=await h.api('admin',`/duels/${duelId}/result`,{method:'POST',data:{homeScore:2,awayScore:1,evidenceId:uploaded.data.evidence.id,scoreSide:'host'}});assert.equal(result.status,200);
  const reviews=await h.api('admin','/reviews');assert.equal(reviews.status,200);assert.equal(reviews.data.duels.length,1);
  const overview=await h.api('admin','/admin/overview');assert.equal(overview.data.stats.activeMatches,1);assert.equal(overview.data.stats.pendingResults,1);
  const rejected=await h.api('admin',`/reviews/${duelId}`,{method:'POST',data:{winner:'host',reportId:result.data.duel.result.id,reason:'Conferi a imagem do placar recebido.'}});assert.equal(rejected.status,403);
  assert.equal((await h.api('admin','/wallet/reviews')).status,200);
});

test('an empty administrator allowlist disables access even for a verified identity',async t=>{
  const h=await harness(t,{adminEmails:[]});
  assert.equal((await h.api('admin','/session')).data.user.isAdmin,false);
  assert.equal((await h.api('admin','/admin/overview')).status,403);
});

test('each configured verified account is authorized and removing configuration revokes existing sessions',async t=>{
  const h=await harness(t,{adminEmails:[ADMIN_EMAIL,'player@example.test']});
  assert.equal((await h.api('admin','/session')).data.user.isAdmin,true);
  assert.equal((await h.api('ordinary','/session')).data.user.isAdmin,true);
  assert.equal((await h.api('ordinary','/admin/overview')).status,200);
  await h.restart([]);
  assert.equal((await h.api('admin','/session')).data.user.isAdmin,false);
  assert.equal((await h.api('ordinary','/me')).data.user.isAdmin,false);
  assert.equal((await h.api('admin','/admin/overview')).status,403);
  assert.equal((await h.api('ordinary','/admin/credits',{method:'POST',data:{userId:h.accounts.admin.user.id,amount:10,reason:'Esta operação deve ser rejeitada.',idempotencyKey:randomUUID()}})).status,403);
  assert.equal((await h.api('admin','/wallet')).data.balance,0);
});

test('overview counts only the deposits eligible for the current administrator proof review',async t=>{
  const customize=(state,accounts)=>{
    for(const [owner,status,method,paymentMode]of [['ordinary','review','transfer','demo'],['unverified','review','transfer',undefined],['admin','review','transfer','demo'],['ordinary','pending','transfer','demo'],['ordinary','review','pix','demo'],['ordinary','approved','transfer','demo']]){
      const id=randomUUID();state.deposits[id]={id,userId:accounts[owner].user.id,status,method,...(paymentMode?{paymentMode}:{}),amount:100,version:1,createdAt:new Date().toISOString()};
      if(status==='approved'){const account=state.users[accounts[owner].user.id];account.balance+=100;account.transactions.unshift({id:randomUUID(),reference:`deposit:${id}`,amount:100,label:'Recarga aprovada de teste',date:new Date().toISOString()});}
    }
  };
  const demo=await harness(t,{paymentMode:'demo',customize});
  const review=(await demo.api('admin','/wallet/reviews')).data;
  assert.equal(review.deposits.length,2);
  assert.equal((await demo.api('admin','/admin/overview')).data.stats.pendingDeposits,review.deposits.length);
  // Connected fixtures retain real Pix requests; demo ledgers belong to their own database.
  const unconfigured=await harness(t,{customize:(state,accounts)=>{
    for(const [owner,status]of [['ordinary','review'],['admin','review'],['ordinary','pending']]){
      const id=randomUUID();state.deposits[id]={id,userId:accounts[owner].user.id,status,method:'pix',paymentMode:'pix_manual',amount:100,priceCents:1000,version:1,createdAt:new Date().toISOString()};
    }
  }});
  assert.deepEqual((await unconfigured.api('admin','/wallet/reviews')).data.deposits,[]);
  assert.equal((await unconfigured.api('admin','/admin/overview')).data.stats.pendingDeposits,0);
});
