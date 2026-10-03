import {constants} from 'node:fs';
import {mkdir,readFile,copyFile,chmod,realpath} from 'node:fs/promises';
import {resolve,relative,join,isAbsolute,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createDuelEconomics,duelEconomics,automaticSettlementCheck} from './duel-economy.mjs';
import {normalizeCountry,validTermsAcceptance,needsAccountOnboarding} from '../account-policy.mjs';

export const DATABASE_FILENAME='arena.sqlite';
export const SCHEMA_VERSION=1;
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const MAPS=['users','duels','sessions','deposits','evidence','walletEvidence','authIdentities'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const normalizeNickname=value=>String(value).normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
const invalid=message=>{throw Error(`Dados do banco inválidos: ${message}`);};
const required=(value,label)=>{if(typeof value!=='string'||!value)invalid(`${label} ausente.`);return value;};
const integer=(value,label)=>{if(!Number.isSafeInteger(value))invalid(`${label} deve ser inteiro seguro.`);return value;};
const encoded=value=>JSON.stringify(value);

export function cursorPage(items,{cursor,limit=20,max=50,key=item=>item.id}={}){
  const reject=()=>{const error=Error('Cursor de página inválido.');error.status=400;error.code='invalid_cursor';throw error;};
  if(!Number.isSafeInteger(limit)||limit<1||limit>max)reject();
  let start=0;
  if(cursor){
    if(typeof cursor!=='string'||cursor.length>1024||!/^[A-Za-z0-9_-]+$/.test(cursor))reject();
    let anchor;try{const decoded=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));if(decoded.v!==1||typeof decoded.id!=='string'||Buffer.from(JSON.stringify(decoded)).toString('base64url')!==cursor)reject();anchor=decoded.id;}catch{reject();}
    const index=items.findIndex(item=>key(item)===anchor);if(index<0)reject();start=index+1;
  }
  const selected=items.slice(start,start+limit),last=selected.at(-1);
  return {items:selected,nextCursor:start+limit<items.length&&last?Buffer.from(JSON.stringify({v:1,id:key(last)})).toString('base64url'):null};
}

