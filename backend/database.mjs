import {constants} from 'node:fs';
import {mkdir,readFile,copyFile,chmod,realpath} from 'node:fs/promises';
import {resolve,relative,join,isAbsolute,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createDuelEconomics,duelEconomics} from './duel-economy.mjs';
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

function validateState(draft){
  if(!plain(draft)||draft.version!==1)invalid('versão de estado não suportada.');
  for(const name of ['users','duels','sessions','evidence'])if(!plain(draft[name]))invalid(`${name} deve ser um mapa.`);
  for(const name of ['deposits','walletEvidence','authIdentities'])if(draft[name]!==undefined&&!plain(draft[name]))invalid(`${name} deve ser um mapa.`);
  if(draft.adminOperations!==undefined&&!plain(draft.adminOperations))invalid('operações administrativas devem ser um mapa.');
  if(draft.houseTransactions!==undefined&&!plain(draft.houseTransactions))invalid('lançamentos da casa devem ser um mapa.');
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
    if(user.balance!==undefined)integer(user.balance,'saldo');
    for(const transaction of user.transactions){
      if(!plain(transaction))invalid('transação inválida.');
      required(transaction.id,'ID da transação');required(transaction.reference,'referência da transação');integer(transaction.amount,'valor da transação');
    }
  }
  for(const [id,duel] of Object.entries(draft.duels)){
    if(!plain(duel)||duel.id!==id)invalid('ID de desafio inconsistente.');
    required(id,'ID do desafio');required(duel.hostId,'anfitrião');required(duel.inviteToken,'token do convite');
    if([duel.hostId,duel.guestId,duel.recipientId].some(userId=>userId&&needsAccountOnboarding(draft.users[userId])))invalid('partida contém jogador com cadastro pendente.');
    if(duel.publicMatchId!=null&&!/^FG-[A-F0-9]{10}$/.test(duel.publicMatchId))invalid('código público de partida inválido.');
    if(duel.fundingVersion!==undefined&&duel.fundingVersion!==1)invalid('versão de reserva da partida não suportada.');
    if(duel.fundingVersion===1||duel.economics!==undefined||duel.settlement!==undefined){
      const stake=integer(duel.stake,'valor combinado da partida');
      if(stake<0||stake>5000)invalid('valor combinado da partida fora do intervalo.');
      const expected=createDuelEconomics(stake,duel.fundingVersion===1?900:0);
      if(duel.economics!==undefined&&(!plain(duel.economics)||Object.entries(expected).some(([key,value])=>duel.economics[key]!==value)))invalid('condições financeiras da partida inconsistentes.');
      if(duel.fundingVersion===1){
        if(!plain(duel.economics)||!Array.isArray(duel.fundedBy)||new Set(duel.fundedBy).size!==duel.fundedBy.length||duel.fundedBy.length>2)invalid('reservas da sala inválidas.');
        if(!['demo','pix_manual','friendly'].includes(duel.creditMode)||duel.creditMode==='friendly'&&stake!==0)invalid('modo de crédito da sala inválido.');
        if(!['invited','awaiting_funds','in_progress','pending_review','disputed','completed','cancelled','expired'].includes(duel.status))invalid('estado da sala inválido.');
        if(duel.guestId===duel.hostId)invalid('participantes da sala precisam ser diferentes.');
        if(duel.fundedBy.some(userId=>![duel.hostId,duel.guestId].includes(userId)||!draft.users[userId]))invalid('reserva pertence a quem não participa da sala.');
        if(stake===0&&duel.fundedBy.length||duel.status==='invited'&&duel.fundedBy.length)invalid('sala sem reserva contém lançamento de participante.');
        if(duel.status==='awaiting_funds'&&(!duel.guestId||stake===0||duel.fundedBy.length===2))invalid('sala aguardando créditos em estado inconsistente.');
        if(['in_progress','pending_review','disputed','completed'].includes(duel.status)&&(!duel.guestId||stake>0&&![duel.hostId,duel.guestId].every(userId=>duel.fundedBy.includes(userId))))invalid('partida iniciada sem os participantes e suas reservas.');
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
  for(const [id,deposit] of Object.entries(draft.deposits||{})){
    if(!plain(deposit)||deposit.id!==id)invalid('ID de depósito inconsistente.');
    required(id,'ID do depósito');required(deposit.userId,'usuário do depósito');
    if(deposit.idempotencyKey!=null)required(deposit.idempotencyKey,'chave do depósito');
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
    const inserts={
      user:db.prepare('INSERT INTO users(id,public_player_id,nickname,nickname_normalized,password_hash,password_salt,data_json) VALUES(?,?,?,?,?,?,?)'),
      duel:db.prepare('INSERT INTO duels(id,public_match_id,invite_token,host_id,guest_id,recipient_id,data_json) VALUES(?,?,?,?,?,?,?)'),
      session:db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,data_json) VALUES(?,?,?,?)'),
      deposit:db.prepare('INSERT INTO deposits(id,user_id,idempotency_key,data_json) VALUES(?,?,?,?)'),
      transaction:db.prepare('INSERT INTO transactions(id,user_id,reference,amount,position,data_json) VALUES(?,?,?,?,?,?)'),
      evidence:db.prepare('INSERT INTO evidence(id,duel_id,author_id,bytes,data_json) VALUES(?,?,?,?,?)'),
      walletEvidence:db.prepare('INSERT INTO wallet_evidence(id,deposit_id,author_id,bytes,data_json) VALUES(?,?,?,?,?)'),
      identity:db.prepare('INSERT INTO auth_identities(provider,subject,user_id,data_json) VALUES(?,?,?,?)')
    };
    function save(draft,migration){
      if(closed)throw Error('O banco da arena está fechado.');
      validateState(draft);
      const legacyDuels=new Set(db.prepare('SELECT id FROM duels WHERE public_match_id IS NULL').all().map(row=>row.id));
      for(const duel of Object.values(draft.duels))if(duel.publicMatchId==null&&!migration&&!legacyDuels.has(duel.id))invalid('nova partida exige código público FG com 10 dígitos hexadecimais.');
      const extra=Object.fromEntries(Object.entries(draft).filter(([key])=>key!=='version'&&!MAPS.includes(key)));
      const extraJson=encoded(extra);
      db.exec('BEGIN IMMEDIATE;');
      try{
        db.exec('DELETE FROM auth_identities; DELETE FROM wallet_evidence; DELETE FROM evidence; DELETE FROM transactions; DELETE FROM sessions; DELETE FROM deposits; DELETE FROM duels; DELETE FROM users;');
        for(const user of Object.values(draft.users)){
          const {transactions,passwordHash,passwordSalt,...data}=user;
          inserts.user.run(user.id,user.publicPlayerId,user.nickname,normalizeNickname(user.nickname),passwordHash??null,passwordSalt??null,encoded(data));
          transactions.forEach((transaction,position)=>inserts.transaction.run(transaction.id,user.id,transaction.reference,transaction.amount,position,encoded(transaction)));
        }
        for(const duel of Object.values(draft.duels))inserts.duel.run(duel.id,duel.publicMatchId??null,duel.inviteToken,duel.hostId,duel.guestId??null,duel.recipientId??null,encoded(duel));
        for(const [hash,session] of Object.entries(draft.sessions))inserts.session.run(hash,session.userId,session.expiresAt,encoded(session));
        for(const deposit of Object.values(draft.deposits||{}))inserts.deposit.run(deposit.id,deposit.userId,deposit.idempotencyKey??null,encoded(deposit));
        for(const item of Object.values(draft.evidence))inserts.evidence.run(item.id,item.duelId,item.authorId,item.bytes,encoded(item));
        for(const item of Object.values(draft.walletEvidence||{}))inserts.walletEvidence.run(item.id,item.depositId,item.authorId,item.bytes,encoded(item));
        for(const identity of Object.values(draft.authIdentities||{}))inserts.identity.run(identity.provider,identity.subject,identity.userId,encoded(identity));
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
        validateState(legacy);
        const backup=join(directory,`state.json.pre-sqlite-${Date.now()}-${randomUUID()}.bak`);
        await copyFile(source,backup,constants.COPYFILE_EXCL);await chmod(backup,0o600);
        save(legacy,{source:'state.json',backup:basename(backup),date:new Date().toISOString()});
      }else save({version:1,...Object.fromEntries(MAPS.map(key=>[key,{}]))});
    }
    return {path,schemaVersion:SCHEMA_VERSION,load,save,close(){if(!closed){db.close();closed=true;}}};
  }catch(error){
    if(db.isTransaction)try{db.exec('ROLLBACK;');}catch{}
    db.close();closed=true;throw error;
  }
}
