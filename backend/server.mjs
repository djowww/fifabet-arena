import {createServer} from 'node:http';
import {pipeline} from 'node:stream/promises';
import {validatePaidDepositRecovery,bankReferenceAlreadyUsed} from './deposit-recovery.mjs';
import {achievementsFor,reviewAccountDeletion} from './account-privacy.mjs';
import {generateRecoveryCodes,consumeRecoveryCode,createAccountThrottle,sessionList,revokeSessions} from './account-security.mjs';
import {assertPaymentEnvironment,pendingDepositTotals,assertRoomAdmission} from './wallet-policy.mjs';
import {normalizeDuelResult,sameDuelResult,duelResultOutcome} from './duel-economy.mjs';
import {isIP} from 'node:net';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,relative,join,extname,isAbsolute,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CLUBS} from '../clubs.mjs';
import {openArenaDatabase,normalizeNickname,cursorPage} from './database.mjs';
import {createOAuthService} from './oauth.mjs';
import {createResultRecognizer} from './result-recognition.mjs';
import {createDuelEconomics,duelEconomics,duelFunders,reservedDuelStake,OPEN_DUEL_STATUSES,RESULT_CONFIRMATION_MS,automaticSettlementCheck} from './duel-economy.mjs';
import {TERMS_VERSION,normalizeCountry,needsAccountOnboarding} from '../account-policy.mjs';
import {lifecyclePolicy,storedLifecycle,readinessState,normalizeCompatibility,normalizeGameAccount,visualHashesSimilar} from './game-policy.mjs';
import {rankingFor} from './ranking-policy.mjs';
import {createEvidenceStorage} from './evidence-storage.mjs';
import {createVisualInspector} from './visual-fingerprint.mjs';

