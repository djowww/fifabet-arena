import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,relative,join,extname,isAbsolute,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CLUBS} from '../clubs.mjs';
import {openArenaDatabase,normalizeNickname} from './database.mjs';
import {createOAuthService} from './oauth.mjs';
import {createResultRecognizer} from './result-recognition.mjs';
import {createDuelEconomics,duelEconomics,duelFunders,reservedDuelStake,OPEN_DUEL_STATUSES,RESULT_CONFIRMATION_MS,automaticSettlementCheck} from './duel-economy.mjs';
import {TERMS_VERSION,normalizeCountry,needsAccountOnboarding} from '../account-policy.mjs';

const scrypt=promisify(scryptCallback);
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DAY=86_400_000;
const MAX_IMAGE=5*1024*1024;
const MAX_PENDING_OPERATIONS=128;
const MODES=['1v1','Ultimate Team','Clubes'];
const PLATFORMS=['playstation','xbox','pc','switch'];
const DEPOSIT_AMOUNTS=[100,250,500,1000];
const DEPOSIT_METHODS=['card','pix','transfer'];
const MAX_ADMIN_CREDIT_GRANT=100_000;
const normalizedEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
function adminEmailAllowlist(value){
  const entries=Array.isArray(value)?value:String(value||'').split(',');
  const emails=entries.map(normalizedEmail).filter(Boolean);
  if(emails.some(email=>email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)))throw Error('FIFABET_ADMIN_EMAILS deve conter e-mails válidos separados por vírgula.');
  return new Set(emails);
}
function parsePixPackages(value){
  if(!value)return null;
  const entries=value.split(',').map(item=>item.trim()).filter(Boolean).map(item=>{
    const match=/^(100|250|500|1000):(\d{1,8})$/.exec(item);
    if(!match)throw Error('FIFABET_PIX_PACKAGES deve usar o formato créditos:centavos, por exemplo 100:1000.');
    const credits=Number(match[1]),priceCents=Number(match[2]);
    if(priceCents<100||priceCents>100_000_000)throw Error('O preço Pix de cada pacote deve estar entre R$ 1,00 e R$ 1.000.000,00.');
    return [credits,{amount:credits,priceCents}];
  });
  const packages=Object.fromEntries(entries);
  if(entries.length!==DEPOSIT_AMOUNTS.length||DEPOSIT_AMOUNTS.some(amount=>!packages[amount])||new Set(entries.map(([amount])=>amount)).size!==entries.length)throw Error('FIFABET_PIX_PACKAGES deve definir os pacotes de 100, 250, 500 e 1.000 créditos.');
  return packages;
}
const COOKIE='fifabet_session';
const token=()=>randomBytes(32).toString('base64url');
const sha=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const fail=(status,message,code='invalid_request')=>{const error=new Error(message);error.status=status;error.code=code;throw error;};
const CONTENT_SECURITY_POLICY="default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'";
function setSecurityHeaders(response,secureCookie){
  response.setHeader('Cache-Control','no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('X-Frame-Options','DENY');
  response.setHeader('X-Permitted-Cross-Domain-Policies','none');
  response.setHeader('Cross-Origin-Resource-Policy','same-origin');
  response.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy',CONTENT_SECURITY_POLICY);
  if(secureCookie)response.setHeader('Strict-Transport-Security','max-age=31536000');
}
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
function nickname(value){
  const name=typeof value==='string'?value.trim():'';
  if(name.length<2||name.length>20||!/^[\p{L}\p{N}_ .-]+$/u.test(name))fail(400,'Use um apelido de 2 a 20 letras ou números.');
  return name;
}
function password(value){
  if(typeof value!=='string'||value.length<10||value.length>256)fail(400,'Use uma senha de 10 a 256 caracteres.');
  return value;
}
function accountDetails(data,source){
  const countryCode=normalizeCountry(data.countryCode);
  if(!countryCode)fail(400,'Escolha seu país de residência.','country_invalid');
  if(data.acceptedTerms!==true)fail(400,'Leia e aceite os Termos de uso e a Política de privacidade para criar sua conta.','terms_required');
  if(data.termsVersion!==TERMS_VERSION)fail(409,'Os termos foram atualizados. Leia a versão atual antes de continuar.','terms_updated');
  return {countryCode,termsAcceptance:{version:TERMS_VERSION,acceptedAt:now(),source}};
}
function requireCompleteAccount(user){
  if(needsAccountOnboarding(user))fail(403,'Complete seu cadastro com apelido, país e aceite dos termos para continuar.','onboarding_required');
}
function integer(value,min,max,label){
  if(!Number.isSafeInteger(value)||value<min||value>max)fail(400,`${label} inválido.`);
  return value;
}
function reason(value){
  const text=typeof value==='string'?value.trim():'';
  if(text.length<10||text.length>1000)fail(400,'Descreva o motivo com 10 a 1.000 caracteres.');
  return text;
}
function readCookie(request){
  const match=String(request.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${COOKIE}=`));
  return match?match.slice(COOKIE.length+1):'';
}
function safeEqual(a,b){
  const one=Buffer.from(String(a||'')),two=Buffer.from(String(b||''));
  return one.length===two.length&&timingSafeEqual(one,two);
}
function dimensions(body,mime){
  let width=0,height=0;
  if(mime==='image/png'&&body.length>=24&&body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&body.toString('ascii',12,16)==='IHDR'){
    width=body.readUInt32BE(16);height=body.readUInt32BE(20);
  }else if(mime==='image/jpeg'&&body.length>=4&&body[0]===255&&body[1]===216){
    let i=2;
    while(i+4<body.length){
      if(body[i++]!==255)break;
      while(body[i]===255)i++;
      const marker=body[i++];
      if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      const length=body.readUInt16BE(i);
      if(length<2||i+length>body.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=body.readUInt16BE(i+3);width=body.readUInt16BE(i+5);break;}
      i+=length;
    }
  }else if(mime==='image/webp'&&body.length>=30&&body.toString('ascii',0,4)==='RIFF'&&body.toString('ascii',8,12)==='WEBP'){
    const format=body.toString('ascii',12,16);
    if(format==='VP8X'){width=body.readUIntLE(24,3)+1;height=body.readUIntLE(27,3)+1;}
    else if(format==='VP8 '&&body[23]===157&&body[24]===1&&body[25]===42){width=body.readUInt16LE(26)&16383;height=body.readUInt16LE(28)&16383;}
    else if(format==='VP8L'&&body[20]===47){width=1+body[21]+((body[22]&63)<<8);height=1+(body[22]>>6)+(body[23]<<2)+((body[24]&15)<<10);}
  }
  if(!width||!height||width>8192||height>8192||width*height>24_000_000)fail(400,'Envie uma imagem PNG, JPG ou WebP válida de até 24 megapixels.','invalid_image');
  return {width,height};
}
async function readBody(request,limit){
  const announced=Number(request.headers['content-length']);
  if(Number.isFinite(announced)&&announced>limit)fail(413,'Arquivo ou formulário muito grande.','payload_too_large');
  const chunks=[];let total=0;
  for await(const chunk of request){total+=chunk.length;if(total>limit)fail(413,'Arquivo ou formulário muito grande.','payload_too_large');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
async function jsonBody(request){
  if(String(request.headers['content-type']||'').split(';')[0]!=='application/json')fail(415,'Envie o formulário como JSON.');
  try{const data=JSON.parse((await readBody(request,16*1024)).toString('utf8'));if(!plain(data))fail(400,'Formulário inválido.');return data;}
  catch(error){if(error.status)throw error;fail(400,'JSON inválido.');}
}
function balanceChange(user,reference,amount,label){
  if(user.transactions.some(t=>t.reference===reference))return;
  if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(user.balance+amount)||user.balance+amount<0)fail(409,'Joga aí Coin insuficiente. Confira seu saldo antes de entrar nesta sala.','insufficient_balance');
  if(amount===0)return;
  user.balance+=amount;
  user.transactions.unshift({id:randomUUID(),reference,amount,label,date:now()});
}
// Old demonstration credits remain a separate, nonfinancial ledger.
function duelBalanceChange(user,duel,reference,amount,label){
  if(duel.creditMode!=='legacy_demo')return balanceChange(user,reference,amount,label);
  const ledger={balance:user.demoBalance||0,transactions:user.demoTransactions||[]};
  balanceChange(ledger,reference,amount,`[DEMO ANTIGA] ${label}`);
  user.demoBalance=ledger.balance;user.demoTransactions=ledger.transactions;
}
function uniquePublicId(records,prefix,field){
  let value;
  do{value=`${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`;}while(Object.values(records).some(record=>record[field]===value));
  return value;
}
function publicPlayer(user){return {id:user.id,publicPlayerId:user.publicPlayerId,nickname:user.nickname,clubId:user.clubId,gameAccount:user.gameAccount,createdAt:user.createdAt};}
function directoryPlayer(user){return {publicPlayerId:user.publicPlayerId,nickname:user.nickname,clubId:user.clubId};}
function member(duel,user){return duel.hostId===user.id||duel.guestId===user.id;}
function refundDuelReserves(state,duel,reference,label){
  for(const id of duelFunders(duel))duelBalanceChange(state.users[id],duel,reference,duel.stake,label);
}
function needsMatchReview(duel){
  return ['pending_review','disputed'].includes(duel.status)||duel.status==='in_progress'&&(duel.issueReports||[]).some(issue=>issue.status==='open');
}
function expireInvites(state){
  const time=Date.now();let changed=false;
  for(const duel of Object.values(state.duels))if(['invited','awaiting_funds'].includes(duel.status)&&Date.parse(duel.expiresAt)<=time){
    refundDuelReserves(state,duel,`expiry:${duel.id}`,'Sala expirada: reserva devolvida');
    duel.status='expired';duel.closedAt=now();changed=true;
  }
  for(const duel of Object.values(state.duels))if(duel.status==='pending_review'&&duel.result?.confirmationDeadline&&!duel.result.confirmedBy&&!duel.result.confirmationTimedOutAt&&Date.parse(duel.result.confirmationDeadline)<=time){
    duel.result.confirmationTimedOutAt=now();duel.reviewReason='confirmation_expired';changed=true;
  }
  for(const [id,session]of Object.entries(state.sessions))if(session.expiresAt<=time){delete state.sessions[id];changed=true;}
  return changed;
}
function duelView(state,duel,user){
  const result={...duel,economics:duelEconomics(duel),fundedBy:duelFunders(duel),issueReports:duel.issueReports||[],host:publicPlayer(state.users[duel.hostId]),guest:duel.guestId?publicPlayer(state.users[duel.guestId]):null,recipient:duel.recipientId?publicPlayer(state.users[duel.recipientId]):null};
  if(duel.hostId!==user.id||duel.status!=='invited')delete result.inviteToken;
  if(duel.hostId===user.id&&duel.creationOperationId)result.operationId=duel.creationOperationId;
  delete result.creationOperationId;delete result.creationOperationSignature;
  return result;
}
function requirePendingInvite(duel){
  if(duel.status==='expired')fail(410,'Este convite expirou. Peça um novo convite ao seu amigo.','invite_expired');
  if(duel.status==='cancelled')fail(410,'Este convite foi cancelado. Peça um novo convite ao seu amigo.','invite_cancelled');
  if(duel.status!=='invited')fail(409,'Este convite já foi aceito. Confira a partida na sua arena.','invite_already_accepted');
}
function depositView(state,deposit,{includePaymentInfo=false,pixKey=''}={}){
  const {idempotencyKey,...visible}=deposit;
  const result={...visible,owner:publicPlayer(state.users[deposit.userId]),paymentMode:deposit.paymentMode||'demo',realMoney:deposit.paymentMode==='pix_manual'};
  if(includePaymentInfo&&deposit.paymentMode==='pix_manual'&&['pending','review'].includes(deposit.status))result.paymentInfo={pixKey,amountCents:deposit.priceCents,currency:'BRL'};
  return result;
}
function fields(data,allowed){
  if(Object.keys(data).some(key=>!allowed.includes(key)))fail(400,'Formulário contém campos não aceitos. Confira os dados e tente novamente.','unsupported_fields');
}
function depositVersion(deposit,version){
  if(!Number.isSafeInteger(version)||version!==deposit.version)fail(409,'O pedido mudou. Atualize a carteira antes de continuar.','stale_deposit');
}

/** Private SQLite storage; one process owns the serialized state writer. */
export async function createArenaServer(options={}){
  const dataDir=resolve(options.dataDir||process.env.FIFABET_DATA_DIR||join(homedir(),'.fifabet-arena'));
  const rootRelative=relative(ROOT,dataDir);
  if(rootRelative===''||(!rootRelative.startsWith(`..${sep}`)&&rootRelative!=='..'&&!isAbsolute(rootRelative)))throw Error('FIFABET_DATA_DIR deve ficar fora da pasta publicada do site.');
  const publicOrigin=options.publicOrigin||process.env.FIFABET_PUBLIC_ORIGIN||'';
  const paymentMode=options.paymentMode||process.env.FIFABET_PAYMENT_MODE||'unconfigured';
  if(!['demo','unconfigured','pix_manual'].includes(paymentMode))throw Error('Modo de pagamento inválido.');
  if(publicOrigin&&(new URL(publicOrigin).origin!==publicOrigin||!/^https?:\/\//.test(publicOrigin)))throw Error('FIFABET_PUBLIC_ORIGIN deve conter somente a origem, sem caminho.');
  const reviewerIds=new Set(options.reviewerIds||String(process.env.FIFABET_REVIEWER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean));
  const adminEmails=adminEmailAllowlist(options.adminEmails??(options.env||process.env).FIFABET_ADMIN_EMAILS);
  const pixKey=String(options.pixKey??process.env.FIFABET_PIX_KEY??'').trim();
  const pixPackages=options.pixPackages||parsePixPackages(process.env.FIFABET_PIX_PACKAGES||'');
  if(paymentMode==='pix_manual'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)||!pixPackages||reviewerIds.size===0))throw Error('Pix manual exige chave de e-mail, preços para os quatro pacotes e ao menos um revisor configurado.');
  if(paymentMode==='pix_manual'&&!publicOrigin.startsWith('https://'))throw Error('Pix manual só pode ser habilitado com uma origem HTTPS pública configurada.');
  const secureCookie=publicOrigin.startsWith('https://')||options.secureCookie===true;
  const trustProxyLoopback=options.trustProxyLoopback===true||process.env.FIFABET_TRUST_PROXY_LOOPBACK==='1';
  if(paymentMode==='demo'&&publicOrigin&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(publicOrigin))throw Error('Recargas simuladas não podem ser habilitadas em uma origem pública.');
  const oauth=await createOAuthService({publicOrigin,env:options.env||process.env});
  const recognizer=options.recognizer||await createResultRecognizer({enabled:(options.env||process.env).FIFABET_OCR_ENABLED!=='0'});
  const maxEvidenceBytes=Number(options.maxEvidenceBytes||process.env.FIFABET_MAX_EVIDENCE_BYTES||200*1024*1024);
  if(!Number.isSafeInteger(maxEvidenceBytes)||maxEvidenceBytes<MAX_IMAGE)throw Error('FIFABET_MAX_EVIDENCE_BYTES deve ser um número inteiro de pelo menos 5 MiB.');
  await mkdir(dataDir,{recursive:true,mode:0o700});
  await mkdir(join(dataDir,'evidence'),{recursive:true,mode:0o700});
  await mkdir(join(dataDir,'wallet-evidence'),{recursive:true,mode:0o700});
  const lockPath=join(dataDir,'instance.lock');
  let lock;
  try{lock=await open(lockPath,'wx',0o600);await lock.writeFile(String(process.pid));}
  catch(error){if(error.code==='EEXIST')throw Error('Já há uma instância usando esta pasta de dados. Se o processo encerrou inesperadamente, remova instance.lock somente após confirmar que o servidor parou.');throw error;}
  let state,storage;
  try{
    storage=await openArenaDatabase(dataDir);state=storage.load();
    if(!state.walletLedgerVersion){
      for(const user of Object.values(state.users)){
        user.demoBalance=user.balance;user.demoTransactions=user.transactions;
        user.balance=0;user.transactions=[];
      }
      for(const duel of Object.values(state.duels))duel.creditMode='legacy_demo';
      state.walletLedgerVersion=1;state.walletLedgerMigratedAt=now();
    }
    for(const duel of Object.values(state.duels))if(!duel.publicMatchId)duel.publicMatchId=uniquePublicId(state.duels,'FG','publicMatchId');
    storage.save(state);
  }catch(error){
    storage?.close();await lock.close();await unlink(lockPath);throw error;
  }
  const persist=draft=>storage.save(draft);
  let tail=Promise.resolve(),pendingOperations=0;
  const serial=fn=>{
    if(pendingOperations>=MAX_PENDING_OPERATIONS){const error=new Error('A arena está ocupada. Tente novamente em alguns segundos.');error.status=503;error.code='server_busy';return Promise.reject(error);}
    pendingOperations++;
    const next=tail.then(fn,fn);
    tail=next.catch(()=>{}).finally(()=>{pendingOperations--;});
    return next;
  };
  const limits=new Map();
  const MAX_RATE_LIMIT_BUCKETS=10_000;
  let nextRateLimitSweep=0;
  function rateLimitAddress(request){
    const peer=request.socket.remoteAddress,forwarded=request.headers['x-real-ip'];
    if(trustProxyLoopback&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)&&typeof forwarded==='string'&&isIP(forwarded))return forwarded;
    return peer;
  }
  function rateLimit(request,kind,max,window){
    const key=`${rateLimitAddress(request)}:${kind}`,time=Date.now();
    if(time>=nextRateLimitSweep&&(limits.size>2_000||limits.size>=MAX_RATE_LIMIT_BUCKETS)){
      nextRateLimitSweep=time+60_000;
      for(const [entry,bucket]of limits)if(bucket.until<=time)limits.delete(entry);
    }
    let bucket=limits.get(key);
    if(!bucket&&limits.size>=MAX_RATE_LIMIT_BUCKETS)fail(429,'Limite de tráfego atingido. Tente novamente mais tarde.','rate_limit_capacity');
    if(!bucket||time>bucket.until){bucket={count:0,until:time+window};limits.set(key,bucket);}
    if(++bucket.count>max)fail(429,'Muitas tentativas. Aguarde alguns minutos.','rate_limited');
  }
  const sessionFor=(draft,request)=>draft.sessions[sha(readCookie(request))];
  const verifiedEmails=(draft,user)=>[...new Set(Object.values(draft.authIdentities).filter(identity=>identity.userId===user.id&&identity.emailVerified===true&&['google','apple'].includes(identity.provider)&&normalizedEmail(identity.email)).map(identity=>normalizedEmail(identity.email)))];
  const admin=(draft,user)=>verifiedEmails(draft,user).some(email=>adminEmails.has(email));
  const reviewer=(draft,user)=>reviewerIds.has(user.id)||admin(draft,user);
  const sessionPlayer=(draft,user)=>({...publicPlayer(user),countryCode:user.countryCode??null,needsOnboarding:needsAccountOnboarding(user),balance:user.balance,isReviewer:!needsAccountOnboarding(user)&&reviewer(draft,user),isAdmin:!needsAccountOnboarding(user)&&admin(draft,user)});
  function authenticated(draft,request){
    const session=sessionFor(draft,request);
    if(!session||session.expiresAt<=Date.now()||!draft.users[session.userId])fail(401,'Entre na sua conta para continuar.','unauthorized');
    return {session,user:draft.users[session.userId]};
  }
  function mutationAllowed(request,session){
    const origin=request.headers.origin;
    const expected=publicOrigin||`http://${request.headers.host}`;
    if(!origin||origin!==expected)fail(403,'Origem do pedido não permitida.','origin_rejected');
    if(session&&!safeEqual(request.headers['x-csrf-token'],session.csrfToken))fail(403,'Atualize a sessão e tente novamente.','csrf_rejected');
  }
  function setSession(draft,user,response){
    const value=token();const csrfToken=token();
    const session={userId:user.id,csrfToken,createdAt:Date.now(),expiresAt:Date.now()+14*DAY};
    const existing=Object.entries(draft.sessions).filter(([,s])=>s.userId===user.id).sort((a,b)=>a[1].createdAt-b[1].createdAt);
    while(existing.length>=8)delete draft.sessions[existing.shift()[0]];
    draft.sessions[sha(value)]=session;
    appendCookie(response,`${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14*DAY/1000}${secureCookie?'; Secure':''}`);
    return {user:sessionPlayer(draft,user),csrfToken};
  }
  function appendCookie(response,value){
    const existing=response.getHeader('Set-Cookie');
    response.setHeader('Set-Cookie',[...(Array.isArray(existing)?existing:existing?[existing]:[]),value]);
  }
  function newUser(draft,name,passwordFields={}){
    if(Object.keys(draft.users).length>=10_000)fail(503,'Cadastro temporariamente indisponível.');
    const user={id:randomUUID(),publicPlayerId:uniquePublicId(draft.users,'FBA','publicPlayerId'),nickname:name,...passwordFields,signupVersion:1,onboardingRequired:true,clubId:null,gameAccount:null,createdAt:now(),balance:0,friends:[],transactions:[]};
    draft.users[user.id]=user;return user;
  }
  function socialUser(draft,identity){
    const key=`${identity.provider}:${identity.subject}`,existing=draft.authIdentities[key];
    if(existing){
      const user=draft.users[existing.userId];if(!user)fail(409,'Conta indisponível.','account_conflict');
      // Refresh authorization from the provider's current, server-verified identity.
      Object.assign(existing,{email:identity.emailVerified===true?identity.email:null,emailVerified:identity.emailVerified===true,updatedAt:now()});
      return user;
    }
    // Never expose a Google/Apple full name or auto-link an existing account by e-mail.
    let name;
    do{name=`Jogador_${randomBytes(4).toString('hex')}`;}while(Object.values(draft.users).some(user=>normalizeNickname(user.nickname)===normalizeNickname(name)));
    const user=newUser(draft,name);
    draft.authIdentities[key]={provider:identity.provider,subject:identity.subject,userId:user.id,email:identity.emailVerified===true?identity.email:null,emailVerified:identity.emailVerified===true,createdAt:now()};
    return user;
  }
  const pendingDuels=(draft,user)=>Object.values(draft.duels).filter(duel=>member(duel,user)&&OPEN_DUEL_STATUSES.includes(duel.status));
  const reservedBalance=(draft,user,legacy=false)=>pendingDuels(draft,user).filter(duel=>(duel.creditMode==='legacy_demo')===legacy).reduce((sum,duel)=>sum+reservedDuelStake(duel,user.id),0);
  const adminUser=(draft,user)=>({id:user.id,publicPlayerId:user.publicPlayerId,nickname:user.nickname,clubId:user.clubId,createdAt:user.createdAt,balance:user.balance,reserved:reservedBalance(draft,user),verifiedEmails:verifiedEmails(draft,user)});
  function adminOperation(draft,operation){
    const actor=draft.users[operation.actorId],target=draft.users[operation.userId];
    return {id:operation.id,type:operation.type,actor:{publicPlayerId:actor.publicPlayerId,nickname:actor.nickname},target:{publicPlayerId:target.publicPlayerId,nickname:target.nickname},amount:operation.amount,reason:operation.reason,balanceBefore:operation.balanceBefore,balanceAfter:operation.balanceAfter,createdAt:operation.createdAt};
  }
  function ownDuel(draft,user,id){
    const duel=draft.duels[id];
    if(!duel||(!member(duel,user)&&duel.recipientId!==user.id))fail(404,'Desafio não encontrado.','not_found');
    return duel;
  }
  function ownDeposit(draft,user,id){
    const deposit=draft.deposits[id];
    if(!deposit||deposit.userId!==user.id)fail(404,'Pedido de recarga não encontrado.','not_found');
    return deposit;
  }
  function evidenceTotal(draft){return [...Object.values(draft.evidence),...Object.values(draft.walletEvidence)].reduce((sum,item)=>sum+item.bytes,0);}
  function approveDeposit(draft,deposit,actorId,kind,text){
    const owner=draft.users[deposit.userId];
    const live=deposit.paymentMode==='pix_manual';
    balanceChange(owner,`deposit:${deposit.id}`,deposit.amount,live?'Joga aí Coin liberado após confirmação manual de Pix':`[DEMO] Recarga por ${{card:'cartão',pix:'Pix',transfer:'transferência'}[deposit.method]} aprovada em simulação`);
    Object.assign(owner.transactions.find(tx=>tx.reference===`deposit:${deposit.id}`),{...(live?{realMoneyPayment:true,priceCents:deposit.priceCents}:{demo:true}),source:'deposit',depositId:deposit.id,method:deposit.method});
    deposit.status='approved';deposit.updatedAt=now();deposit.version++;
    deposit.decision={outcome:'approved',kind,actorId,reason:text,date:deposit.updatedAt,provider:live?'manual-bank-review':'fifabet-demo'};
  }
  function accept(draft,duel,user){
    requirePendingInvite(duel);
    if(duel.hostId===user.id)fail(409,'Este convite é seu. Compartilhe o link com seu amigo.','invite_own');
    if(duel.recipientId&&duel.recipientId!==user.id)fail(403,'Este convite foi enviado para outro jogador.','invite_wrong_recipient');
    if(duel.fundingVersion===2&&duel.stake>0&&duel.creditMode!=='coins'&&duel.creditMode!==paymentMode)fail(503,'As reservas desta sala estão indisponíveis neste modo de pagamento.','payments_unavailable');
    if(duel.fundingVersion!==1){
      duelBalanceChange(user,duel,`reserve:${duel.id}`,-duel.stake,'Joga aí Coin reservado ao entrar na sala');
      if(duel.fundingVersion===2&&duel.stake>0)duel.fundedBy.push(user.id);
    }
    duel.guestId=user.id;duel.status=duel.fundingVersion===1&&duel.stake>0?'awaiting_funds':'in_progress';duel.acceptedAt=now();duel.waitingAt=null;duel.waitingBy=null;
    if(duel.status==='in_progress')duel.startedAt=duel.acceptedAt;
    for(const [one,two]of [[user.id,duel.hostId],[duel.hostId,user.id]])if(!draft.users[one].friends.includes(two))draft.users[one].friends.push(two);
    return duelView(draft,duel,user);
  }
  function settleDuel(draft,duel,winner,{reviewerId=null,text,source='team_review'}={}){
    if(duel.settlement||draft.houseTransactions?.[`fee:${duel.id}`])fail(409,'Esta partida já foi liquidada.','already_settled');
    if([1,2].includes(duel.fundingVersion)&&duel.stake>0&&![duel.hostId,duel.guestId].every(id=>duel.fundedBy.includes(id)))fail(409,'As reservas da partida estão incompletas.','funding_incomplete');
    const economics=duelEconomics(duel),date=now(),winnerId=winner==='draw'?null:(winner==='host'?duel.hostId:duel.guestId);
    if(winner==='draw')refundDuelReserves(draft,duel,`settlement:${duel.id}`,'Empate confirmado: Joga aí Coin devolvido');
    else{
      duelBalanceChange(draft.users[winnerId],duel,`settlement:${duel.id}`,economics.winnerPayout,economics.houseFee?'Vitória confirmada: Joga aí Coin após taxa da casa de 9%':'Vitória confirmada: Joga aí Coin da partida');
      if(economics.houseFee>0){
        const reference=`fee:${duel.id}`;
        (draft.houseTransactions??={})[reference]={id:randomUUID(),reference,duelId:duel.id,amount:economics.houseFee,creditMode:duel.creditMode,source:'duel_fee',date,reviewerId};
      }
    }
    duel.winner=winner;duel.winnerId=winnerId;
    duel.settlement={date,pot:economics.pot,fee:winner==='draw'?0:economics.houseFee,prize:winner==='draw'?economics.pot:economics.winnerPayout,winner,winnerId};
    duel.review={reviewerId,reason:text,source,approvedAt:date,resultId:duel.result.id};duel.status='completed';duel.closedAt=date;duel.reviewReason=null;
    for(const issue of duel.issueReports||[])if(issue.status==='open'){issue.status='resolved';issue.resolvedAt=date;}
  }
  function tryAutomaticSettlement(draft,duel){
    const checked=automaticSettlementCheck(draft,duel);
    if(checked.eligible)settleDuel(draft,duel,checked.winner,{source:'bilateral_verified',text:'Dois participantes confirmaram o mesmo placar com fotos distintas e leitura consistente dentro de cinco minutos.'});
    else if(duel.result?.confirmedBy)duel.reviewReason=checked.reason;
  }
  function roomNotifications(duels,user){
    const result=[];
    for(const duel of duels){
      if(duel.waitingBy&&duel.waitingBy!==user.id&&duel.waitingAt&&['invited','awaiting_funds','in_progress'].includes(duel.status))result.push({id:`waiting:${duel.id}:${duel.waitingAt}`,type:'waiting',duelId:duel.id,publicMatchId:duel.publicMatchId,message:'Seu adversário está esperando por você na sala.',createdAt:duel.waitingAt});
      if(duel.result&&duel.result.reporterId!==user.id&&member(duel,user)&&!duel.result.confirmedBy&&duel.status==='pending_review')result.push({id:`result:${duel.result.id}`,type:'result_confirmation',duelId:duel.id,publicMatchId:duel.publicMatchId,message:duel.result.confirmationTimedOutAt?'O prazo de confirmação terminou. A equipe avaliará o resultado.':'Seu adversário enviou o placar. Envie sua foto e confirme em até cinco minutos.',createdAt:duel.result.submittedAt});
      if(duel.hostId===user.id&&duel.guestId&&duel.status==='in_progress')result.push({id:`joined:${duel.id}`,type:'joined',duelId:duel.id,publicMatchId:duel.publicMatchId,message:'Seu adversário entrou. A partida pode começar.',createdAt:duel.acceptedAt});
    }
    return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);
  }
  const mimeTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8'};
  const publicFiles=new Set([
    'manifest.webmanifest','sw.js','pwa.mjs','pwa.css','offline.html',
    'index.html','legal.html','colecao.html','bootstrap.js','app.js','play.js','backend-client.mjs','account-policy.mjs','model.mjs','clubs.mjs','football-trophies.mjs','rivalry-section.mjs','admin-panel.mjs','account-art.mjs','account-views.mjs','lobby-view.mjs','ui-icons.mjs','room-ui.mjs','image-preparation.mjs',
    'styles.css','arena.css','shop.css','profile.css','achievements.css','rivalry.css','competitive-modes.css','practical.css','lobby.css','wizard.css','admin.css','account.css','account-pages.css','taste.css'
  ]);
  const serverStatus=()=>({available:true,mode:'shared',storage:'sqlite',schemaVersion:storage.schemaVersion,termsVersion:TERMS_VERSION,paymentMode,realMoney:paymentMode==='pix_manual',noRealMoney:paymentMode!=='pix_manual',paymentsAvailable:paymentMode==='demo'||paymentMode==='pix_manual',authProviders:oauth.status(),recognition:recognizer.status(),apiVersion:1,reviewerConfigured:reviewerIds.size>0||adminEmails.size>0});
  async function route(draft,request,response,url,stagedEvidencePaths){
    const path=url.pathname,method=request.method;
    if(method==='GET'&&path==='/api/v1/status')return serverStatus();
    if(method==='GET'&&path==='/api/v1/session'){
      const session=sessionFor(draft,request),user=session&&draft.users[session.userId];
      return user&&session.expiresAt>Date.now()?{user:sessionPlayer(draft,user),csrfToken:session.csrfToken}:{user:null,csrfToken:null};
    }
    if(method==='POST'&&['/api/v1/auth/register','/api/v1/auth/login'].includes(path)){
      mutationAllowed(request);rateLimit(request,'auth',15,10*60*1000);
      const data=await jsonBody(request);
      if(path.endsWith('/register')){
        fields(data,['nickname','password','countryCode','acceptedTerms','termsVersion']);
        const name=nickname(data.nickname),pass=password(data.password);
        const details=accountDetails(data,'password');
        if(Object.values(draft.users).some(u=>normalizeNickname(u.nickname)===normalizeNickname(name)))fail(409,'Este apelido já está em uso.','nickname_taken');
        const salt=randomBytes(16).toString('hex');
        const digest=(await scrypt(pass,salt,64)).toString('hex');
        const user=newUser(draft,name,{passwordHash:digest,passwordSalt:salt});
        Object.assign(user,details,{onboardingRequired:false});
        return setSession(draft,user,response);
      }
      const identifier=String(data.identifier??data.nickname??'').trim();
      const pass=typeof data.password==='string'&&data.password.length<=256?data.password:'';
      const user=Object.values(draft.users).find(u=>normalizeNickname(u.nickname)===normalizeNickname(identifier)||u.publicPlayerId===identifier.toUpperCase());
      const digest=await scrypt(pass,user?.passwordSalt||'fifabet-invalid-user-salt',64);
      if(!user?.passwordHash||!user.passwordSalt||!safeEqual(digest.toString('hex'),user.passwordHash))fail(401,'ID, apelido ou senha incorretos.','invalid_credentials');
      return setSession(draft,user,response);
    }
    const codeMatch=/^\/api\/v1\/invites\/code\/([^/]+)(\/accept)?$/.exec(path);
    if(method==='GET'&&codeMatch&&!codeMatch[2]){
      rateLimit(request,'invite-lookup',60,10*60*1000);
      if(!/^FG-[A-F0-9]{10}$/.test(codeMatch[1]))fail(400,'Código inválido. Use FG seguido dos 10 caracteres da partida.','invite_invalid');
      const duel=Object.values(draft.duels).find(item=>item.publicMatchId===codeMatch[1]);
      if(!duel)fail(404,'Partida não encontrada. Confira o código com seu amigo.','invite_not_found');
      requirePendingInvite(duel);
      const current=sessionFor(draft,request),candidate=current&&current.expiresAt>Date.now()&&draft.users[current.userId],user=candidate&&!needsAccountOnboarding(candidate)?candidate:null;
      if(user&&duel.recipientId&&duel.recipientId!==user.id&&duel.hostId!==user.id)fail(403,'Este convite foi enviado para outro jogador.','invite_wrong_recipient');
      return {invite:{publicMatchId:duel.publicMatchId,stake:duel.stake,fundingVersion:duel.fundingVersion||0,economics:duelEconomics(duel),creditMode:duel.creditMode,mode:duel.mode,platform:duel.platform,status:duel.status,expiresAt:duel.expiresAt,...(user?{rules:duel.rules,host:{nickname:draft.users[duel.hostId].nickname}}:{})}};
    }
    const {user,session}=authenticated(draft,request);
    if(method!=='GET')mutationAllowed(request,session);
    if(method==='POST')rateLimit(request,'mutation',120,60*1000);
    if(method==='POST'&&path==='/api/v1/auth/onboarding'){
      rateLimit(request,'onboarding',15,10*60*1000);
      if(!needsAccountOnboarding(user))fail(409,'Seu cadastro já está completo. Edite seu apelido no perfil.','onboarding_complete');
      const identity=Object.values(draft.authIdentities).find(item=>item.userId===user.id&&['google','apple'].includes(item.provider));
      if(!identity)fail(409,'Entre novamente com a conta usada para criar este perfil.','account_conflict');
      const data=await jsonBody(request);fields(data,['nickname','countryCode','acceptedTerms','termsVersion']);
      const name=nickname(data.nickname),details=accountDetails(data,identity.provider);
      if(Object.values(draft.users).some(other=>other.id!==user.id&&normalizeNickname(other.nickname)===normalizeNickname(name)))fail(409,'Este apelido já está em uso.','nickname_taken');
      Object.assign(user,details,{nickname:name,onboardingRequired:false});
      return {user:sessionPlayer(draft,user),csrfToken:session.csrfToken};
    }
    // Social authentication proves identity; it does not accept the app's terms.
    if(needsAccountOnboarding(user)&&!(method==='GET'&&path==='/api/v1/me')&&!(method==='POST'&&path==='/api/v1/auth/logout'))requireCompleteAccount(user);
    if(path.startsWith('/api/v1/admin/')){
      if(!admin(draft,user))fail(403,'Esta área é exclusiva para administradores autorizados.','admin_required');
      if(method==='GET'&&path==='/api/v1/admin/overview'){
        const duels=Object.values(draft.duels),deposits=Object.values(draft.deposits);
        return {stats:{users:Object.keys(draft.users).length,activeMatches:duels.filter(duel=>['awaiting_funds','in_progress','pending_review','disputed'].includes(duel.status)).length,pendingInvites:duels.filter(duel=>duel.status==='invited').length,pendingResults:duels.filter(duel=>['pending_review','disputed'].includes(duel.status)).length,pendingIssues:duels.filter(duel=>OPEN_DUEL_STATUSES.includes(duel.status)&&(duel.issueReports||[]).some(issue=>issue.status==='open')).length,pendingDeposits:deposits.filter(deposit=>deposit.status==='review'&&deposit.userId!==user.id&&(paymentMode==='pix_manual'&&deposit.paymentMode==='pix_manual'&&deposit.method==='pix'||paymentMode==='demo'&&(deposit.paymentMode||'demo')==='demo'&&deposit.method==='transfer')).length},paymentMode,paymentsAvailable:paymentMode==='demo'||paymentMode==='pix_manual',authProviders:oauth.status()};
      }
      if(method==='GET'&&path==='/api/v1/admin/users'){
        const search=(url.searchParams.get('search')||'').trim().toLocaleLowerCase('pt-BR');
        if(search.length>100)fail(400,'Use até 100 caracteres na busca.');
        const users=Object.values(draft.users).filter(candidate=>!search||[candidate.nickname,candidate.publicPlayerId,...verifiedEmails(draft,candidate)].some(value=>value.toLocaleLowerCase('pt-BR').includes(search))).sort((a,b)=>a.nickname.localeCompare(b.nickname,'pt-BR'));
        return {users:users.slice(0,50).map(candidate=>adminUser(draft,candidate)),total:users.length,limit:50};
      }
      if(method==='GET'&&path==='/api/v1/admin/audit')return {entries:Object.values(draft.adminOperations||{}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(operation=>adminOperation(draft,operation)),limit:100};
      if(method==='POST'&&path==='/api/v1/admin/credits'){
        rateLimit(request,'admin-credits',30,60*1000);
        const data=await jsonBody(request);fields(data,['userId','amount','reason','idempotencyKey']);
        const amount=integer(data.amount,1,MAX_ADMIN_CREDIT_GRANT,'Quantidade de Joga aí Coin'),text=reason(data.reason);
        if(typeof data.idempotencyKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.idempotencyKey))fail(400,'Chave da operação inválida.','invalid_idempotency_key');
        if(typeof data.userId!=='string'||!Object.hasOwn(draft.users,data.userId))fail(404,'Jogador não encontrado.','not_found');
        const target=draft.users[data.userId],key=`${user.id}:${data.idempotencyKey.toLowerCase()}`;
        if(needsAccountOnboarding(target))fail(409,'Este jogador precisa completar o cadastro antes de receber Joga aí Coin.','recipient_onboarding_required');
        const operations=draft.adminOperations??={},existing=operations[key];
        if(existing){
          if(existing.userId!==target.id||existing.amount!==amount||existing.reason!==text)fail(409,'Esta chave já foi usada para outra operação. Atualize o formulário.','idempotency_conflict');
          return {operation:adminOperation(draft,existing),user:adminUser(draft,target),replayed:true};
        }
        const operation={id:randomUUID(),type:'credit_grant',actorId:user.id,userId:target.id,amount,reason:text,balanceBefore:target.balance,createdAt:now()};
        balanceChange(target,`admin:${operation.id}`,amount,'Joga aí Coin adicionado pela administração');
        Object.assign(target.transactions[0],{source:'admin_adjustment',administrative:true,adminOperationId:operation.id});
        operation.balanceAfter=target.balance;operations[key]=operation;
        return {operation:adminOperation(draft,operation),user:adminUser(draft,target),replayed:false};
      }
      fail(404,'Ferramenta administrativa não encontrada.','not_found');
    }
    if(method==='POST'&&codeMatch&&codeMatch[2]){
      if(!/^FG-[A-F0-9]{10}$/.test(codeMatch[1]))fail(400,'Código de partida inválido.','invite_invalid');
      const duel=Object.values(draft.duels).find(item=>item.publicMatchId===codeMatch[1]);
      if(!duel)fail(404,'Partida não encontrada. Confira o código com seu amigo.','invite_not_found');
      return {duel:accept(draft,duel,user)};
    }
    if(method==='POST'&&path==='/api/v1/auth/logout'){
      delete draft.sessions[sha(readCookie(request))];
      response.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie?'; Secure':''}`);
      return {ok:true};
    }
    if(method==='GET'&&path==='/api/v1/me'){
      if(needsAccountOnboarding(user))return {user:{...sessionPlayer(draft,user),demoBalance:0,legacyDemoBalance:0,friends:[],transactions:[]},duels:[],history:[],stats:{played:0,wins:0,reserved:0,legacyDemoReserved:0},csrfToken:session.csrfToken};
      const duels=Object.values(draft.duels).filter(d=>member(d,user)||d.recipientId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      const closed=duels.filter(d=>['completed','cancelled','expired'].includes(d.status));
      return {user:{...sessionPlayer(draft,user),demoBalance:user.demoBalance||0,legacyDemoBalance:user.demoBalance||0,friends:user.friends.map(id=>publicPlayer(draft.users[id])),transactions:user.transactions},duels:duels.filter(d=>!closed.includes(d)).map(d=>duelView(draft,d,user)),history:closed.map(d=>duelView(draft,d,user)),notifications:roomNotifications(duels,user),stats:{played:closed.filter(d=>d.status==='completed').length,wins:closed.filter(d=>d.winnerId===user.id).length,reserved:reservedBalance(draft,user),legacyDemoReserved:reservedBalance(draft,user,true)},csrfToken:session.csrfToken};
    }
    if(method==='GET'&&path==='/api/v1/rooms'){
      const rooms=Object.values(draft.duels).filter(duel=>duel.visibility==='public'&&!duel.recipientId&&duel.hostId!==user.id&&duel.status==='invited'&&duel.fundingVersion===2).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50);
      return {rooms:rooms.map(duel=>({publicMatchId:duel.publicMatchId,host:{nickname:draft.users[duel.hostId].nickname,clubId:draft.users[duel.hostId].clubId},stake:duel.stake,creditMode:duel.creditMode,economics:duelEconomics(duel),mode:duel.mode,platform:duel.platform,expiresAt:duel.expiresAt}))};
    }
    if(method==='GET'&&path==='/api/v1/leaderboard'){
      const ranked=new Map();
      for(const duel of Object.values(draft.duels)){
        if(duel.status!=='completed'||!duel.review?.approvedAt||duel.review.resultId!==duel.result?.id||!draft.users[duel.hostId]||!draft.users[duel.guestId])continue;
        const draw=duel.winner==='draw';
        if(!draw&&![duel.hostId,duel.guestId].includes(duel.winnerId))continue;
        for(const id of [duel.hostId,duel.guestId]){
          if(!ranked.has(id))ranked.set(id,{player:directoryPlayer(draft.users[id]),played:0,wins:0,draws:0,losses:0});
          const entry=ranked.get(id);entry.played++;
          if(draw)entry.draws++;else if(duel.winnerId===id)entry.wins++;else entry.losses++;
        }
      }
      return {entries:[...ranked.values()].sort((a,b)=>b.wins-a.wins||b.draws-a.draws||a.player.nickname.localeCompare(b.player.nickname,'pt-BR')).slice(0,100)};
    }
    if(method==='PATCH'&&path==='/api/v1/me'){
      const data=await jsonBody(request);
      if(Object.hasOwn(data,'nickname')){const name=nickname(data.nickname);if(Object.values(draft.users).some(u=>u.id!==user.id&&normalizeNickname(u.nickname)===normalizeNickname(name)))fail(409,'Este apelido já está em uso.');user.nickname=name;}
      if(Object.hasOwn(data,'clubId')){if(data.clubId!==null&&!CLUBS.some(c=>c.id===data.clubId))fail(400,'Escolha um clube do catálogo.');user.clubId=data.clubId;}
      return {user:sessionPlayer(draft,user)};
    }
    if(method==='GET'&&path==='/api/v1/wallet'){
      const deposits=Object.values(draft.deposits).filter(deposit=>deposit.userId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(deposit=>depositView(draft,deposit,{includePaymentInfo:true,pixKey}));
      const catalog=paymentMode==='demo'?DEPOSIT_AMOUNTS:paymentMode==='pix_manual'?DEPOSIT_AMOUNTS.map(amount=>pixPackages[amount]):[];
      return {balance:user.balance,reserved:reservedBalance(draft,user),transactions:user.transactions,legacyDemoBalance:user.demoBalance||0,legacyDemoReserved:reservedBalance(draft,user,true),legacyDemoTransactions:user.demoTransactions||[],deposits,catalog,packs:paymentMode==='demo'?DEPOSIT_AMOUNTS:catalog,methods:paymentMode==='demo'?DEPOSIT_METHODS:paymentMode==='pix_manual'?['pix']:[],paymentMode,paymentsAvailable:paymentMode==='demo'||paymentMode==='pix_manual',realMoney:paymentMode==='pix_manual',noRealMoney:paymentMode!=='pix_manual'};
    }
    if(method==='POST'&&path==='/api/v1/wallet/deposits'){
      if(!['demo','pix_manual'].includes(paymentMode))fail(503,'Compra de Joga aí Coin indisponível no momento.','payments_unavailable');
      rateLimit(request,'wallet-deposit',10,60*60*1000);
      const data=await jsonBody(request);fields(data,['amount','method','installments','idempotencyKey']);
      if(!DEPOSIT_AMOUNTS.includes(data.amount)||!(paymentMode==='demo'?DEPOSIT_METHODS:['pix']).includes(data.method))fail(400,'Escolha um pacote e um método de pagamento disponíveis.');
      const installments=integer(data.installments??1,1,6,'Número de parcelas');
      if(data.method!=='card'&&installments!==1)fail(400,'Parcelas são disponíveis apenas na simulação de cartão.');
      if(typeof data.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(data.idempotencyKey))fail(400,'Use um identificador único de operação de 16 a 100 caracteres.');
      const existing=Object.values(draft.deposits).find(deposit=>deposit.userId===user.id&&deposit.idempotencyKey===data.idempotencyKey);
      if(existing){
        if(existing.amount!==data.amount||existing.method!==data.method||existing.installments!==installments||(existing.paymentMode||'demo')!==paymentMode)fail(409,'Esse identificador já pertence a outro pedido.','idempotency_conflict');
        return {deposit:depositView(draft,existing,{includePaymentInfo:true,pixKey})};
      }
      if(Object.values(draft.deposits).filter(deposit=>deposit.userId===user.id&&['pending','review'].includes(deposit.status)).length>=10)fail(409,'Conclua ou cancele pedidos pendentes antes de criar mais.');
      const date=now(),deposit={id:randomUUID(),userId:user.id,idempotencyKey:data.idempotencyKey,amount:data.amount,method:data.method,installments,status:'pending',version:1,createdAt:date,updatedAt:date,evidenceId:null,evidenceIds:[],decision:null,paymentMode,...(paymentMode==='pix_manual'?{priceCents:pixPackages[data.amount].priceCents}: {})};
      draft.deposits[deposit.id]=deposit;
      return {deposit:depositView(draft,deposit,{includePaymentInfo:true,pixKey})};
    }
    const depositMatch=/^\/api\/v1\/wallet\/deposits\/([a-f0-9-]{36})\/(simulate|cancel|proof)$/.exec(path);
    if(method==='POST'&&depositMatch){
      const deposit=ownDeposit(draft,user,depositMatch[1]),action=depositMatch[2];
      if(!['demo','pix_manual'].includes(paymentMode)&&action!=='cancel')fail(503,'Recargas desativadas até configurar os pagamentos.','payments_unavailable');
      if(!['pending','review'].includes(deposit.status))fail(409,'Este pedido já foi encerrado.');
      if(action==='proof'){
      if(!(['demo','pix_manual'].includes(paymentMode)&&(deposit.paymentMode||'demo')===paymentMode&&(paymentMode==='pix_manual'?deposit.method==='pix':deposit.method==='transfer')))fail(409,'Este pedido não aceita comprovante neste método ou modo.');
        depositVersion(deposit,Number(url.searchParams.get('version')));
        rateLimit(request,'evidence',30,60*60*1000);
        if(deposit.evidenceIds.length>=3)fail(409,'Este pedido já possui três comprovantes. A equipe deve revisar as imagens.');
        const mime=String(request.headers['content-type']||'').split(';')[0];
        if(!['image/png','image/jpeg','image/webp'].includes(mime))fail(415,'Use uma foto PNG, JPG ou WebP.');
        const body=await readBody(request,MAX_IMAGE),size=dimensions(body,mime),id=randomUUID();
        if(evidenceTotal(draft)+body.length>maxEvidenceBytes)fail(507,'O armazenamento de fotos está cheio. Avise a equipe.','storage_full');
        const item={id,depositId:deposit.id,authorId:user.id,mime,bytes:body.length,...size,sha256:sha(body),createdAt:now()};
        const evidencePath=join(dataDir,'wallet-evidence',id);
        await writeFile(evidencePath,body,{mode:0o600,flag:'wx'});stagedEvidencePaths.push(evidencePath);draft.walletEvidence[id]=item;
        deposit.evidenceId=id;deposit.evidenceIds.push(id);deposit.status='review';deposit.version++;deposit.updatedAt=now();
        return {deposit:depositView(draft,deposit),evidence:{id,mime,bytes:body.length,...size,url:`/api/v1/wallet/evidence/${id}`}};
      }
      const data=await jsonBody(request);
      if(action==='cancel'){
        fields(data,['version']);depositVersion(deposit,data.version);
        deposit.status='cancelled';deposit.version++;deposit.updatedAt=now();
        deposit.decision={outcome:'cancelled',kind:'owner',actorId:user.id,reason:deposit.paymentMode==='pix_manual'?'Pedido Pix cancelado pelo jogador.':'Pedido de teste cancelado pelo jogador.',date:deposit.updatedAt,provider:deposit.paymentMode==='pix_manual'?'manual-bank-review':'fifabet-demo'};
      }else{
        if(paymentMode!=='demo'||deposit.paymentMode!=='demo')fail(503,'A confirmação de pagamento real precisa ser revisada pela equipe.','payments_unavailable');
        fields(data,['mode','outcome','version']);depositVersion(deposit,data.version);
        if(data.mode!=='demo'||!['approved','rejected'].includes(data.outcome))fail(400,'Identifique explicitamente a simulação demonstrativa.');
        if(!['card','pix'].includes(deposit.method))fail(403,'Transferências exigem comprovante e revisão por outra conta da equipe.');
        if(data.outcome==='approved')approveDeposit(draft,deposit,user.id,'simulation','Aprovação simulada pelo jogador em ambiente de teste.');
        else{deposit.status='rejected';deposit.updatedAt=now();deposit.version++;deposit.decision={outcome:'rejected',kind:'simulation',actorId:user.id,reason:'Rejeição simulada pelo jogador em ambiente de teste.',date:deposit.updatedAt,provider:'fifabet-demo'};}
      }
      return {deposit:depositView(draft,deposit),balance:user.balance,paymentMode,realMoney:paymentMode==='pix_manual'};
    }
    const walletEvidenceMatch=/^\/api\/v1\/wallet\/evidence\/([a-f0-9-]{36})$/.exec(path);
    if(method==='GET'&&walletEvidenceMatch){
      const item=draft.walletEvidence[walletEvidenceMatch[1]],deposit=item&&draft.deposits[item.depositId];
      if(!item||!deposit||(deposit.userId!==user.id&&!reviewer(draft,user)))fail(404,'Comprovante não encontrado.','not_found');
      const body=await readFile(join(dataDir,'wallet-evidence',item.id));
      response.writeHead(200,{'Content-Type':item.mime,'Content-Length':body.length,'Content-Disposition':`inline; filename="comprovante-${deposit.paymentMode==='pix_manual'?'pix':'demo'}-${item.id}${{'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[item.mime]}"`});
      response.end(body);return null;
    }
    if(method==='GET'&&path==='/api/v1/wallet/reviews'){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode revisar comprovantes.');
      return {deposits:Object.values(draft.deposits).filter(deposit=>deposit.status==='review'&&deposit.userId!==user.id&&(paymentMode==='pix_manual'&&deposit.paymentMode==='pix_manual'&&deposit.method==='pix'||paymentMode==='demo'&&(deposit.paymentMode||'demo')==='demo'&&deposit.method==='transfer')).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(deposit=>depositView(draft,deposit)),paymentMode,realMoney:paymentMode==='pix_manual'};
    }
    const walletReviewMatch=/^\/api\/v1\/wallet\/reviews\/([a-f0-9-]{36})$/.exec(path);
    if(method==='POST'&&walletReviewMatch){
      if(!['demo','pix_manual'].includes(paymentMode))fail(503,'Recargas desativadas até configurar os pagamentos.','payments_unavailable');
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode decidir sobre comprovantes.');
      const deposit=draft.deposits[walletReviewMatch[1]];
      if(!deposit)fail(404,'Pedido de recarga não encontrado.','not_found');
      if(deposit.userId===user.id)fail(403,'Uma pessoa não pode julgar o próprio comprovante.');
      if(deposit.status!=='review'||!draft.walletEvidence[deposit.evidenceId]||!(paymentMode==='pix_manual'&&deposit.paymentMode==='pix_manual'&&deposit.method==='pix'||paymentMode==='demo'&&(deposit.paymentMode||'demo')==='demo'&&deposit.method==='transfer'))fail(409,'Este pedido não possui comprovante pendente neste modo de pagamento.');
      const data=await jsonBody(request);fields(data,['decision','reason','version']);depositVersion(deposit,data.version);
      const text=reason(data.reason);
      if(!['approve','reject'].includes(data.decision))fail(400,'Escolha aprovar ou rejeitar o comprovante.');
      if(data.decision==='approve')approveDeposit(draft,deposit,user.id,'team_review',text);
      else{deposit.status='rejected';deposit.updatedAt=now();deposit.version++;deposit.decision={outcome:'rejected',kind:'team_review',actorId:user.id,reason:text,date:deposit.updatedAt,provider:deposit.paymentMode==='pix_manual'?'manual-bank-review':'fifabet-demo'};}
      return {deposit:depositView(draft,deposit),paymentMode,realMoney:paymentMode==='pix_manual'};
    }
    const playerMatch=/^\/api\/v1\/players\/(FBA-[A-F0-9]{10})$/.exec(path);
    if(method==='GET'&&playerMatch){
      const player=Object.values(draft.users).find(u=>u.publicPlayerId===playerMatch[1]);
      if(!player||needsAccountOnboarding(player))fail(404,'Jogador não encontrado. Confira o ID.','not_found');
      return {player:directoryPlayer(player)};
    }
    if(method==='POST'&&path==='/api/v1/duels'){
      const data=await jsonBody(request);
      if(data.expectedHostId!==undefined&&data.expectedHostId!==user.id)fail(409,'A conta mudou. Confira quem está conectado e prepare a partida novamente.','account_changed');
      const stake=integer(data.stake,0,5000,'Quantidade de Joga aí Coin');
      if(stake>0&&stake<10)fail(400,'Use zero para jogar sem aposta ou pelo menos 10 Joga aí Coin por participante.');
      if(!MODES.includes(data.mode)||!PLATFORMS.includes(data.platform))fail(400,'Escolha um modo e uma plataforma válidos.');
      let operationId=null;
      if(data.operationId!==undefined){
        if(typeof data.operationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.operationId))fail(400,'Atualize o formulário antes de criar a partida.','invalid_operation_id');
        operationId=data.operationId.toLowerCase();
      }
      let recipient=null;
      if(data.opponentPlayerId){recipient=Object.values(draft.users).find(u=>u.publicPlayerId===String(data.opponentPlayerId).trim().toUpperCase());if(!recipient||needsAccountOnboarding(recipient))fail(404,'ID do adversário não encontrado.');if(recipient.id===user.id)fail(400,'Escolha outro jogador.');}
      if(data.visibility!==undefined&&!['public','private'].includes(data.visibility))fail(400,'Escolha uma sala aberta na arena ou somente por convite.');
      if(recipient&&data.visibility==='public')fail(400,'Uma partida destinada a um amigo precisa ser privada.');
      const visibility=recipient?'private':data.visibility||'public';
      const rules=typeof data.rules==='string'?data.rules.trim():'';
      if(rules.length>500)fail(400,'As regras podem ter até 500 caracteres.');
      const operationSignature=operationId?sha(JSON.stringify({stake,mode:data.mode,platform:data.platform,recipientId:recipient?.id||null,rules,visibility})):null;
      if(operationId){
        const existing=Object.values(draft.duels).find(duel=>duel.hostId===user.id&&duel.creationOperationId===operationId);
        if(existing){
          if(existing.creationOperationSignature!==operationSignature)fail(409,'Este envio já criou uma partida com outros dados. Atualize o formulário.','operation_conflict');
          return {duel:duelView(draft,existing,user),...(existing.status==='invited'?{inviteToken:existing.inviteToken}:{})};
        }
      }
      if(Object.values(draft.duels).filter(d=>d.hostId===user.id&&d.status==='invited').length>=20)fail(409,'Conclua ou cancele convites pendentes antes de criar mais.');
      if(Object.values(draft.duels).filter(d=>member(d,user)&&OPEN_DUEL_STATUSES.includes(d.status)).length>=50)fail(409,'Conclua desafios em andamento antes de criar mais.');
      const duel={id:randomUUID(),publicMatchId:uniquePublicId(draft.duels,'FG','publicMatchId'),creditMode:stake===0?'friendly':paymentMode==='unconfigured'?'coins':paymentMode,hostId:user.id,guestId:null,recipientId:recipient?.id||null,visibility,stake,fundingVersion:2,fundedBy:[],economics:createDuelEconomics(stake),mode:data.mode,platform:data.platform,rules,status:'invited',inviteToken:token(),createdAt:now(),expiresAt:new Date(Date.now()+7*DAY).toISOString(),reports:[],disputes:[],issueReports:[],result:null,cancellationRequestedBy:[]};
      if(stake>0){duelBalanceChange(user,duel,`reserve:${duel.id}`,-stake,'Joga aí Coin reservado ao criar a sala');duel.fundedBy.push(user.id);}
      if(operationId){duel.creationOperationId=operationId;duel.creationOperationSignature=operationSignature;}
      draft.duels[duel.id]=duel;
      return {duel:duelView(draft,duel,user),inviteToken:duel.inviteToken};
    }
    const inviteMatch=/^\/api\/v1\/invites\/([^/]*)(\/accept)?$/.exec(path);
    if(inviteMatch){
      if(!/^[A-Za-z0-9_-]{43}$/.test(inviteMatch[1]))fail(400,'Código de convite inválido. Copie o código ou link completo.','invite_invalid');
      const duel=Object.values(draft.duels).find(d=>safeEqual(d.inviteToken,inviteMatch[1]));
      if(!duel)fail(404,'Convite não encontrado. Confira o código ou peça um novo link.','invite_not_found');
      if(duel.recipientId&&duel.recipientId!==user.id&&duel.hostId!==user.id)fail(403,'Este convite foi enviado para outro jogador.','invite_wrong_recipient');
      requirePendingInvite(duel);
      if(method==='GET'&&!inviteMatch[2])return {invite:{publicMatchId:duel.publicMatchId,creditMode:duel.creditMode,host:{nickname:draft.users[duel.hostId].nickname},stake:duel.stake,fundingVersion:duel.fundingVersion||0,economics:duelEconomics(duel),mode:duel.mode,platform:duel.platform,rules:duel.rules,status:duel.status,expiresAt:duel.expiresAt}};
      if(method==='POST'&&inviteMatch[2])return {duel:accept(draft,duel,user)};
    }
    const duelMatch=/^\/api\/v1\/duels\/([a-f0-9-]{36})\/(accept|fund|nudge|issue|cancel|cancel-withdraw|result|confirm|dispute)$/.exec(path);
    if(method==='POST'&&duelMatch){
      const duel=ownDuel(draft,user,duelMatch[1]);
      const action=duelMatch[2];
      if(action==='accept')return {duel:accept(draft,duel,user)};
      if(action==='fund'){
        if(!member(duel,user))fail(403,'Somente os participantes podem reservar Joga aí Coin na sala.');
        const data=await jsonBody(request);fields(data,['stake']);
        const stake=integer(data.stake,0,5000,'Quantidade de Joga aí Coin');
        if(stake!==duel.stake)fail(409,'O valor informado difere do valor combinado na sala.','stake_mismatch');
        if(duel.stake===0)fail(409,'Esta sala não precisa de uma nova reserva.','funding_unavailable');
        if(duel.fundingVersion===2&&duel.fundedBy.includes(user.id))return {duel:duelView(draft,duel,user)};
        if(duel.fundingVersion!==1)fail(409,'Esta sala não precisa de uma nova reserva.','funding_unavailable');
        if(!['awaiting_funds','in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Esta sala não aceita mais reservas.','funding_closed');
        if(duel.fundedBy.includes(user.id))return {duel:duelView(draft,duel,user)};
        if(duel.status!=='awaiting_funds')fail(409,'A partida já começou.','funding_closed');
        if(paymentMode==='unconfigured'||duel.creditMode!==paymentMode)fail(503,'As reservas de Joga aí Coin desta sala estão indisponíveis no momento.','payments_unavailable');
        duelBalanceChange(user,duel,`reserve:${duel.id}`,-duel.stake,'Joga aí Coin reservado na sala');
        duel.fundedBy.push(user.id);
        if([duel.hostId,duel.guestId].every(id=>duel.fundedBy.includes(id))){duel.status='in_progress';duel.startedAt=now();}
        return {duel:duelView(draft,duel,user)};
      }
      if(action==='nudge'){
        if(!member(duel,user))fail(403,'Somente os participantes podem avisar que estão esperando.');
        if(!['invited','awaiting_funds','in_progress'].includes(duel.status))fail(409,'Esta partida não está aguardando jogadores.');
        const data=await jsonBody(request);fields(data,[]);
        const previous=duel.nudgedAtBy?.[user.id];
        if(previous&&Date.now()-Date.parse(previous)<60_000)fail(429,'O aviso já foi enviado. Aguarde um minuto para avisar novamente.','nudge_limited');
        duel.waitingAt=now();duel.waitingBy=user.id;(duel.nudgedAtBy??={})[user.id]=duel.waitingAt;
        return {duel:duelView(draft,duel,user)};
      }
      if(action==='issue'){
        if(!member(duel,user))fail(403,'Somente os participantes podem reportar um problema.');
        if(!['in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Esta sala não aceita novos relatos de problema.');
        const issues=duel.issueReports??=[];
        const data=await jsonBody(request);fields(data,['reason']);
        const text=reason(data.reason);
        if(issues.some(issue=>issue.authorId===user.id&&issue.reason===text&&issue.status==='open'))return {duel:duelView(draft,duel,user)};
        if(issues.length>=10)fail(409,'Os problemas já registrados serão avaliados pela equipe.');
        issues.push({id:randomUUID(),authorId:user.id,reason:text,createdAt:now(),status:'open'});
        return {duel:duelView(draft,duel,user)};
      }
      if(action==='cancel-withdraw'){
        if(!member(duel,user))fail(403,'Somente os participantes podem responder ao cancelamento.');
        if(duel.status!=='in_progress'||!duel.cancellationRequestedBy.length)fail(409,'Não há pedido de cancelamento em andamento.');
        duel.cancellationRequestedBy=[];
        return {duel:duelView(draft,duel,user)};
      }
      if(action==='cancel'){
        if(duel.status==='invited'&&(duel.hostId===user.id||duel.recipientId===user.id)){
          const declined=duel.recipientId===user.id;
          refundDuelReserves(draft,duel,`cancel:${duel.id}`,declined?'Convite recusado: reserva devolvida':'Convite cancelado: reserva devolvida');
          duel.status='cancelled';duel.closedAt=now();duel.cancelledBy=user.id;duel.cancellationReason=declined?'declined':'withdrawn';
        }
        else if(duel.status==='awaiting_funds'&&member(duel,user)){
          refundDuelReserves(draft,duel,`cancel:${duel.id}`,'Sala cancelada antes do início: reserva devolvida');
          duel.status='cancelled';duel.closedAt=now();duel.cancelledBy=user.id;duel.cancellationReason='before_start';
        }
        else if(duel.status==='in_progress'&&member(duel,user)){
          if(!duel.cancellationRequestedBy.includes(user.id))duel.cancellationRequestedBy.push(user.id);
          if(duel.cancellationRequestedBy.length===2){refundDuelReserves(draft,duel,`cancel:${duel.id}`,'Cancelamento combinado: reserva devolvida');duel.status='cancelled';duel.closedAt=now();}
        }else fail(409,'Este desafio precisa ser resolvido pela revisão.');
        return {duel:duelView(draft,duel,user)};
      }
      if(!member(duel,user))fail(403,'Somente os participantes podem modificar o desafio.');
      if(!['in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Este desafio não aceita mais resultados.');
      if(action==='result'){
        if(duel.reports.length>=20)fail(409,'A equipe precisa resolver este desafio antes de receber novos placares.');
        const data=await jsonBody(request),homeScore=integer(data.homeScore,0,99,'Placar do anfitrião'),awayScore=integer(data.awayScore,0,99,'Placar do convidado');
        fields(data,['homeScore','awayScore','evidenceId','scoreSide']);
        if(!['host','guest'].includes(data.scoreSide))fail(400,'Informe qual jogador aparece à esquerda da foto.','score_side_required');
        const evidence=draft.evidence[data.evidenceId];
        if(!evidence||evidence.duelId!==duel.id||evidence.authorId!==user.id)fail(400,'Envie sua foto do placar deste desafio antes de registrar o resultado.');
        if(duel.status==='pending_review'&&duel.result?.reporterId===user.id&&duel.result.evidenceId===evidence.id&&duel.result.homeScore===homeScore&&duel.result.awayScore===awayScore&&duel.result.scoreSide===data.scoreSide)return {duel:duelView(draft,duel,user)};
        if(duel.result&&duel.result.reporterId!==user.id&&duel.status==='pending_review')fail(409,'Já existe um placar do seu adversário. Confira o resultado e envie sua foto para confirmar.','confirmation_required');
        // A revised report cannot extend the first participant's five-minute deadline.
        const submittedAt=now(),confirmationDeadline=duel.result?.confirmationDeadline||new Date(Date.parse(submittedAt)+RESULT_CONFIRMATION_MS).toISOString();
        const result={id:randomUUID(),reporterId:user.id,homeScore,awayScore,scoreSide:data.scoreSide,evidenceId:evidence.id,submittedAt,confirmedBy:null,confirmationDeadline,...(duel.result?.confirmationTimedOutAt?{confirmationTimedOutAt:duel.result.confirmationTimedOutAt}:{})};
        duel.reports.push(result);duel.result=result;duel.status='pending_review';duel.reviewReason=result.confirmationTimedOutAt?'confirmation_expired':null;duel.cancellationRequestedBy=[];duel.waitingAt=null;duel.waitingBy=null;
      }else if(action==='confirm'){
        const data=await jsonBody(request);
        fields(data,['reportId','evidenceId','homeScore','awayScore','scoreSide']);
        if(!duel.result||duel.status==='disputed')fail(409,'Aguarde um resultado atualizado antes de concordar.');
        if(data.reportId!==duel.result.id)fail(409,'O placar mudou. Confira a versão atual antes de confirmar.','stale_result');
        if(duel.result.reporterId===user.id)fail(403,'O adversário precisa confirmar o seu placar.');
        const homeScore=integer(data.homeScore,0,99,'Placar do anfitrião'),awayScore=integer(data.awayScore,0,99,'Placar do convidado');
        if(!['host','guest'].includes(data.scoreSide))fail(400,'Informe qual jogador aparece à esquerda da sua foto.','score_side_required');
        const evidence=draft.evidence[data.evidenceId];
        if(!evidence||evidence.duelId!==duel.id||evidence.authorId!==user.id)fail(400,'Envie sua própria foto desta partida para confirmar o placar.','confirmation_evidence_required');
        if(duel.result.confirmedBy){
          if(duel.result.confirmedBy===user.id&&duel.result.confirmationEvidenceId===evidence.id&&duel.result.homeScore===homeScore&&duel.result.awayScore===awayScore&&duel.result.confirmationScoreSide===data.scoreSide)return {duel:duelView(draft,duel,user)};
          fail(409,'Este resultado já recebeu uma confirmação. Aguarde a avaliação.','already_confirmed');
        }
        if(homeScore!==duel.result.homeScore||awayScore!==duel.result.awayScore){
          if(duel.disputes.length>=10)fail(409,'As divergências já registradas serão avaliadas pela equipe.');
          duel.disputes.push({id:randomUUID(),authorId:user.id,reason:'Os placares informados pelos participantes são diferentes.',evidenceId:evidence.id,homeScore,awayScore,createdAt:now()});duel.status='disputed';duel.reviewReason='score_mismatch';
          return {duel:duelView(draft,duel,user)};
        }
        duel.result.confirmedBy=user.id;duel.result.confirmedAt=now();
        duel.result.confirmationEvidenceId=evidence.id;duel.result.confirmationScoreSide=data.scoreSide;
        if(!duel.result.confirmationDeadline||Date.now()>=Date.parse(duel.result.confirmationDeadline))duel.result.confirmationTimedOutAt??=now();
        const storedReport=duel.reports.find(report=>report.id===duel.result.id);
        if(storedReport)Object.assign(storedReport,duel.result);
        tryAutomaticSettlement(draft,duel);
      }else if(action==='dispute'){
        if(duel.disputes.length>=10)fail(409,'As divergências já registradas serão avaliadas pela equipe.');
        const data=await jsonBody(request),text=reason(data.reason),evidence=draft.evidence[data.evidenceId];
        if(!duel.result)fail(409,'Registre um resultado antes de sinalizar divergência.');
        if(data.reportId!==duel.result.id)fail(409,'O placar mudou. Confira a versão atual antes de sinalizar.','stale_result');
        if(!evidence||evidence.duelId!==duel.id||evidence.authorId!==user.id)fail(400,'Envie sua foto do placar antes de sinalizar divergência.');
        duel.disputes.push({id:randomUUID(),authorId:user.id,reason:text,evidenceId:evidence.id,createdAt:now()});duel.status='disputed';
      }
      return {duel:duelView(draft,duel,user)};
    }
    if(method==='POST'&&path==='/api/v1/evidence'){
      rateLimit(request,'evidence',30,60*60*1000);
      const duel=ownDuel(draft,user,url.searchParams.get('duelId'));
      if(!member(duel,user)||!['in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Este desafio não aceita novas fotos.');
      if(Object.values(draft.evidence).filter(e=>e.duelId===duel.id&&e.authorId===user.id).length>=12)fail(409,'Limite de 12 fotos por participante neste desafio.');
      const mime=String(request.headers['content-type']||'').split(';')[0];
      if(!['image/png','image/jpeg','image/webp'].includes(mime))fail(415,'Use uma foto PNG, JPG ou WebP.');
      const body=await readBody(request,MAX_IMAGE),size=dimensions(body,mime),id=randomUUID();
      if(evidenceTotal(draft)+body.length>maxEvidenceBytes)fail(507,'O armazenamento de fotos está cheio. Avise a equipe.','storage_full');
      const hash=sha(body),duplicateEvidence=Object.values(draft.evidence).some(item=>item.sha256===hash&&(item.duelId!==duel.id||item.authorId!==user.id));
      const item={id,duelId:duel.id,authorId:user.id,mime,bytes:body.length,...size,sha256:hash,duplicateEvidence,createdAt:now()};
      const evidencePath=join(dataDir,'evidence',id);
      await writeFile(evidencePath,body,{mode:0o600,flag:'wx'});stagedEvidencePaths.push(evidencePath);draft.evidence[id]=item;
      return {evidence:{id,mime,bytes:item.bytes,width:item.width,height:item.height,createdAt:item.createdAt,url:`/api/v1/evidence/${id}`}};
    }
    const evidenceMatch=/^\/api\/v1\/evidence\/([a-f0-9-]{36})$/.exec(path);
    if(method==='GET'&&evidenceMatch){
      const item=draft.evidence[evidenceMatch[1]],duel=item&&draft.duels[item.duelId];
      if(!item||!duel||(!member(duel,user)&&!reviewer(draft,user)))fail(404,'Foto não encontrada.','not_found');
      const body=await readFile(join(dataDir,'evidence',item.id));
      response.writeHead(200,{'Content-Type':item.mime,'Content-Length':body.length,'Content-Disposition':`inline; filename="placar-${item.id}${{ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[item.mime]}"`});
      response.end(body);return null;
    }
    if(method==='GET'&&path==='/api/v1/reviews'){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode revisar resultados.');
      return {duels:Object.values(draft.duels).filter(needsMatchReview).map(d=>duelView(draft,d,user))};
    }
    const issueReviewMatch=/^\/api\/v1\/reviews\/([a-f0-9-]{36})\/issues\/([a-f0-9-]{36})$/.exec(path);
    if(method==='POST'&&issueReviewMatch){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode revisar problemas.');
      const duel=draft.duels[issueReviewMatch[1]],issue=duel?.issueReports?.find(item=>item.id===issueReviewMatch[2]);
      if(!duel||!issue||!['in_progress','pending_review','disputed'].includes(duel.status)||issue.status!=='open')fail(409,'Este problema já foi resolvido ou a sala mudou.','issue_closed');
      if(member(duel,user))fail(403,'Um participante não pode julgar o próprio problema.');
      const data=await jsonBody(request);fields(data,['decision','reason','reportId']);
      if(data.reportId!==(duel.result?.id||null))fail(409,'O placar mudou. Atualize a revisão do problema.','stale_result');
      if(!['dismiss','cancel'].includes(data.decision))fail(400,'Escolha encerrar o relato ou cancelar a partida.');
      const text=reason(data.reason),date=now(),review={reviewerId:user.id,decision:data.decision,reason:text,reviewedAt:date};
      issue.status='resolved';issue.resolvedAt=date;issue.review=review;
      if(data.decision==='cancel'){
        refundDuelReserves(draft,duel,`cancel:${duel.id}`,'Problema avaliado pela equipe: reserva devolvida');
        duel.status='cancelled';duel.closedAt=date;duel.cancelledBy=user.id;duel.cancellationReason='team_review';duel.problemReview=review;duel.cancellationRequestedBy=[];
        for(const remaining of duel.issueReports)if(remaining.status==='open'){remaining.status='resolved';remaining.resolvedAt=date;remaining.review=review;}
      }
      return {duel:duelView(draft,duel,user)};
    }
    const reviewMatch=/^\/api\/v1\/reviews\/([a-f0-9-]{36})$/.exec(path);
    if(method==='POST'&&reviewMatch){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode distribuir Joga aí Coin.');
      const duel=draft.duels[reviewMatch[1]];
      if(!duel||!duel.result||!['pending_review','disputed'].includes(duel.status))fail(409,'Resultado indisponível para revisão.');
      if(member(duel,user))fail(403,'Um participante não pode julgar o próprio desafio.');
      const data=await jsonBody(request),text=reason(data.reason);
      if(data.reportId!==duel.result.id)fail(409,'O placar mudou. Revise a versão atual antes de distribuir Joga aí Coin.','stale_result');
      if(!['host','guest','draw'].includes(data.winner))fail(400,'Escolha anfitrião, convidado ou empate.');
      if(duel.fundingVersion===2&&duel.status==='pending_review'&&!duel.result.confirmedBy&&Date.parse(duel.result.confirmationDeadline)>Date.now()&&!(duel.issueReports||[]).some(issue=>issue.status==='open'))fail(409,'Aguarde a confirmação do adversário ou o fim do prazo de cinco minutos antes de revisar.','confirmation_pending');
      settleDuel(draft,duel,data.winner,{reviewerId:user.id,text});
      return {duel:duelView(draft,duel,user)};
    }
    fail(404,'Endpoint não encontrado.','not_found');
  }
  const server=createServer(async(request,response)=>{
    const stagedEvidencePaths=[];
    setSecurityHeaders(response,secureCookie);
    try{
      let url;
      try{url=new URL(request.url||'/',publicOrigin||'http://localhost');}
      catch{fail(400,'Endereço inválido.');}
      rateLimit(request,'requests',500,60*1000);
      const oauthRoute=/^\/api\/v1\/auth\/oauth\/(google|apple)\/(start|callback)$/.exec(url.pathname);
      if(oauthRoute){
        const [,provider,action]=oauthRoute;let clearOAuthCookie;
        try{
          rateLimit(request,'oauth',30,10*60*1000);
          if(action==='start'){
            if(request.method!=='GET')fail(405,'Método não permitido.');
            if(request.headers['sec-fetch-site']==='cross-site')fail(403,'Inicie o login na própria arena.','oauth_invalid_state');
            const flow=await oauth.start(provider);appendCookie(response,flow.setCookie);
            response.writeHead(303,{Location:flow.authorizationUrl});response.end();return;
          }
          let params;
          if(provider==='apple'){
            if(request.method!=='POST'||String(request.headers['content-type']||'').split(';')[0]!=='application/x-www-form-urlencoded')fail(400,'Resposta de login inválida.','oauth_invalid_response');
            params=new URLSearchParams((await readBody(request,48*1024)).toString('utf8'));
          }else{
            if(request.method!=='GET')fail(405,'Resposta de login inválida.','oauth_invalid_response');
            params=url.searchParams;
          }
          // Provider I/O runs outside the database queue. Only a verified identity can commit a session.
          const completed=await oauth.finish(provider,{params,cookieHeader:request.headers.cookie});
          clearOAuthCookie=completed.setCookie;
          await serial(async()=>{
            const draft=structuredClone(state);expireInvites(draft);
            const user=socialUser(draft,completed.identity);
            appendCookie(response,completed.setCookie);setSession(draft,user,response);
            await persist(draft);state=draft;
          });
          response.writeHead(303,{Location:'/?auth=success#arena'});response.end();
        }catch(error){
          response.removeHeader('Set-Cookie');
          if(error.setCookie||clearOAuthCookie)appendCookie(response,error.setCookie||clearOAuthCookie);
          const allowed=['oauth_unavailable','oauth_expired','oauth_invalid_state','oauth_cancelled','oauth_rejected','oauth_invalid_response','oauth_provider_unavailable','account_conflict'];
          response.writeHead(303,{Location:`/?auth_error=${allowed.includes(error.code)?error.code:'failed'}#arena`});response.end();
        }
        return;
      }
      if(request.method==='GET'&&url.pathname==='/api/v1/status'){
        response.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(serverStatus()));
        return;
      }
      const recognitionMatch=/^\/api\/v1\/duels\/([a-f0-9-]{36})\/recognize$/.exec(url.pathname);
      if(request.method==='POST'&&recognitionMatch){
        // OCR runs outside the serialized SQLite writer so wallets/auth remain responsive.
        let ownerId,evidence,duelId;
        const data=await jsonBody(request);fields(data,['evidenceId']);
        await serial(async()=>{
          const {session,user}=authenticated(state,request);mutationAllowed(request,session);requireCompleteAccount(user);ownerId=user.id;
          rateLimit(request,'recognition',6,60*1000);
          const duel=ownDuel(state,user,recognitionMatch[1]);duelId=duel.id;
          if(!member(duel,user)||!['in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Esta partida não aceita leitura de placar.');
          evidence=state.evidence[data.evidenceId];
          if(!evidence||evidence.duelId!==duel.id||evidence.authorId!==user.id)fail(404,'Envie sua foto desta partida antes de ler o placar.','not_found');
          if(evidence.width*evidence.height>2_000_000)fail(400,'Use uma foto menor para ler o placar. O envio pelo celular já ajusta o tamanho.');
        });
        const recognition=await recognizer.recognize(join(dataDir,'evidence',evidence.id));
        await serial(async()=>{
          const {session,user}=authenticated(state,request);mutationAllowed(request,session);requireCompleteAccount(user);
          if(user.id!==ownerId)fail(409,'A conta mudou. Reabra o envio do resultado.','account_changed');
          const duel=ownDuel(state,user,duelId);
          if(!member(duel,user)||!['in_progress','pending_review','disputed'].includes(duel.status))fail(409,'O estado da partida mudou. Atualize antes de enviar.');
          // Store only bounded scores/status, not OCR text or private data from the photo.
          const draft=structuredClone(state);expireInvites(draft);draft.evidence[evidence.id].recognition={...recognition,readAt:now()};
          tryAutomaticSettlement(draft,draft.duels[duelId]);
          await persist(draft);state=draft;
          response.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify({recognition}));
        });
        return;
      }
      if(url.pathname.startsWith('/api/')){
        await serial(async()=>{
          const draft=structuredClone(state),expired=expireInvites(draft);
          const result=await route(draft,request,response,url,stagedEvidencePaths);
          if(request.method!=='GET'||expired)await persist(draft);
          state=draft;
          stagedEvidencePaths.length=0;
          if(result!==null){response.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(result));}
        });
        return;
      }
      if(!['GET','HEAD'].includes(request.method))fail(405,'Método não permitido.');
      const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const asset=/^assets\/(avatars|brand|clubs|flags|kits|players|signatures|trophies)\/[a-z0-9-]+\.(png|jpg|webp|svg)$/.test(path)||/^assets\/pwa\/icons-(192|512|maskable-512|apple-180)\.png$/.test(path);
      if(!publicFiles.has(path)&&!asset)fail(404,'Página não encontrada.');
      const body=await readFile(join(ROOT,path));
      response.writeHead(200,{'Content-Type':mimeTypes[extname(path)],'Content-Length':body.length});response.end(request.method==='HEAD'?undefined:body);
    }catch(error){
      await Promise.all(stagedEvidencePaths.map(async path=>{
        try{await unlink(path);}
        catch(cleanupError){if(cleanupError.code!=='ENOENT')console.error('Fifa GO evidence cleanup failed:',cleanupError.message);}
      }));
      if(response.headersSent){response.destroy();return;}
      // Failed persistence must not install an authenticated cookie for an uncommitted session.
      response.removeHeader('Set-Cookie');
      const status=error.status||(error.code==='ENOENT'?404:500);
      if(status===500)console.error('Fifa GO request failed:',error.message);
      response.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
      response.end(JSON.stringify({error:status===500?'O servidor não conseguiu concluir o pedido.':error.message,code:error.status?error.code:'server_error'}));
    }
  });
  server.requestTimeout=30_000;server.headersTimeout=15_000;server.keepAliveTimeout=5_000;server.maxHeadersCount=100;server.maxRequestsPerSocket=100;server.maxConnections=256;
  let cleanupPromise;
  const cleanup=()=>cleanupPromise||(cleanupPromise=tail.then(async()=>{recognizer.close();storage.close();await lock.close().catch(()=>{});await unlink(lockPath).catch(()=>{});}));
  server.on('close',()=>{void cleanup();});
  return {server,dataDir,reviewerIds,async close(){await new Promise((resolveClose,reject)=>server.close(error=>error?reject(error):resolveClose()));await cleanup();}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const host=process.env.FIFABET_HOST||'127.0.0.1',port=Number(process.env.FIFABET_PORT||4174);
  if(host!=='127.0.0.1'&&host!=='localhost'&&!process.env.FIFABET_PUBLIC_ORIGIN)throw Error('Configure FIFABET_PUBLIC_ORIGIN ao abrir o servidor para outros dispositivos.');
  const arena=await createArenaServer();
  arena.server.listen(port,host,()=>{console.log(`Fifa GO com banco SQLite: ${process.env.FIFABET_PUBLIC_ORIGIN||`http://${host}:${port}`}`);console.log(`Dados privados: ${arena.dataDir}`);console.log('Pagamentos reais ainda não conectados. Configure os provedores de login social e a equipe de revisão.');});
  const stop=async()=>{await arena.close();process.exit(0);};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