function validateState(draft){
  if(!plain(draft)||draft.version!==1)invalid('versão de estado não suportada.');
  for(const name of ['users','duels','sessions','evidence'])if(!plain(draft[name]))invalid(`${name} deve ser um mapa.`);
  for(const name of ['deposits','walletEvidence','authIdentities'])if(draft[name]!==undefined&&!plain(draft[name]))invalid(`${name} deve ser um mapa.`);
  if(draft.adminOperations!==undefined&&!plain(draft.adminOperations))invalid('operações administrativas devem ser um mapa.');
  if(draft.houseTransactions!==undefined&&!plain(draft.houseTransactions))invalid('lançamentos da casa devem ser um mapa.');
  const transactionIds=new Set();
  for(const [id,user] of Object.entries(draft.users)){
    if(!plain(user)||user.id!==id)invalid('ID de usuário inconsistente.');
    required(id,'ID do usuário');required(user.publicPlayerId,'ID público do usuário');required(user.nickname,'apelido');
    if(!normalizeNickname(user.nickname))invalid('apelido normalizado vazio.');
    if(user.signupVersion!==undefined&&user.signupVersion!==1)invalid('versão de cadastro não suportada.');
    if(user.onboardingRequired!==undefined&&typeof user.onboardingRequired!=='boolean')invalid('estado de conclusão do cadastro inválido.');
    if(user.onboardingRequired!==undefined&&user.signupVersion!==1)invalid('estado de conclusão exige versão de cadastro.');
    if(user.countryCode!==undefined&&normalizeCountry(user.countryCode)!==user.countryCode)invalid('país de residência inválido.');
    if(user.termsAcceptance!==undefined&&!validTermsAcceptance(user.termsAcceptance))invalid('registro de aceite dos termos inválido.');
    if(!Array.isArray(user.transactions))invalid('transações do usuário ausentes.');
    if(user.signupVersion===1){
      if(typeof user.onboardingRequired!=='boolean')invalid('novo cadastro exige estado de conclusão.');
      if(user.onboardingRequired===false&&needsAccountOnboarding(user))invalid('cadastro concluído exige país e aceite dos termos.');
      if(user.onboardingRequired&&(user.passwordHash!=null||user.passwordSalt!=null||user.balance!==0||user.transactions.length||!Array.isArray(user.friends)||user.friends.length))invalid('cadastro pendente não pode ter senha, créditos ou amizades.');
    }
    if(user.passwordHash!=null&&typeof user.passwordHash!=='string')invalid('hash de senha inválido.');
    if(user.passwordSalt!=null&&typeof user.passwordSalt!=='string')invalid('salt de senha inválido.');
    if(user.balance!==undefined){
      integer(user.balance,'saldo');if(user.balance<0)invalid('saldo negativo.');
      integer(user.walletOpeningBalance,'saldo de abertura');
      let reconciled=user.walletOpeningBalance;for(const tx of user.transactions){integer(tx.amount,'lançamento');reconciled+=tx.amount;if(!Number.isSafeInteger(reconciled))invalid('extrato excede inteiro seguro.');}
      if(reconciled!==user.balance)invalid('saldo não corresponde à abertura e ao extrato.');
    }
    for(const transaction of user.transactions){
      if(!plain(transaction))invalid('transação inválida.');
      required(transaction.id,'ID da transação');required(transaction.reference,'referência da transação');integer(transaction.amount,'valor da transação');
      if(transactionIds.has(transaction.id))invalid('ID de transação duplicado.');transactionIds.add(transaction.id);
    }
  }
  for(const [id,duel] of Object.entries(draft.duels)){
    if(!plain(duel)||duel.id!==id)invalid('ID de desafio inconsistente.');
    required(id,'ID do desafio');required(duel.hostId,'anfitrião');required(duel.inviteToken,'token do convite');
    if([duel.hostId,duel.guestId,duel.recipientId].some(userId=>userId&&needsAccountOnboarding(draft.users[userId])))invalid('partida contém jogador com cadastro pendente.');
    if(duel.publicMatchId!=null&&!/^FG-[A-F0-9]{10}$/.test(duel.publicMatchId))invalid('código público de partida inválido.');
    if(duel.fundingVersion!==undefined&&![1,2].includes(duel.fundingVersion))invalid('versão de reserva da partida não suportada.');
    if(duel.lobbyVersion!==undefined){
      if(duel.lobbyVersion!==1||!Array.isArray(duel.readyBy)||new Set(duel.readyBy).size!==duel.readyBy.length||duel.readyBy.some(id=>![duel.hostId,duel.guestId].includes(id)))invalid('prontidão da sala inválida.');
      if(duel.status==='waiting_start'&&(!duel.guestId||duel.startedAt||duel.readyBy.length>1))invalid('preparação da sala inválida.');
      if(['in_progress','pending_review','disputed','completed'].includes(duel.status)&&(!duel.startedAt||![duel.hostId,duel.guestId].every(id=>duel.readyBy.includes(id))))invalid('partida iniciada sem confirmação dos participantes.');
    }else if(duel.status==='waiting_start')invalid('preparação exige versão da sala.');
    if(duel.chatMessages!==undefined){
      if(!Array.isArray(duel.chatMessages)||duel.chatMessages.length>200)invalid('conversa da sala inválida.');
      const operations=new Set(),ids=new Set();
      for(const [index,message] of duel.chatMessages.entries()){
        if(!plain(message)||message.sequence!==index+1||!duel.guestId||![duel.hostId,duel.guestId].includes(message.authorId)||typeof message.text!=='string'||!message.text.trim()||message.text.length>1000||/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u.test(message.text))invalid('mensagem da sala inválida.');
        required(message.id,'ID da mensagem');required(message.authorNickname,'autor da mensagem');required(message.createdAt,'data da mensagem');required(message.operationId,'operação da mensagem');
        const operation=`${message.authorId}:${message.operationId}`;if(operations.has(operation)||ids.has(message.id))invalid('mensagem duplicada.');operations.add(operation);ids.add(message.id);
      }
    }
    if(duel.visibility!==undefined&&(!['public','private'].includes(duel.visibility)||duel.visibility==='public'&&duel.recipientId))invalid('visibilidade da sala inválida.');
    if([1,2].includes(duel.fundingVersion)||duel.economics!==undefined||duel.settlement!==undefined){
      const stake=integer(duel.stake,'valor combinado da partida');
      if(stake<0||stake>5000)invalid('valor combinado da partida fora do intervalo.');
      const expected=createDuelEconomics(stake,[1,2].includes(duel.fundingVersion)?900:0);
      if(duel.economics!==undefined&&(!plain(duel.economics)||Object.entries(expected).some(([key,value])=>duel.economics[key]!==value)))invalid('condições financeiras da partida inconsistentes.');
      if([1,2].includes(duel.fundingVersion)){
        if(!plain(duel.economics)||!Array.isArray(duel.fundedBy)||new Set(duel.fundedBy).size!==duel.fundedBy.length||duel.fundedBy.length>2)invalid('reservas da sala inválidas.');
        if(!['demo','pix_manual','friendly','coins'].includes(duel.creditMode)||duel.creditMode==='friendly'&&stake!==0)invalid('modo de crédito da sala inválido.');
        if(!['invited','awaiting_funds','waiting_start','in_progress','pending_review','disputed','completed','cancelled','expired'].includes(duel.status))invalid('estado da sala inválido.');
        if(duel.guestId===duel.hostId)invalid('participantes da sala precisam ser diferentes.');
        if(duel.fundedBy.some(userId=>![duel.hostId,duel.guestId].includes(userId)||!draft.users[userId]))invalid('reserva pertence a quem não participa da sala.');
        if(stake===0&&duel.fundedBy.length||duel.fundingVersion===1&&duel.status==='invited'&&duel.fundedBy.length)invalid('sala sem reserva contém lançamento de participante.');
        if(duel.fundingVersion===2&&stake>0&&duel.status==='invited'&&(duel.fundedBy.length!==1||duel.fundedBy[0]!==duel.hostId))invalid('sala pública exige a reserva prévia do anfitrião.');
        if(duel.status==='awaiting_funds'&&(!duel.guestId||stake===0||duel.fundedBy.length===2))invalid('sala aguardando créditos em estado inconsistente.');
        if(['waiting_start','in_progress','pending_review','disputed','completed'].includes(duel.status)&&(!duel.guestId||stake>0&&![duel.hostId,duel.guestId].every(userId=>duel.fundedBy.includes(userId))))invalid('partida iniciada sem os participantes e suas reservas.');
        for(const userId of duel.fundedBy){
          const transactions=draft.users[userId].transactions;
          if(!transactions.some(entry=>entry.reference===`reserve:${id}`&&entry.amount===-stake))invalid('lançamento da reserva não encontrado na carteira.');
          if(['cancelled','expired'].includes(duel.status)){
            const reference=`${duel.status==='expired'?'expiry':'cancel'}:${id}`;
            if(!transactions.some(entry=>entry.reference===reference&&entry.amount===stake))invalid('devolução da reserva não encontrada na carteira.');
          }
        }
        if(duel.status==='completed'&&!duel.settlement)invalid('partida concluída sem liquidação registrada.');
      }
      if(duel.settlement!==undefined){
        const settlement=duel.settlement,economics=duelEconomics(duel),draw=duel.winner==='draw';
        if(!plain(settlement)||duel.status!=='completed'||!['host','guest','draw'].includes(duel.winner))invalid('liquidação em estado inválido.');
        required(settlement.date,'data da liquidação');
        const winnerId=draw?null:(duel.winner==='host'?duel.hostId:duel.guestId),fee=draw?0:economics.houseFee,prize=draw?economics.pot:economics.winnerPayout;
        if(settlement.pot!==economics.pot||settlement.fee!==fee||settlement.prize!==prize||fee+prize!==economics.pot||settlement.winner!==duel.winner||settlement.winnerId!==winnerId||duel.winnerId!==winnerId)invalid('valores da liquidação inconsistentes.');
        if(!duel.review?.approvedAt||duel.review.resultId!==duel.result?.id)invalid('liquidação exige revisão do resultado atual.');
        if(duel.review.source==='bilateral_verified'){
          const checked=automaticSettlementCheck(draft,{...duel,status:'pending_review'},Date.parse(duel.result.confirmedAt));
          if(duel.review.reviewerId!==null||!checked.eligible||checked.winner!==duel.winner)invalid('liquidação automática exige duas fotos distintas verificadas e confirmação bilateral dentro do prazo.');
        }
        for(const userId of draw?[duel.hostId,duel.guestId]:[winnerId]){
          const user=draft.users[userId],amount=draw?stake:prize,transactions=duel.creditMode==='legacy_demo'?user?.demoTransactions:user?.transactions;
          if(amount>0&&!transactions?.some(entry=>entry.reference===`settlement:${id}`&&entry.amount===amount))invalid('crédito da liquidação não encontrado na carteira.');
        }
        if(fee>0){
          const entry=draft.houseTransactions?.[`fee:${id}`];
          if(!entry||entry.amount!==fee||entry.duelId!==id)invalid('taxa da casa não registrada.');
        }else if(draft.houseTransactions?.[`fee:${id}`])invalid('partida sem taxa contém lançamento da casa.');
      }
    }
    if(duel.issueReports!==undefined){
      if(!Array.isArray(duel.issueReports)||duel.issueReports.length>10)invalid('relatos de problema da sala inválidos.');
      for(const issue of duel.issueReports){
        if(!plain(issue)||![duel.hostId,duel.guestId].includes(issue.authorId)||!['open','resolved'].includes(issue.status)||typeof issue.reason!=='string'||issue.reason.length<10||issue.reason.length>1000)invalid('relato de problema inválido.');
        required(issue.id,'ID do relato');required(issue.createdAt,'data do relato');
        if(issue.status==='resolved')required(issue.resolvedAt,'data da resolução');
      }
    }
  }
  for(const [reference,entry] of Object.entries(draft.houseTransactions||{})){
    if(!plain(entry)||entry.reference!==reference||reference!==`fee:${entry.duelId}`||entry.source!=='duel_fee')invalid('referência da taxa da casa inválida.');
    required(entry.id,'ID da taxa');required(entry.date,'data da taxa');
    const amount=integer(entry.amount,'taxa da casa'),duel=draft.duels[entry.duelId];
    if(amount<=0||!duel?.settlement||duel.status!=='completed'||duel.winner==='draw'||duel.settlement.fee!==amount||duel.settlement.date!==entry.date||duel.creditMode!==entry.creditMode||duel.review?.reviewerId!==entry.reviewerId)invalid('taxa da casa sem liquidação correspondente.');
  }
  for(const [id,session] of Object.entries(draft.sessions)){
    required(id,'hash da sessão');if(!plain(session))invalid('sessão inválida.');
    required(session.userId,'usuário da sessão');integer(session.expiresAt,'prazo da sessão');
  }
  const bankReferences=new Set();
  for(const [id,deposit] of Object.entries(draft.deposits||{})){
    if(!plain(deposit)||deposit.id!==id)invalid('ID de depósito inconsistente.');
    required(id,'ID do depósito');required(deposit.userId,'usuário do depósito');
    if(deposit.idempotencyKey!=null)required(deposit.idempotencyKey,'chave do depósito');
    if(deposit.status==='approved'){
      const ledger=deposit.legacyDepositLedger==='demo'?draft.users[deposit.userId]?.demoTransactions:draft.users[deposit.userId]?.transactions;
      if(deposit.legacyDepositLedger!==undefined&&(deposit.legacyDepositLedger!=='demo'||(deposit.paymentMode||'demo')!=='demo'))invalid('livro do depósito histórico inválido.');
      const credit=ledger?.find(tx=>tx.reference===`deposit:${id}`);
      if(!credit||credit.amount!==deposit.amount||!Number.isSafeInteger(deposit.amount)||deposit.amount<=0)invalid('depósito aprovado sem lançamento correspondente.');
      if(deposit.paymentMode==='pix_manual'&&!deposit.legacyBankApproval){
        const decision=deposit.decision;
        if(!plain(decision)||typeof decision.bankReference!=='string'||!decision.bankReference.trim()||decision.bankReference.length>128||/[\u0000-\u001F\u007F]/u.test(decision.bankReference)||!Number.isSafeInteger(deposit.priceCents)||deposit.priceCents<1||decision.bankAmountCents!==deposit.priceCents||typeof decision.paidAt!=='string'||!Number.isFinite(Date.parse(decision.paidAt))||Date.parse(decision.paidAt)>Date.now()+300000)invalid('aprovação Pix exige referência bancária, valor e data válidos.');
        const reference=decision.bankReference.trim().toUpperCase();if(bankReferences.has(reference))invalid('referência bancária repetida.');bankReferences.add(reference);
      }
    }
  }
  for(const name of ['evidence','walletEvidence'])for(const [id,item] of Object.entries(draft[name]||{})){
    if(!plain(item)||item.id!==id)invalid('ID de evidência inconsistente.');
    required(id,'ID da evidência');required(item.authorId,'autor da evidência');integer(item.bytes,'tamanho da evidência');
    required(name==='evidence'?item.duelId:item.depositId,'referência da evidência');
  }
  for(const [key,identity] of Object.entries(draft.authIdentities||{})){
    if(!plain(identity)||!['google','apple'].includes(identity.provider))invalid('provedor de identidade inválido.');
    required(identity.subject,'subject da identidade');required(identity.userId,'usuário da identidade');
    if(key!==`${identity.provider}:${identity.subject}`)invalid('chave de identidade inconsistente.');
  }
  for(const [key,operation] of Object.entries(draft.adminOperations||{})){
    if(!plain(operation)||operation.type!=='credit_grant')invalid('operação administrativa inválida.');
    required(operation.id,'ID da operação administrativa');required(operation.createdAt,'data da operação administrativa');
    if(!draft.users[operation.actorId]||!draft.users[operation.userId])invalid('usuários da operação administrativa ausentes.');
    if(!key.startsWith(`${operation.actorId}:`)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key.slice(operation.actorId.length+1)))invalid('chave da operação administrativa inválida.');
    const amount=integer(operation.amount,'quantidade administrativa'),before=integer(operation.balanceBefore,'saldo anterior'),after=integer(operation.balanceAfter,'saldo posterior');
    if(amount<1||amount>100_000||before<0||after!==before+amount)invalid('saldos administrativos inconsistentes.');
    if(typeof operation.reason!=='string'||operation.reason.length<10||operation.reason.length>1000)invalid('motivo administrativo inválido.');
    const entry=draft.users[operation.userId].transactions.find(transaction=>transaction.reference===`admin:${operation.id}`);
    if(!entry||entry.amount!==amount||entry.adminOperationId!==operation.id||entry.source!=='admin_adjustment')invalid('lançamento administrativo ausente no extrato.');
  }
}

