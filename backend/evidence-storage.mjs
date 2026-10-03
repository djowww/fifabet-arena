import {constants} from 'node:fs';
import {mkdir,rename,lstat,open,readdir,unlink,statfs} from 'node:fs/promises';
import {resolve,join,relative,dirname,sep} from 'node:path';

const KINDS={evidence:'evidence',walletEvidence:'wallet-evidence','wallet-evidence':'wallet-evidence'};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ORPHAN_AGE=86400000;
export function createEvidenceStorage({dataDir,archiveAfterMs=30*86400000,now=Date.now}){
  const root=resolve(dataDir);
  if(!Number.isSafeInteger(archiveAfterMs)||archiveAfterMs<0)throw Error('Prazo de arquivo inválido.');
  function storagePaths(kind,id,archived=false){
    if(!Object.hasOwn(KINDS,kind)||typeof id!=='string'||!UUID.test(id))throw Error('Caminho de evidência inválido.');
    const folder=KINDS[kind],active=join(root,folder,id),archive=join(root,'archive',folder,id);
    return {active,archive,path:archived?archive:active,candidates:archived?[archive,active]:[active,archive]};
  }
  async function checkParents(path,create=false){
    const rootInfo=await lstat(root);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())throw Error('Diretório de evidência inválido.');
    const parts=relative(root,dirname(path)).split(sep).filter(Boolean);let folder=root;
    for(const part of parts){folder=join(folder,part);if(create)await mkdir(folder,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error;});const info=await lstat(folder);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Diretório de evidência inválido.');}
  }
  async function safeOpen(path){
    await checkParents(path);const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink())throw Error('Evidência inválida.');
    const handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
    try{const info=await handle.stat();await checkParents(path);const after=await lstat(path);
      if(!info.isFile()||!after.isFile()||after.isSymbolicLink()||before.dev!==info.dev||before.ino!==info.ino||after.dev!==info.dev||after.ino!==info.ino)throw Error('Evidência inválida.');
      return {handle,bytes:info.size};
    }catch(error){await handle.close();throw error;}
  }
  async function locate(kind,id,archived=false){
    for(const path of storagePaths(kind,id,archived).candidates){try{return await safeOpen(path);}catch(error){if(error.code!=='ENOENT')throw error;}}
    const error=Error('Evidência não encontrada.');error.code='ENOENT';throw error;
  }
  async function read(kind,id,archived=false){const {handle}=await locate(kind,id,archived);try{return await handle.readFile();}finally{await handle.close();}}
  async function openRead(kind,id,archived=false){
    const {handle,bytes}=await locate(kind,id,archived);
    try{
      const stream=handle.createReadStream({autoClose:true});let closing;
      const close=()=>closing||(closing=(async()=>{stream.destroy();await handle.close();})());
      return {stream,bytes,close};
    }catch(error){await handle.close();throw error;}
  }
  async function archiveClosedEvidence(state,time=now()){
    let moved=0;
    for(const [kind,items,parents,parentKey] of [['evidence',state.evidence,state.duels,'duelId'],['walletEvidence',state.walletEvidence,state.deposits,'depositId']])for(const item of Object.values(items||{})){
      const parent=parents?.[item[parentKey]],closed=kind==='evidence'?['completed','cancelled','expired']:['approved','rejected','cancelled'];
      const closedAt=Date.parse(parent?.closedAt||parent?.decision?.date||parent?.updatedAt||'');
      if(item.archivedAt||!closed.includes(parent?.status)||!Number.isFinite(closedAt)||time-closedAt<archiveAfterMs||kind==='evidence'&&(parent.issueReports||[]).some(issue=>issue.status==='open'))continue;
      const paths=storagePaths(kind,item.id);
      await checkParents(paths.archive,true);
      try{await checkParents(paths.active);const info=await lstat(paths.active);if(!info.isFile()||info.isSymbolicLink())throw Error('Evidência inválida.');let archiveExists=false;try{await lstat(paths.archive);archiveExists=true;}catch(error){if(error.code!=='ENOENT')throw error;}if(archiveExists)throw Error('Arquivo de evidência já existe.');await rename(paths.active,paths.archive);}catch(error){if(error.code!=='ENOENT')throw error;try{const info=await lstat(paths.archive);if(!info.isFile()||info.isSymbolicLink())throw Error('Evidência inválida.');}catch(archiveError){if(archiveError.code!=='ENOENT')throw archiveError;continue;}}
      item.archivedAt=new Date(time).toISOString();moved++;
    }
    return {moved};
  }
  function usage(state,maxActiveBytes){
    let activeBytes=0,archivedBytes=0;for(const item of [...Object.values(state.evidence||{}),...Object.values(state.walletEvidence||{})]){if(!Number.isSafeInteger(item.bytes)||item.bytes<0)throw Error('Tamanho de evidência inválido.');if(item.archivedAt)archivedBytes+=item.bytes;else activeBytes+=item.bytes;}
    const totalBytes=activeBytes+archivedBytes;if(!Number.isSafeInteger(totalBytes))throw Error('Tamanho total de evidência inválido.');
    return {activeBytes,archivedBytes,totalBytes,maxActiveBytes,capacityReached:totalBytes>=maxActiveBytes};
  }
  async function capacity(state,{maxTotalBytes,requiredBytes=0,minFreeBytes=64*1024*1024,reservedBytes=0}={}){
    for(const value of [maxTotalBytes,requiredBytes,minFreeBytes,reservedBytes])if(!Number.isSafeInteger(value)||value<0)throw Error('Capacidade de evidência inválida.');
    await checkParents(join(root,'capacity-check'));const disk=await statfs(root,{bigint:true}),free=disk.bavail*disk.bsize;
    const freeBytes=Number(free>BigInt(Number.MAX_SAFE_INTEGER)?BigInt(Number.MAX_SAFE_INTEGER):free),used=usage(state,maxTotalBytes),incoming=requiredBytes+reservedBytes;
    if(!Number.isSafeInteger(incoming))throw Error('Capacidade de evidência inválida.');
    return {...used,maxTotalBytes,freeBytes,minFreeBytes,requiredBytes,reservedBytes,capacityReached:incoming>maxTotalBytes-used.totalBytes||incoming>freeBytes-minFreeBytes};
  }
  async function assertCapacity(state,options){const result=await capacity(state,options);if(result.capacityReached){const error=Error('Armazenamento de evidências sem capacidade disponível.');error.status=507;error.code='storage_capacity';throw error;}return result;}
  async function cleanupOrphans(state,{activeUploads=new Set(),time=now(),olderThanMs=ORPHAN_AGE}={}){
    if(!Number.isFinite(time)||!Number.isSafeInteger(olderThanMs)||olderThanMs<ORPHAN_AGE)throw Error('Prazo de limpeza inválido.');
    const referenceIds=()=>new Set([state.evidence,state.walletEvidence].flatMap(items=>Object.entries(items||{}).flatMap(([key,item])=>[key,item.id].filter(value=>typeof value==='string').map(value=>value.toLowerCase()))));
    const known=referenceIds();
    let removed=0,removedBytes=0;
    for(const kind of ['evidence','walletEvidence']){
      const folder=dirname(storagePaths(kind,'00000000-0000-0000-0000-000000000000').active);
      let names;try{await checkParents(join(folder,'scan'));names=await readdir(folder);}catch(error){if(error.code==='ENOENT')continue;throw error;}
      for(const id of names){if(!UUID.test(id))continue;const path=storagePaths(kind,id).active;
        if(known.has(id.toLowerCase())||activeUploads.has(id)||activeUploads.has(path))continue;
        try{await checkParents(path);const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||time-before.mtimeMs<=olderThanMs)continue;
          // Recheck references and the inode immediately before deleting; callers serialize this with state writes.
          const after=await lstat(path);if(referenceIds().has(id.toLowerCase())||activeUploads.has(id)||activeUploads.has(path)||!after.isFile()||after.isSymbolicLink()||before.ino!==after.ino||before.dev!==after.dev||before.mtimeMs!==after.mtimeMs)continue;
          await unlink(path);removed++;removedBytes+=after.size;
        }catch(error){if(error.code!=='ENOENT')throw error;}
      }
    }
    return {removed,removedBytes};
  }
  return {storagePaths,archiveClosedEvidence,usage,read,openRead,capacity,assertCapacity,cleanupOrphans};
}
