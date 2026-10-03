// Test-only disposable database setup. This module must never be published.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {basename,isAbsolute,relative,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {openArenaDatabase} from './database.mjs';

export async function seedFixtureAdministrator(dataDir){
 const directory=resolve(dataDir),withinTemp=relative(resolve(tmpdir()),directory);
 assert.ok(withinTemp&&withinTemp!=='..'&&!withinTemp.startsWith(`..${sep}`)&&!isAbsolute(withinTemp)&&basename(directory).startsWith('fifago-'),'Administrator fixtures require a disposable Fifa GO temp directory.');
 const storage=await openArenaDatabase(directory);
 try{
  const state=storage.load();assert.equal(Object.keys(state.users).length,0,'Seed the fixture administrator before starting the server or creating players.');
  const id=randomUUID(),subject=randomUUID(),email=`fixture-${id}@example.test`,sessionToken=randomBytes(32).toString('base64url'),csrfToken=randomBytes(32).toString('base64url'),createdAt=new Date().toISOString();
  state.walletLedgerVersion=1;
  state.users[id]={id,publicPlayerId:`FBA-${randomBytes(5).toString('hex').toUpperCase()}`,nickname:'FixtureAdmin',clubId:null,gameAccount:null,createdAt,balance:0,walletOpeningBalance:0,transactions:[],friends:[]};
  state.authIdentities[`google:${subject}`]={provider:'google',subject,userId:id,email,emailVerified:true,createdAt};
  state.sessions[createHash('sha256').update(sessionToken).digest('hex')]={userId:id,csrfToken,createdAt:Date.now(),expiresAt:Date.now()+86_400_000};
  storage.save(state);
  return {id,email,sessionToken,csrfToken};
 }finally{storage.close();}
}

export async function grantFixtureCredits(base,administrator,userId,amount){
 const target=new URL(base);assert.equal(target.protocol,'http:');assert.equal(target.hostname,'127.0.0.1','Synthetic grants are allowed only on disposable localhost test servers.');
 const response=await fetch(`${base}/api/v1/admin/credits`,{method:'POST',headers:{Origin:base,Cookie:`fifabet_session=${administrator.sessionToken}`,'X-CSRF-Token':administrator.csrfToken,'Content-Type':'application/json'},body:JSON.stringify({userId,amount,reason:'Saldo sintético autorizado para fixture descartável de teste.',idempotencyKey:randomUUID()})});
 const payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload));
 return payload;
}
