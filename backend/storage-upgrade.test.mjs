import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile,utimes,symlink,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {finished} from 'node:stream/promises';
import {DatabaseSync} from 'node:sqlite';
import {createEvidenceStorage} from './evidence-storage.mjs';
import {openArenaDatabase} from './database.mjs';

async function storageFixture(t){
  const dir=await mkdtemp(join(tmpdir(),'arena-storage-upgrade-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await mkdir(join(dir,'evidence'));await mkdir(join(dir,'wallet-evidence'));
  return {dir,storage:createEvidenceStorage({dataDir:dir})};
}

test('streaming evidence closes descriptors after completion and cancellation',async t=>{
  const {storage}=await storageFixture(t),id=randomUUID(),path=storage.storagePaths('evidence',id).active;
  await writeFile(path,Buffer.alloc(200000,37));
  const opened=await storage.openRead('evidence',id);assert.equal(opened.bytes,200000);
  const chunks=[];for await(const chunk of opened.stream)chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).length,200000);assert.ok(opened.stream.closed);await opened.close();
  const cancelled=await storage.openRead('evidence',id);cancelled.stream.destroy();
  await finished(cancelled.stream).catch(error=>assert.equal(error.code,'ERR_STREAM_PREMATURE_CLOSE'));
  await cancelled.close();assert.ok(cancelled.stream.closed);
  assert.equal((await storage.read('evidence',id)).length,200000);
});

test('safe streaming refuses symbolic links and non-files',async t=>{
  const {dir,storage}=await storageFixture(t),id=randomUUID(),path=storage.storagePaths('evidence',id).active;
  await mkdir(path);await assert.rejects(storage.openRead('evidence',id),/inválid/);
  await rm(path,{recursive:true});await writeFile(join(dir,'private'),'secret');
  try{await symlink(join(dir,'private'),path);}catch(error){if(error.code==='EPERM'){t.diagnostic('Windows does not grant file symlink permission.');return;}throw error;}
  await assert.rejects(storage.openRead('evidence',id),/inválid/);
  assert.equal(await readFile(join(dir,'private'),'utf8'),'secret');
});