const SCHEMA=`
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK(json_valid(value_json))
) STRICT;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  public_player_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  nickname_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  data_json TEXT NOT NULL CHECK(json_valid(data_json))
) STRICT;
CREATE TABLE IF NOT EXISTS duels (
  id TEXT PRIMARY KEY,
  public_match_id TEXT UNIQUE CHECK(public_match_id IS NULL OR (length(public_match_id)=13 AND substr(public_match_id,1,3)='FG-' AND substr(public_match_id,4) NOT GLOB '*[^0-9A-F]*')),
  invite_token TEXT NOT NULL UNIQUE,
  host_id TEXT NOT NULL REFERENCES users(id),
  guest_id TEXT REFERENCES users(id),
  recipient_id TEXT REFERENCES users(id),
  data_json TEXT NOT NULL CHECK(json_valid(data_json))
) STRICT;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json))
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  idempotency_key TEXT,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  UNIQUE(user_id,idempotency_key)
) STRICT;
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  reference TEXT NOT NULL,
  amount INTEGER NOT NULL,
  position INTEGER NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  UNIQUE(user_id,reference)
) STRICT;
CREATE INDEX IF NOT EXISTS transactions_user ON transactions(user_id,position);
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  duel_id TEXT NOT NULL REFERENCES duels(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  bytes INTEGER NOT NULL CHECK(bytes>=0),
  data_json TEXT NOT NULL CHECK(json_valid(data_json))
) STRICT;
CREATE TABLE IF NOT EXISTS wallet_evidence (
  id TEXT PRIMARY KEY,
  deposit_id TEXT NOT NULL REFERENCES deposits(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  bytes INTEGER NOT NULL CHECK(bytes>=0),
  data_json TEXT NOT NULL CHECK(json_valid(data_json))
) STRICT;
CREATE TABLE IF NOT EXISTS auth_identities (
  provider TEXT NOT NULL CHECK(provider IN ('google','apple')),
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  PRIMARY KEY(provider,subject)
) STRICT;
CREATE INDEX IF NOT EXISTS auth_identities_user ON auth_identities(user_id);
`;

