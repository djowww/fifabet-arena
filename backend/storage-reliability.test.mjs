import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import * as database from './database.mjs';

async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'arena-storage-'));const db=await database.openArenaDatabase(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});const state=db.load();const id=randomUUID();state.users[id]={id,publicPlayerId:'FBA-ONE',nickname:'One',balance:100,friends:[],transactions:[]};return {dir,db,state,id};}

test('incremental saves never rewrite unchanged users and roll back SQL constraint failures',async t=>{
 const {db,state,id}=await fixture(t);db.save(state);const sql=new DatabaseSync(db.path);sql.exec('CREATE TABLE touches(n INTEGER); CREATE TRIGGER user_write AFTER INSERT ON users BEGIN INSERT INTO touches VALUES(1); END; CREATE TRIGGER user_update AFTER UPDATE ON users BEGIN INSERT INTO touches VALUES(1); END;');
 state.sessions.x={userId:id,expiresAt:Date.now()+10000};db.save(state);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM touches').get().n,0);
 const bad=structuredClone(state),other=randomUUID();bad.users[other]={...bad.users[id],id:other};bad.sessions.x.expiresAt+=100;assert.throws(()=>db.save(bad));assert.equal(db.load().sessions.x.expiresAt,state.sessions.x.expiresAt);assert.equal(Object.keys(db.load().users).length,1);sql.close();
});
test('opening balance migrates once and balances must reconcile thereafter',async t=>{
 const {db,state,id}=await fixture(t);db.save(state);assert.equal(db.load().users[id].walletOpeningBalance,100);
 const loaded=db.load();loaded.users[id].balance=101;assert.throws(()=>db.save(loaded),/saldo|extrato/i);
 loaded.users[id].balance=-1;assert.throws(()=>db.save(loaded));
});
test('pre-existing SQLite accounts migrate opening once without rewriting their current balance',async t=>{
 const {dir,db,state,id}=await fixture(t);db.save(state);db.close();const sql=new DatabaseSync(join(dir,'arena.sqlite'));const user=JSON.parse(sql.prepare('SELECT data_json FROM users WHERE id=?').get(id).data_json);delete user.walletOpeningBalance;sql.prepare('UPDATE users SET data_json=? WHERE id=?').run(JSON.stringify(user),id);const extra=JSON.parse(sql.prepare("SELECT value_json FROM metadata WHERE key='state_extra'").get().value_json);delete extra.walletReliabilityVersion;sql.prepare("UPDATE metadata SET value_json=? WHERE key='state_extra'").run(JSON.stringify(extra));sql.close();
 const reopened=await database.openArenaDatabase(dir);try{const migrated=reopened.load();assert.equal(migrated.users[id].walletOpeningBalance,100);assert.equal(migrated.users[id].balance,100);delete migrated.users[id].walletOpeningBalance;assert.throws(()=>reopened.save(migrated));}finally{reopened.close();}
});
test('approved deposits require ledger credit and new live approval requires unique bank evidence',async t=>{
 const {db,state,id}=await fixture(t);db.save(state);const depositId=randomUUID();state.deposits[depositId]={id:depositId,userId:id,amount:100,status:'approved',paymentMode:'pix_manual',priceCents:1000,decision:{bankReference:'bank-1',bankAmountCents:1000,paidAt:new Date().toISOString()}};
 assert.throws(()=>db.save(state),/depósito|lançamento/i);
 state.users[id].balance+=100;state.users[id].transactions.push({id:randomUUID(),reference:`deposit:${depositId}`,amount:100});db.save(state);
 for(const patch of [{bankAmountCents:999},{paidAt:'invalid'},{paidAt:new Date(Date.now()+86400000).toISOString()},{bankReference:'\u0000'}]){const invalid=structuredClone(state);Object.assign(invalid.deposits[depositId].decision,patch);assert.throws(()=>db.save(invalid));}
 const other=randomUUID();state.deposits[other]={...state.deposits[depositId],id:other};state.users[id].balance+=100;state.users[id].transactions.push({id:randomUUID(),reference:`deposit:${other}`,amount:100});assert.throws(()=>db.save(state),/bancária|referência/i);
});
test('opaque cursor preserves newest-first pages and rejects malformed or missing anchors',()=>{
 assert.equal(typeof database.cursorPage,'function');const items=Array.from({length:5},(_,i)=>({id:`item-${i}`}));const first=database.cursorPage(items,{limit:2});assert.deepEqual(first.items,items.slice(0,2));const second=database.cursorPage(items,{cursor:first.nextCursor,limit:2});assert.deepEqual(second.items,items.slice(2,4));assert.throws(()=>database.cursorPage(items,{cursor:'garbage'}));assert.throws(()=>database.cursorPage(items.slice(2),{cursor:first.nextCursor}));
});
test('historical demo deposits follow the startup ledger migration while new approvals cannot use that ledger',async t=>{
 const {db,state,id}=await fixture(t),depositId=randomUUID();state.users[id].balance=100;state.users[id].transactions=[{id:randomUUID(),reference:`deposit:${depositId}`,amount:100}];state.deposits[depositId]={id:depositId,userId:id,amount:100,status:'approved',paymentMode:'demo'};db.save(state);
 const migrated=db.load(),user=migrated.users[id];user.demoBalance=user.balance;user.demoTransactions=user.transactions;user.balance=0;user.transactions=[];user.walletOpeningBalance=0;migrated.walletLedgerVersion=1;assert.doesNotThrow(()=>db.save(migrated));assert.equal(db.load().deposits[depositId].legacyDepositLedger,'demo');assert.equal(db.load().users[id].balance,0);
 const forged=randomUUID();migrated.deposits[forged]={...migrated.deposits[depositId],id:forged};user.demoTransactions.push({id:randomUUID(),reference:`deposit:${forged}`,amount:100});assert.throws(()=>db.save(migrated));
});
test('duplicate global transaction primary keys are rejected instead of silently dropping a row',async t=>{
 const {db,state,id}=await fixture(t),shared=randomUUID();state.users[id].transactions=[{id:shared,reference:'one',amount:10},{id:shared,reference:'two',amount:20}];state.users[id].balance=130;assert.throws(()=>db.save(state),/duplicad|ID/i);assert.equal(Object.keys(db.load().users).length,0);
});
test('databases whose demo ledger was already migrated preserve approved historical deposits on upgrade',async t=>{
 const {dir,db,state,id}=await fixture(t),depositId=randomUUID();state.users[id].transactions=[{id:randomUUID(),reference:`deposit:${depositId}`,amount:100}];state.deposits[depositId]={id:depositId,userId:id,amount:100,status:'approved',paymentMode:'demo'};db.save(state);db.close();
 const sql=new DatabaseSync(join(dir,'arena.sqlite')),user=JSON.parse(sql.prepare('SELECT data_json FROM users WHERE id=?').get(id).data_json);user.demoBalance=user.balance;user.demoTransactions=state.users[id].transactions;user.balance=0;user.walletOpeningBalance=0;sql.prepare('UPDATE users SET data_json=? WHERE id=?').run(JSON.stringify(user),id);sql.exec('DELETE FROM transactions');const extra=JSON.parse(sql.prepare("SELECT value_json FROM metadata WHERE key='state_extra'").get().value_json);extra.walletLedgerVersion=1;delete extra.walletReliabilityVersion;sql.prepare("UPDATE metadata SET value_json=? WHERE key='state_extra'").run(JSON.stringify(extra));sql.close();
 const upgraded=await database.openArenaDatabase(dir);try{assert.equal(upgraded.load().deposits[depositId].legacyDepositLedger,'demo');assert.equal(upgraded.load().users[id].balance,0);}finally{upgraded.close();}
});
test('archival keeps open disputes active and reads survive metadata rollback without deleting files',async t=>{
 const {dir}=await fixture(t),{createEvidenceStorage}=await import('./evidence-storage.mjs'),storage=createEvidenceStorage({dataDir:dir}),id=randomUUID(),open=randomUUID(),time=Date.now(),old=new Date(time-31*86400000).toISOString();
 await mkdir(join(dir,'evidence'),{recursive:true});await writeFile(storage.storagePaths('evidence',id).active,'private-photo');await writeFile(storage.storagePaths('evidence',open).active,'dispute-photo');
 const state={duels:{closed:{status:'completed',closedAt:old},open:{status:'disputed',closedAt:old}},deposits:{},evidence:{[id]:{id,duelId:'closed',bytes:13},[open]:{id:open,duelId:'open',bytes:13}},walletEvidence:{}};
 await storage.archiveClosedEvidence(state,time);assert.ok(state.evidence[id].archivedAt);assert.equal(state.evidence[open].archivedAt,undefined);assert.equal((await storage.read('evidence',id)).toString(),'private-photo');assert.equal(storage.usage(state,100).activeBytes,13);assert.equal(storage.usage(state,100).totalBytes,26);assert.throws(()=>storage.storagePaths('evidence','../secret'));
});
test('visual inspector fails safely for invalid images and fingerprints resizing consistently',async t=>{
 const {createVisualInspector}=await import('./visual-fingerprint.mjs'),inspector=createVisualInspector();t.after(()=>inspector.close());assert.deepEqual(await inspector.inspect(Buffer.from('not an image')),{status:'unavailable'});
 const sharp=(await import('sharp')).default,raw=Buffer.alloc(90*80*3);for(let y=0;y<80;y++)for(let x=0;x<90;x++){const v=x<45?Math.min(240,x*5+y):Math.max(20,240-(x-45)*5-y);raw.fill(v,(y*90+x)*3,(y*90+x)*3+3);}const original=await sharp(raw,{raw:{width:90,height:80,channels:3}}).png().toBuffer(),resized=await sharp(original).resize(180,160).jpeg().toBuffer();const a=await inspector.inspect(original),b=await inspector.inspect(resized);assert.equal(a.status,'checked');assert.match(a.hash,/^[a-f0-9]{16}$/);assert.equal(b.status,'checked');assert.ok((await import('./visual-fingerprint.mjs')).visualDistance(a.hash,b.hash)<=4);assert.notEqual(a.hash,'0000000000000000');assert.deepEqual(await inspector.inspect(original),a);assert.deepEqual(await inspector.inspect(await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer()),{status:'unavailable'});
});
test('inspector time budget and closure return unavailable without leaking processes',async()=>{
 const {createVisualInspector}=await import('./visual-fingerprint.mjs'),inspector=createVisualInspector({timeoutMs:1});assert.deepEqual(await inspector.inspect(Buffer.from('not an image')),{status:'unavailable'});const shutdown=inspector.close();assert.equal(typeof shutdown?.then,'function');await shutdown;assert.deepEqual(await inspector.inspect(Buffer.from('still invalid')),{status:'unavailable'});
});
test('opaque alpha channels do not change a photograph fingerprint',async t=>{
 const {createVisualInspector}=await import('./visual-fingerprint.mjs'),sharp=(await import('sharp')).default,inspector=createVisualInspector();t.after(()=>inspector.close());const raw=Buffer.alloc(90*80*3);for(let y=0;y<80;y++)for(let x=0;x<90;x++)raw.fill(x<45?Math.min(240,x*5+y):Math.max(20,240-(x-45)*5-y),(y*90+x)*3,(y*90+x)*3+3);
 const plain=await sharp(raw,{raw:{width:90,height:80,channels:3}}).png().toBuffer(),alpha=await sharp(plain).ensureAlpha().png().toBuffer();assert.deepEqual(await inspector.inspect(plain),await inspector.inspect(alpha));
});
