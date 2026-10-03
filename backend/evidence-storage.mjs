import {mkdir,rename,readFile,lstat} from 'node:fs/promises';
import {resolve,join,relative,dirname,sep} from 'node:path';

const KINDS={evidence:'evidence',walletEvidence:'wallet-evidence','wallet-evidence':'wallet-evidence'};
export function createEvidenceStorage({dataDir,archiveAfterMs=30*86400000,now=Date.now}){
  const root=resolve(dataDir);
  if(!Number.isSafeInteger(archiveAfterMs)||archiveAfterMs<0)throw Error('Prazo de arquivo inválido.');
  function storagePaths(kind,id,archived=false){
    if(!Object.hasOwn(KINDS,kind)||typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Error('Caminho de evidência inválido.');
    const folder=KINDS[kind],active=join(root,folder,id),archive=join(root,'archive',folder,id);
    return {active,archive,path:archived?archive:active,candidates:archived?[archive,active]:[active,archive]};
  }
  async function checkParents(path,create=false){
    const parts=relative(root,dirname(path)).split(sep).filter(Boolean);let folder=root;
    for(const part of parts){folder=join(folder,part);if(create)await mkdir(folder,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error;});const info=await lstat(folder);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Diretório de evidência inválido.');}
  }
  async function safeRead(path){await checkParents(path);const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink())throw Error('Evidência inválida.');return readFile(path);}
  async function read(kind,id,archived=false){
    for(const path of storagePaths(kind,id,archived).candidates){try{return await safeRead(path);}catch(error){if(error.code!=='ENOENT')throw error;}}
    const error=Error('Evidência não encontrada.');error.code='ENOENT';throw error;
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
    let activeBytes=0,archivedBytes=0;for(const item of [...Object.values(state.evidence||{}),...Object.values(state.walletEvidence||{})]){if(item.archivedAt)archivedBytes+=item.bytes;else activeBytes+=item.bytes;}
    return {activeBytes,archivedBytes,totalBytes:activeBytes+archivedBytes,maxActiveBytes,capacityReached:activeBytes>=maxActiveBytes};
  }
  return {storagePaths,archiveClosedEvidence,usage,read};
}