/** Opens private SQLite storage. The existing request queue remains the sole state writer. */
export async function openArenaDatabase(dataDir){
  if(Number(process.versions.node.split('.')[0])<24)throw Error('O banco da arena exige Node.js 24 ou superior.');
  const {DatabaseSync}=await import('node:sqlite');
  const directory=resolve(dataDir);
  await mkdir(directory,{recursive:true,mode:0o700});
  const [actualRoot,actualDirectory]=await Promise.all([realpath(ROOT),realpath(directory)]);
  const rootRelative=relative(actualRoot,actualDirectory);
  if(rootRelative===''||(!rootRelative.startsWith(`..${sep}`)&&rootRelative!=='..'&&!isAbsolute(rootRelative)))throw Error('O banco da arena deve ficar fora da pasta publicada do site.');
  const path=join(directory,DATABASE_FILENAME);
  const db=new DatabaseSync(path,{enableForeignKeyConstraints:true,timeout:5000});
  let closed=false;
  try{
    await chmod(path,0o600);
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    const version=db.prepare('PRAGMA user_version').get().user_version;
    if(version!==0&&version!==SCHEMA_VERSION)throw Error('Versão do banco não suportada; use a versão compatível da aplicação.');
    db.exec(`BEGIN IMMEDIATE; ${SCHEMA} PRAGMA user_version=${SCHEMA_VERSION}; COMMIT;`);
    const readMetadata=key=>{const row=db.prepare('SELECT value_json FROM metadata WHERE key=?').get(key);return row?JSON.parse(row.value_json):undefined;};
    const setMetadata=db.prepare('INSERT INTO metadata(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json');
    const tables=[
      ['users',['id'],['id','public_player_id','nickname','nickname_normalized','password_hash','password_salt','data_json']],
      ['duels',['id'],['id','public_match_id','invite_token','host_id','guest_id','recipient_id','data_json']],
      ['sessions',['token_hash'],['token_hash','user_id','expires_at','data_json']],
      ['deposits',['id'],['id','user_id','idempotency_key','data_json']],
      ['transactions',['id'],['id','user_id','reference','amount','position','data_json']],
      ['evidence',['id'],['id','duel_id','author_id','bytes','data_json']],
      ['wallet_evidence',['id'],['id','deposit_id','author_id','bytes','data_json']],
      ['auth_identities',['provider','subject'],['provider','subject','user_id','data_json']]
    ].map(([name,keys,columns])=>({name,keys,columns,
      read:db.prepare(`SELECT ${columns.join(',')} FROM ${name}`),
      remove:db.prepare(`DELETE FROM ${name} WHERE ${keys.map(key=>`${key}=?`).join(' AND ')}`),
      upsert:db.prepare(`INSERT INTO ${name}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')}) ON CONFLICT(${keys.join(',')}) DO UPDATE SET ${columns.filter(key=>!keys.includes(key)).map(key=>`${key}=excluded.${key}`).join(',')}`)
    }));
    let reliabilityMigration=false;
    function migrateReliability(draft){
      for(const user of Object.values(draft.users))if(user.walletOpeningBalance===undefined)user.walletOpeningBalance=(user.balance||0)-user.transactions.reduce((sum,tx)=>sum+tx.amount,0);
      for(const deposit of Object.values(draft.deposits||{}))if(deposit.status==='approved'&&deposit.paymentMode==='pix_manual')deposit.legacyBankApproval=true;
      for(const deposit of Object.values(draft.deposits||{}))if(draft.walletLedgerVersion===1&&deposit.status==='approved'&&(deposit.paymentMode||'demo')==='demo'){
        const user=draft.users[deposit.userId],reference=`deposit:${deposit.id}`;
        if(!user?.transactions.some(tx=>tx.reference===reference)&&user?.demoTransactions?.some(tx=>tx.reference===reference&&tx.amount===deposit.amount))deposit.legacyDepositLedger='demo';
      }
      draft.walletReliabilityVersion=1;
    }
    function save(draft,migration){
      if(closed)throw Error('O banco da arena está fechado.');
      const previousUsers=new Map(db.prepare('SELECT id,data_json FROM users').all().map(row=>[row.id,JSON.parse(row.data_json)]));
      const ledgerTransition=draft.walletLedgerVersion===1&&!readMetadata('state_extra')?.walletLedgerVersion;
      const previousLedger=ledgerTransition?load():null,demoMigratedUsers=new Set();
      for(const user of Object.values(draft.users)){
        const previous=previousUsers.get(user.id);
        if(user.walletOpeningBalance===undefined&&!previous)user.walletOpeningBalance=(user.balance||0)-user.transactions.reduce((sum,tx)=>sum+tx.amount,0);
        const demoMigration=ledgerTransition&&previous&&user.balance===0&&user.transactions.length===0&&user.walletOpeningBalance===0&&user.demoBalance===previous.balance&&encoded(user.demoTransactions)===encoded(previousLedger.users[user.id].transactions);
        if(demoMigration)demoMigratedUsers.add(user.id);
        if(previous?.walletOpeningBalance!==undefined&&user.walletOpeningBalance!==previous.walletOpeningBalance&&!demoMigration)invalid('saldo de abertura imutável.');
      }
      const previousDeposits=new Map(db.prepare('SELECT id,data_json FROM deposits').all().map(row=>[row.id,JSON.parse(row.data_json)]));
      for(const deposit of Object.values(draft.deposits||{})){
        const previous=previousDeposits.get(deposit.id),unchanged=previous&&previous.userId===deposit.userId&&previous.amount===deposit.amount&&previous.status===deposit.status&&(previous.paymentMode||'demo')===(deposit.paymentMode||'demo');
        if(unchanged&&demoMigratedUsers.has(deposit.userId)&&deposit.status==='approved'&&(deposit.paymentMode||'demo')==='demo')deposit.legacyDepositLedger='demo';
        if(deposit.legacyDepositLedger!==undefined&&!reliabilityMigration&&(!unchanged||previous.legacyDepositLedger!==deposit.legacyDepositLedger&&!demoMigratedUsers.has(deposit.userId)))invalid('livro do depósito histórico exige migração explícita.');
        if(deposit.legacyBankApproval&&!reliabilityMigration&&!previous?.legacyBankApproval)invalid('aprovação legada exige migração explícita.');
      }
      validateState(draft);
      const legacyDuels=new Set(db.prepare('SELECT id FROM duels WHERE public_match_id IS NULL').all().map(row=>row.id));
      for(const duel of Object.values(draft.duels))if(duel.publicMatchId==null&&!migration&&!legacyDuels.has(duel.id))invalid('nova partida exige código público FG com 10 dígitos hexadecimais.');
      const extra=Object.fromEntries(Object.entries(draft).filter(([key])=>key!=='version'&&!MAPS.includes(key)));
      const extraJson=encoded(extra);
      db.exec('BEGIN IMMEDIATE;');
      try{
        const rows=Object.fromEntries(tables.map(table=>[table.name,[]]));
        for(const user of Object.values(draft.users)){
          const {transactions,passwordHash,passwordSalt,...data}=user;
          rows.users.push([user.id,user.publicPlayerId,user.nickname,normalizeNickname(user.nickname),passwordHash??null,passwordSalt??null,encoded(data)]);
          transactions.forEach((transaction,position)=>rows.transactions.push([transaction.id,user.id,transaction.reference,transaction.amount,position,encoded(transaction)]));
        }
        for(const duel of Object.values(draft.duels))rows.duels.push([duel.id,duel.publicMatchId??null,duel.inviteToken,duel.hostId,duel.guestId??null,duel.recipientId??null,encoded(duel)]);
        for(const [hash,session] of Object.entries(draft.sessions))rows.sessions.push([hash,session.userId,session.expiresAt,encoded(session)]);
        for(const deposit of Object.values(draft.deposits||{}))rows.deposits.push([deposit.id,deposit.userId,deposit.idempotencyKey??null,encoded(deposit)]);
        for(const item of Object.values(draft.evidence))rows.evidence.push([item.id,item.duelId,item.authorId,item.bytes,encoded(item)]);
        for(const item of Object.values(draft.walletEvidence||{}))rows.wallet_evidence.push([item.id,item.depositId,item.authorId,item.bytes,encoded(item)]);
        for(const identity of Object.values(draft.authIdentities||{}))rows.auth_identities.push([identity.provider,identity.subject,identity.userId,encoded(identity)]);
        const changes=tables.map(table=>{
          const key=row=>encoded(table.keys.map(column=>row[table.columns.indexOf(column)]));
          const previous=new Map(table.read.all().map(record=>{const row=table.columns.map(column=>record[column]);return [key(row),row];}));
          const next=new Map(rows[table.name].map(row=>[key(row),row]));if(next.size!==rows[table.name].length)invalid('chave primária duplicada.');return {table,previous,next,key};
        });
        for(const {table,previous,next} of [...changes].reverse())for(const [key,row] of previous)if(!next.has(key))table.remove.run(...table.keys.map(column=>row[table.columns.indexOf(column)]));
        for(const {table,previous,next} of changes)for(const [key,row] of next)if(!previous.has(key)||row.some((value,index)=>value!==previous.get(key)[index]))table.upsert.run(...row);
        setMetadata.run('state_extra',extraJson);setMetadata.run('initialized','true');
        if(migration)setMetadata.run('json_migration',encoded(migration));
        db.exec('COMMIT;');
      }catch(error){db.exec('ROLLBACK;');throw error;}
    }
    function load(){
      if(closed)throw Error('O banco da arena está fechado.');
      db.exec('BEGIN;');
      try{
        const result={...(readMetadata('state_extra')||{}),version:1,...Object.fromEntries(MAPS.map(key=>[key,{}]))};
        for(const row of db.prepare('SELECT id,password_hash,password_salt,data_json FROM users').all()){
          const user=JSON.parse(row.data_json);
          if(row.password_hash!==null)user.passwordHash=row.password_hash;
          if(row.password_salt!==null)user.passwordSalt=row.password_salt;
          user.transactions=[];result.users[row.id]=user;
        }
        for(const row of db.prepare('SELECT user_id,data_json FROM transactions ORDER BY user_id,position').all())result.users[row.user_id].transactions.push(JSON.parse(row.data_json));
        for(const [map,table,key] of [['duels','duels','id'],['sessions','sessions','token_hash'],['deposits','deposits','id'],['evidence','evidence','id'],['walletEvidence','wallet_evidence','id']]){
          for(const row of db.prepare(`SELECT ${key} AS record_key,data_json FROM ${table}`).all())result[map][row.record_key]=JSON.parse(row.data_json);
        }
        for(const row of db.prepare('SELECT provider,subject,data_json FROM auth_identities').all())result.authIdentities[`${row.provider}:${row.subject}`]=JSON.parse(row.data_json);
        db.exec('COMMIT;');return result;
      }catch(error){db.exec('ROLLBACK;');throw error;}
    }
    if(!readMetadata('initialized')){
      const source=join(directory,'state.json');
      let legacy,hasLegacy=false;
      try{legacy=JSON.parse(await readFile(source,'utf8'));hasLegacy=true;}
      catch(error){if(error.code!=='ENOENT')throw error;}
      if(hasLegacy){
        migrateReliability(legacy);reliabilityMigration=true;
        validateState(legacy);
        const backup=join(directory,`state.json.pre-sqlite-${Date.now()}-${randomUUID()}.bak`);
        await copyFile(source,backup,constants.COPYFILE_EXCL);await chmod(backup,0o600);
        save(legacy,{source:'state.json',backup:basename(backup),date:new Date().toISOString()});
        reliabilityMigration=false;
      }else save({version:1,...Object.fromEntries(MAPS.map(key=>[key,{}]))});
    }
    const existing=load();
    if(existing.walletReliabilityVersion!==1){migrateReliability(existing);reliabilityMigration=true;save(existing);reliabilityMigration=false;}
    return {path,schemaVersion:SCHEMA_VERSION,load,save,close(){if(!closed){db.close();closed=true;}}};
  }catch(error){
    if(db.isTransaction)try{db.exec('ROLLBACK;');}catch{}
    db.close();closed=true;throw error;
  }
}
