const MINUTE=60_000,HOUR=60*MINUTE;
const DEFAULTS={inviteMs:24*HOUR,preparationMs:10*MINUTE,readyMs:2*MINUTE,matchMs:HOUR,reviewMs:24*HOUR,highStake:500};
const ENV_KEYS={inviteMs:'FIFABET_INVITE_MS',preparationMs:'FIFABET_PREPARATION_MS',readyMs:'FIFABET_READY_MS',matchMs:'FIFABET_MATCH_MS',reviewMs:'FIFABET_REVIEW_MS',highStake:'FIFABET_HIGH_STAKE'};
const invalid=message=>{const error=new Error(message);error.status=400;error.code='invalid_game_policy';throw error;};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

/** Snapshot this policy in each new room; changing configuration must not revise an agreement. */
export function lifecyclePolicy({env=process.env}={}){
  const result={...DEFAULTS};
  for(const [key,name]of Object.entries(ENV_KEYS))if(env[name]!==undefined&&env[name]!==''){
    const value=Number(env[name]),max=key==='highStake'?5000:30*24*HOUR;
    if(!Number.isSafeInteger(value)||value<1||value>max)invalid(`Configuração ${name} inválida.`);
    result[key]=value;
  }
  return result;
}

/** Return fields to merge into a room. Existing deadlines always retain precedence. */
export function storedLifecycle(duel,time=Date.now(),policy=duel.lifecyclePolicy||DEFAULTS){
  const result={};
  for(const field of ['inviteDeadline','preparationDeadline','matchDeadline','reviewDeadline'])if(duel[field]!==undefined)result[field]=duel[field];
  const add=(field,base,duration)=>{
    if(result[field]!==undefined)return;
    const parsed=typeof base==='number'?base:Date.parse(base);
    const anchor=Number.isFinite(parsed)?parsed:time;
    if(!Number.isFinite(anchor)||!Number.isSafeInteger(duration)||duration<1)invalid('Prazo da partida inválido.');
    result[field]=new Date(anchor+duration).toISOString();
  };
  if(duel.status==='invited')add('inviteDeadline',duel.createdAt,policy.inviteMs);
  if(['awaiting_funds','waiting_start'].includes(duel.status))add('preparationDeadline',duel.acceptedAt,policy.preparationMs);
  if(duel.status==='in_progress')add('matchDeadline',duel.startedAt,policy.matchMs);
  if(['pending_review','disputed'].includes(duel.status))add('reviewDeadline',duel.reviewStartedAt||duel.result?.submittedAt,policy.reviewMs);
  return result;
}

/** Legacy readiness is preserved; timestamped readiness has a strict expiry boundary. */
export function readinessState(duel,time=Date.now()){
  const readyBy=[],expiredBy=[],readyAtBy={},duration=duel.lifecyclePolicy?.readyMs||DEFAULTS.readyMs;
  for(const id of new Set(duel.readyBy||[])){
    if(![duel.hostId,duel.guestId].includes(id))continue;
    const timestamp=duel.readyAtBy?.[id];
    if(timestamp===undefined&&!duel.lifecyclePolicy){readyBy.push(id);continue;}
    const started=Date.parse(timestamp);
    if(!Number.isFinite(time)||!Number.isFinite(started)||started>time||started+duration<=time){expiredBy.push(id);continue;}
    readyBy.push(id);readyAtBy[id]=timestamp;
  }
  return {readyBy,readyAtBy,expiredBy};
}

function optionalText(data,key,max,result){
  if(data[key]===undefined||data[key]===null)return;
  if(typeof data[key]!=='string')invalid(`Campo ${key} inválido.`);
  const value=data[key].trim();
  if(value.length>max||/[\u0000-\u001f\u007f]/u.test(value))invalid(`Campo ${key} deve ter até ${max} caracteres.`);
  if(value)result[key]=value;
}

export function normalizeCompatibility(data={}){
  if(!plain(data))invalid('Compatibilidade inválida.');
  const result={};
  optionalText(data,'gameEdition',40,result);optionalText(data,'consoleGeneration',40,result);
  if(data.crossplay!==undefined){
    if(!['any','enabled','disabled'].includes(data.crossplay))invalid('Escolha a opção de crossplay.');
    result.crossplay=data.crossplay;
  }
  if(data.matchRules!==undefined){
    const rules=data.matchRules;
    if(!plain(rules)||typeof rules.extraTime!=='boolean'||typeof rules.penalties!=='boolean'||rules.disconnectPolicy!=='review'||Object.keys(rules).some(key=>!['extraTime','penalties','disconnectPolicy'].includes(key)))invalid('Regras estruturadas da partida inválidas.');
    result.matchRules={extraTime:rules.extraTime,penalties:rules.penalties,disconnectPolicy:'review'};
  }
  return result;
}

export function normalizeGameAccount(data={}){
  const result=normalizeCompatibility(data);
  for(const key of ['eaId','psnId','xboxId'])optionalText(data,key,64,result);
  return result;
}

/** 64-bit dHash only. This detects similarity and never authenticates a match. */
export function visualHashesSimilar(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==16||b.length!==16||!/^[a-f0-9]{16}$/i.test(a)||!/^[a-f0-9]{16}$/i.test(b))return false;
  let distance=0;
  for(let i=0;i<16;i++){
    let bits=parseInt(a[i],16)^parseInt(b[i],16);
    while(bits){bits&=bits-1;if(++distance>6)return false;}
  }
  return true;
}
