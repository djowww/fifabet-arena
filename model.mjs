export const STORAGE_KEY = 'fifabet:arena:v2';
export const VIEWS = ['arena', 'bets', 'wallet', 'trophies', 'friends'];
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
export const TROPHIES = [
  {id:'welcome',name:'Primeiro passo',description:'Crie seu perfil na arena.',icon:'flag',color:'mint'},
  {id:'favorite',name:'Na torcida',description:'Salve uma partida nos favoritos.',icon:'star',color:'amber'},
  {id:'firstbet',name:'Visão de jogo',description:'Registre seu primeiro palpite.',icon:'ticket',color:'blue'},
  {id:'winner',name:'Bola na rede',description:'Conclua um palpite vencedor na simulação.',icon:'target',color:'mint'},
  {id:'friend',name:'Joga junto',description:'Adicione seu primeiro amigo demo.',icon:'users',color:'pink'},
  {id:'explorer',name:'Explorador',description:'Visite as cinco áreas da FifaBet.',icon:'compass',color:'violet'}
];
const stamp=()=>new Date().toISOString();
const uid=()=>globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const copy=x=>JSON.parse(JSON.stringify(x));
export const emptyState=()=>({version:2,activeProfileId:null,profiles:{},results:{},legacyArchive:[]});
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
function profile(name,color='mint'){
  const date=stamp();
  return {id:uid(),nickname:name,color:COLORS.includes(color)?color:'mint',createdAt:date,balance:1000,bets:[],transactions:[{id:uid(),ref:'welcome',kind:'bonus',label:'Boas-vindas à arena',amount:1000,date}],friends:[],requests:[{personId:'bia',direction:'in'}],challenges:[],favorites:[],reminders:[],achievements:{},visited:[],activity:[],unread:0};
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
function awards(p){
  const ready={welcome:true,favorite:p.favorites.length>0,firstbet:p.bets.length>0,winner:p.bets.some(b=>b.status==='won'),friend:p.friends.length>0,explorer:VIEWS.every(v=>p.visited.includes(v))};
  for(const t of TROPHIES)if(ready[t.id]&&!p.achievements[t.id]){p.achievements[t.id]=stamp();activity(p,`Troféu desbloqueado: ${t.name}`,'trophy');}
}
function requireProfile(s){const p=current(s);if(!p)throw Error('Entre em um perfil demo para continuar.');return p;}
function person(id){if(!PEOPLE.some(p=>p.id===id))throw Error('Jogador não encontrado.');return PEOPLE.find(p=>p.id===id);}
export function change(input,action,data={}){
  const s=copy(input);let p=current(s);
  if(action==='create'){
    const name=nickname(data.nickname);
    if(Object.values(s.profiles).some(x=>x.nickname.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('Esse apelido já existe neste navegador. Use a aba Entrar para continuar.');
    p=profile(name,data.color);s.profiles[p.id]=p;s.activeProfileId=p.id;activity(p,'Seu perfil demo está pronto. Você recebeu 1.000 pontos.','user');
  }else if(action==='login'){
    if(!Object.hasOwn(s.profiles,data.id))throw Error('Perfil não encontrado.');s.activeProfileId=data.id;p=current(s);
  }else if(action==='logout'){s.activeProfileId=null;return s;}
  else {
    p=requireProfile(s);
    if(action==='visit'){if(VIEWS.includes(data.view)&&!p.visited.includes(data.view))p.visited.push(data.view);}
    else if(action==='profile'){
      const name=nickname(data.nickname);
      if(Object.values(s.profiles).some(x=>x.id!==p.id&&x.nickname.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('Esse apelido já está em uso neste navegador.');
      p.nickname=name;if(COLORS.includes(data.color))p.color=data.color;
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
      p.friends=p.friends.filter(id=>id!==data.id);p.challenges=p.challenges.filter(c=>c.personId!==data.id);
    }else if(action==='challenge'){
      const who=person(data.id);if(!p.friends.includes(who.id))throw Error('Adicione esse jogador aos amigos primeiro.');
      if(p.challenges.some(c=>c.personId===who.id))throw Error('Já existe um desafio demo pendente para esse amigo.');
      p.challenges.push({id:uid(),personId:who.id,date:stamp()});activity(p,`Desafio amistoso enviado para ${who.name}. Sem pontos envolvidos.`,'gamepad');
    }else if(action==='cancelChallenge'){p.challenges=p.challenges.filter(c=>c.id!==data.id);}
    else if(action==='readActivity'){p.unread=0;}
    else throw Error('Ação desconhecida.');
  }
  if(p)awards(p);return s;
}
const array=x=>Array.isArray(x)?x:[];
const finite=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback;
const safeBalance=x=>Math.max(0,Math.min(1e9,Math.floor(finite(x))));
const text=(x,max=120)=>typeof x==='string'?x.slice(0,max):'';
function normalizeBet(b){
  if(!b||!Number.isSafeInteger(b.stake)||b.stake<10||b.stake>1e9||!Number.isFinite(b.odd)||b.odd<=1||!Number.isSafeInteger(payout(b.stake,b.odd)))return null;
  return {id:text(String(b.id),80)||uid(),matchId:text(b.matchId,20),home:text(b.home,30),away:text(b.away,30),league:text(b.league),side:b.side==='away'?'away':'home',selection:text(b.selection,30),stake:b.stake,odd:b.odd,potential:payout(b.stake,b.odd),status:['pending','won','lost'].includes(b.status)?b.status:'pending',date:text(b.date,40)||stamp(),settledAt:text(b.settledAt,40)};
}
export function restore(raw,oldProfile=null,oldBets=null){
  const s=emptyState();let d;try{d=typeof raw==='string'?JSON.parse(raw):raw;}catch{}
  if(d?.version===2&&d.profiles&&typeof d.profiles==='object'){
    for(const value of Object.values(d.profiles).slice(0,50)){
      if(!value||typeof value.id!=='string'||!value.id||['__proto__','constructor','prototype'].includes(value.id)||typeof value.nickname!=='string'||!value.nickname.trim())continue;
      const p=profile(text(value.nickname,20),value.color);p.id=text(value.id,80);p.createdAt=text(value.createdAt,40)||stamp();p.balance=safeBalance(value.balance);
      p.bets=array(value.bets).map(normalizeBet).filter(Boolean).slice(0,1000);
      p.transactions=array(value.transactions).filter(t=>t&&Number.isSafeInteger(t.amount)&&typeof t.ref==='string').map(t=>({id:text(String(t.id),80),ref:text(t.ref,150),kind:text(t.kind,30),label:text(t.label),amount:t.amount,date:text(t.date,40)||stamp()})).slice(0,3000);
      p.friends=[...new Set(array(value.friends).filter(id=>PEOPLE.some(w=>w.id===id)))];
      p.requests=array(value.requests).filter(r=>r&&PEOPLE.some(w=>w.id===r.personId)&&['in','out'].includes(r.direction)&&!p.friends.includes(r.personId)).map(r=>({personId:r.personId,direction:r.direction}));
      p.challenges=array(value.challenges).filter(c=>c&&p.friends.includes(c.personId)).map(c=>({id:text(c.id,80),personId:c.personId,date:text(c.date,40)}));
      p.favorites=[...new Set(array(value.favorites).filter(id=>MATCHES.some(m=>m.id===id)))];
      p.reminders=[...new Set(array(value.reminders).filter(id=>MATCHES.some(m=>m.id===id)))];
      p.visited=[...new Set(array(value.visited).filter(v=>VIEWS.includes(v)))];p.achievements={};
      for(const t of TROPHIES)if(typeof value.achievements?.[t.id]==='string')p.achievements[t.id]=text(value.achievements[t.id],40);
      p.activity=array(value.activity).filter(a=>a&&typeof a.text==='string').slice(0,100).map(a=>({id:text(a.id,80),text:text(a.text,220),icon:text(a.icon,20),date:text(a.date,40)}));p.unread=Math.max(0,Math.min(99,finite(value.unread)));
      s.profiles[p.id]=p;
    }
    s.activeProfileId=Object.hasOwn(s.profiles,d.activeProfileId)?d.activeProfileId:null;
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
    const p=profile(text(old.nickname,20));p.id='legacy-profile';p.balance=safeBalance(old.balance);p.bets=bets;p.transactions=[{id:uid(),ref:'migration',kind:'migration',label:'Saldo do protótipo anterior',amount:p.balance,date:stamp()}];awards(p);s.profiles[p.id]=p;s.activeProfileId=p.id;
  }else s.legacyArchive=bets;
  return s;
}
