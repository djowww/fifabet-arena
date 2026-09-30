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

const scrypt=promisify(scryptCallback);
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DAY=86_400_000;
const MAX_IMAGE=5*1024*1024;
const MODES=['1v1','Ultimate Team','Clubes'];
const PLATFORMS=['playstation','xbox','pc','switch'];
const DEPOSIT_AMOUNTS=[100,250,500,1000];
const DEPOSIT_METHODS=['card','pix','transfer'];
const COOKIE='fifabet_session';
const token=()=>randomBytes(32).toString('base64url');
const sha=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const fail=(status,message,code='invalid_request')=>{const error=new Error(message);error.status=status;error.code=code;throw error;};
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
  if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(user.balance+amount)||user.balance+amount<0)fail(409,'Pontos insuficientes ou saldo inválido.','insufficient_balance');
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
function member(duel,user){return duel.hostId===user.id||duel.guestId===user.id;}
function expireInvites(state){
  const time=Date.now();let changed=false;
  for(const duel of Object.values(state.duels))if(duel.status==='invited'&&Date.parse(duel.expiresAt)<=time){
    duelBalanceChange(state.users[duel.hostId],duel,`expiry:${duel.id}`,duel.stake,'Convite expirado: reserva devolvida');
    duel.status='expired';duel.closedAt=now();changed=true;
  }
  for(const [id,session]of Object.entries(state.sessions))if(session.expiresAt<=time){delete state.sessions[id];changed=true;}
  return changed;
}
function duelView(state,duel,user){
  const result={...duel,host:publicPlayer(state.users[duel.hostId]),guest:duel.guestId?publicPlayer(state.users[duel.guestId]):null,recipient:duel.recipientId?publicPlayer(state.users[duel.recipientId]):null};
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
function depositView(state,deposit){
  const {idempotencyKey,...visible}=deposit;
  return {...visible,owner:publicPlayer(state.users[deposit.userId]),paymentMode:'demo',realMoney:false};
}
function fields(data,allowed){
  if(Object.keys(data).some(key=>!allowed.includes(key)))fail(400,'Use apenas os campos da simulação. Não envie número de cartão, CVV, chave Pix ou dados bancários.','unsupported_fields');
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
  if(!['demo','unconfigured'].includes(paymentMode))throw Error('Nenhum gateway real está conectado. Use FIFABET_PAYMENT_MODE=unconfigured; demo é somente para desenvolvimento local.');
  if(publicOrigin&&(new URL(publicOrigin).origin!==publicOrigin||!/^https?:\/\//.test(publicOrigin)))throw Error('FIFABET_PUBLIC_ORIGIN deve conter somente a origem, sem caminho.');
  const reviewerIds=new Set(options.reviewerIds||String(process.env.FIFABET_REVIEWER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean));
  const secureCookie=publicOrigin.startsWith('https://')||options.secureCookie===true;
  const trustProxyLoopback=options.trustProxyLoopback===true||process.env.FIFABET_TRUST_PROXY_LOOPBACK==='1';
  if(paymentMode==='demo'&&publicOrigin&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(publicOrigin))throw Error('Recargas simuladas não podem ser habilitadas em uma origem pública.');
  const oauth=await createOAuthService({publicOrigin,env:options.env||process.env});
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
  let tail=Promise.resolve();
  const serial=fn=>{const next=tail.then(fn,fn);tail=next.catch(()=>{});return next;};
  const limits=new Map();
  function rateLimitAddress(request){
    const peer=request.socket.remoteAddress,forwarded=request.headers['x-real-ip'];
    if(trustProxyLoopback&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)&&typeof forwarded==='string'&&isIP(forwarded))return forwarded;
    return peer;
  }
  function rateLimit(request,kind,max,window){
    const key=`${rateLimitAddress(request)}:${kind}`,time=Date.now();
    let bucket=limits.get(key);
    if(!bucket||time>bucket.until){bucket={count:0,until:time+window};limits.set(key,bucket);}
    if(++bucket.count>max)fail(429,'Muitas tentativas. Aguarde alguns minutos.','rate_limited');
    if(limits.size>2000)for(const [k,v]of limits)if(v.until<time)limits.delete(k);
  }
  const sessionFor=(draft,request)=>draft.sessions[sha(readCookie(request))];
  const reviewer=user=>reviewerIds.has(user.id);
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
    return {user:{...publicPlayer(user),balance:user.balance,isReviewer:reviewer(user)},csrfToken};
  }
  function appendCookie(response,value){
    const existing=response.getHeader('Set-Cookie');
    response.setHeader('Set-Cookie',[...(Array.isArray(existing)?existing:existing?[existing]:[]),value]);
  }
  function newUser(draft,name,passwordFields={}){
    if(Object.keys(draft.users).length>=10_000)fail(503,'Cadastro temporariamente indisponível.');
    const user={id:randomUUID(),publicPlayerId:uniquePublicId(draft.users,'FBA','publicPlayerId'),nickname:name,...passwordFields,clubId:null,gameAccount:null,createdAt:now(),balance:0,friends:[],transactions:[]};
    draft.users[user.id]=user;return user;
  }
  function socialUser(draft,identity){
    const key=`${identity.provider}:${identity.subject}`,existing=draft.authIdentities[key];
    if(existing){const user=draft.users[existing.userId];if(!user)fail(409,'Conta indisponível.','account_conflict');return user;}
    // Never expose a Google/Apple full name or auto-link an existing account by e-mail.
    let name;
    do{name=`Jogador_${randomBytes(4).toString('hex')}`;}while(Object.values(draft.users).some(user=>normalizeNickname(user.nickname)===normalizeNickname(name)));
    const user=newUser(draft,name);
    draft.authIdentities[key]={provider:identity.provider,subject:identity.subject,userId:user.id,email:identity.emailVerified?identity.email:null,emailVerified:identity.emailVerified,createdAt:now()};
    return user;
  }
  const pendingDuels=(draft,user)=>Object.values(draft.duels).filter(duel=>member(duel,user)&&['invited','in_progress','pending_review','disputed'].includes(duel.status));
  const reservedBalance=(draft,user,legacy=false)=>pendingDuels(draft,user).filter(duel=>(duel.creditMode==='legacy_demo')===legacy).reduce((sum,duel)=>sum+duel.stake,0);
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
    balanceChange(owner,`deposit:${deposit.id}`,deposit.amount,`[DEMO] Recarga por ${{card:'cartão',pix:'Pix',transfer:'transferência'}[deposit.method]} aprovada em simulação`);
    Object.assign(owner.transactions.find(tx=>tx.reference===`deposit:${deposit.id}`),{demo:true,source:'deposit',depositId:deposit.id,method:deposit.method});
    deposit.status='approved';deposit.updatedAt=now();deposit.version++;
    deposit.decision={outcome:'approved',kind,actorId,reason:text,date:deposit.updatedAt,provider:'fifabet-demo'};
  }
  function accept(draft,duel,user){
    requirePendingInvite(duel);
    if(duel.hostId===user.id)fail(409,'Este convite é seu. Compartilhe o link com seu amigo.','invite_own');
    if(duel.recipientId&&duel.recipientId!==user.id)fail(403,'Este convite foi enviado para outro jogador.','invite_wrong_recipient');
    duelBalanceChange(user,duel,`reserve:${duel.id}`,-duel.stake,'Pontos reservados para desafio');
    duel.guestId=user.id;duel.status='in_progress';duel.acceptedAt=now();
    for(const [one,two]of [[user.id,duel.hostId],[duel.hostId,user.id]])if(!draft.users[one].friends.includes(two))draft.users[one].friends.push(two);
    return duelView(draft,duel,user);
  }
  const mimeTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
  const publicFiles=new Set(['index.html','legacy.html','colecao.html','app.js','play.js','arena-app.js','backend-client.mjs','model.mjs','clubs.mjs','football-trophies.mjs','rivalry-section.mjs','styles.css','arena.css','shop.css','profile.css','achievements.css','rivalry.css','competitive-modes.css','practical.css','lobby.css','wizard.css','arena-app.css']);
  const serverStatus=()=>({available:true,mode:'shared',storage:'sqlite',schemaVersion:storage.schemaVersion,paymentMode,realMoney:false,noRealMoney:true,paymentsAvailable:paymentMode==='demo',authProviders:oauth.status(),apiVersion:1,reviewerConfigured:reviewerIds.size>0});
  async function route(draft,request,response,url){
    const path=url.pathname,method=request.method;
    if(method==='GET'&&path==='/api/v1/status')return serverStatus();
    if(method==='GET'&&path==='/api/v1/session'){
      const session=sessionFor(draft,request),user=session&&draft.users[session.userId];
      return user&&session.expiresAt>Date.now()?{user:{...publicPlayer(user),balance:user.balance,isReviewer:reviewer(user)},csrfToken:session.csrfToken}:{user:null,csrfToken:null};
    }
    if(method==='POST'&&['/api/v1/auth/register','/api/v1/auth/login'].includes(path)){
      mutationAllowed(request);rateLimit(request,'auth',15,10*60*1000);
      const data=await jsonBody(request);
      if(path.endsWith('/register')){
        const name=nickname(data.nickname),pass=password(data.password);
        if(Object.values(draft.users).some(u=>normalizeNickname(u.nickname)===normalizeNickname(name)))fail(409,'Este apelido já está em uso.','nickname_taken');
        const salt=randomBytes(16).toString('hex');
        const digest=(await scrypt(pass,salt,64)).toString('hex');
        const user=newUser(draft,name,{passwordHash:digest,passwordSalt:salt});
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
      const current=sessionFor(draft,request),user=current&&current.expiresAt>Date.now()&&draft.users[current.userId];
      if(user&&duel.recipientId&&duel.recipientId!==user.id&&duel.hostId!==user.id)fail(403,'Este convite foi enviado para outro jogador.','invite_wrong_recipient');
      return {invite:{publicMatchId:duel.publicMatchId,stake:duel.stake,creditMode:duel.creditMode,mode:duel.mode,platform:duel.platform,status:duel.status,expiresAt:duel.expiresAt,...(user?{rules:duel.rules,host:{nickname:draft.users[duel.hostId].nickname}}:{})}};
    }
    const {user,session}=authenticated(draft,request);
    if(method!=='GET')mutationAllowed(request,session);
    if(method==='POST')rateLimit(request,'mutation',120,60*1000);
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
      const duels=Object.values(draft.duels).filter(d=>member(d,user)||d.recipientId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      const closed=duels.filter(d=>['completed','cancelled','expired'].includes(d.status));
      return {user:{...publicPlayer(user),balance:user.balance,demoBalance:user.demoBalance||0,legacyDemoBalance:user.demoBalance||0,isReviewer:reviewer(user),friends:user.friends.map(id=>publicPlayer(draft.users[id])),transactions:user.transactions},duels:duels.filter(d=>!closed.includes(d)).map(d=>duelView(draft,d,user)),history:closed.map(d=>duelView(draft,d,user)),stats:{played:closed.filter(d=>d.status==='completed').length,wins:closed.filter(d=>d.winnerId===user.id).length,reserved:reservedBalance(draft,user),legacyDemoReserved:reservedBalance(draft,user,true)},csrfToken:session.csrfToken};
    }
    if(method==='GET'&&path==='/api/v1/leaderboard'){
      const ranked=new Map();
      for(const duel of Object.values(draft.duels)){
        if(duel.status!=='completed'||!duel.review?.approvedAt||duel.review.resultId!==duel.result?.id||!draft.users[duel.hostId]||!draft.users[duel.guestId])continue;
        const draw=duel.winner==='draw';
        if(!draw&&![duel.hostId,duel.guestId].includes(duel.winnerId))continue;
        for(const id of [duel.hostId,duel.guestId]){
          if(!ranked.has(id))ranked.set(id,{player:publicPlayer(draft.users[id]),played:0,wins:0,draws:0,losses:0});
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
      return {user:{...publicPlayer(user),balance:user.balance,isReviewer:reviewer(user)}};
    }
    if(method==='GET'&&path==='/api/v1/wallet'){
      return {balance:user.balance,reserved:reservedBalance(draft,user),transactions:user.transactions,legacyDemoBalance:user.demoBalance||0,legacyDemoReserved:reservedBalance(draft,user,true),legacyDemoTransactions:user.demoTransactions||[],deposits:Object.values(draft.deposits).filter(deposit=>deposit.userId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(deposit=>depositView(draft,deposit)),catalog:paymentMode==='demo'?DEPOSIT_AMOUNTS:[],packs:paymentMode==='demo'?DEPOSIT_AMOUNTS:[],methods:paymentMode==='demo'?DEPOSIT_METHODS:[],paymentMode,paymentsAvailable:paymentMode==='demo',realMoney:false,noRealMoney:true};
    }
    if(method==='POST'&&path==='/api/v1/wallet/deposits'){
      if(paymentMode!=='demo')fail(503,'Compra de créditos pendente: ainda precisamos conectar a conta comercial e o provedor de pagamento.','payments_unavailable');
      const data=await jsonBody(request);fields(data,['amount','method','installments','idempotencyKey']);
      if(!DEPOSIT_AMOUNTS.includes(data.amount)||!DEPOSIT_METHODS.includes(data.method))fail(400,'Escolha um pacote de créditos e um método de teste válidos.');
      const installments=integer(data.installments??1,1,6,'Número de parcelas');
      if(data.method!=='card'&&installments!==1)fail(400,'Parcelas são disponíveis apenas na simulação de cartão.');
      if(typeof data.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(data.idempotencyKey))fail(400,'Use um identificador único de operação de 16 a 100 caracteres.');
      const existing=Object.values(draft.deposits).find(deposit=>deposit.userId===user.id&&deposit.idempotencyKey===data.idempotencyKey);
      if(existing){
        if(existing.amount!==data.amount||existing.method!==data.method||existing.installments!==installments)fail(409,'Esse identificador já pertence a outro pedido.','idempotency_conflict');
        return {deposit:depositView(draft,existing)};
      }
      if(Object.values(draft.deposits).filter(deposit=>deposit.userId===user.id&&['pending','review'].includes(deposit.status)).length>=10)fail(409,'Conclua ou cancele pedidos pendentes antes de criar mais.');
      const date=now(),deposit={id:randomUUID(),userId:user.id,idempotencyKey:data.idempotencyKey,amount:data.amount,method:data.method,installments,status:'pending',version:1,createdAt:date,updatedAt:date,evidenceId:null,evidenceIds:[],decision:null};
      draft.deposits[deposit.id]=deposit;
      return {deposit:depositView(draft,deposit)};
    }
    const depositMatch=/^\/api\/v1\/wallet\/deposits\/([a-f0-9-]{36})\/(simulate|cancel|proof)$/.exec(path);
    if(method==='POST'&&depositMatch){
      const deposit=ownDeposit(draft,user,depositMatch[1]),action=depositMatch[2];
      if(paymentMode!=='demo'&&action!=='cancel')fail(503,'Recargas desativadas até a conexão do provedor de pagamento.','payments_unavailable');
      if(!['pending','review'].includes(deposit.status))fail(409,'Este pedido já foi encerrado.');
      if(action==='proof'){
        if(deposit.method!=='transfer')fail(409,'Comprovante é usado apenas na simulação de transferência.');
        depositVersion(deposit,Number(url.searchParams.get('version')));
        rateLimit(request,'evidence',30,60*60*1000);
        if(deposit.evidenceIds.length>=3)fail(409,'Este pedido já possui três comprovantes. A equipe deve revisar as imagens.');
        const mime=String(request.headers['content-type']||'').split(';')[0];
        if(!['image/png','image/jpeg','image/webp'].includes(mime))fail(415,'Use uma foto PNG, JPG ou WebP.');
        const body=await readBody(request,MAX_IMAGE),size=dimensions(body,mime),id=randomUUID();
        if(evidenceTotal(draft)+body.length>maxEvidenceBytes)fail(507,'O armazenamento de fotos está cheio. Avise a equipe.','storage_full');
        const item={id,depositId:deposit.id,authorId:user.id,mime,bytes:body.length,...size,sha256:sha(body),createdAt:now()};
        await writeFile(join(dataDir,'wallet-evidence',id),body,{mode:0o600,flag:'wx'});draft.walletEvidence[id]=item;
        deposit.evidenceId=id;deposit.evidenceIds.push(id);deposit.status='review';deposit.version++;deposit.updatedAt=now();
        return {deposit:depositView(draft,deposit),evidence:{id,mime,bytes:body.length,...size,url:`/api/v1/wallet/evidence/${id}`}};
      }
      const data=await jsonBody(request);
      if(action==='cancel'){
        fields(data,['version']);depositVersion(deposit,data.version);
        deposit.status='cancelled';deposit.version++;deposit.updatedAt=now();
        deposit.decision={outcome:'cancelled',kind:'owner',actorId:user.id,reason:'Pedido de teste cancelado pelo jogador.',date:deposit.updatedAt,provider:'fifabet-demo'};
      }else{
        fields(data,['mode','outcome','version']);depositVersion(deposit,data.version);
        if(data.mode!=='demo'||!['approved','rejected'].includes(data.outcome))fail(400,'Identifique explicitamente a simulação demonstrativa.');
        if(!['card','pix'].includes(deposit.method))fail(403,'Transferências exigem comprovante e revisão por outra conta da equipe.');
        if(data.outcome==='approved')approveDeposit(draft,deposit,user.id,'simulation','Aprovação simulada pelo jogador em ambiente de teste.');
        else{deposit.status='rejected';deposit.updatedAt=now();deposit.version++;deposit.decision={outcome:'rejected',kind:'simulation',actorId:user.id,reason:'Rejeição simulada pelo jogador em ambiente de teste.',date:deposit.updatedAt,provider:'fifabet-demo'};}
      }
      return {deposit:depositView(draft,deposit),balance:user.balance,paymentMode:'demo',realMoney:false};
    }
    const walletEvidenceMatch=/^\/api\/v1\/wallet\/evidence\/([a-f0-9-]{36})$/.exec(path);
    if(method==='GET'&&walletEvidenceMatch){
      const item=draft.walletEvidence[walletEvidenceMatch[1]],deposit=item&&draft.deposits[item.depositId];
      if(!item||!deposit||(deposit.userId!==user.id&&!reviewer(user)))fail(404,'Comprovante não encontrado.','not_found');
      const body=await readFile(join(dataDir,'wallet-evidence',item.id));
      response.writeHead(200,{'Content-Type':item.mime,'Content-Length':body.length,'Content-Disposition':`inline; filename="comprovante-demo-${item.id}${{'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[item.mime]}"`});
      response.end(body);return null;
    }
    if(method==='GET'&&path==='/api/v1/wallet/reviews'){
      if(!reviewer(user))fail(403,'Apenas a equipe autorizada pode revisar comprovantes.');
      return {deposits:Object.values(draft.deposits).filter(deposit=>deposit.method==='transfer'&&deposit.status==='review'&&deposit.userId!==user.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(deposit=>depositView(draft,deposit)),paymentMode:'demo',realMoney:false};
    }
    const walletReviewMatch=/^\/api\/v1\/wallet\/reviews\/([a-f0-9-]{36})$/.exec(path);
    if(method==='POST'&&walletReviewMatch){
      if(paymentMode!=='demo')fail(503,'Recargas desativadas até a conexão do provedor de pagamento.','payments_unavailable');
      if(!reviewer(user))fail(403,'Apenas a equipe autorizada pode decidir sobre comprovantes.');
      const deposit=draft.deposits[walletReviewMatch[1]];
      if(!deposit)fail(404,'Pedido de recarga não encontrado.','not_found');
      if(deposit.userId===user.id)fail(403,'Uma pessoa não pode julgar o próprio comprovante.');
      if(deposit.method!=='transfer'||deposit.status!=='review'||!draft.walletEvidence[deposit.evidenceId])fail(409,'Este pedido não possui comprovante pendente de revisão.');
      const data=await jsonBody(request);fields(data,['decision','reason','version']);depositVersion(deposit,data.version);
      const text=reason(data.reason);
      if(!['approve','reject'].includes(data.decision))fail(400,'Escolha aprovar ou rejeitar o comprovante de teste.');
      if(data.decision==='approve')approveDeposit(draft,deposit,user.id,'team_review',text);
      else{deposit.status='rejected';deposit.updatedAt=now();deposit.version++;deposit.decision={outcome:'rejected',kind:'team_review',actorId:user.id,reason:text,date:deposit.updatedAt,provider:'fifabet-demo'};}
      return {deposit:depositView(draft,deposit),paymentMode:'demo',realMoney:false};
    }
    const playerMatch=/^\/api\/v1\/players\/(FBA-[A-F0-9]{10})$/.exec(path);
    if(method==='GET'&&playerMatch){
      const player=Object.values(draft.users).find(u=>u.publicPlayerId===playerMatch[1]);
      if(!player)fail(404,'Jogador não encontrado. Confira o ID.','not_found');
      return {player:publicPlayer(player)};
    }
    if(method==='POST'&&path==='/api/v1/duels'){
      const data=await jsonBody(request);
      if(data.expectedHostId!==undefined&&data.expectedHostId!==user.id)fail(409,'A conta mudou. Confira quem está conectado e prepare a partida novamente.','account_changed');
      const stake=integer(data.stake,0,5000,'Quantidade de créditos');
      if(paymentMode!=='demo'&&stake!==0)fail(503,'Enquanto os pagamentos estão em configuração, crie uma partida amistosa sem créditos.','payments_unavailable');
      if(stake>0&&stake<10)fail(400,'Use zero para amistosa ou pelo menos 10 créditos de teste.');
      if(!MODES.includes(data.mode)||!PLATFORMS.includes(data.platform))fail(400,'Escolha um modo e uma plataforma válidos.');
      let operationId=null;
      if(data.operationId!==undefined){
        if(typeof data.operationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.operationId))fail(400,'Atualize o formulário antes de criar a partida.','invalid_operation_id');
        operationId=data.operationId.toLowerCase();
      }
      let recipient=null;
      if(data.opponentPlayerId){recipient=Object.values(draft.users).find(u=>u.publicPlayerId===String(data.opponentPlayerId).trim().toUpperCase());if(!recipient)fail(404,'ID do adversário não encontrado.');if(recipient.id===user.id)fail(400,'Escolha outro jogador.');}
      const rules=typeof data.rules==='string'?data.rules.trim():'';
      if(rules.length>500)fail(400,'As regras podem ter até 500 caracteres.');
      const operationSignature=operationId?sha(JSON.stringify({stake,mode:data.mode,platform:data.platform,recipientId:recipient?.id||null,rules})):null;
      if(operationId){
        const existing=Object.values(draft.duels).find(duel=>duel.hostId===user.id&&duel.creationOperationId===operationId);
        if(existing){
          if(existing.creationOperationSignature!==operationSignature)fail(409,'Este envio já criou uma partida com outros dados. Atualize o formulário.','operation_conflict');
          return {duel:duelView(draft,existing,user),...(existing.status==='invited'?{inviteToken:existing.inviteToken}:{})};
        }
      }
      if(Object.values(draft.duels).filter(d=>d.hostId===user.id&&d.status==='invited').length>=20)fail(409,'Conclua ou cancele convites pendentes antes de criar mais.');
      if(Object.values(draft.duels).filter(d=>member(d,user)&&['invited','in_progress','pending_review','disputed'].includes(d.status)).length>=50)fail(409,'Conclua desafios em andamento antes de criar mais.');
      const duel={id:randomUUID(),publicMatchId:uniquePublicId(draft.duels,'FG','publicMatchId'),creditMode:paymentMode==='demo'?'demo':'friendly',hostId:user.id,guestId:null,recipientId:recipient?.id||null,stake,mode:data.mode,platform:data.platform,rules,status:'invited',inviteToken:token(),createdAt:now(),expiresAt:new Date(Date.now()+7*DAY).toISOString(),reports:[],disputes:[],result:null,cancellationRequestedBy:[]};
      if(operationId){duel.creationOperationId=operationId;duel.creationOperationSignature=operationSignature;}
      balanceChange(user,`reserve:${duel.id}`,-stake,'Pontos reservados para desafio');
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
      if(method==='GET'&&!inviteMatch[2])return {invite:{publicMatchId:duel.publicMatchId,creditMode:duel.creditMode,host:{nickname:draft.users[duel.hostId].nickname},stake:duel.stake,mode:duel.mode,platform:duel.platform,rules:duel.rules,status:duel.status,expiresAt:duel.expiresAt}};
      if(method==='POST'&&inviteMatch[2])return {duel:accept(draft,duel,user)};
    }
    const duelMatch=/^\/api\/v1\/duels\/([a-f0-9-]{36})\/(accept|cancel|cancel-withdraw|result|confirm|dispute)$/.exec(path);
    if(method==='POST'&&duelMatch){
      const duel=ownDuel(draft,user,duelMatch[1]);
      const action=duelMatch[2];
      if(action==='accept')return {duel:accept(draft,duel,user)};
      if(action==='cancel-withdraw'){
        if(!member(duel,user))fail(403,'Somente os participantes podem responder ao cancelamento.');
        if(duel.status!=='in_progress'||!duel.cancellationRequestedBy.length)fail(409,'Não há pedido de cancelamento em andamento.');
        duel.cancellationRequestedBy=[];
        return {duel:duelView(draft,duel,user)};
      }
      if(action==='cancel'){
        if(duel.status==='invited'&&(duel.hostId===user.id||duel.recipientId===user.id)){
          const declined=duel.recipientId===user.id;
          duelBalanceChange(draft.users[duel.hostId],duel,`cancel:${duel.id}`,duel.stake,declined?'Convite recusado: reserva devolvida':'Convite cancelado: reserva devolvida');
          duel.status='cancelled';duel.closedAt=now();duel.cancelledBy=user.id;duel.cancellationReason=declined?'declined':'withdrawn';
        }
        else if(duel.status==='in_progress'&&member(duel,user)){
          if(!duel.cancellationRequestedBy.includes(user.id))duel.cancellationRequestedBy.push(user.id);
          if(duel.cancellationRequestedBy.length===2){for(const id of [duel.hostId,duel.guestId])duelBalanceChange(draft.users[id],duel,`cancel:${duel.id}`,duel.stake,'Cancelamento combinado: reserva devolvida');duel.status='cancelled';duel.closedAt=now();}
        }else fail(409,'Este desafio precisa ser resolvido pela revisão.');
        return {duel:duelView(draft,duel,user)};
      }
      if(!member(duel,user))fail(403,'Somente os participantes podem modificar o desafio.');
      if(!['in_progress','pending_review','disputed'].includes(duel.status))fail(409,'Este desafio não aceita mais resultados.');
      if(action==='result'){
        if(duel.reports.length>=20)fail(409,'A equipe precisa resolver este desafio antes de receber novos placares.');
        const data=await jsonBody(request),homeScore=integer(data.homeScore,0,99,'Placar do anfitrião'),awayScore=integer(data.awayScore,0,99,'Placar do convidado');
        const evidence=draft.evidence[data.evidenceId];
        if(!evidence||evidence.duelId!==duel.id||evidence.authorId!==user.id)fail(400,'Envie sua foto do placar deste desafio antes de registrar o resultado.');
        const result={id:randomUUID(),reporterId:user.id,homeScore,awayScore,evidenceId:evidence.id,submittedAt:now(),confirmedBy:null};
        duel.reports.push(result);duel.result=result;duel.status='pending_review';duel.cancellationRequestedBy=[];
      }else if(action==='confirm'){
        const data=await jsonBody(request);
        if(!duel.result||duel.status==='disputed')fail(409,'Aguarde um resultado atualizado antes de concordar.');
        if(data.reportId!==duel.result.id)fail(409,'O placar mudou. Confira a versão atual antes de confirmar.','stale_result');
        if(duel.result.reporterId===user.id)fail(403,'O adversário precisa confirmar o seu placar.');
        duel.result.confirmedBy=user.id;duel.result.confirmedAt=now();
        const storedReport=duel.reports.find(report=>report.id===duel.result.id);
        if(storedReport){storedReport.confirmedBy=user.id;storedReport.confirmedAt=duel.result.confirmedAt;}
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
      const item={id,duelId:duel.id,authorId:user.id,mime,bytes:body.length,...size,sha256:sha(body),createdAt:now()};
      await writeFile(join(dataDir,'evidence',id),body,{mode:0o600,flag:'wx'});draft.evidence[id]=item;
      return {evidence:{id,mime,bytes:item.bytes,width:item.width,height:item.height,createdAt:item.createdAt,url:`/api/v1/evidence/${id}`}};
    }
    const evidenceMatch=/^\/api\/v1\/evidence\/([a-f0-9-]{36})$/.exec(path);
    if(method==='GET'&&evidenceMatch){
      const item=draft.evidence[evidenceMatch[1]],duel=item&&draft.duels[item.duelId];
      if(!item||!duel||(!member(duel,user)&&!reviewer(user)))fail(404,'Foto não encontrada.','not_found');
      const body=await readFile(join(dataDir,'evidence',item.id));
      response.writeHead(200,{'Content-Type':item.mime,'Content-Length':body.length,'Content-Disposition':`inline; filename="placar-${item.id}${{ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[item.mime]}"`});
      response.end(body);return null;
    }
    if(method==='GET'&&path==='/api/v1/reviews'){
      if(!reviewer(user))fail(403,'Apenas a equipe autorizada pode revisar resultados.');
      return {duels:Object.values(draft.duels).filter(d=>['pending_review','disputed'].includes(d.status)).map(d=>duelView(draft,d,user))};
    }
    const reviewMatch=/^\/api\/v1\/reviews\/([a-f0-9-]{36})$/.exec(path);
    if(method==='POST'&&reviewMatch){
      if(!reviewer(user))fail(403,'Apenas a equipe autorizada pode distribuir pontos.');
      const duel=draft.duels[reviewMatch[1]];
      if(!duel||!duel.result||!['pending_review','disputed'].includes(duel.status))fail(409,'Resultado indisponível para revisão.');
      if(member(duel,user))fail(403,'Um participante não pode julgar o próprio desafio.');
      const data=await jsonBody(request),text=reason(data.reason);
      if(data.reportId!==duel.result.id)fail(409,'O placar mudou. Revise a versão atual antes de distribuir pontos.','stale_result');
      if(!['host','guest','draw'].includes(data.winner))fail(400,'Escolha anfitrião, convidado ou empate.');
      if(data.winner==='draw')for(const id of [duel.hostId,duel.guestId])duelBalanceChange(draft.users[id],duel,`settlement:${duel.id}`,duel.stake,'Empate aprovado: reserva devolvida');
      else{const id=data.winner==='host'?duel.hostId:duel.guestId;duelBalanceChange(draft.users[id],duel,`settlement:${duel.id}`,2*duel.stake,'Vitória aprovada pela equipe: pontos do desafio');}
      duel.winner=data.winner;duel.winnerId=data.winner==='draw'?null:(data.winner==='host'?duel.hostId:duel.guestId);
      duel.review={reviewerId:user.id,reason:text,approvedAt:now(),resultId:duel.result.id};duel.status='completed';duel.closedAt=now();
      return {duel:duelView(draft,duel,user)};
    }
    fail(404,'Endpoint não encontrado.','not_found');
  }
  const server=createServer(async(request,response)=>{
    response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('X-Frame-Options','DENY');
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
      if(url.pathname.startsWith('/api/')){
        await serial(async()=>{
          const draft=structuredClone(state),expired=expireInvites(draft);
          const result=await route(draft,request,response,url);
          if(request.method!=='GET'||expired)await persist(draft);
          state=draft;
          if(result!==null){response.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(result));}
        });
        return;
      }
      if(!['GET','HEAD'].includes(request.method))fail(405,'Método não permitido.');
      const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const asset=/^assets\/(avatars|brand|clubs|flags|kits|players|signatures|trophies)\/[a-z0-9-]+\.(png|jpg|webp|svg)$/.test(path);
      if(!publicFiles.has(path)&&!asset)fail(404,'Página não encontrada.');
      const body=await readFile(join(ROOT,path));
      response.writeHead(200,{'Content-Type':mimeTypes[extname(path)],'Content-Length':body.length});response.end(request.method==='HEAD'?undefined:body);
    }catch(error){
      if(response.headersSent){response.destroy();return;}
      // Failed persistence must not install an authenticated cookie for an uncommitted session.
      response.removeHeader('Set-Cookie');
      const status=error.status||(error.code==='ENOENT'?404:500);
      if(status===500)console.error('Fifa GO request failed:',error.message);
      response.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
      response.end(JSON.stringify({error:status===500?'O servidor não conseguiu concluir o pedido.':error.message,code:error.status?error.code:'server_error'}));
    }
  });
  server.requestTimeout=30_000;server.headersTimeout=15_000;server.keepAliveTimeout=5_000;
  let cleanupPromise;
  const cleanup=()=>cleanupPromise||(cleanupPromise=tail.then(async()=>{storage.close();await lock.close().catch(()=>{});await unlink(lockPath).catch(()=>{});}));
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