const scrypt=promisify(scryptCallback);
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DAY=86_400_000;
const MAX_IMAGE=5*1024*1024;
const MAX_PENDING_OPERATIONS=128;
const preparedBodies=new WeakMap(),preparedAuth=new WeakMap(),preparedVisual=new WeakMap(),preflightAuthLimited=new WeakSet();
const preparedUploads=new WeakMap(),preflightImageLimited=new WeakSet();
const accountProjections=new WeakMap();
function accountProjection(snapshot,userId){
  let accounts=accountProjections.get(snapshot);
  if(!accounts){
    accounts=new Map();
    const account=id=>{if(!accounts.has(id))accounts.set(id,{duels:[],deposits:[]});return accounts.get(id);};
    for(const duel of Object.values(snapshot.duels))for(const id of new Set([duel.hostId,duel.guestId,duel.recipientId].filter(Boolean)))account(id).duels.push(duel);
    for(const deposit of Object.values(snapshot.deposits))account(deposit.userId).deposits.push(deposit);
    for(const records of accounts.values())for(const list of [records.duels,records.deposits])list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
    accountProjections.set(snapshot,accounts);
  }
  return accounts.get(userId)||{duels:[],deposits:[]};
}
function projectedReserve(snapshot,user,legacy=false){return accountProjection(snapshot,user.id).duels.filter(d=>member(d,user)&&OPEN_DUEL_STATUSES.includes(d.status)&&(d.creditMode==='legacy_demo')===legacy).reduce((sum,d)=>sum+reservedDuelStake(d,user.id),0);}
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
  if(preparedBodies.has(request)){const body=preparedBodies.get(request);if(body.length>limit)fail(413,'Arquivo ou formulário muito grande.','payload_too_large');return body;}
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
  user.transactions.unshift({id:randomUUID(),reference,amount,label,date:now(),balanceAfter:user.balance});
}
// Old demonstration credits remain a separate, nonfinancial ledger.
function duelBalanceChange(user,duel,reference,amount,label){
  if(duel.creditMode!=='legacy_demo'){
    balanceChange(user,reference,amount,label);
    const entry=user.transactions.find(item=>item.reference===reference);
    if(entry)Object.assign(entry,{publicMatchId:duel.publicMatchId,duelId:duel.id,source:reference.startsWith('reserve:')?'duel_reserve':reference.startsWith('settlement:')?duel.winner==='draw'?'duel_refund':'duel_prize':'duel_refund',stake:duel.stake,...(reference.startsWith('settlement:')?{pot:duelEconomics(duel).pot,houseFee:duel.winner==='draw'?0:duelEconomics(duel).houseFee}: {})});
    return;
  }
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
  return ['pending_review','disputed'].includes(duel.status)||duel.status==='in_progress'&&(duel.matchTimedOutAt||(duel.issueReports||[]).some(issue=>issue.status==='open'));
}
function expireInvites(state){
  const time=Date.now();let changed=false;
  for(const duel of Object.values(state.duels)){
    if(duel.status==='waiting_start'){
      const ready=readinessState(duel,time);
      if(ready.expiredBy.length){duel.readyBy=ready.readyBy;duel.readyAtBy=ready.readyAtBy;changed=true;}
    }
    if(duel.status==='in_progress'&&Date.parse(duel.matchDeadline)<=time&&!duel.matchTimedOutAt){
      duel.matchTimedOutAt=now();duel.operationalReview={reason:'match_timeout',openedAt:now()};duel.reviewDeadline=new Date(time+(duel.lifecyclePolicy?.reviewMs||DAY)).toISOString();changed=true;
    }
    if(needsMatchReview(duel)&&Date.parse(duel.reviewDeadline)<=time&&!duel.reviewOverdueAt){duel.reviewOverdueAt=now();changed=true;}
  }
  for(const duel of Object.values(state.duels))if(['invited','awaiting_funds','waiting_start'].includes(duel.status)&&Math.min(...[duel.expiresAt,duel.status==='invited'?duel.inviteDeadline:duel.preparationDeadline].map(Date.parse).filter(Number.isFinite))<=time){
    refundDuelReserves(state,duel,`expiry:${duel.id}`,'Sala expirada: reserva devolvida');
    duel.status='expired';duel.closedAt=now();changed=true;
  }
  for(const duel of Object.values(state.duels))if(duel.status==='pending_review'&&duel.result?.confirmationDeadline&&!duel.result.confirmedBy&&!duel.result.confirmationTimedOutAt&&Date.parse(duel.result.confirmationDeadline)<=time){
    duel.result.confirmationTimedOutAt=now();duel.reviewReason='confirmation_expired';changed=true;
  }
  for(const [id,session]of Object.entries(state.sessions))if(session.expiresAt<=time){delete state.sessions[id];changed=true;}
  return changed;
}
function lifecycleDue(state,time=Date.now()){
  return Object.values(state.duels).some(duel=>
    duel.status==='waiting_start'&&readinessState(duel,time).expiredBy.length>0||
    duel.status==='in_progress'&&Date.parse(duel.matchDeadline)<=time&&!duel.matchTimedOutAt||
    needsMatchReview(duel)&&Date.parse(duel.reviewDeadline)<=time&&!duel.reviewOverdueAt||
    ['invited','awaiting_funds','waiting_start'].includes(duel.status)&&[duel.expiresAt,duel.status==='invited'?duel.inviteDeadline:duel.preparationDeadline].some(value=>Date.parse(value)<=time)||
    duel.status==='pending_review'&&duel.result?.confirmationDeadline&&!duel.result.confirmedBy&&!duel.result.confirmationTimedOutAt&&Date.parse(duel.result.confirmationDeadline)<=time
  );
}
function duelView(state,duel,user){
  const result={...duel,economics:duelEconomics(duel),fundedBy:duelFunders(duel),issueReports:duel.issueReports||[],host:publicPlayer(state.users[duel.hostId]),guest:duel.guestId?publicPlayer(state.users[duel.guestId]):null,recipient:duel.recipientId?publicPlayer(state.users[duel.recipientId]):null};
  if(duel.hostId!==user.id||duel.status!=='invited')delete result.inviteToken;
  if(duel.hostId===user.id&&duel.creationOperationId)result.operationId=duel.creationOperationId;
  delete result.creationOperationId;delete result.creationOperationSignature;
  delete result.chatMessages;
  const visibleEvidence=new Set([duel.result?.evidenceId,duel.result?.confirmationEvidenceId,...(duel.reports||[]).flatMap(report=>[report.evidenceId,report.confirmationEvidenceId]),...(duel.disputes||[]).map(d=>d.evidenceId)].filter(Boolean));
  result.evidence=[...visibleEvidence].flatMap(id=>{const item=state.evidence[id];return item&&item.duelId===duel.id?[{id:item.id,authorId:item.authorId,createdAt:item.createdAt,recognition:item.recognition,duplicateEvidence:item.duplicateEvidence,visualCheck:item.visualCheck}]:[];});
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
  const visualInspector=options.visualInspector||createVisualInspector();
  const gamePolicy=lifecyclePolicy({env:options.env||process.env});
  const evidenceStorage=createEvidenceStorage({dataDir,archiveAfterMs:Number((options.env||process.env).FIFABET_ARCHIVE_AFTER_MS||30*DAY)});
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
    const walletEnvironment=assertPaymentEnvironment(state,paymentMode);
    if(!state.walletLedgerVersion){
      for(const user of Object.values(state.users)){
        user.demoBalance=user.balance;user.demoTransactions=user.transactions;
        user.balance=0;user.transactions=[];user.walletOpeningBalance=0;
      }
      for(const duel of Object.values(state.duels))duel.creditMode='legacy_demo';
      state.walletLedgerVersion=1;state.walletLedgerMigratedAt=now();
    }
    state.walletEnvironment=walletEnvironment;
    for(const duel of Object.values(state.duels))if(!duel.publicMatchId)duel.publicMatchId=uniquePublicId(state.duels,'FG','publicMatchId');
    for(const duel of Object.values(state.duels))if(OPEN_DUEL_STATUSES.includes(duel.status)&&!duel.lifecyclePolicy){
      // Existing open rooms get operational clocks; never revise a completed agreement.
      duel.lifecyclePolicy={...gamePolicy};
      if(duel.status==='invited')duel.inviteDeadline=duel.expiresAt;
      if(['waiting_start','awaiting_funds'].includes(duel.status))duel.preparationDeadline=new Date(Date.now()+gamePolicy.preparationMs).toISOString();
      if(duel.status==='in_progress')duel.matchDeadline=new Date(Date.now()+gamePolicy.matchMs).toISOString();
      if(needsMatchReview(duel))duel.reviewDeadline=new Date(Date.now()+gamePolicy.reviewMs).toISOString();
      if(duel.status==='waiting_start')duel.readyAtBy=Object.fromEntries((duel.readyBy||[]).map(id=>[id,now()]));
    }
    expireInvites(state);
    storage.save(state);
  }catch(error){
    storage?.close();await recognizer.close();await visualInspector.close();await lock.close();await unlink(lockPath);throw error;
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
  const limits=new Map(),accountThrottle=createAccountThrottle(),activeUploads=new Set(),uploadReservations=new Map(),activeDownloads=new Map();
  let downloads=0,capacityTail=Promise.resolve();
  async function reserveUpload(path,bytes){
    const previous=capacityTail;let release;capacityTail=new Promise(resolve=>{release=resolve;});
    await previous;
    try{await evidenceStorage.assertCapacity(state,{maxTotalBytes:maxEvidenceBytes,requiredBytes:bytes,reservedBytes:[...uploadReservations.values()].reduce((a,b)=>a+b,0)});activeUploads.add(path);uploadReservations.set(path,bytes);}
    finally{release();}
  }
  function freshSession(session){if(!Number.isFinite(session.createdAt)||Date.now()-session.createdAt>15*60_000)fail(403,"Entre novamente para confirmar esta operação sensível.","reauth_required");}
  async function requireRetainedDepositProof(draft,deposit){
    const item=draft.walletEvidence[deposit.evidenceId];let file;
    try{
      if(!item)throw Error('Missing proof');
      file=await evidenceStorage.openRead('walletEvidence',item.id,!!item.archivedAt);
      if(file.bytes!==item.bytes||file.bytes<=0||file.bytes>MAX_IMAGE)throw Error('Invalid proof size');
      const hash=createHash('sha256');let bytes=0;
      for await(const chunk of file.stream){bytes+=chunk.length;if(bytes>MAX_IMAGE)throw Error('Invalid proof size');hash.update(chunk);}
      if(bytes!==item.bytes||hash.digest('hex')!==item.sha256)throw Error('Invalid proof digest');
    }catch{fail(409,'O comprovante original não está disponível ou íntegro. Resolva o arquivo antes de concluir a conferência.','deposit_proof_unavailable');}
    finally{await file?.close();}
  }
  async function streamEvidence(kind,item,user,response){
    if(downloads>=16||(activeDownloads.get(user.id)||0)>=3)fail(429,"Há muitas fotos sendo abertas. Aguarde um instante.","download_busy");
    downloads++;activeDownloads.set(user.id,(activeDownloads.get(user.id)||0)+1);let file;
    try{file=await evidenceStorage.openRead(kind,item.id,!!item.archivedAt);response.writeHead(200,{"Content-Type":item.mime,"Content-Length":file.bytes,"Content-Disposition":`inline; filename="evidencia-${item.id}${{"image/png":".png","image/jpeg":".jpg","image/webp":".webp"}[item.mime]}"`});await pipeline(file.stream,response,{signal:AbortSignal.timeout(60_000)});}
    finally{try{await file?.close();}finally{downloads--;const count=(activeDownloads.get(user.id)||1)-1;if(count)activeDownloads.set(user.id,count);else activeDownloads.delete(user.id);}}
    return null;
  }
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
    if(!session||session.expiresAt<=Date.now()||!draft.users[session.userId]||draft.users[session.userId].disabledAt)fail(401,'Entre na sua conta para continuar.','unauthorized');
    return {session,user:draft.users[session.userId]};
  }
  function mutationAllowed(request,session){
    const origin=request.headers.origin;
    const expected=publicOrigin||`http://${request.headers.host}`;
    if(!origin||origin!==expected)fail(403,'Origem do pedido não permitida.','origin_rejected');
    if(session&&!safeEqual(request.headers['x-csrf-token'],session.csrfToken))fail(403,'Atualize a sessão e tente novamente.','csrf_rejected');
  }
  let preparingBodies=0;
  async function prepareMutation(request,url,stagedEvidencePaths){
    const auth=['/api/v1/auth/register','/api/v1/auth/login','/api/v1/auth/recover'].includes(url.pathname),isImage=url.pathname==='/api/v1/evidence'||/^\/api\/v1\/wallet\/deposits\/[a-f0-9-]{36}\/proof$/.test(url.pathname);
    if(auth){mutationAllowed(request);rateLimit(request,'auth',15,10*60*1000);preflightAuthLimited.add(request);}
    else{const {user,session}=authenticated(state,request);mutationAllowed(request,session);if(!['/api/v1/auth/logout','/api/v1/auth/onboarding'].includes(url.pathname))requireCompleteAccount(user);}
    if(preparingBodies>=16)fail(503,'Muitos envios em andamento. Tente novamente em instantes.','upload_busy');
    preparingBodies++;
    try{
      if(isImage){
        rateLimit(request,'evidence',30,60*60*1000);preflightImageLimited.add(request);
        const mime=String(request.headers['content-type']||'').split(';')[0];if(!['image/png','image/jpeg','image/webp'].includes(mime))fail(415,'Use uma foto PNG, JPG ou WebP.');
        const {user}=authenticated(state,request);
        if(url.pathname==='/api/v1/evidence'){
          const duel=ownDuel(state,user,url.searchParams.get('duelId'));if(!member(duel,user)||!['in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Este desafio não aceita novas fotos.');
          if(Object.values(state.evidence).filter(e=>e.duelId===duel.id&&e.authorId===user.id).length>=12)fail(409,'Limite de 12 fotos por participante neste desafio.');
        }else{
          const id=/\/deposits\/([a-f0-9-]{36})\/proof$/.exec(url.pathname)[1],deposit=ownDeposit(state,user,id);
          if(!['pending','review'].includes(deposit.status))fail(409,'Este pedido já foi encerrado.');
          if(!(['demo','pix_manual'].includes(paymentMode)&&(deposit.paymentMode||'demo')===paymentMode&&(paymentMode==='pix_manual'?deposit.method==='pix':deposit.method==='transfer')))fail(409,'Este pedido não aceita comprovante neste método ou modo.');
          depositVersion(deposit,Number(url.searchParams.get('version')));
          if(deposit.evidenceIds.length>=3)fail(409,'Este pedido já possui três comprovantes. A equipe deve revisar as imagens.');
        }
        const announced=Number(request.headers['content-length']);
        if(evidenceTotal(state)>=maxEvidenceBytes||Number.isSafeInteger(announced)&&announced>0&&evidenceTotal(state)+announced>maxEvidenceBytes)fail(507,'O armazenamento de fotos está cheio. Avise a equipe.','storage_full');
      }
      const body=await readBody(request,isImage?MAX_IMAGE:16*1024);preparedBodies.set(request,body);
      if(auth){
        const data=await jsonBody(request);
        if(url.pathname.endsWith('/register')||url.pathname.endsWith('/recover')){if(url.pathname.endsWith('/recover'))accountThrottle.check(String(data.identifier||''));const pass=password(url.pathname.endsWith('/recover')?data.newPassword:data.password),salt=randomBytes(16).toString('hex');preparedAuth.set(request,{salt,digest:(await scrypt(pass,salt,64)).toString('hex')});}
        else{const identifier=String(data.identifier??data.nickname??'').trim(),user=Object.values(state.users).find(u=>normalizeNickname(u.nickname)===normalizeNickname(identifier)||u.publicPlayerId===identifier.toUpperCase()),pass=typeof data.password==='string'&&data.password.length<=256?data.password:'';accountThrottle.check(user?.id||identifier);const salt=user?.passwordSalt||'fifabet-invalid-user-salt';preparedAuth.set(request,{userId:user?.id,salt,hash:user?.passwordHash,digest:(await scrypt(pass,salt,64)).toString('hex')});}
      }
      if(['/api/v1/auth/security/password','/api/v1/auth/security/recovery-codes'].includes(url.pathname)){
        const {user}=authenticated(state,request),data=await jsonBody(request);rateLimit(request,'security-auth',10,60_000);
        const current=String(data.currentPassword??data.password??'');if(current.length>256)fail(400,'Senha inválida.');
        const digest=(await scrypt(current,user.passwordSalt||'invalid-security-password',64)).toString('hex');
        const prepared={userId:user.id,hash:user.passwordHash,salt:user.passwordSalt,digest};
        if(url.pathname.endsWith('/password')){prepared.newSalt=randomBytes(16).toString('hex');prepared.newHash=(await scrypt(password(data.newPassword),prepared.newSalt,64)).toString('hex');}
        preparedAuth.set(request,prepared);
      }
      if(isImage){
        const mime=String(request.headers['content-type']||'').split(';')[0],size=dimensions(body,mime),id=randomUUID(),kind=url.pathname==='/api/v1/evidence'?'evidence':'walletEvidence';
        if(kind==='evidence')preparedVisual.set(request,await visualInspector.inspect(body));
        const path=evidenceStorage.storagePaths(kind,id).active;
        await reserveUpload(path,body.length);let file;
        try{file=await open(path,'wx',0o600);stagedEvidencePaths.push(path);await file.writeFile(body);}
        catch(error){if(!file){activeUploads.delete(path);uploadReservations.delete(path);}throw error;}
        finally{await file?.close();}
        preparedUploads.set(request,{id,path,size,sha256:sha(body)});
      }
    }finally{preparingBodies--;}
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
    const user={id:randomUUID(),publicPlayerId:uniquePublicId(draft.users,'FBA','publicPlayerId'),nickname:name,...passwordFields,signupVersion:1,onboardingRequired:true,clubId:null,gameAccount:null,createdAt:now(),balance:0,walletOpeningBalance:0,friends:[],transactions:[]};
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
  function evidenceTotal(draft){return evidenceStorage.usage(draft,maxEvidenceBytes).totalBytes;}
  function walletRevision(draft,user){return sha(JSON.stringify({balance:user.balance,count:user.transactions.length,first:user.transactions[0]?.id,reserved:projectedReserve(draft,user),deposits:accountProjection(draft,user.id).deposits.map(d=>[d.id,d.version,d.status])})).slice(0,24);}
  function financialHealth(draft){
    const mismatches=[];
    for(const u of Object.values(draft.users)){const expected=(u.walletOpeningBalance||0)+u.transactions.reduce((sum,t)=>sum+t.amount,0);if(!Number.isSafeInteger(expected)||expected!==u.balance||u.balance<0)mismatches.push({publicPlayerId:u.publicPlayerId,reason:'balance_ledger'});}
    return {ok:mismatches.length===0,mismatches};
  }
  function approveDeposit(draft,deposit,actorId,kind,text,bank={}){
    const owner=draft.users[deposit.userId];
    const live=deposit.paymentMode==='pix_manual';
    balanceChange(owner,`deposit:${deposit.id}`,deposit.amount,live?'Joga aí Coin liberado após confirmação manual de Pix':`[DEMO] Recarga por ${{card:'cartão',pix:'Pix',transfer:'transferência'}[deposit.method]} aprovada em simulação`);
    Object.assign(owner.transactions.find(tx=>tx.reference===`deposit:${deposit.id}`),{...(live?{realMoneyPayment:true,priceCents:deposit.priceCents}:{demo:true}),source:'deposit',depositId:deposit.id,method:deposit.method});
    deposit.status='approved';deposit.updatedAt=now();deposit.version++;
    deposit.decision={outcome:'approved',kind,actorId,reason:text,date:deposit.updatedAt,provider:live?'manual-bank-review':'fifabet-demo',...(live?bank:{})};
  }
  function accept(draft,duel,user){
    requirePendingInvite(duel);
    assertRoomAdmission(draft,user.id,{duelId:duel.id});
    if(duel.hostId===user.id)fail(409,'Este convite é seu. Compartilhe o link com seu amigo.','invite_own');
    if(duel.recipientId&&duel.recipientId!==user.id)fail(403,'Este convite foi enviado para outro jogador.','invite_wrong_recipient');
    if(duel.fundingVersion===2&&duel.stake>0&&duel.creditMode!=='coins'&&duel.creditMode!==paymentMode)fail(503,'As reservas desta sala estão indisponíveis neste modo de pagamento.','payments_unavailable');
    if(duel.fundingVersion!==1){
      duelBalanceChange(user,duel,`reserve:${duel.id}`,-duel.stake,'Joga aí Coin reservado ao entrar na sala');
      if(duel.fundingVersion===2&&duel.stake>0)duel.fundedBy.push(user.id);
    }
    duel.guestId=user.id;duel.status=duel.fundingVersion===1&&duel.stake>0?'awaiting_funds':duel.lobbyVersion===1?'waiting_start':'in_progress';duel.acceptedAt=now();duel.waitingAt=null;duel.waitingBy=null;
    if(duel.status==='in_progress')duel.startedAt=duel.acceptedAt;
    if(duel.lifecyclePolicy){Object.assign(duel,storedLifecycle(duel));if(duel.preparationDeadline)duel.expiresAt=duel.preparationDeadline;}
    for(const [one,two]of [[user.id,duel.hostId],[duel.hostId,user.id]])if(!draft.users[one].friends.includes(two))draft.users[one].friends.push(two);
    return duelView(draft,duel,user);
  }
  function settleDuel(draft,duel,winner,{reviewerId=null,text,source='team_review'}={}){
    if(duel.settlement||draft.houseTransactions?.[`fee:${duel.id}`])fail(409,'Esta partida já foi liquidada.','already_settled');
    if([1,2].includes(duel.fundingVersion)&&duel.stake>0&&![duel.hostId,duel.guestId].every(id=>duel.fundedBy.includes(id)))fail(409,'As reservas da partida estão incompletas.','funding_incomplete');
    const economics=duelEconomics(duel),date=now(),winnerId=winner==='draw'?null:(winner==='host'?duel.hostId:duel.guestId);
    duel.winner=winner;
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
      if(duel.status==='invited'&&duel.recipientId===user.id)result.push({id:'invite:'+duel.id,type:'invite',duelId:duel.id,publicMatchId:duel.publicMatchId,message:'Você recebeu um convite. Confira as regras e o valor antes de aceitar.',createdAt:duel.createdAt});
      const rivalReady=(duel.readyBy||[]).find(id=>id!==user.id&&[duel.hostId,duel.guestId].includes(id));
      if(duel.status==='waiting_start'&&rivalReady&&!duel.readyBy.includes(user.id))result.push({id:'ready:'+duel.id+':'+(duel.readyAtBy?.[rivalReady]||duel.acceptedAt),type:'ready',duelId:duel.id,publicMatchId:duel.publicMatchId,message:'Seu rival está pronto. Confirme o início da partida.',createdAt:duel.readyAtBy?.[rivalReady]||duel.acceptedAt});
      if(duel.waitingBy&&duel.waitingBy!==user.id&&duel.waitingAt&&['invited','awaiting_funds','waiting_start','in_progress'].includes(duel.status))result.push({id:`waiting:${duel.id}:${duel.waitingAt}`,type:'waiting',duelId:duel.id,publicMatchId:duel.publicMatchId,message:'Seu adversário está esperando por você na sala.',createdAt:duel.waitingAt});
      if(duel.result&&duel.result.reporterId!==user.id&&member(duel,user)&&!duel.result.confirmedBy&&duel.status==='pending_review')result.push({id:`result:${duel.result.id}`,type:'result_confirmation',duelId:duel.id,publicMatchId:duel.publicMatchId,message:duel.result.confirmationTimedOutAt?'O prazo de confirmação terminou. A equipe avaliará o resultado.':'Seu adversário enviou o placar. Envie sua foto e confirme em até cinco minutos.',createdAt:duel.result.submittedAt});
      if(duel.hostId===user.id&&duel.guestId&&duel.status==='waiting_start')result.push({id:`joined:${duel.id}`,type:'joined',duelId:duel.id,publicMatchId:duel.publicMatchId,message:'Seu adversário entrou. Preparem a partida.',createdAt:duel.acceptedAt});
      if(duel.matchTimedOutAt&&duel.status==='in_progress')result.push({id:`timeout:${duel.id}`,type:'review',duelId:duel.id,publicMatchId:duel.publicMatchId,message:'O prazo da partida terminou. Envie o resultado ou acompanhe o atendimento da equipe. Ninguém vence por ausência.',createdAt:duel.matchTimedOutAt});
    }
    return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);
  }
  const mimeTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8'};
  const publicFiles=new Set([
    'review-evidence.mjs','account-tools.mjs','review-tools.mjs','review-tools.css','account-security-ui.mjs','result-phases.mjs','app-notifications.mjs','audit-upgrade.css',
    'manifest.webmanifest','sw.js','pwa.mjs','pwa.css','offline.html',
    'index.html','legal.html','colecao.html','bootstrap.js','app.js','play.js','backend-client.mjs','account-policy.mjs','model.mjs','clubs.mjs','football-trophies.mjs','rivalry-section.mjs','admin-panel.mjs','account-art.mjs','account-views.mjs','lobby-view.mjs','ui-icons.mjs','room-ui.mjs','chat-ui.mjs','image-preparation.mjs',
    'styles.css','arena.css','shop.css','profile.css','achievements.css','rivalry.css','competitive-modes.css','practical.css','lobby.css','wizard.css','admin.css','account.css','account-pages.css','taste.css'
  ]);
  const serverStatus=()=>({available:true,mode:'shared',storage:'sqlite',schemaVersion:storage.schemaVersion,termsVersion:TERMS_VERSION,paymentMode,realMoney:paymentMode==='pix_manual',noRealMoney:paymentMode!=='pix_manual',paymentsAvailable:paymentMode==='demo'||paymentMode==='pix_manual',authProviders:oauth.status(),recognition:recognizer.status(),apiVersion:1,reviewerConfigured:reviewerIds.size>0||adminEmails.size>0});
  async function route(draft,request,response,url,stagedEvidencePaths){
    const path=url.pathname,method=request.method;
    if(method==='GET'&&path==='/api/v1/status')return serverStatus();
    if(method==='GET'&&path==='/api/v1/session'){
      const session=sessionFor(draft,request),user=session&&draft.users[session.userId];
      return user&&!user.disabledAt&&session.expiresAt>Date.now()?{user:sessionPlayer(draft,user),csrfToken:session.csrfToken}:{user:null,csrfToken:null};
    }
    if(method==='POST'&&['/api/v1/auth/register','/api/v1/auth/login','/api/v1/auth/recover'].includes(path)){
      mutationAllowed(request);if(!preflightAuthLimited.has(request))rateLimit(request,'auth',15,10*60*1000);
      const data=await jsonBody(request);
      if(path.endsWith('/recover')){
        fields(data,['identifier','recoveryCode','newPassword']);password(data.newPassword);
        const identifier=String(data.identifier||'').trim(),user=Object.values(draft.users).find(u=>normalizeNickname(u.nickname)===normalizeNickname(identifier)||u.publicPlayerId===identifier.toUpperCase()),prepared=preparedAuth.get(request);
        if(!user?.passwordHash||!prepared?.salt||!prepared?.digest||!consumeRecoveryCode(user,data.recoveryCode))fail(401,'Não foi possível recuperar com estes dados. Use um código de recuperação válido ou o login Google.','invalid_recovery');
        user.passwordSalt=prepared.salt;user.passwordHash=prepared.digest;user.passwordChangedAt=now();
        for(const [key,session]of Object.entries(draft.sessions))if(session.userId===user.id)delete draft.sessions[key];
        return setSession(draft,user,response);
      }
      if(path.endsWith('/register')){
        fields(data,['nickname','password','countryCode','acceptedTerms','termsVersion']);
        const name=nickname(data.nickname),pass=password(data.password);
        const details=accountDetails(data,'password');
        if(Object.values(draft.users).some(u=>normalizeNickname(u.nickname)===normalizeNickname(name)))fail(409,'Este apelido já está em uso.','nickname_taken');
        const prepared=preparedAuth.get(request);
        if(!prepared?.salt||!prepared?.digest)fail(409,'Reenvie o formulário de cadastro.','auth_retry');
        const {salt,digest}=prepared;
        const user=newUser(draft,name,{passwordHash:digest,passwordSalt:salt});
        Object.assign(user,details,{onboardingRequired:false});
        return setSession(draft,user,response);
      }
      const identifier=String(data.identifier??data.nickname??'').trim();
      const pass=typeof data.password==='string'&&data.password.length<=256?data.password:'';
      const user=Object.values(draft.users).find(u=>normalizeNickname(u.nickname)===normalizeNickname(identifier)||u.publicPlayerId===identifier.toUpperCase());
      const prepared=preparedAuth.get(request);
      if(!user?.passwordHash||!user.passwordSalt||prepared?.userId!==user.id||prepared?.salt!==user.passwordSalt||prepared?.hash!==user.passwordHash||!safeEqual(prepared.digest,user.passwordHash))fail(401,'ID, apelido ou senha incorretos.','invalid_credentials');
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
      return {invite:{publicMatchId:duel.publicMatchId,stake:duel.stake,fundingVersion:duel.fundingVersion||0,economics:duelEconomics(duel),creditMode:duel.creditMode,mode:duel.mode,platform:duel.platform,status:duel.status,expiresAt:duel.expiresAt,...(user?{rules:duel.rules,gameEdition:duel.gameEdition,consoleGeneration:duel.consoleGeneration,crossplay:duel.crossplay,matchRules:duel.matchRules,host:{nickname:draft.users[duel.hostId].nickname}}:{})}};
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
    if(path.startsWith('/api/v1/auth/security')){
      const current=sha(readCookie(request));
      if(method==='GET'&&path==='/api/v1/auth/security')return {sessions:sessionList(draft,user.id,current),hasPassword:!!user.passwordHash,googleLinked:verifiedEmails(draft,user).length>0,recoveryCodesRemaining:(user.recoveryCodes||[]).length,deletionRequest:user.deletionRequest||null};
      if(method!=='POST')fail(405,'Método não permitido.');
      const data=await jsonBody(request);
      if(method==='POST'&&path==='/api/v1/auth/security/revoke'){fields(data,['id','allOthers']);revokeSessions(draft,user.id,current,data);return {ok:true};}
      if(method==='POST'&&path==='/api/v1/auth/security/delete-request'){
        fields(data,['reason']);const text=reason(data.reason);
        if(!user.deletionRequest||user.deletionRequest.status==='rejected'){
          if(user.deletionRequest)(user.deletionRequestHistory||=[]).push(structuredClone(user.deletionRequest));
          user.deletionRequest={requestedAt:now(),reason:text,status:'pending_review'};
        }
        return {request:user.deletionRequest};
      }
      freshSession(session);
      const prepared=preparedAuth.get(request),verified=prepared?.userId===user.id&&prepared?.hash===user.passwordHash&&prepared?.salt===user.passwordSalt&&safeEqual(prepared.digest,user.passwordHash);
      if(path.endsWith('/recovery-codes')){fields(data,['password']);if(!user.passwordHash)fail(409,'Esta conta entra com Google. Use a recuperação da conta Google.','google_recovery');if(!verified)fail(401,'Senha atual incorreta.','invalid_credentials');return generateRecoveryCodes(user);}
      if(path.endsWith('/password')){fields(data,['currentPassword','newPassword']);if(!user.passwordHash||!verified||!prepared?.newHash)fail(401,'Senha atual incorreta.','invalid_credentials');user.passwordHash=prepared.newHash;user.passwordSalt=prepared.newSalt;user.passwordChangedAt=now();for(const [key,s]of Object.entries(draft.sessions))if(s.userId===user.id)delete draft.sessions[key];return {...setSession(draft,user,response),ok:true};}
      fail(404,'Ferramenta de segurança não encontrada.','not_found');
    }
    if(path.startsWith('/api/v1/admin/')){
      if(!admin(draft,user))fail(403,'Esta área é exclusiva para administradores autorizados.','admin_required');
      if(method==='GET'&&path==='/api/v1/admin/overview'){
        const duels=Object.values(draft.duels),deposits=Object.values(draft.deposits);
        const overview={stats:{users:Object.keys(draft.users).length,activeMatches:duels.filter(duel=>['awaiting_funds','waiting_start','in_progress','pending_review','disputed'].includes(duel.status)).length,pendingInvites:duels.filter(duel=>duel.status==='invited').length,pendingResults:duels.filter(duel=>['pending_review','disputed'].includes(duel.status)).length,pendingIssues:duels.filter(duel=>OPEN_DUEL_STATUSES.includes(duel.status)&&(duel.issueReports||[]).some(issue=>issue.status==='open')).length,pendingDeposits:deposits.filter(deposit=>deposit.status==='review'&&deposit.userId!==user.id&&(paymentMode==='pix_manual'&&deposit.paymentMode==='pix_manual'&&deposit.method==='pix'||paymentMode==='demo'&&(deposit.paymentMode||'demo')==='demo'&&deposit.method==='transfer')).length},paymentMode,paymentsAvailable:paymentMode==='demo'||paymentMode==='pix_manual',authProviders:oauth.status()};
        const usage=evidenceStorage.usage(draft,maxEvidenceBytes);
        return {...overview,storage:{...usage,warning:usage.totalBytes>=maxEvidenceBytes*0.8},financialHealth:financialHealth(draft),stats:{...overview.stats,overdueReviews:duels.filter(d=>needsMatchReview(d)&&Date.parse(d.reviewDeadline)<=Date.now()).length}};
      }
      if(method==='GET'&&path==='/api/v1/admin/users'){
        const search=(url.searchParams.get('search')||'').trim().toLocaleLowerCase('pt-BR');
        if(search.length>100)fail(400,'Use até 100 caracteres na busca.');
        const users=Object.values(draft.users).filter(candidate=>!search||[candidate.nickname,candidate.publicPlayerId,...verifiedEmails(draft,candidate)].some(value=>value.toLocaleLowerCase('pt-BR').includes(search))).sort((a,b)=>a.nickname.localeCompare(b.nickname,'pt-BR'));
        return {users:users.slice(0,50).map(candidate=>adminUser(draft,candidate)),total:users.length,limit:50};
      }
      if(method==='GET'&&path==='/api/v1/admin/deletion-requests')return {requests:Object.values(draft.users).filter(u=>u.deletionRequest?.status==='pending_review').map(u=>({user:publicPlayer(u),request:u.deletionRequest}))};
      const deletionMatch=/^\/api\/v1\/admin\/deletion-requests\/([a-f0-9-]{36})$/.exec(path);
      if(method==='POST'&&deletionMatch){freshSession(session);const data=await jsonBody(request);fields(data,['decision','reason']);const target=draft.users[deletionMatch[1]];if(!target)fail(404,'Conta não encontrada.','not_found');return {request:reviewAccountDeletion(draft,target,user,data)};}
      if(method==='GET'&&path==='/api/v1/admin/audit')return {entries:Object.values(draft.adminOperations||{}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(operation=>adminOperation(draft,operation)),limit:100};
      if(method==='POST'&&path==='/api/v1/admin/credits'){
        freshSession(session);rateLimit(request,'admin-credits',30,60*1000);
        const data=await jsonBody(request);fields(data,['userId','amount','reason','idempotencyKey']);
        const amount=integer(data.amount,1,MAX_ADMIN_CREDIT_GRANT,'Quantidade de Joga aí Coin'),text=reason(data.reason);
        if(typeof data.idempotencyKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.idempotencyKey))fail(400,'Chave da operação inválida.','invalid_idempotency_key');
        if(typeof data.userId!=='string'||!Object.hasOwn(draft.users,data.userId))fail(404,'Jogador não encontrado.','not_found');
        const target=draft.users[data.userId],key=`${user.id}:${data.idempotencyKey.toLowerCase()}`;
        if(target.disabledAt)fail(409,"Esta conta foi desativada.","account_disabled");
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
      const duels=accountProjection(draft,user.id).duels;
      const closed=duels.filter(d=>['completed','cancelled','expired'].includes(d.status));
      const compact=url.searchParams.get('compact')==='1';
      return {user:{...sessionPlayer(draft,user),demoBalance:user.demoBalance||0,legacyDemoBalance:user.demoBalance||0,friends:user.friends.map(id=>publicPlayer(draft.users[id])),transactions:compact?[]:user.transactions},duels:duels.filter(d=>!closed.includes(d)).map(d=>duelView(draft,d,user)),history:(compact?closed.slice(0,20):closed).map(d=>duelView(draft,d,user)),hasMoreHistory:compact&&closed.length>20,walletRevision:walletRevision(draft,user),achievements:achievementsFor(draft,user.id),notifications:roomNotifications(duels,user),stats:{played:closed.filter(d=>d.status==='completed').length,wins:closed.filter(d=>d.winnerId===user.id).length,reserved:reservedBalance(draft,user),legacyDemoReserved:reservedBalance(draft,user,true)},csrfToken:session.csrfToken};
    }
    if(method==='GET'&&path==='/api/v1/history'){
      const search=(url.searchParams.get('search')||'').trim().toLocaleLowerCase('pt-BR'),filter=url.searchParams.get('status')||'all';
      if(search.length>100||!['all','settled','review','cancelled'].includes(filter))fail(400,'Filtro de histórico inválido.');
      const visible=accountProjection(draft,user.id).duels.filter(d=>filter==='all'||filter==='settled'&&d.status==='completed'||filter==='review'&&['pending_review','disputed'].includes(d.status)||filter==='cancelled'&&['cancelled','expired'].includes(d.status)).filter(d=>!search||[d.publicMatchId,d.mode,...[d.hostId,d.guestId,d.recipientId].flatMap(id=>[draft.users[id]?.nickname,draft.users[id]?.publicPlayerId])].some(value=>String(value||'').toLocaleLowerCase('pt-BR').includes(search)));
      const page=cursorPage(visible,{cursor:url.searchParams.get('cursor')||undefined,limit:Number(url.searchParams.get('limit')||20)});
      return {items:page.items.map(d=>duelView(draft,d,user)),nextCursor:page.nextCursor};
    }
    const singleDuelMatch=/^\/api\/v1\/duels\/([a-f0-9-]{36})$/.exec(path);
    if(method==='GET'&&singleDuelMatch)return {duel:duelView(draft,ownDuel(draft,user,singleDuelMatch[1]),user)};
    if(method==='GET'&&path==='/api/v1/rooms'){
      const rooms=Object.values(draft.duels).filter(duel=>duel.visibility==='public'&&!duel.recipientId&&duel.hostId!==user.id&&duel.status==='invited'&&duel.fundingVersion===2).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50);
      return {rooms:rooms.map(duel=>({publicMatchId:duel.publicMatchId,host:{nickname:draft.users[duel.hostId].nickname,clubId:draft.users[duel.hostId].clubId},stake:duel.stake,creditMode:duel.creditMode,economics:duelEconomics(duel),mode:duel.mode,platform:duel.platform,gameEdition:duel.gameEdition,consoleGeneration:duel.consoleGeneration,crossplay:duel.crossplay,expiresAt:duel.expiresAt}))};
    }
    if(method==='GET'&&path==='/api/v1/leaderboard'){
      return rankingFor(draft,user.id);
    }
    if(method==='PATCH'&&path==='/api/v1/me'){
      const data=await jsonBody(request);
      // Preserve the profile contract: only these explicit public fields are writable.
      if(Object.hasOwn(data,'nickname')){const name=nickname(data.nickname);if(Object.values(draft.users).some(u=>u.id!==user.id&&normalizeNickname(u.nickname)===normalizeNickname(name)))fail(409,'Este apelido já está em uso.');user.nickname=name;}
      if(Object.hasOwn(data,'clubId')){if(data.clubId!==null&&!CLUBS.some(c=>c.id===data.clubId))fail(400,'Escolha um clube do catálogo.');user.clubId=data.clubId;}
      if(Object.hasOwn(data,'gameAccount'))user.gameAccount=data.gameAccount===null?null:normalizeGameAccount(data.gameAccount);
      return {user:sessionPlayer(draft,user)};
    }
    if(method==='GET'&&path==='/api/v1/wallet'){
      const deposits=accountProjection(draft,user.id).deposits.map(deposit=>depositView(draft,deposit,{includePaymentInfo:true,pixKey}));
      const catalog=paymentMode==='demo'?DEPOSIT_AMOUNTS:paymentMode==='pix_manual'?DEPOSIT_AMOUNTS.map(amount=>pixPackages[amount]):[];
      const paged=['cursor','depositCursor','limit'].some(key=>url.searchParams.has(key)),limit=Number(url.searchParams.get('limit')||20);
      const transactions=paged?cursorPage(user.transactions,{cursor:url.searchParams.get('cursor')||undefined,limit}):{items:user.transactions,nextCursor:null};
      const requests=paged?cursorPage(deposits,{cursor:url.searchParams.get('depositCursor')||undefined,limit}):{items:deposits,nextCursor:null};
      return {pendingDepositAmount:pendingDepositTotals(draft,user.id,paymentMode).amount,pendingDeposits:pendingDepositTotals(draft,user.id,paymentMode),balance:user.balance,reserved:reservedBalance(draft,user),transactions:transactions.items,transactionsNextCursor:transactions.nextCursor,depositsNextCursor:requests.nextCursor,revision:walletRevision(draft,user),legacyDemoBalance:user.demoBalance||0,legacyDemoReserved:reservedBalance(draft,user,true),legacyDemoTransactions:user.demoTransactions||[],deposits:requests.items,catalog,packs:paymentMode==='demo'?DEPOSIT_AMOUNTS:catalog,methods:paymentMode==='demo'?DEPOSIT_METHODS:paymentMode==='pix_manual'?['pix']:[],paymentMode,paymentsAvailable:paymentMode==='demo'||paymentMode==='pix_manual',realMoney:paymentMode==='pix_manual',noRealMoney:paymentMode!=='pix_manual'};
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
        if(!preflightImageLimited.has(request))rateLimit(request,'evidence',30,60*60*1000);
        if(deposit.evidenceIds.length>=3)fail(409,'Este pedido já possui três comprovantes. A equipe deve revisar as imagens.');
        const mime=String(request.headers['content-type']||'').split(';')[0];
        if(!['image/png','image/jpeg','image/webp'].includes(mime))fail(415,'Use uma foto PNG, JPG ou WebP.');
        const body=await readBody(request,MAX_IMAGE),size=dimensions(body,mime),id=preparedUploads.get(request).id;
        if(evidenceTotal(draft)+body.length>maxEvidenceBytes)fail(507,'O armazenamento de fotos está cheio. Avise a equipe.','storage_full');
        const item={id,depositId:deposit.id,authorId:user.id,mime,bytes:body.length,...size,sha256:sha(body),createdAt:now()};
        draft.walletEvidence[id]=item;
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
      return streamEvidence('walletEvidence',item,user,response);
    }
    if(method==='GET'&&path==='/api/v1/wallet/recoveries'){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe pode conferir recebimentos.');
      return {deposits:paymentMode==='pix_manual'?Object.values(draft.deposits).filter(d=>['cancelled','rejected'].includes(d.status)&&d.paymentMode==='pix_manual'&&d.method==='pix'&&d.userId!==user.id&&!d.recovery&&draft.walletEvidence[d.evidenceId]).map(d=>depositView(draft,d)):[]};
    }
    const recoveryMatch=/^\/api\/v1\/wallet\/recoveries\/([a-f0-9-]{36})$/.exec(path);
    if(method==='POST'&&recoveryMatch){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe pode recuperar recebimentos.');freshSession(session);
      const deposit=draft.deposits[recoveryMatch[1]];if(!deposit)fail(404,'Pedido não encontrado.','not_found');
      const data=await jsonBody(request);fields(data,['version','outcome','reason','bankReference','bankAmountCents','paidAt','refundBankReference','refundAmountCents','refundedAt']);const text=reason(data.reason),signature=sha(JSON.stringify(data));
      if(deposit.recovery?.actorId===user.id&&deposit.recovery.operationSignature===signature)return {deposit:depositView(draft,deposit),replayed:true};
      const facts=validatePaidDepositRecovery(draft,deposit,user.id,data,{paymentMode}),previousDecision=deposit.decision;
      await requireRetainedDepositProof(draft,deposit);
      if(facts.outcome==='credit')approveDeposit(draft,deposit,user.id,'paid_closed_order_recovery',text,facts);
      else{deposit.updatedAt=now();deposit.version++;}
      deposit.recovery={...facts,previousDecision,actorId:user.id,reason:text,date:now(),operationSignature:signature};
      return {deposit:depositView(draft,deposit),replayed:false};
    }
    if(method==='GET'&&path==='/api/v1/wallet/reviews'){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode revisar comprovantes.');
      return {deposits:Object.values(draft.deposits).filter(deposit=>deposit.status==='review'&&deposit.userId!==user.id&&(paymentMode==='pix_manual'&&deposit.paymentMode==='pix_manual'&&deposit.method==='pix'||paymentMode==='demo'&&(deposit.paymentMode||'demo')==='demo'&&deposit.method==='transfer')).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(deposit=>depositView(draft,deposit)),paymentMode,realMoney:paymentMode==='pix_manual'};
    }
    const walletReviewMatch=/^\/api\/v1\/wallet\/reviews\/([a-f0-9-]{36})$/.exec(path);
    if(method==='POST'&&walletReviewMatch){
      freshSession(session);
      if(!['demo','pix_manual'].includes(paymentMode))fail(503,'Recargas desativadas até configurar os pagamentos.','payments_unavailable');
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode decidir sobre comprovantes.');
      const deposit=draft.deposits[walletReviewMatch[1]];
      if(!deposit)fail(404,'Pedido de recarga não encontrado.','not_found');
      if(deposit.userId===user.id)fail(403,'Uma pessoa não pode julgar o próprio comprovante.');
      if(deposit.status!=='review'||!draft.walletEvidence[deposit.evidenceId]||!(paymentMode==='pix_manual'&&deposit.paymentMode==='pix_manual'&&deposit.method==='pix'||paymentMode==='demo'&&(deposit.paymentMode||'demo')==='demo'&&deposit.method==='transfer'))fail(409,'Este pedido não possui comprovante pendente neste modo de pagamento.');
      const data=await jsonBody(request);fields(data,['decision','reason','version','bankReference','bankAmountCents','paidAt']);depositVersion(deposit,data.version);
      const text=reason(data.reason);
      if(!['approve','reject'].includes(data.decision))fail(400,'Escolha aprovar ou rejeitar o comprovante.');
      if(data.decision==='approve'){
        await requireRetainedDepositProof(draft,deposit);
        let bank={};
        if(deposit.paymentMode==='pix_manual'){
          const bankReference=typeof data.bankReference==='string'?data.bankReference.trim().toUpperCase():'';
          if(bankReference.length<8||bankReference.length>128||!/^[-A-Z0-9._]+$/.test(bankReference))fail(400,'Informe o identificador único da transferência no extrato bancário.','invalid_bank_reference');
          if(!Number.isSafeInteger(data.bankAmountCents)||data.bankAmountCents!==deposit.priceCents)fail(400,'O valor recebido precisa corresponder ao pacote em centavos.','bank_amount_mismatch');
          const paid=Date.parse(data.paidAt);
          if(!Number.isFinite(paid)||paid>Date.now()+5*60_000||paid<Date.parse(deposit.createdAt)-DAY)fail(400,'Confira a data de recebimento da transferência.','invalid_bank_date');
          if(bankReferenceAlreadyUsed(draft,bankReference,{excludeDepositId:deposit.id}))fail(409,'Esta transferência já foi vinculada a outra recarga.','bank_reference_used');
          bank={bankReference,bankAmountCents:data.bankAmountCents,paidAt:new Date(paid).toISOString()};
        }
        approveDeposit(draft,deposit,user.id,'team_review',text,bank);
      }
      else{deposit.status='rejected';deposit.updatedAt=now();deposit.version++;deposit.decision={outcome:'rejected',kind:'team_review',actorId:user.id,reason:text,date:deposit.updatedAt,provider:deposit.paymentMode==='pix_manual'?'manual-bank-review':'fifabet-demo'};}
      return {deposit:depositView(draft,deposit),paymentMode,realMoney:paymentMode==='pix_manual'};
    }
    const playerMatch=/^\/api\/v1\/players\/(FBA-[A-F0-9]{10})$/.exec(path);
    if(method==='GET'&&playerMatch){
      const player=Object.values(draft.users).find(u=>u.publicPlayerId===playerMatch[1]);
      if(!player||player.disabledAt||needsAccountOnboarding(player))fail(404,'Jogador não encontrado. Confira o ID.','not_found');
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
      if(data.opponentPlayerId){recipient=Object.values(draft.users).find(u=>u.publicPlayerId===String(data.opponentPlayerId).trim().toUpperCase());if(!recipient||recipient.disabledAt||needsAccountOnboarding(recipient))fail(404,'ID do adversário não encontrado.');if(recipient.id===user.id)fail(400,'Escolha outro jogador.');}
      if(data.visibility!==undefined&&!['public','private'].includes(data.visibility))fail(400,'Escolha uma sala aberta na arena ou somente por convite.');
      if(recipient&&data.visibility==='public')fail(400,'Uma partida destinada a um amigo precisa ser privada.');
      const visibility=recipient?'private':data.visibility||'public';
      const rules=typeof data.rules==='string'?data.rules.trim():'';
      if(rules.length>500)fail(400,'As regras podem ter até 500 caracteres.');
      const compatibility=normalizeCompatibility(data);
      const operationSignature=operationId?sha(JSON.stringify({stake,mode:data.mode,platform:data.platform,recipientId:recipient?.id||null,rules,visibility,...compatibility})):null;
      if(operationId){
        const existing=Object.values(draft.duels).find(duel=>duel.hostId===user.id&&duel.creationOperationId===operationId);
        if(existing){
          if(existing.creationOperationSignature!==operationSignature)fail(409,'Este envio já criou uma partida com outros dados. Atualize o formulário.','operation_conflict');
          return {duel:duelView(draft,existing,user),...(existing.status==='invited'?{inviteToken:existing.inviteToken}:{})};
        }
      }
      if(Object.values(draft.duels).filter(d=>d.hostId===user.id&&d.status==='invited').length>=20)fail(409,'Conclua ou cancele convites pendentes antes de criar mais.');
      assertRoomAdmission(draft,user.id);
      const duel={id:randomUUID(),publicMatchId:uniquePublicId(draft.duels,'FG','publicMatchId'),creditMode:stake===0?'friendly':paymentMode==='unconfigured'?'coins':paymentMode,hostId:user.id,guestId:null,recipientId:recipient?.id||null,visibility,stake,fundingVersion:2,lobbyVersion:1,readyBy:[],chatMessages:[],fundedBy:[],economics:createDuelEconomics(stake),mode:data.mode,platform:data.platform,rules,status:'invited',inviteToken:token(),createdAt:now(),expiresAt:new Date(Date.now()+7*DAY).toISOString(),reports:[],disputes:[],issueReports:[],result:null,cancellationRequestedBy:[]};
      Object.assign(duel,compatibility,{lifecyclePolicy:{...gamePolicy},riskPolicyVersion:1,readyAtBy:{}});
      Object.assign(duel,storedLifecycle(duel));duel.expiresAt=duel.inviteDeadline;
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
      if(method==='GET'&&!inviteMatch[2])return {invite:{publicMatchId:duel.publicMatchId,creditMode:duel.creditMode,host:{nickname:draft.users[duel.hostId].nickname},stake:duel.stake,fundingVersion:duel.fundingVersion||0,economics:duelEconomics(duel),mode:duel.mode,platform:duel.platform,rules:duel.rules,gameEdition:duel.gameEdition,consoleGeneration:duel.consoleGeneration,crossplay:duel.crossplay,matchRules:duel.matchRules,status:duel.status,expiresAt:duel.expiresAt}};
      if(method==='POST'&&inviteMatch[2])return {duel:accept(draft,duel,user)};
    }
    const chatMatch=/^\/api\/v1\/duels\/([a-f0-9-]{36})\/chat$/.exec(path);
    if(chatMatch&&['GET','POST'].includes(method)){
      const duel=draft.duels[chatMatch[1]];
      if(!duel?.guestId||!member(duel,user))fail(404,'Conversa não encontrada.','not_found');
      const messages=duel.chatMessages??=[],closed=['completed','cancelled','expired'].includes(duel.status);
      const publicMessage=({operationId,...message})=>message;
      const envelope=selected=>({messages:selected.map(publicMessage),lastSequence:messages.at(-1)?.sequence||0,closed});
      if(method==='GET'){
        const cursor=url.searchParams.get('after')??'0';
        if(!/^\d+$/.test(cursor)||!Number.isSafeInteger(Number(cursor)))fail(400,'Sequência da conversa inválida.','invalid_chat_cursor');
        return envelope(messages.filter(message=>message.sequence>Number(cursor)));
      }
      const data=await jsonBody(request);fields(data,['operationId','text']);
      if(typeof data.operationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.operationId))fail(400,'Operação da conversa inválida.','invalid_operation_id');
      if(typeof data.text!=='string'||!data.text.trim()||data.text.length>1000||/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u.test(data.text))fail(400,'Escreva uma mensagem de até 1000 caracteres.','invalid_chat_text');
      data.text=data.text.trim();
      const operationId=data.operationId.toLowerCase(),previous=messages.find(message=>message.authorId===user.id&&message.operationId===operationId);
      if(previous){if(previous.text!==data.text)fail(409,'Esta operação já enviou outra mensagem.','idempotency_conflict');return envelope([previous]);}
      if(closed||!['waiting_start','in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Esta conversa está encerrada.','chat_closed');
      if(messages.length>=200)fail(409,'Esta conversa atingiu o limite de mensagens.','chat_full');
      rateLimit(request,`chat:${duel.id}:${user.id}`,30,60*1000);
      const message={id:randomUUID(),sequence:(messages.at(-1)?.sequence||0)+1,authorId:user.id,authorNickname:user.nickname,text:data.text,createdAt:now(),operationId};
      messages.push(message);duel.chatMessages=messages;return envelope([message]);
    }
    const duelMatch=/^\/api\/v1\/duels\/([a-f0-9-]{36})\/(accept|start|unready|fund|nudge|issue|cancel|cancel-withdraw|result|confirm|dispute)$/.exec(path);
    if(method==='POST'&&duelMatch){
      const duel=ownDuel(draft,user,duelMatch[1]);
      const action=duelMatch[2];
      if(action==='accept')return {duel:accept(draft,duel,user)};
      if(action==='start'){
        if(!duel.guestId||!member(duel,user))fail(404,'Sala não encontrada.','not_found');
        const data=await jsonBody(request);fields(data,[]);
        if(duel.status==='in_progress'&&duel.lobbyVersion===1)return {duel:duelView(draft,duel,user)};
        if(duel.status!=='waiting_start'||duel.lobbyVersion!==1)fail(409,'Esta sala não está em preparação.','start_unavailable');
        if(duel.stake>0&&![duel.hostId,duel.guestId].every(id=>duel.fundedBy.includes(id)))fail(409,'As reservas da partida estão incompletas.','funding_incomplete');
        const ready=readinessState(duel);duel.readyBy=ready.readyBy;duel.readyAtBy=ready.readyAtBy;
        if(!duel.readyBy.includes(user.id)){duel.readyBy.push(user.id);duel.readyAtBy[user.id]=now();}
        (duel.compatibilityConfirmedBy??={})[user.id]=now();
        if([duel.hostId,duel.guestId].every(id=>duel.readyBy.includes(id))){duel.status='in_progress';duel.startedAt=now();duel.waitingAt=null;duel.waitingBy=null;Object.assign(duel,storedLifecycle(duel));}
        return {duel:duelView(draft,duel,user)};
      }
      if(action==='unready'){
        if(!member(duel,user)||!duel.guestId)fail(404,'Sala não encontrada.','not_found');
        const data=await jsonBody(request);fields(data,[]);
        if(duel.status!=='waiting_start')fail(409,'A partida já iniciou ou a preparação terminou.','start_unavailable');
        duel.readyBy=(duel.readyBy||[]).filter(id=>id!==user.id);delete duel.readyAtBy?.[user.id];delete duel.compatibilityConfirmedBy?.[user.id];
        return {duel:duelView(draft,duel,user)};
      }
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
        if([duel.hostId,duel.guestId].every(id=>duel.fundedBy.includes(id))){duel.status='in_progress';duel.startedAt=now();Object.assign(duel,storedLifecycle(duel));}
        return {duel:duelView(draft,duel,user)};
      }
      if(action==='nudge'){
        if(!member(duel,user))fail(403,'Somente os participantes podem avisar que estão esperando.');
        if(!['invited','awaiting_funds','waiting_start','in_progress'].includes(duel.status))fail(409,'Esta partida não está aguardando jogadores.');
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
        else if(['awaiting_funds','waiting_start'].includes(duel.status)&&member(duel,user)){
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
        const data=await jsonBody(request),reported=normalizeDuelResult(data,duel.matchRules),{homeScore,awayScore}=reported;
        fields(data,['homeScore','awayScore','extraTime','penalties','evidenceId','scoreSide']);
        if(!['host','guest'].includes(data.scoreSide))fail(400,'Informe qual jogador aparece à esquerda da foto.','score_side_required');
        const evidence=draft.evidence[data.evidenceId];
        if(!evidence||evidence.duelId!==duel.id||evidence.authorId!==user.id)fail(400,'Envie sua foto do placar deste desafio antes de registrar o resultado.');
        if(duel.status==='pending_review'&&duel.result?.reporterId===user.id&&duel.result.evidenceId===evidence.id&&sameDuelResult(duel.result,reported)&&duel.result.scoreSide===data.scoreSide)return {duel:duelView(draft,duel,user)};
        if(duel.result&&duel.result.reporterId!==user.id&&duel.status==='pending_review')fail(409,'Já existe um placar do seu adversário. Confira o resultado e envie sua foto para confirmar.','confirmation_required');
        // A revised report cannot extend the first participant's five-minute deadline.
        const submittedAt=now(),confirmationDeadline=duel.result?.confirmationDeadline||new Date(Date.parse(submittedAt)+RESULT_CONFIRMATION_MS).toISOString();
        const result={id:randomUUID(),resultVersion:1,reporterId:user.id,...reported,scoreSide:data.scoreSide,evidenceId:evidence.id,submittedAt,confirmedBy:null,confirmationDeadline,...(duel.result?.confirmationTimedOutAt?{confirmationTimedOutAt:duel.result.confirmationTimedOutAt}:{})};
        duel.reports.push(result);duel.result=result;duel.status='pending_review';duel.reviewReason=result.confirmationTimedOutAt?'confirmation_expired':null;duel.cancellationRequestedBy=[];duel.waitingAt=null;duel.waitingBy=null;Object.assign(duel,storedLifecycle(duel));
      }else if(action==='confirm'){
        const data=await jsonBody(request);
        fields(data,['reportId','evidenceId','homeScore','awayScore','extraTime','penalties','scoreSide']);
        if(!duel.result||duel.status==='disputed')fail(409,'Aguarde um resultado atualizado antes de concordar.');
        if(data.reportId!==duel.result.id)fail(409,'O placar mudou. Confira a versão atual antes de confirmar.','stale_result');
        if(duel.result.reporterId===user.id)fail(403,'O adversário precisa confirmar o seu placar.');
        const confirmed=normalizeDuelResult(data,duel.matchRules),{homeScore,awayScore}=confirmed;
        if(!['host','guest'].includes(data.scoreSide))fail(400,'Informe qual jogador aparece à esquerda da sua foto.','score_side_required');
        const evidence=draft.evidence[data.evidenceId];
        if(!evidence||evidence.duelId!==duel.id||evidence.authorId!==user.id)fail(400,'Envie sua própria foto desta partida para confirmar o placar.','confirmation_evidence_required');
        if(duel.result.confirmedBy){
          if(duel.result.confirmedBy===user.id&&duel.result.confirmationEvidenceId===evidence.id&&sameDuelResult(duel.result,confirmed)&&duel.result.confirmationScoreSide===data.scoreSide)return {duel:duelView(draft,duel,user)};
          fail(409,'Este resultado já recebeu uma confirmação. Aguarde a avaliação.','already_confirmed');
        }
        if(!sameDuelResult(duel.result,confirmed)){
          if(duel.disputes.length>=10)fail(409,'As divergências já registradas serão avaliadas pela equipe.');
          duel.disputes.push({id:randomUUID(),authorId:user.id,reason:'Os placares informados pelos participantes são diferentes.',evidenceId:evidence.id,...confirmed,createdAt:now()});duel.status='disputed';duel.reviewReason='score_mismatch';
          return {duel:duelView(draft,duel,user)};
        }
        duel.result.confirmedBy=user.id;duel.result.confirmedAt=now();
        duel.result.confirmationEvidenceId=evidence.id;duel.result.confirmationScoreSide=data.scoreSide;duel.result.confirmedScore=confirmed;
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
      if(!preflightImageLimited.has(request))rateLimit(request,'evidence',30,60*60*1000);
      const duel=ownDuel(draft,user,url.searchParams.get('duelId'));
      if(!member(duel,user)||!['in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Este desafio não aceita novas fotos.');
      if(Object.values(draft.evidence).filter(e=>e.duelId===duel.id&&e.authorId===user.id).length>=12)fail(409,'Limite de 12 fotos por participante neste desafio.');
      const mime=String(request.headers['content-type']||'').split(';')[0];
      if(!['image/png','image/jpeg','image/webp'].includes(mime))fail(415,'Use uma foto PNG, JPG ou WebP.');
      const body=await readBody(request,MAX_IMAGE),size=dimensions(body,mime),id=preparedUploads.get(request).id;
      if(evidenceTotal(draft)+body.length>maxEvidenceBytes)fail(507,'O armazenamento de fotos está cheio. Avise a equipe.','storage_full');
      const hash=preparedUploads.get(request).sha256,duplicateEvidence=Object.values(draft.evidence).some(item=>item.sha256===hash&&(item.duelId!==duel.id||item.authorId!==user.id));
      const visual=preparedVisual.get(request)||{status:'unavailable'};
      const similar=visual.status==='checked'&&Object.values(draft.evidence).some(item=>(item.duelId!==duel.id||item.authorId!==user.id)&&visualHashesSimilar(visual.hash,item.visualHash));
      const item={id,duelId:duel.id,authorId:user.id,mime,bytes:body.length,...size,sha256:hash,duplicateEvidence,createdAt:now(),visualHash:visual.hash,visualCheck:{status:visual.status,requiresReview:visual.status!=='checked'||!!similar,similarEvidence:!!similar}};
      draft.evidence[id]=item;
      return {evidence:{id,mime,bytes:item.bytes,width:item.width,height:item.height,createdAt:item.createdAt,url:`/api/v1/evidence/${id}`}};
    }
    const evidenceMatch=/^\/api\/v1\/evidence\/([a-f0-9-]{36})$/.exec(path);
    if(method==='GET'&&evidenceMatch){
      const item=draft.evidence[evidenceMatch[1]],duel=item&&draft.duels[item.duelId];
      if(!item||!duel||(!member(duel,user)&&!reviewer(draft,user)))fail(404,'Foto não encontrada.','not_found');
      return streamEvidence('evidence',item,user,response);
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
      else if(duel.result?.confirmedBy)tryAutomaticSettlement(draft,duel);
      return {duel:duelView(draft,duel,user)};
    }
    const abandonmentMatch=/^\/api\/v1\/reviews\/([a-f0-9-]{36})\/abandon$/.exec(path);
    if(method==='POST'&&abandonmentMatch){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode resolver abandono.');
      const duel=draft.duels[abandonmentMatch[1]];
      if(!duel||!duel.matchTimedOutAt||duel.result||!['in_progress','disputed'].includes(duel.status))fail(409,'Esta sala não tem um abandono sem placar pendente.','abandonment_unavailable');
      if(member(duel,user))fail(403,'Um participante não pode julgar a própria partida.');
      const data=await jsonBody(request);fields(data,['decision','reason']);if(data.decision!=='cancel')fail(400,'Abandono sem placar permite somente cancelamento e devolução.');
      const text=reason(data.reason);refundDuelReserves(draft,duel,`cancel:${duel.id}`,'Abandono avaliado pela equipe: reserva devolvida');
      duel.status='cancelled';duel.closedAt=now();duel.cancellationReason='team_abandonment';duel.problemReview={reviewerId:user.id,decision:'cancel',reason:text,reviewedAt:duel.closedAt};
      for(const issue of duel.issueReports||[])if(issue.status==='open'){issue.status='resolved';issue.resolvedAt=duel.closedAt;issue.review=duel.problemReview;}
      return {duel:duelView(draft,duel,user)};
    }
    const reviewMatch=/^\/api\/v1\/reviews\/([a-f0-9-]{36})$/.exec(path);
    if(method==='POST'&&reviewMatch){
      if(!reviewer(draft,user))fail(403,'Apenas a equipe autorizada pode distribuir Joga aí Coin.');
      freshSession(session);
      const duel=draft.duels[reviewMatch[1]];
      if(!duel||!duel.result||!['pending_review','disputed'].includes(duel.status))fail(409,'Resultado indisponível para revisão.');
      if(member(duel,user))fail(403,'Um participante não pode julgar o próprio desafio.');
      const data=await jsonBody(request),text=reason(data.reason);
      if(data.reportId!==duel.result.id)fail(409,'O placar mudou. Revise a versão atual antes de distribuir Joga aí Coin.','stale_result');
      if(!['host','guest','draw'].includes(data.winner))fail(400,'Escolha anfitrião, convidado ou empate.');
      if(duel.fundingVersion===2&&duel.status==='pending_review'&&!duel.result.confirmedBy&&Date.parse(duel.result.confirmationDeadline)>Date.now()&&!(duel.issueReports||[]).some(issue=>issue.status==='open'))fail(409,'Aguarde a confirmação do adversário ou o fim do prazo de cinco minutos antes de revisar.','confirmation_pending');
      if(data.winner==='draw'){
        let outcome;try{outcome=duelResultOutcome(duel.result,duel.matchRules||{});}catch{fail(409,'Confira o resultado do desempate antes de registrar um empate.','tiebreak_review_required');}
        if(outcome.winner!=='draw')fail(409,'O placar informado define um vencedor; confira as fotos antes de decidir.','tiebreak_review_required');
      }
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
      if(url.pathname.startsWith('/api/')&&request.method!=='GET')await prepareMutation(request,url,stagedEvidencePaths);
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
        if(request.method==='GET'){
          if(lifecycleDue(state))await serial(async()=>{const draft=structuredClone(state);if(expireInvites(draft)){await persist(draft);state=draft;}});
          const result=await route(state,request,response,url,stagedEvidencePaths);
          if(result!==null){response.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(result));}
          return;
        }
        await serial(async()=>{
          const draft=structuredClone(state),expired=expireInvites(draft);
          const result=await route(draft,request,response,url,stagedEvidencePaths);
          if(request.method!=='GET'||expired)await persist(draft);
          state=draft;
          for(const path of stagedEvidencePaths){activeUploads.delete(path);uploadReservations.delete(path);}
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
        activeUploads.delete(path);uploadReservations.delete(path);
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
  let maintenancePromise=null,lastArchive=0,closing=false;
  async function maintain(){
    try{
      if(lifecycleDue(state))await serial(async()=>{const draft=structuredClone(state);if(expireInvites(draft)){await persist(draft);state=draft;}});
      if(Date.now()-lastArchive>60*60_000){
        lastArchive=Date.now();await serial(()=>evidenceStorage.cleanupOrphans(state,{activeUploads}));const snapshot=structuredClone(state),{moved}=await evidenceStorage.archiveClosedEvidence(snapshot);
        if(moved)await serial(async()=>{const draft=structuredClone(state);for(const name of ['evidence','walletEvidence'])for(const item of Object.values(snapshot[name]||{}))if(item.archivedAt&&draft[name][item.id])draft[name][item.id].archivedAt=item.archivedAt;await persist(draft);state=draft;});
      }
    }catch(error){console.error('Fifa GO maintenance failed:',error.message);}
  }
  const maintenanceTimer=setInterval(()=>{
    if(closing||maintenancePromise)return;
    maintenancePromise=maintain().finally(()=>{maintenancePromise=null;});
  },5000);maintenanceTimer.unref();
  let cleanupPromise;
  const cleanup=()=>{closing=true;clearInterval(maintenanceTimer);return cleanupPromise||(cleanupPromise=(async()=>{await maintenancePromise;await tail;await recognizer.close();await visualInspector.close();storage.close();await lock.close().catch(()=>{});await unlink(lockPath).catch(()=>{});})());};
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