test('streaming and orphan cleanup refuse a linked evidence directory',async t=>{
  const {dir,storage}=await storageFixture(t),id=randomUUID(),outside=await mkdtemp(join(tmpdir(),'arena-outside-'));
  t.after(()=>rm(outside,{recursive:true,force:true}));await writeFile(join(outside,id),'private-outside');
  await rm(join(dir,'evidence'),{recursive:true});await symlink(outside,join(dir,'evidence'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(storage.openRead('evidence',id),/inválid/);
  await assert.rejects(storage.cleanupOrphans({evidence:{},walletEvidence:{}}),/inválid/);
  assert.equal(await readFile(join(outside,id),'utf8'),'private-outside');
});

test('archive bytes count toward upload quota and filesystem reserve is enforced',async t=>{
  const {storage}=await storageFixture(t),state={evidence:{one:{bytes:60}},walletEvidence:{two:{bytes:50,archivedAt:'2026-01-01'}}};
  assert.equal(storage.usage(state,100).capacityReached,true);
  const quota=await storage.capacity(state,{maxTotalBytes:120,requiredBytes:11,minFreeBytes:0});assert.equal(quota.totalBytes,110);assert.equal(quota.capacityReached,true);
  await assert.rejects(storage.assertCapacity(state,{maxTotalBytes:120,requiredBytes:11,minFreeBytes:0}),error=>error.status===507&&error.code==='storage_capacity');
  const permitted=await storage.assertCapacity(state,{maxTotalBytes:120,requiredBytes:10,minFreeBytes:0});assert.equal(permitted.capacityReached,false);assert.ok(permitted.freeBytes>0);
  const id=randomUUID();await writeFile(storage.storagePaths('walletEvidence',id).active,'financial-proof');
  await assert.rejects(storage.assertCapacity(state,{maxTotalBytes:1000,requiredBytes:1,minFreeBytes:Number.MAX_SAFE_INTEGER}),error=>error.status===507);
  assert.equal((await storage.read('walletEvidence',id)).toString(),'financial-proof');
  await assert.rejects(storage.capacity(state,{maxTotalBytes:120,requiredBytes:-1}));
});

test('orphan cleanup removes only old unreferenced inactive UUID uploads and preserves archives',async t=>{
  const {dir,storage}=await storageFixture(t),orphan=randomUUID(),known=randomUUID(),otherKind=randomUUID(),active=randomUUID(),recent=randomUUID(),archived=randomUUID(),time=Date.now(),old=new Date(time-25*3600000);
  for(const id of [orphan,known,otherKind,active,recent])await writeFile(storage.storagePaths('evidence',id).active,id);
  for(const id of [orphan,known,otherKind,active])await utimes(storage.storagePaths('evidence',id).active,old,old);
  await writeFile(join(dir,'evidence','not-a-uuid'),'preserve');await utimes(join(dir,'evidence','not-a-uuid'),old,old);
  await mkdir(join(dir,'archive','evidence'),{recursive:true});await writeFile(storage.storagePaths('evidence',archived,true).archive,'financial-proof');await utimes(storage.storagePaths('evidence',archived,true).archive,old,old);
  const state={evidence:{[known]:{id:known}},walletEvidence:{[otherKind.toUpperCase()]:{id:otherKind.toUpperCase()}}};
  const result=await storage.cleanupOrphans(state,{time,activeUploads:new Set([storage.storagePaths('evidence',active).active])});assert.equal(result.removed,1);
  await assert.rejects(lstat(storage.storagePaths('evidence',orphan).active),error=>error.code==='ENOENT');
  for(const id of [known,otherKind,active,recent])assert.ok((await lstat(storage.storagePaths('evidence',id).active)).isFile());
  assert.equal(await readFile(storage.storagePaths('evidence',archived,true).archive,'utf8'),'financial-proof');assert.equal(await readFile(join(dir,'evidence','not-a-uuid'),'utf8'),'preserve');
  await assert.rejects(storage.cleanupOrphans(state,{olderThanMs:1000}));
});

test('saving uses cached SQL rows and failed SQL commits keep the prior diff baseline',async t=>{
  const reads=[],original=DatabaseSync.prototype.prepare;
  DatabaseSync.prototype.prepare=function(sql){const statement=original.call(this,sql);return new Proxy(statement,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;return (...args)=>{if(key==='all'&&/^SELECT /i.test(sql))reads.push(sql);return value.apply(target,args);};}});};
  t.after(()=>{DatabaseSync.prototype.prepare=original;});
  const dir=await mkdtemp(join(tmpdir(),'arena-sql-cache-')),db=await openArenaDatabase(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});
  const state=db.load(),id=randomUUID();state.users[id]={id,publicPlayerId:'FBA-CACHE',nickname:'Cache',balance:100,transactions:[]};db.save(state);
  reads.length=0;state.sessions.one={userId:id,expiresAt:500};db.save(state);assert.deepEqual(reads,[]);
  const failed=structuredClone(state),duplicate=randomUUID();failed.users[duplicate]={...failed.users[id],id:duplicate};failed.sessions.one.expiresAt=600;assert.throws(()=>db.save(failed));
  state.sessions.one.expiresAt=600;db.save(state);assert.equal(db.load().sessions.one.expiresAt,600);assert.equal(Object.keys(db.load().users).length,1);
  const sql=new DatabaseSync(db.path);sql.exec("CREATE TRIGGER fail_metadata BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'metadata failure'); END;");
  state.users[id].nickname='Committed next time';state.sessions.one.expiresAt=700;assert.throws(()=>db.save(state),/metadata failure/);
  assert.equal(JSON.parse(sql.prepare('SELECT data_json FROM sessions WHERE token_hash=?').get('one').data_json).expiresAt,600);
  sql.exec('DROP TRIGGER fail_metadata');sql.close();db.save(state);assert.equal(db.load().sessions.one.expiresAt,700);assert.equal(db.load().users[id].nickname,'Committed next time');
  const tampered=db.load();tampered.users[id].walletOpeningBalance=101;tampered.users[id].balance=101;assert.throws(()=>db.save(tampered),/imutável/);
});
