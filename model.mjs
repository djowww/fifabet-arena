import {CLUBS,clubById,findClub} from './clubs.mjs?v=14';
export {CLUBS,clubById,findClub};
export const STORAGE_KEY = 'fifabet:arena:v2';
export const VIEWS = ['arena', 'friends', 'store', 'ranking', 'bets', 'trophies', 'wallet'];
export const MATCHES = [
  {id:'m1',type:'professional',phase:'live',league:'Copa Brasil',stage:'Semifinal · Jogo 2',home:'NandoFC',away:'LucasD10',score:[2,1],minute:62,odds:[1.72,2.20],color:'violet'},
  {id:'m2',type:'community',phase:'live',league:'Copa da Comunidade',stage:'Chave superior · MD3',home:'gui_x',away:'Renatinho',score:[0,0],minute:28,odds:[1.96,1.88],color:'mint'},
  {id:'m3',type:'professional',phase:'live',league:'Liga Pro Brasil',stage:'Semana 08 · Jogo 4',home:'MaduFC',away:'JP_Lima',score:[1,1],minute:74,odds:[2.15,1.68],color:'pink'},
  {id:'m4',type:'community',phase:'soon',league:'Desafio da Noite',stage:'Hoje · 20:30',home:'LariPlay',away:'Cadu7',score:[0,0],minute:0,odds:[1.85,1.95],color:'amber'},
  {id:'m5',type:'professional',phase:'soon',league:'Open Brasil',stage:'Hoje · 21:15 · Final',home:'RafaZ',away:'GersonFC',score:[0,0],minute:0,odds:[1.78,2.04],color:'blue'},
  {id:'m6',type:'community',phase:'soon',league:'Arena dos Amigos',stage:'Amanhã · 19:00',home:'BiaGoals',away:'Teteu10',score:[0,0],minute:0,odds:[1.91,1.91],color:'mint'}
];
export const PEOPLE = [
  {id:'bia',name:'BiaGoals',initials:'BG',color:'pink',online:true,level:7,tag:'Joga por diversão',wins:18,trophies:4},
  {id:'leo',name:'LeoPlay',initials:'LP',color:'blue',online:true,level:12,tag:'Fã da Liga Pro',wins:32,trophies:6},
  {id:'mari',name:'MariFC',initials:'MF',color:'violet',online:false,level:9,tag:'De olho na comunidade',wins:24,trophies:5},
  {id:'dudu',name:'Dudu10',initials:'D10',color:'amber',online:true,level:5,tag:'Sempre na torcida',wins:12,trophies:3},
  {id:'caio',name:'CaioGG',initials:'CG',color:'mint',online:false,level:8,tag:'Um jogo de cada vez',wins:21,trophies:4},
  {id:'nina',name:'NinaFut',initials:'NF',color:'pink',online:true,level:6,tag:'Futebol até no controle',wins:15,trophies:4}
];
export const COLORS = ['mint','violet','blue','amber','pink'];
export const DUEL_MODES = ['1v1','Ultimate Team','Clubes'];
export const DEPOSIT_PACKAGES = [100,250,500,1000];
export const PAYMENT_METHODS = [
  {id:'card',label:'Cartão demo'},
  {id:'pix',label:'Pix demo'},
  {id:'transfer',label:'Transferência demo'}
];
export const GAME_PLATFORMS = [
  {id:'playstation',label:'PlayStation'},
  {id:'xbox',label:'Xbox'},
  {id:'pc',label:'PC'},
  {id:'switch',label:'Nintendo Switch'}
];
export const TEAM_FLAGS = [
  {id:'green',name:'Verde em faixas'},
  {id:'blue',name:'Azul em faixas'},
  {id:'red',name:'Rubro em faixas'},
  {id:'gold',name:'Dourado em faixas'},
  {id:'violet',name:'Violeta em faixas'}
];
export const STICKERS = [
  {
    id:'cristiano-ronaldo',player:'Cristiano Ronaldo',club:'Portugal',nationality:'Portugal',countryCode:'pt',position:'ATACANTE',
    price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-caricature',
    art:'assets/avatars/cristiano-ronaldo.png',signatureAsset:'assets/signatures/ronaldo.svg',
    signatureSource:'https://www.theplayerstribune.com/cristiano-ronaldo-madrid-english/',
    signatureReference:'https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_Signature.svg'
  },
  {
    id:'bruno-fernandes',player:'Bruno Fernandes',club:'Portugal',nationality:'Portugal',countryCode:'pt',position:'MEIA',
    price:450,tier:'silver',theme:'silver',recognition:'Reconhecimento internacional',kind:'player-caricature',
    art:'assets/avatars/bruno-fernandes.png',signatureAsset:'assets/signatures/bruno-fernandes.svg',
    signatureSource:'https://www.manutd.com/en/news/detail/win-special-bruno-fernandes-print-and-shirt-to-celebrate-his-100th-man-utd-goal',
    signatureReference:'https://commons.wikimedia.org/wiki/File:Bruno_Fernandes_Signature.svg'
  },
  {
    id:'senne-lammens',player:'Senne Lammens',club:'Bélgica',nationality:'Bélgica',countryCode:'be',position:'GOLEIRO',
    price:250,tier:'bronze',theme:'bronze',recognition:'Em ascensão',kind:'player-caricature',
    art:'assets/avatars/senne-lammens.png',signatureAsset:'assets/signatures/lammens.svg',
    signatureSource:'https://x.com/manutd/status/2041557866130112966',
    signatureReference:'https://commons.wikimedia.org/wiki/File:Senne_Lammens_Signature.svg'
  },
  {id:'neymar',player:'Neymar',club:'Brasil',nationality:'Brasil',countryCode:'br',position:'ATACANTE',price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-caricature',art:'assets/avatars/neymar.png',signatureAsset:null},
  {id:'vinicius-junior',player:'Vini Jr.',club:'Brasil',nationality:'Brasil',countryCode:'br',position:'ATACANTE',price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-caricature',art:'assets/avatars/vinicius-junior.png',signatureAsset:null},
  {id:'erling-haaland',player:'Erling Haaland',club:'Noruega',nationality:'Noruega',countryCode:'no',position:'ATACANTE',price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-caricature',art:'assets/avatars/erling-haaland.png',signatureAsset:null},
  {id:'lionel-messi',player:'Lionel Messi',club:'Argentina',nationality:'Argentina',countryCode:'ar',position:'ATACANTE',price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-photo',art:'assets/avatars/lionel-messi.jpg',signatureAsset:null},
  {id:'kylian-mbappe',player:'Kylian Mbappé',club:'França',nationality:'França',countryCode:'fr',position:'ATACANTE',price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-caricature',art:'assets/avatars/kylian-mbappe.png',signatureAsset:null},
  {id:'mohamed-salah',player:'Mohamed Salah',club:'Egito',nationality:'Egito',countryCode:'eg',position:'ATACANTE',price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-caricature',art:'assets/avatars/mohamed-salah.png',signatureAsset:null},
  {id:'jude-bellingham',player:'Jude Bellingham',club:'Inglaterra',nationality:'Inglaterra',countryCode:'gb-eng',position:'MEIA',price:450,tier:'silver',theme:'silver',recognition:'Reconhecimento internacional',kind:'player-caricature',art:'assets/avatars/jude-bellingham.png',signatureAsset:null},
  {id:'robert-lewandowski',player:'Robert Lewandowski',club:'Polônia',nationality:'Polônia',countryCode:'pl',position:'ATACANTE',price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-caricature',art:'assets/avatars/robert-lewandowski.png',signatureAsset:null},
  {id:'luka-modric',player:'Luka Modrić',club:'Croácia',nationality:'Croácia',countryCode:'hr',position:'MEIA',price:700,tier:'gold',theme:'gold',recognition:'Ícone global',kind:'player-caricature',art:'assets/avatars/luka-modric.png',signatureAsset:null},
  {id:'kevin-de-bruyne',player:'Kevin De Bruyne',club:'Bélgica',nationality:'Bélgica',countryCode:'be',position:'MEIA',price:450,tier:'silver',theme:'silver',recognition:'Reconhecimento internacional',kind:'player-caricature',art:'assets/avatars/kevin-de-bruyne.png',signatureAsset:null},
  {id:'nilo-raio',player:'Nilo Raio',club:'Aurora City FC',position:'PONTA',rating:91,price:350,theme:'aurora',signature:'N. Raio',kind:'fictional-demo',retired:true},
  {id:'maya-luz',player:'Maya Luz',club:'Luar United',position:'MEIA',rating:89,price:450,theme:'lunar',signature:'Maya L.',kind:'fictional-demo',retired:true},
  {id:'tito-rocha',player:'Tito Rocha',club:'Horizonte AC',position:'ZAGUEIRO',rating:87,price:300,theme:'horizon',signature:'T. Rocha',kind:'fictional-demo',retired:true},
  {id:'breno-vale',player:'Breno Vale',club:'Sol do Norte FC',position:'GOLEIRO',rating:90,price:500,theme:'solar',signature:'B. Vale',kind:'fictional-demo',retired:true}
];
export const TROPHIES = [
  {id:'welcome',name:'Taça de estreia',description:'Crie seu perfil na arena.',icon:'flag',color:'mint'},
  {id:'favorite',name:'Alma de arquibancada',description:'Salve uma partida demo nos favoritos.',icon:'star',color:'amber'},
  {id:'firstbet',name:'Camisa 10',description:'Registre seu primeiro palpite na simulação.',icon:'ticket',color:'blue'},
  {id:'winner',name:'Chuteira de ouro',description:'Conclua um palpite vencedor na simulação.',icon:'target',color:'mint'},
  {id:'friend',name:'Clássico entre amigos',description:'Adicione seu primeiro amigo demo.',icon:'users',color:'pink'},
  {id:'explorer',name:'Noites europeias',description:'Conheça as áreas principais da FifaBet.',icon:'compass',color:'violet'}
];
const stamp=()=>new Date().toISOString();
const uid=()=>globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const copy=x=>JSON.parse(JSON.stringify(x));
export const emptyState=()=>({version:7,activeProfileId:null,profiles:{},results:{},duels:{},legacyArchive:[]});
export const current=s=>Object.hasOwn(s.profiles,s.activeProfileId)?s.profiles[s.activeProfileId]:null;
export const points=n=>Number(n||0).toLocaleString('pt-BR');
export const payout=(stake,odd)=>Math.round(stake*odd);
export function validStake(value,balance=Infinity){
  const n=Number(value);
  if(value==='' || !Number.isFinite(n)) return 'Informe a quantidade de pontos.';
  if(!Number.isInteger(n)) return 'Use apenas pontos inteiros.';
  if(n<10) return 'O mínimo é 10 pontos.';
  if(n>balance) return 'Seu saldo demo é insuficiente.';
  return '';
}
function nickname(value){
  const n=String(value??'').trim();
  if(n.length<2||n.length>20||!/^[\p{L}\p{N}_ .-]+$/u.test(n)) throw Error('Use de 2 a 20 letras, números, espaços, ponto, hífen ou _.');
  return n;
}
function eaId(value){
  const id=typeof value==='string'?value.trim():'';
  if(id.length<4||id.length>16||/[\s\p{C}<>"'&@/\\]/u.test(id))throw Error('Informe seu EA ID público com 4 a 16 caracteres, sem espaços. Não use e-mail ou senha.');
  return id;
}
function gameAccount(value){
  if(!value||!GAME_PLATFORMS.some(item=>item.id===value.platform))return null;
  try{
    const savedAt=typeof value.savedAt==='string'&&Number.isFinite(Date.parse(value.savedAt))?new Date(value.savedAt).toISOString():stamp();
    // A local identifier never proves EA account ownership, even after a storage edit.
    return {eaId:eaId(value.eaId),platform:value.platform,status:'unverified',savedAt};
  }catch{return null;}
}
function profile(name,color='mint'){
  const date=stamp();
  return {id:uid(),publicPlayerId:'',nickname:name,color:COLORS.includes(color)?color:'mint',clubId:null,teamName:'',teamFlag:'green',avatarSticker:null,ownedStickers:[],gameAccount:null,createdAt:date,balance:1000,bets:[],depositRequests:[],transactions:[{id:uid(),ref:'welcome',kind:'bonus',label:'Boas-vindas à arena',amount:1000,date}],friends:[],requests:[{personId:'bia',direction:'in'}],challenges:[],favorites:[],reminders:[],achievements:{},visited:[],activity:[],unread:0};
}
function playerCode(id,salt=0){
  let hash=2166136261;for(const c of `${id}:${salt}`)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  return `FBA-${hash.toString(16).toUpperCase().padStart(8,'0')}`;
}
function ensurePlayerCode(s,p,preferred=''){
  const used=new Set(Object.values(s.profiles).filter(v=>v.id!==p.id).map(v=>v.publicPlayerId));
  if(/^FBA-[A-F0-9]{8}$/.test(preferred)&&!used.has(preferred)){p.publicPlayerId=preferred;return;}
  let salt=0;while(used.has(playerCode(p.id,salt)))salt++;p.publicPlayerId=playerCode(p.id,salt);
}
export function findProfileByPlayerId(s,value){
  const code=typeof value==='string'?value.trim().toUpperCase():'';
  return /^FBA-[A-F0-9]{8}$/.test(code)?Object.values(s.profiles).find(p=>p.publicPlayerId===code)||null:null;
}
function activity(p,text,icon='bell'){
  p.activity.unshift({id:uid(),text,icon,date:stamp()});
  p.activity=p.activity.slice(0,100); p.unread=Math.min(99,p.unread+1);
}
function transaction(p,ref,kind,label,amount){
  if(p.transactions.some(t=>t.ref===ref))return false;
  if(!Number.isSafeInteger(amount)||p.balance+amount<0||p.balance+amount>1e9)throw Error('Valor de pontos inválido.');
  p.balance+=amount;
  p.transactions.unshift({id:uid(),ref,kind,label,amount,date:stamp()});return true;
}
function awards(p,s=null){
  const ownDuels=s?duelsForProfile(s,p.id):[];
  const ready={welcome:true,favorite:p.favorites.length>0,firstbet:p.bets.length>0||ownDuels.length>0,winner:p.bets.some(b=>b.status==='won')||ownDuels.some(d=>d.status==='settled'&&d.winnerId===p.id),friend:p.friends.length>0||ownDuels.some(d=>d.acceptedAt),explorer:VIEWS.every(v=>p.visited.includes(v))};
  for(const t of TROPHIES)if(ready[t.id]&&!p.achievements[t.id]){p.achievements[t.id]=stamp();activity(p,`Troféu desbloqueado: ${t.name}`,'trophy');}
}
function requireProfile(s){const p=current(s);if(!p)throw Error('Entre em um perfil demo para continuar.');return p;}
function person(id){if(!PEOPLE.some(p=>p.id===id))throw Error('Jogador não encontrado.');return PEOPLE.find(p=>p.id===id);}
const DEPOSIT_ACTIONS=['createDemoDeposit','confirmDemoDeposit','rejectDemoDeposit','cancelDemoDeposit','attachDemoReceipt'];
export function depositRequestsForProfile(s,profileId=s.activeProfileId){
  return Object.hasOwn(s.profiles,profileId)?[...(s.profiles[profileId].depositRequests||[])]:[];
}
export function pendingDemoDepositPoints(s,profileId=s.activeProfileId){
  return depositRequestsForProfile(s,profileId).filter(d=>['pending','review'].includes(d.status)).reduce((sum,d)=>sum+d.amount,0);
}
function changeDemoDeposit(p,action,data){
  p.depositRequests||=[];
  if(action==='createDemoDeposit'){
    const amount=Number(data.amount),method=data.method,installments=Number(data.installments??1);
    if(!Number.isSafeInteger(amount)||!DEPOSIT_PACKAGES.includes(amount))throw Error('Escolha um pacote demo de 100, 250, 500 ou 1.000 pontos.');
    if(!PAYMENT_METHODS.some(m=>m.id===method))throw Error('Escolha cartão, Pix ou transferência de demonstração.');
    if(!Number.isSafeInteger(installments)||installments<1||installments>6||(method!=='card'&&installments!==1))throw Error('Cartão demo aceita de 1 a 6 parcelas. Pix e transferência não têm parcelamento.');
    const operationId=typeof data.operationId==='string'?data.operationId:'';
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(operationId))throw Error('Identificador da solicitação demo inválido.');
    const existing=p.depositRequests.find(d=>d.operationId===operationId);
    if(existing){
      if(existing.amount!==amount||existing.method!==method||existing.installments!==installments)throw Error('Essa solicitação já foi criada com outros dados.');
      return;
    }
    if(p.depositRequests.length>=500)throw Error('Este perfil atingiu o limite de 500 solicitações demo.');
    const request={id:uid(),operationId,amount,method,installments,status:'pending',createdAt:stamp(),confirmedAt:'',rejectedAt:'',cancelledAt:'',receipt:null,receipts:[]};
    p.depositRequests.unshift(request);
    activity(p,`${points(amount)} pontos solicitados via ${PAYMENT_METHODS.find(m=>m.id===method).label}. Nenhum valor foi cobrado e seu saldo ainda não mudou.`,'wallet');return;
  }
  const d=p.depositRequests.find(item=>item.id===data.id);
  if(!d)throw Error('Solicitação demo não encontrada neste perfil.');
  if(action==='confirmDemoDeposit'){
    if(d.method==='transfer')throw Error('Comprovantes de transferência precisam de uma equipe no servidor. O modo local não libera esses pontos.');
    if(d.status==='confirmed')return;
    if(d.status!=='pending')throw Error('Somente uma solicitação demo pendente pode ser confirmada.');
    if(!DEPOSIT_PACKAGES.includes(d.amount)||!['card','pix'].includes(d.method))throw Error('Solicitação demo inválida.');
    transaction(p,`demo-deposit:${d.id}`,'demo-deposit',`Crédito simulado · ${PAYMENT_METHODS.find(m=>m.id===d.method).label}`,d.amount);
    d.status='confirmed';d.confirmedAt=stamp();
    activity(p,`Simulação concluída: ${points(d.amount)} pontos adicionados. Nenhum pagamento real foi processado.`,'wallet');
  }else if(action==='rejectDemoDeposit'){
    if(!['card','pix'].includes(d.method))throw Error('A recusa simulada está disponível apenas para cartão e Pix.');
    if(d.status==='rejected')return;
    if(d.status!=='pending')throw Error('Somente uma solicitação demo pendente pode ser recusada.');
    d.status='rejected';d.rejectedAt=stamp();activity(p,'Pagamento de teste recusado. Nenhum crédito foi adicionado e nenhum valor foi cobrado.','wallet');
  }else if(action==='cancelDemoDeposit'){
    if(d.status==='cancelled')return;
    if(d.status!=='pending'&&!(d.method==='transfer'&&d.status==='review'))throw Error('Somente uma solicitação pendente ou transferência em análise pode ser cancelada.');
    d.status='cancelled';d.cancelledAt=stamp();activity(p,'Solicitação demo cancelada. Seu saldo não mudou.','wallet');
  }else if(action==='attachDemoReceipt'){
    if(d.method!=='transfer'||!['pending','review'].includes(d.status))throw Error('Envie um comprovante de uma transferência demo pendente ou em análise.');
    if(!validEvidence(data.evidenceDataUrl))throw Error('Anexe uma foto válida do comprovante demo.');
    if(d.receipts.length>=5)throw Error('Limite de cinco comprovantes demo atingido para esta solicitação.');
    const receipt={id:uid(),evidenceDataUrl:data.evidenceDataUrl,evidenceName:text(data.evidenceName,100)||'Comprovante demo',date:stamp()};
    d.receipt=receipt;d.receipts.push(receipt);d.status='review';
    activity(p,'Comprovante demo salvo neste navegador. Nenhuma equipe está conectada para avaliá-lo; os pontos não foram liberados.','shield');
  }
}
const DUEL_ACTIONS=['createDuel','acceptDuel','rejectDuel','cancelDuel','submitDuelResult','confirmDuelResult','disputeDuelResult','requestDuelCancel','confirmDuelCancel','withdrawDuelCancel'];
const DUEL_OPEN=['invited','active','review','disputed'];
function ensureDuelCode(s,d,preferred=''){
  const used=new Set(Object.values(s.duels||{}).filter(value=>value.id!==d.id).map(value=>value.publicDuelId));
  if(/^JOGO-[A-F0-9]{8}$/.test(preferred)&&!used.has(preferred)){d.publicDuelId=preferred;return;}
  const random=new Uint32Array(1);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(random);
  else random[0]=Math.floor(Math.random()*0x100000000);
  // The public invitation code is generated independently from the internal ID.
  // Incrementing on collision also guarantees progress in a small local arena.
  let candidate=random[0];
  do{d.publicDuelId=`JOGO-${candidate.toString(16).toUpperCase().padStart(8,'0')}`;candidate=(candidate+1)>>>0;}while(used.has(d.publicDuelId));
}
export function duelsForProfile(s,profileId=s.activeProfileId){
  return Object.values(s.duels||{}).filter(d=>d.creatorId===profileId||d.opponentId===profileId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export function duelOpponent(s,duel,profileId=s.activeProfileId){
  if(!duel||![duel.creatorId,duel.opponentId].includes(profileId))return null;
  return s.profiles[duel.creatorId===profileId?duel.opponentId:duel.creatorId]||null;
}
export function duelReservedPoints(s,profileId=s.activeProfileId){
  return duelsForProfile(s,profileId).reduce((sum,d)=>sum+(DUEL_OPEN.includes(d.status)&&d.reservedBy.includes(profileId)?d.stake:0),0);
}
function requireDuel(s,p,id){
  const d=Object.hasOwn(s.duels||{},id)?s.duels[id]:null;
  if(!d||![d.creatorId,d.opponentId].includes(p.id))throw Error('Desafio não encontrado para este perfil.');
  if(!Object.hasOwn(s.profiles,d.creatorId)||!Object.hasOwn(s.profiles,d.opponentId))throw Error('Os dois perfis precisam existir neste navegador.');
  return d;
}
function duelAmount(d){
  if(!Number.isSafeInteger(d.stake)||d.stake<10||d.stake>5000)throw Error('Quantidade de pontos do desafio inválida.');
}
function reserveDuel(p,d){
  duelAmount(d);
  const error=validStake(d.stake,p.balance);if(error)throw Error(error);
  if(!transaction(p,`duel:${d.id}:reserve`,'duel-reserve',`Pontos reservados · ${d.mode}`,-d.stake))throw Error('Os pontos deste desafio já foram reservados.');
  d.reservedBy.push(p.id);
}
function ensureDuelFunds(s,d){
  duelAmount(d);
  for(const id of d.reservedBy){
    const p=s.profiles[id];
    if(!p||!p.transactions.some(t=>t.ref===`duel:${d.id}:reserve`&&t.amount===-d.stake))throw Error('A reserva de pontos deste desafio não está íntegra.');
    if(p.transactions.some(t=>[`duel:${d.id}:refund`,`duel:${d.id}:payout`].includes(t.ref)))throw Error('Os pontos deste desafio já foram devolvidos ou distribuídos.');
  }
}
function releaseDuel(s,d,status){
  ensureDuelFunds(s,d);
  for(const id of d.reservedBy){
    const p=s.profiles[id];transaction(p,`duel:${d.id}:refund`,'duel-refund',`Devolução · ${d.mode}`,d.stake);
    activity(p,`Desafio ${status==='rejected'?'recusado':'cancelado'}: ${points(d.stake)} pontos devolvidos.`,'gamepad');
  }
  d.reservedBy=[];d.status=status;d.closedAt=stamp();d.cancelRequestedBy=null;
}
function resultScore(value){
  if(!['number','string'].includes(typeof value)||value===''||(typeof value==='string'&&!/^\d{1,2}$/.test(value))||!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>99)throw Error('Informe o placar dos dois jogadores com números de 0 a 99.');
  return Number(value);
}
function changeDuel(s,p,action,data){
  s.duels||={};
  if(action==='createDuel'){
    const operationId=text(data.operationId,80);
    if(operationId&&Object.values(s.duels).some(d=>d.creatorId===p.id&&d.operationId===operationId))return;
    if(!Object.hasOwn(s.profiles,data.opponentId)||data.opponentId===p.id)throw Error('Escolha outro perfil real cadastrado neste navegador.');
    const opponent=s.profiles[data.opponentId];
    if(Object.values(s.duels).some(d=>DUEL_OPEN.includes(d.status)&&[d.creatorId,d.opponentId].includes(p.id)&&[d.creatorId,d.opponentId].includes(opponent.id)))throw Error('Já existe um desafio pendente entre esses dois perfis.');
    if(Object.values(s.duels).length>=500)throw Error('Este navegador atingiu o limite de 500 desafios.');
    const stake=Number(data.stake),error=validStake(data.stake,p.balance);if(error)throw Error(error);
    if(stake>5000)throw Error('O máximo por desafio é 5.000 pontos.');
    const mode=data.mode||'1v1';if(!DUEL_MODES.includes(mode))throw Error('Escolha um modo de jogo válido.');
    const platform=data.platform===undefined?'pc':data.platform;if(!GAME_PLATFORMS.some(item=>item.id===platform))throw Error('Escolha uma plataforma de jogo válida.');
    const d={id:uid(),publicDuelId:'',operationId,creatorId:p.id,opponentId:opponent.id,stake,mode,platform,rules:text(data.rules,300).trim(),status:'invited',createdAt:stamp(),acceptedAt:'',reservedBy:[],report:null,reports:[],disputes:[],cancelRequestedBy:null,winnerId:null,settledAt:'',peerConfirmed:false,confirmedBy:null,moderation:null};
    ensureDuelCode(s,d);
    reserveDuel(p,d);s.duels[d.id]=d;
    activity(p,`Convite para ${opponent.nickname}: ${points(stake)} pontos reservados.`,'gamepad');
    activity(opponent,`${p.nickname} convidou você para ${mode} valendo ${points(stake)} pontos.`,'gamepad');return;
  }
  const d=requireDuel(s,p,data.id),other=duelOpponent(s,d,p.id);
  if(action==='acceptDuel'){
    if(p.id!==d.opponentId)throw Error('Somente o perfil convidado pode aceitar.');
    if(d.status==='active')return;
    if(d.status!=='invited')throw Error('Este convite não está mais pendente.');
    ensureDuelFunds(s,d);reserveDuel(p,d);d.status='active';d.acceptedAt=stamp();
    for(const member of [p,other]){activity(member,`Desafio aceito. ${points(d.stake*2)} pontos ficam reservados até a revisão da equipe.`,'gamepad');awards(member,s);}
  }else if(action==='rejectDuel'||action==='cancelDuel'){
    const expected=action==='rejectDuel'?d.opponentId:d.creatorId;
    if(p.id!==expected)throw Error(action==='rejectDuel'?'Somente o perfil convidado pode recusar.':'Somente quem criou o convite pode cancelá-lo.');
    const status=action==='rejectDuel'?'rejected':'cancelled';if(d.status===status)return;
    if(d.status!=='invited')throw Error('Depois do aceite, o cancelamento precisa da concordância dos dois.');
    releaseDuel(s,d,status);activity(p,action==='rejectDuel'?'Você recusou o desafio.':'Você cancelou o convite.','gamepad');
  }else if(action==='submitDuelResult'){
    if(!['active','disputed'].includes(d.status))throw Error('Envie um resultado de um desafio aceito ou em disputa.');
    if(d.cancelRequestedBy)throw Error('Responda ao pedido de cancelamento antes de enviar o placar.');
    const homeScore=resultScore(data.homeScore),awayScore=resultScore(data.awayScore);
    if(!validEvidence(data.evidenceDataUrl))throw Error('Anexe uma foto válida do placar.');
    if(d.reports.length>=20)throw Error('Limite de propostas atingido. Os dois perfis podem cancelar o desafio para recuperar os pontos.');
    const report={id:uid(),submittedBy:p.id,homeScore,awayScore,winnerId:homeScore===awayScore?null:homeScore>awayScore?d.creatorId:d.opponentId,evidenceDataUrl:data.evidenceDataUrl,evidenceName:text(data.evidenceName,100)||'Foto do resultado',date:stamp()};
    d.report=report;d.reports.push(report);d.status='review';d.confirmedBy=null;d.peerConfirmed=false;d.moderation=null;
    activity(other,`${p.nickname} enviou o placar ${homeScore} × ${awayScore}. Confira a foto e confirme ou conteste.`,'shield');
    activity(p,'Placar enviado. O rival pode conferir a foto; os pontos aguardam a revisão da equipe.','shield');
  }else if(action==='confirmDuelResult'){
    if(!d.report||data.reportId!==d.report.id)throw Error('O resultado mudou. Abra a proposta atual antes de confirmar.');
    if(p.id===d.report.submittedBy)throw Error('O outro perfil precisa confirmar o placar. Você não pode aprovar sua própria proposta.');
    if(['review','settled'].includes(d.status)&&d.peerConfirmed&&d.confirmedBy===p.id)return;
    if(d.status!=='review')throw Error('Não há um resultado aguardando confirmação.');
    if(d.cancelRequestedBy)throw Error('Responda ao pedido de cancelamento antes de confirmar o placar.');
    if(d.reservedBy.length!==2||![d.creatorId,d.opponentId].every(id=>d.reservedBy.includes(id)))throw Error('Os dois perfis precisam ter reservado seus pontos.');
    ensureDuelFunds(s,d);
    d.peerConfirmed=true;d.confirmedBy=p.id;
    for(const member of [p,other])activity(member,'Os dois perfis concordaram com o placar. Os pontos continuam reservados: este modo local não tem uma equipe de revisão conectada.','shield');
  }else if(action==='disputeDuelResult'){
    if(d.status!=='review'||!d.report||data.reportId!==d.report.id)throw Error('Abra o resultado atual antes de contestar.');
    if(p.id===d.report.submittedBy)throw Error('Somente o outro perfil pode contestar esta proposta.');
    const reason=text(data.reason,300).trim();if(reason.length<8)throw Error('Explique a divergência em pelo menos 8 caracteres.');
    if(!validEvidence(data.evidenceDataUrl))throw Error('Anexe uma foto válida para contestar o resultado.');
    d.disputes.push({id:uid(),reportId:d.report.id,by:p.id,reason,evidenceDataUrl:data.evidenceDataUrl,evidenceName:text(data.evidenceName,100)||'Foto da contestação',date:stamp()});
    d.status='disputed';d.peerConfirmed=false;d.confirmedBy=null;activity(p,'Resultado contestado. Os pontos continuam reservados até revisão ou cancelamento pelos dois.','shield');
    activity(other,`${p.nickname} contestou o placar. Confira a foto e envie uma nova proposta ou combine o cancelamento.`,'shield');
  }else if(action==='requestDuelCancel'){
    if(!['active','review','disputed'].includes(d.status))throw Error('Este desafio não está disponível para cancelamento em acordo.');
    if(d.cancelRequestedBy===p.id)return;
    if(d.cancelRequestedBy)throw Error('O outro perfil já pediu o cancelamento. Confirme ou recuse esse pedido.');
    d.cancelRequestedBy=p.id;activity(other,`${p.nickname} pediu o cancelamento. Confirme para devolver os pontos aos dois.`,'gamepad');
  }else if(action==='confirmDuelCancel'){
    if(d.status==='cancelled'&&d.cancelledBy?.includes(p.id))return;
    if(!['active','review','disputed'].includes(d.status)||!d.cancelRequestedBy)throw Error('Não há um pedido de cancelamento pendente.');
    if(d.cancelRequestedBy===p.id)throw Error('O outro perfil precisa confirmar o cancelamento.');
    const requester=d.cancelRequestedBy;releaseDuel(s,d,'cancelled');d.cancelledBy=[requester,p.id];
  }else if(action==='withdrawDuelCancel'){
    if(!d.cancelRequestedBy||!['active','review','disputed'].includes(d.status))throw Error('Não há um pedido de cancelamento pendente.');
    d.cancelRequestedBy=null;activity(other,`${p.nickname} retirou ou recusou o pedido de cancelamento. O desafio continua.`,'gamepad');
  }
}
// Developer-only simulation. This is deliberately outside regular profile actions:
// a static browser cannot authenticate a reviewer or authorize real payments.
export function reviewDuelResult(input,data={},reviewContext={}){
  if(reviewContext.demo!==true||reviewContext.reviewerId!=='demo-reviewer')throw Error('A revisão exige um contexto explícito de simulação. Use o backend para uma equipe autenticada.');
  const s=copy(input),d=Object.hasOwn(s.duels||{},data.id)?s.duels[data.id]:null;
  if(!d||!d.report||data.reportId!==d.report.id)throw Error('Resultado atual não encontrado para revisão.');
  if(![null,d.creatorId,d.opponentId].includes(data.winnerId))throw Error('Informe um vencedor participante ou empate.');
  if(d.status==='settled'){
    if(d.winnerId!==data.winnerId)throw Error('Este desafio já foi liquidado com outro resultado.');
    return s;
  }
  if(d.status!=='review'||!d.peerConfirmed)throw Error('Os dois perfis precisam concordar com o placar antes desta simulação de revisão.');
  const reason=text(data.reason,300).trim();if(reason.length<8)throw Error('Registre o motivo da revisão em pelo menos 8 caracteres.');
  if(d.reservedBy.length!==2||![d.creatorId,d.opponentId].every(id=>d.reservedBy.includes(id)))throw Error('As reservas dos dois participantes precisam estar íntegras.');
  ensureDuelFunds(s,d);
  if(data.winnerId){
    const winner=s.profiles[data.winnerId];transaction(winner,`duel:${d.id}:payout`,'duel-payout',`Vitória revisada em simulação · ${d.mode}`,d.stake*2);
  }else for(const id of d.reservedBy)transaction(s.profiles[id],`duel:${d.id}:refund`,'duel-refund',`Empate revisado em simulação · ${d.mode}`,d.stake);
  d.status='settled';d.winnerId=data.winnerId;d.settledAt=stamp();d.reservedBy=[];
  d.moderation={source:'local-demo',reviewerId:'demo-reviewer',reportId:d.report.id,reason,date:d.settledAt};
  for(const id of [d.creatorId,d.opponentId]){
    const member=s.profiles[id];activity(member,d.winnerId?`Simulação de revisão: ${s.profiles[d.winnerId].nickname} recebeu ${points(d.stake*2)} pontos.`:'Simulação de revisão: empate, pontos devolvidos aos dois.','flag');awards(member,s);
  }
  return s;
}
export function change(input,action,data={}){
  const s=copy(input);let p=current(s);
  if(action==='create'){
    const name=nickname(data.nickname);
    if(Object.values(s.profiles).some(x=>x.nickname.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('Esse apelido já existe neste navegador. Use a aba Entrar para continuar.');
    p=profile(name,data.color);ensurePlayerCode(s,p);s.profiles[p.id]=p;s.activeProfileId=p.id;activity(p,'Seu perfil demo está pronto. Você recebeu 1.000 pontos.','user');
  }else if(action==='login'){
    if(!Object.hasOwn(s.profiles,data.id))throw Error('Perfil não encontrado.');s.activeProfileId=data.id;p=current(s);
  }else if(action==='logout'){s.activeProfileId=null;return s;}
  else {
    p=requireProfile(s);
    if(action==='visit'){if(VIEWS.includes(data.view)&&!p.visited.includes(data.view))p.visited.push(data.view);}
    else if(DEPOSIT_ACTIONS.includes(action)){changeDemoDeposit(p,action,data);}
    else if(DUEL_ACTIONS.includes(action)){changeDuel(s,p,action,data);}
    else if(action==='profile'){
      const name=nickname(data.nickname);
      if(Object.values(s.profiles).some(x=>x.id!==p.id&&x.nickname.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('Esse apelido já está em uso neste navegador.');
      p.nickname=name;if(COLORS.includes(data.color))p.color=data.color;
      if(Object.hasOwn(data,'clubId')){
        const club=clubById(data.clubId);
        if(data.clubId!==null&&data.clubId!==''&&!club)throw Error('Escolha um clube da lista.');
        p.clubId=club?.id||null;p.teamName=club?.name||'';
      }else if(typeof data.teamName==='string'){
        p.teamName=data.teamName.trim().slice(0,50);const club=findClub(p.teamName);
        p.clubId=club?.id||null;if(club)p.teamName=club.name;
      }
      if(TEAM_FLAGS.some(flag=>flag.id===data.teamFlag))p.teamFlag=data.teamFlag;
      if(data.avatarStyle==='club')p.avatarSticker=null;
    }else if(action==='saveGameAccount'){
      const id=eaId(data.eaId);
      if(!GAME_PLATFORMS.some(item=>item.id===data.platform))throw Error('Escolha a plataforma em que você joga.');
      p.gameAccount={eaId:id,platform:data.platform,status:'unverified',savedAt:stamp()};
      activity(p,'EA ID salvo neste perfil como não verificado. A conexão oficial ainda não está disponível.','gamepad');
    }else if(action==='unlinkGameAccount'){
      p.gameAccount=null;
    }else if(action==='purchaseSticker'){
      const sticker=STICKERS.find(item=>item.id===data.id);if(!sticker)throw Error('Figurinha não encontrada.');
      if(p.ownedStickers.includes(sticker.id))throw Error('Você já tem essa figurinha.');
      if(p.balance<sticker.price)throw Error('Saldo demo insuficiente para esta figurinha.');
      if(!transaction(p,`sticker:${sticker.id}`,'shop',`Figurinha demo: ${sticker.player}`,-sticker.price))throw Error('Essa compra já foi registrada.');
      p.ownedStickers.push(sticker.id);if(!p.avatarSticker)p.avatarSticker=sticker.id;
      activity(p,`Figurinha demo de ${sticker.player} adicionada à coleção.`,'star');
    }else if(action==='avatarSticker'){
      if(data.id===null||data.id===''){p.avatarSticker=null;}
      else if(!STICKERS.some(item=>item.id===data.id)||!p.ownedStickers.includes(data.id))throw Error('Compre esta figurinha antes de usá-la como avatar.');
      else p.avatarSticker=data.id;
    }else if(action==='favorite'||action==='reminder'){
      if(!MATCHES.some(m=>m.id===data.id))throw Error('Partida não encontrada.');
      const arr=action==='favorite'?p.favorites:p.reminders;
      const i=arr.indexOf(data.id);if(i>=0)arr.splice(i,1);else arr.push(data.id);
    }else if(action==='deposit'){
      if(![500,1000,2500,5000].includes(data.amount)||!['pix','card'].includes(data.method)||!data.paymentId)throw Error('Escolha um pacote e um método demo válidos.');
      if(transaction(p,`payment:${data.paymentId}`,'deposit',`Crédito via ${data.method==='pix'?'Pix demo':'cartão demo'}`,data.amount))activity(p,`${points(data.amount)} pontos adicionados à carteira. Pagamento simulado.`,'wallet');
    }else if(action==='bet'){
      const m=MATCHES.find(x=>x.id===data.matchId);
      if(!m||!['home','away'].includes(data.side))throw Error('Selecione um resultado válido.');
      if(p.bets.some(b=>b.id===data.operationId))return s;
      if(s.results[m.id])throw Error('Este confronto já foi encerrado na simulação.');
      const error=validStake(data.stake,p.balance);if(error)throw Error(error);
      const stake=Number(data.stake),odd=m.odds[data.side==='home'?0:1],id=data.operationId||uid();
      transaction(p,`bet:${id}`,'bet',`Palpite: ${m.home} × ${m.away}`,-stake);
      p.bets.unshift({id,matchId:m.id,home:m.home,away:m.away,league:m.league,side:data.side,selection:m[data.side],stake,odd,potential:payout(stake,odd),status:'pending',date:stamp()});
      activity(p,`Palpite em ${m[data.side]} confirmado: ${points(stake)} pts.`,'ticket');
    }else if(action==='settle'){
      const m=MATCHES.find(x=>x.id===data.matchId);if(!m||!['home','away'].includes(data.winner))throw Error('Resultado inválido.');
      if(s.results[m.id]){if(s.results[m.id].winner!==data.winner)throw Error('Esse confronto já tem um resultado definido.');return s;}
      s.results[m.id]={winner:data.winner,date:stamp()};
      for(const prof of Object.values(s.profiles)){
        for(const b of prof.bets.filter(b=>b.matchId===m.id&&b.status==='pending')){
          b.status=b.side===data.winner?'won':'lost';b.settledAt=stamp();
          if(b.status==='won')transaction(prof,`settle:${b.id}`,'payout',`Retorno: ${m.home} × ${m.away}`,b.potential);
          activity(prof,`${m.home} × ${m.away}: ${b.status==='won'?`palpite vencedor, +${points(b.potential)} pts.`:'palpite encerrado sem retorno.'}`,'flag');
        }awards(prof);
      }
    }else if(action==='invite'){
      const who=person(data.id);if(p.friends.includes(who.id)||p.requests.some(r=>r.personId===who.id))throw Error('Você já tem uma conexão ou convite com esse jogador.');
      p.requests.push({personId:who.id,direction:'out'});activity(p,`Convite demo enviado para ${who.name}.`,'users');
    }else if(action==='cancelInvite'||action==='decline'){
      p.requests=p.requests.filter(r=>r.personId!==data.id);
    }else if(action==='accept'||action==='simulateAccept'){
      const who=person(data.id),dir=action==='accept'?'in':'out';
      if(!p.requests.some(r=>r.personId===who.id&&r.direction===dir))throw Error('Este convite não está mais pendente.');
      if(!p.friends.includes(who.id))p.friends.push(who.id);p.requests=p.requests.filter(r=>r.personId!==who.id);activity(p,`${who.name} entrou na sua lista de amigos demo.`,'users');
    }else if(action==='removeFriend'){
      if(p.challenges.some(c=>c.personId===data.id&&['accepted','review','disputed'].includes(c.status)))throw Error('Conclua a revisão do desafio antes de remover este amigo. As evidências precisam ser preservadas.');
      p.friends=p.friends.filter(id=>id!==data.id);p.challenges=p.challenges.filter(c=>c.personId!==data.id||c.status!=='sent');
    }else if(action==='challenge'){
      const who=person(data.id);if(!p.friends.includes(who.id))throw Error('Adicione esse jogador aos amigos primeiro.');
      if(p.challenges.some(c=>c.personId===who.id&&['sent','accepted','review','disputed'].includes(c.status)))throw Error('Já existe um desafio demo pendente para esse amigo.');
      const stake=Number(data.stake??100),mode=String(data.mode||'1v1');
      if(![50,100,250,500].includes(stake))throw Error('Escolha um valor simbólico válido.');
      if(!['1v1','Ultimate Team','Clubes'].includes(mode))throw Error('Escolha um formato de partida válido.');
      p.challenges.push({id:uid(),personId:who.id,date:stamp(),stake,mode,status:'sent'});activity(p,`Desafio demo enviado para ${who.name}: ${points(stake)} pontos simbólicos · ${mode}.`,'gamepad');
    }else if(action==='acceptChallenge'){
      const c=p.challenges.find(item=>item.id===data.id&&item.status==='sent');if(!c)throw Error('Este convite não está mais pendente.');
      c.status='accepted';activity(p,`Aceite demo confirmado para o desafio de ${person(c.personId).name}.`,'gamepad');
    }else if(action==='submitChallengeResult'){
      const c=p.challenges.find(item=>item.id===data.id&&item.status==='accepted');if(!c||!['you','friend'].includes(data.winner))throw Error('Escolha um desafio confirmado e informe quem venceu.');
      if(!validEvidence(data.evidenceDataUrl))throw Error('Anexe uma foto válida do placar para solicitar a revisão.');
      c.status='review';c.reportedWinner=data.winner;c.evidenceDataUrl=data.evidenceDataUrl;c.evidenceName=text(data.evidenceName,100)||'Foto do resultado';c.submittedAt=stamp();
      activity(p,`Resultado do desafio contra ${person(c.personId).name} enviado para análise. Pontos seguem bloqueados.`,'shield');
    }else if(action==='reportFraud'){
      const c=p.challenges.find(item=>item.id===data.id&&['accepted','review'].includes(item.status));if(!c)throw Error('Este desafio não está disponível para sinalização.');
      if(!['you','friend'].includes(data.winner)||!validEvidence(data.evidenceDataUrl))throw Error('Informe o possível vencedor e anexe uma foto válida do placar.');
      const reason=text(data.reason,300).trim();if(reason.length<8)throw Error('Explique a suspeita em pelo menos 8 caracteres.');
      if(c.status==='review')c.originalReport=normalizeResultReport(c);
      c.status='disputed';c.reportedWinner=data.winner;c.evidenceDataUrl=data.evidenceDataUrl;c.evidenceName=text(data.evidenceName,100)||'Foto do resultado';c.fraudReason=reason;c.flaggedAt=stamp();
      activity(p,`Suspeita de fraude sinalizada no desafio contra ${person(c.personId).name}. Pontos seguem bloqueados.`,'shield');
    }else if(action==='resolveChallenge'){
      throw Error('O resultado não pode ser concluído sem foto e revisão da equipe.');
    }else if(action==='cancelChallenge'){
      const c=p.challenges.find(item=>item.id===data.id);
      if(!c||c.status!=='sent')throw Error('Somente um convite ainda não aceito pode ser cancelado.');
      p.challenges=p.challenges.filter(item=>item.id!==data.id);
    }
    else if(action==='readActivity'){p.unread=0;}
    else throw Error('Ação desconhecida.');
  }
  if(p)awards(p,s);return s;
}
const array=x=>Array.isArray(x)?x:[];
const finite=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback;
const safeBalance=x=>Math.max(0,Math.min(1e9,Math.floor(finite(x))));
const text=(x,max=120)=>typeof x==='string'?x.slice(0,max):'';
const validEvidence=x=>typeof x==='string'&&x.length<=450000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]{4,}={0,2}$/.test(x);
function normalizeResultReport(value){
  if(!value||!['you','friend'].includes(value.reportedWinner)||!validEvidence(value.evidenceDataUrl))return null;
  return {reportedWinner:value.reportedWinner,evidenceDataUrl:value.evidenceDataUrl,evidenceName:text(value.evidenceName,100)||'Foto do resultado',submittedAt:text(value.submittedAt,40)};
}
function normalizeBet(b){
  if(!b||!Number.isSafeInteger(b.stake)||b.stake<10||b.stake>1e9||!Number.isFinite(b.odd)||b.odd<=1||!Number.isSafeInteger(payout(b.stake,b.odd)))return null;
  return {id:text(String(b.id),80)||uid(),matchId:text(b.matchId,20),home:text(b.home,30),away:text(b.away,30),league:text(b.league),side:b.side==='away'?'away':'home',selection:text(b.selection,30),stake:b.stake,odd:b.odd,potential:payout(b.stake,b.odd),status:['pending','won','lost'].includes(b.status)?b.status:'pending',date:text(b.date,40)||stamp(),settledAt:text(b.settledAt,40)};
}
function normalizeDemoReceipt(value){
  if(!value||typeof value.id!=='string'||!value.id||value.id.length>80||!validEvidence(value.evidenceDataUrl))return null;
  return {id:value.id,evidenceDataUrl:value.evidenceDataUrl,evidenceName:text(value.evidenceName,100)||'Comprovante demo',date:text(value.date,40)};
}
function normalizeDemoDeposit(value,p){
  if(!value||typeof value.id!=='string'||!value.id||value.id.length>80||!Number.isSafeInteger(value.amount)||!DEPOSIT_PACKAGES.includes(value.amount))return null;
  if(!PAYMENT_METHODS.some(m=>m.id===value.method)||!Number.isSafeInteger(value.installments)||value.installments<1||value.installments>6||(value.method!=='card'&&value.installments!==1))return null;
  if(typeof value.operationId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(value.operationId))return null;
  const request={id:value.id,operationId:value.operationId,amount:value.amount,method:value.method,installments:value.installments,status:['pending','review','confirmed','rejected','cancelled'].includes(value.status)?value.status:'pending',createdAt:text(value.createdAt,40),confirmedAt:'',rejectedAt:'',cancelledAt:'',receipt:null,receipts:[]};
  if(request.method==='transfer'){
    const receipts=array(value.receipts).map(normalizeDemoReceipt).filter(Boolean),latest=normalizeDemoReceipt(value.receipt);
    const seen=new Set();request.receipts=receipts.filter(r=>!seen.has(r.id)&&seen.add(r.id)).slice(-5);
    if(latest&&!seen.has(latest.id))request.receipts=[...request.receipts,latest].slice(-5);
    request.receipt=latest||request.receipts.at(-1)||null;
    if(request.receipt&&!['cancelled','rejected'].includes(request.status))request.status='review';
    else if(['review','confirmed'].includes(request.status))request.status='pending';
  }else{
    const credit=p.transactions.find(t=>t.ref===`demo-deposit:${request.id}`&&t.amount===request.amount);
    if(credit){request.status='confirmed';request.confirmedAt=text(value.confirmedAt,40)||credit.date;}
    else if(['confirmed','review'].includes(request.status))request.status='pending';
  }
  if(request.status==='cancelled')request.cancelledAt=text(value.cancelledAt,40);
  if(request.status==='rejected')request.rejectedAt=text(value.rejectedAt,40);
  return request;
}
function normalizeDuelReport(r,d){
  if(!r||!r.id||![d.creatorId,d.opponentId].includes(r.submittedBy)||!validEvidence(r.evidenceDataUrl))return null;
  if(!Number.isSafeInteger(r.homeScore)||!Number.isSafeInteger(r.awayScore)||Math.min(r.homeScore,r.awayScore)<0||Math.max(r.homeScore,r.awayScore)>99)return null;
  return {id:text(r.id,80),submittedBy:r.submittedBy,homeScore:r.homeScore,awayScore:r.awayScore,winnerId:r.homeScore===r.awayScore?null:r.homeScore>r.awayScore?d.creatorId:d.opponentId,evidenceDataUrl:r.evidenceDataUrl,evidenceName:text(r.evidenceName,100)||'Foto do resultado',date:text(r.date,40)};
}
function normalizeDuel(value,s){
  if(!value||typeof value.id!=='string'||!value.id||['__proto__','constructor','prototype'].includes(value.id)||value.id.length>80)return null;
  if(!Object.hasOwn(s.profiles,value.creatorId)||!Object.hasOwn(s.profiles,value.opponentId)||value.creatorId===value.opponentId)return null;
  if(!Number.isSafeInteger(value.stake)||value.stake<10||value.stake>5000||!DUEL_MODES.includes(value.mode))return null;
  if(![...DUEL_OPEN,'settled','rejected','cancelled'].includes(value.status))return null;
  const platform=value.platform===undefined?'pc':value.platform;if(!GAME_PLATFORMS.some(item=>item.id===platform))return null;
  const d={id:value.id,publicDuelId:'',operationId:text(value.operationId,80),creatorId:value.creatorId,opponentId:value.opponentId,stake:value.stake,mode:value.mode,platform,rules:text(value.rules,300),status:value.status,createdAt:text(value.createdAt,40)||stamp(),acceptedAt:text(value.acceptedAt,40),reservedBy:[],report:null,reports:[],disputes:[],cancelRequestedBy:null,winnerId:null,settledAt:'',peerConfirmed:false,confirmedBy:null,moderation:null};
  d.report=normalizeDuelReport(value.report,d);
  d.reports=array(value.reports).map(r=>normalizeDuelReport(r,d)).filter(Boolean).slice(-20);
  if(d.report&&!d.reports.some(r=>r.id===d.report.id))d.reports.push(d.report);
  d.disputes=array(value.disputes).filter(r=>r&&[d.creatorId,d.opponentId].includes(r.by)&&validEvidence(r.evidenceDataUrl)).slice(-20).map(r=>({id:text(r.id,80),reportId:text(r.reportId,80),by:r.by,reason:text(r.reason,300),evidenceDataUrl:r.evidenceDataUrl,evidenceName:text(r.evidenceName,100),date:text(r.date,40)}));
  if(['review','disputed'].includes(d.status)&&!d.report)d.status='active';
  d.peerConfirmed=!!(d.report&&value.peerConfirmed&&[d.creatorId,d.opponentId].includes(value.confirmedBy)&&value.confirmedBy!==d.report.submittedBy);
  d.confirmedBy=d.peerConfirmed?value.confirmedBy:null;
  if(['active','review','disputed'].includes(d.status)&&[d.creatorId,d.opponentId].includes(value.cancelRequestedBy))d.cancelRequestedBy=value.cancelRequestedBy;
  if(DUEL_OPEN.includes(d.status)){
    const expected=d.status==='invited'?[d.creatorId]:[d.creatorId,d.opponentId];
    // A stale active record with a payout or refund cannot distribute points twice.
    for(const id of expected){
      const p=s.profiles[id];
      if(!p.transactions.some(t=>t.ref===`duel:${d.id}:reserve`&&t.amount===-d.stake)||p.transactions.some(t=>[`duel:${d.id}:refund`,`duel:${d.id}:payout`].includes(t.ref)))return null;
    }
    d.reservedBy=expected;
  }
  if(d.status==='settled'){
    if(!d.report||!d.peerConfirmed||value.moderation?.source!=='local-demo'||value.moderation?.reviewerId!=='demo-reviewer'||value.moderation?.reportId!==d.report.id||![null,d.creatorId,d.opponentId].includes(value.winnerId))return null;
    d.winnerId=value.winnerId;d.settledAt=text(value.settledAt,40);
    d.moderation={source:'local-demo',reviewerId:'demo-reviewer',reportId:d.report.id,reason:text(value.moderation.reason,300),date:text(value.moderation.date,40)};
  }
  if(['cancelled','rejected'].includes(d.status))d.closedAt=text(value.closedAt,40);
  if(d.status==='cancelled')d.cancelledBy=array(value.cancelledBy).filter(id=>[d.creatorId,d.opponentId].includes(id));
  const preferred=typeof value.publicDuelId==='string'?value.publicDuelId:'';
  if(/^JOGO-[A-F0-9]{8}$/.test(preferred)&&!Object.values(s.duels).some(existing=>existing.publicDuelId===preferred))d.publicDuelId=preferred;
  return d;
}
export function restore(raw,oldProfile=null,oldBets=null){
  const s=emptyState();let d;try{d=typeof raw==='string'?JSON.parse(raw):raw;}catch{}
  if([2,3,4,5,6,7].includes(d?.version)&&d.profiles&&typeof d.profiles==='object'){
    for(const value of Object.values(d.profiles).slice(0,50)){
      if(!value||typeof value.id!=='string'||!value.id||['__proto__','constructor','prototype'].includes(value.id)||typeof value.nickname!=='string'||!value.nickname.trim())continue;
      const p=profile(text(value.nickname,20),value.color);p.id=text(value.id,80);p.createdAt=text(value.createdAt,40)||stamp();p.balance=safeBalance(value.balance);
      p.teamName=text(value.teamName,50).trim();p.teamFlag=TEAM_FLAGS.some(flag=>flag.id===value.teamFlag)?value.teamFlag:'green';
      const club=d.version<6||!Object.hasOwn(value,'clubId')?clubById(value.clubId)||findClub(p.teamName):clubById(value.clubId);
      p.clubId=club?.id||null;if(club)p.teamName=club.name;
      p.ownedStickers=[...new Set(array(value.ownedStickers).filter(id=>STICKERS.some(item=>item.id===id)))];
      p.avatarSticker=p.ownedStickers.includes(value.avatarSticker)?value.avatarSticker:null;
      p.gameAccount=gameAccount(value.gameAccount);
      p.bets=array(value.bets).map(normalizeBet).filter(Boolean).slice(0,1000);
      p.transactions=array(value.transactions).filter(t=>t&&Number.isSafeInteger(t.amount)&&typeof t.ref==='string').map(t=>({id:text(String(t.id),80),ref:text(t.ref,150),kind:text(t.kind,30),label:text(t.label),amount:t.amount,date:text(t.date,40)||stamp()})).slice(0,3000);
      const depositIds=new Set(),operationIds=new Set();
      p.depositRequests=array(value.depositRequests).map(d=>normalizeDemoDeposit(d,p)).filter(d=>d&&!depositIds.has(d.id)&&!operationIds.has(d.operationId)&&depositIds.add(d.id)&&operationIds.add(d.operationId)).slice(0,500);
      p.friends=[...new Set(array(value.friends).filter(id=>PEOPLE.some(w=>w.id===id)))];
      p.requests=array(value.requests).filter(r=>r&&PEOPLE.some(w=>w.id===r.personId)&&['in','out'].includes(r.direction)&&!p.friends.includes(r.personId)).map(r=>({personId:r.personId,direction:r.direction}));
      p.challenges=array(value.challenges).filter(c=>c&&p.friends.includes(c.personId)).map(c=>{
        const evidence=validEvidence(c.evidenceDataUrl)?c.evidenceDataUrl:'';
        let status=['sent','accepted','review','disputed','completed'].includes(c.status)?c.status:'sent';
        let reviewedAt=text(c.reviewedAt,40),winner=['you','friend'].includes(c.winner)?c.winner:'';
        const reportedWinner=['you','friend'].includes(c.reportedWinner)?c.reportedWinner:'';
        if(status==='completed'&&(!reviewedAt||!evidence)){status=evidence?'review':'accepted';winner='';reviewedAt='';}
        if(['review','disputed'].includes(status)&&(!evidence||!reportedWinner))status='accepted';
        return {id:text(c.id,80),personId:c.personId,date:text(c.date,40),stake:[50,100,250,500].includes(Number(c.stake))?Number(c.stake):0,mode:['1v1','Ultimate Team','Clubes'].includes(c.mode)?c.mode:'1v1',status,winner:status==='completed'?winner:'',completedAt:status==='completed'?text(c.completedAt,40):'',reportedWinner,evidenceDataUrl:evidence,evidenceName:text(c.evidenceName,100),submittedAt:text(c.submittedAt,40),fraudReason:text(c.fraudReason,300),flaggedAt:text(c.flaggedAt,40),reviewedAt,originalReport:normalizeResultReport(c.originalReport)};
      });
      p.favorites=[...new Set(array(value.favorites).filter(id=>MATCHES.some(m=>m.id===id)))];
      p.reminders=[...new Set(array(value.reminders).filter(id=>MATCHES.some(m=>m.id===id)))];
      p.visited=[...new Set(array(value.visited).filter(v=>VIEWS.includes(v)))];p.achievements={};
      for(const t of TROPHIES)if(typeof value.achievements?.[t.id]==='string')p.achievements[t.id]=text(value.achievements[t.id],40);
      p.activity=array(value.activity).filter(a=>a&&typeof a.text==='string').slice(0,100).map(a=>({id:text(a.id,80),text:text(a.text,220),icon:text(a.icon,20),date:text(a.date,40)}));p.unread=Math.max(0,Math.min(99,finite(value.unread)));
      ensurePlayerCode(s,p,text(value.publicPlayerId,12));s.profiles[p.id]=p;
    }
    s.version=7;s.activeProfileId=Object.hasOwn(s.profiles,d.activeProfileId)?d.activeProfileId:null;
    for(const value of Object.values(d.duels||{}).slice(0,500)){
      const duel=normalizeDuel(value,s);if(duel&&!Object.hasOwn(s.duels,duel.id))s.duels[duel.id]=duel;
    }
    // Keep all saved codes before assigning codes to older or malformed records.
    for(const duel of Object.values(s.duels))ensureDuelCode(s,duel,duel.publicDuelId);
    for(const m of MATCHES)if(['home','away'].includes(d.results?.[m.id]?.winner))s.results[m.id]={winner:d.results[m.id].winner,date:text(d.results[m.id].date,40)};
    s.legacyArchive=array(d.legacyArchive).map(normalizeBet).filter(Boolean);return s;
  }
  let old,legacy;try{old=typeof oldProfile==='string'?JSON.parse(oldProfile):oldProfile;}catch{}
  try{legacy=typeof oldBets==='string'?JSON.parse(oldBets):oldBets;}catch{}
  const bets=array(legacy).map(b=>{
    if(!b||!Number.isInteger(b.stake)||!Number.isFinite(b.odds))return null;
    const m=MATCHES.find(m=>m.home===b.home&&m.away===b.away);
    return normalizeBet({...b,id:`legacy-${b.id}`,matchId:m?.id||'',league:b.event,side:b.selection===b.away?'away':'home',odd:b.odds,date:stamp(),status:'pending'});
  }).filter(Boolean);
  if(old&&typeof old.nickname==='string'&&old.nickname.trim()){
    const p=profile(text(old.nickname,20));p.id='legacy-profile';ensurePlayerCode(s,p);p.balance=safeBalance(old.balance);p.bets=bets;p.transactions=[{id:uid(),ref:'migration',kind:'migration',label:'Saldo do protótipo anterior',amount:p.balance,date:stamp()}];awards(p);s.profiles[p.id]=p;s.activeProfileId=p.id;
  }else s.legacyArchive=bets;
  return s;
}
