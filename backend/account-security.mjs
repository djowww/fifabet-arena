import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const failure=(status,message,code)=>{const error=Error(message);Object.assign(error,{status,code});throw error;};
export function generateRecoveryCodes(user){
 const codes=Array.from({length:8},()=>`FGREC-${randomBytes(16).toString('hex').toUpperCase()}`);
 user.recoveryCodes=codes.map(code=>hash(code));user.recoveryCodesCreatedAt=new Date().toISOString();
 return {codes};
}
export function consumeRecoveryCode(user,code){
 const normalized=String(code||'').trim().toUpperCase(),candidate=Buffer.from(hash(normalized),'hex');
 if(!/^FGREC-[A-F0-9]{32}$/.test(normalized))return false;
 const index=(user.recoveryCodes||[]).findIndex(stored=>typeof stored==='string'&&/^[a-f0-9]{64}$/.test(stored)&&timingSafeEqual(Buffer.from(stored,'hex'),candidate));
 if(index<0)return false;user.recoveryCodes.splice(index,1);return true;
}
export function createAccountThrottle({now=Date.now,max=10,windowMs=60_000,capacity=10_000}={}){
 const attempts=new Map();
 return {check(identifier){
  const key=String(identifier||'').trim().normalize('NFKC').toLocaleLowerCase('pt-BR').slice(0,100),time=now();
  if(attempts.size>=capacity)for(const [entry,bucket]of attempts)if(bucket.until<=time)attempts.delete(entry);
  let bucket=attempts.get(key);
  if(!bucket||bucket.until<=time){if(!bucket&&attempts.size>=capacity)failure(429,'Muitas tentativas. Aguarde um minuto.','account_rate_limited');bucket={count:0,until:time+windowMs};attempts.set(key,bucket);}
  if(++bucket.count>max)failure(429,'Muitas tentativas nesta conta. Aguarde um minuto.','account_rate_limited');
 }};
}
const publicSessionId=key=>hash(`session:${key}`).slice(0,32);
export function sessionList(state,userId,current,time=Date.now()){
 return Object.entries(state.sessions).filter(([,s])=>s.userId===userId&&s.expiresAt>time).map(([key,s])=>({id:publicSessionId(key),current:key===current,createdAt:new Date(s.createdAt).toISOString(),expiresAt:new Date(s.expiresAt).toISOString()})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export function revokeSessions(state,userId,current,{id,allOthers=false}={}){
 if(allOthers===true){for(const [key,s]of Object.entries(state.sessions))if(s.userId===userId&&key!==current)delete state.sessions[key];return;}
 const found=Object.entries(state.sessions).find(([key,s])=>s.userId===userId&&publicSessionId(key)===id);
 if(!found)failure(404,'Sessão não encontrada.','not_found');
 if(found[0]===current)failure(409,'Use Sair para encerrar esta sessão.','current_session');delete state.sessions[found[0]];
}
