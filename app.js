import {STORAGE_KEY,VIEWS,MATCHES,PEOPLE,COLORS,TROPHIES,emptyState,current,points,payout,validStake,change,restore} from './model.mjs?v=2';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 gamepad:'M6 9h12a3 3 0 0 1 3 3l1 5a2 2 0 0 1-3 2l-3-2H8l-3 2a2 2 0 0 1-3-2l1-5a3 3 0 0 1 3-3M7 11v4M5 13h4M16 12h.01M19 14h.01M9 9V7h6V5',
 ticket:'M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4M14 7v2m0 3v1m0 3v1',
 wallet:'M20 8H5a3 3 0 0 1 0-6h13v6M3 5v14a2 2 0 0 0 2 2h15V8M16 12h6v5h-6zM18 14.5h.01',
 trophy:'M8 3h8v6a4 4 0 0 1-8 0V3M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6v3H9z',
 users:'M15 21v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3M21 21v-3a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 user:'M20 21v-3a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v3M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 plus:'M12 5v14M5 12h14',minus:'M5 12h14',chevron:'m9 5 7 7-7 7',down:'m6 9 6 6 6-6',close:'m6 6 12 12M6 18 18 6',
 check:'m5 12 4 4L19 6',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z',
 arrow:'M5 12h14m-6-6 6 6-6 6',arrowup:'M12 19V5m-6 6 6-6 6 6',arrowdown:'M12 5v14m-6-6 6 6 6-6',
 info:'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 shield:'m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4zM8 12l3 3 5-6',
 flag:'M4 22V3m0 0h7l2 3h7v11h-7l-2-3H4',
 target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
 compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-5-13-3 7-7 3 3-7 7-3z',
 lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
 credit:'M3 4h18v16H3zM3 9h18M7 16h3',pix:'m12 2 10 10-10 10L2 12 12 2zM6 8l4 4-4 4m12-8-4 4 4 4M10 12h4',
 logout:'M9 3H4v18h5m6-5 5-4-5-4M8 12h12',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
 play:'m8 4 12 8-12 8V4z',clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',heart:'M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 8 15 8 15S25 10 20 5z'
};
const icon=(name,cls='')=>`<svg class='icon ${cls}' viewBox='0 0 24 24' aria-hidden='true'><path d='${paths[name]||paths.info}'/></svg>`;
const initials=n=>String(n).replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase();
const avatar=(name,color='mint',size='')=>`<span class='avatar ${COLORS.includes(color)?color:'mint'} ${size}' aria-hidden='true'>${esc(initials(name))}</span>`;
const date=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Agora';};
const time=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';};
const newId=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const routes={arena:'arena',amigos:'friends',ranking:'ranking',palpites:'bets',historico:'bets',trofeus:'trophies',conquistas:'trophies',carteira:'wallet'};
const labels={arena:'Desafios',friends:'Amigos',ranking:'Ranking',bets:'Histórico',wallet:'Pontos',trophies:'Conquistas'};
const navViews=['arena','friends','ranking','bets','trophies'];
const navIcons={arena:'gamepad',friends:'users',ranking:'trophy',bets:'ticket',trophies:'shield',wallet:'wallet'};
let localOnly=false;
function read(key){try{return localStorage.getItem(key);}catch{localOnly=true;return null;}}
let state=restore(read(STORAGE_KEY),read('fifabet-profile'),read('fifabet-bets'));
function readSlip(profileId){
 let value;try{value=JSON.parse(sessionStorage.getItem(`fifabet-slip:v2:${profileId||'guest'}`)||'null');}catch{}
 const pick=value?.pick&&MATCHES.some(m=>m.id===value.pick.matchId&&['home','away'].includes(value.pick.side))?value.pick:null;
 return {pick,stake:typeof value?.stake==='string'||typeof value?.stake==='number'?String(value.stake):'100'};
}
const cachedPick=readSlip(state.activeProfileId);
const ui={view:routes[location.hash.slice(1)]||'arena',matchFilter:'all',category:'all',featured:'m1',pick:cachedPick?.pick||null,stake:cachedPick?.stake||'100',betFilter:'all',friendTab:'discover',friendSearch:'',walletFilter:'all',authTab:'login',color:'mint',payment:null,modalKind:null,afterLogin:null};
if(ui.pick&&!MATCHES.some(m=>m.id===ui.pick.matchId&&['home','away'].includes(ui.pick.side)))ui.pick=null;
let paymentTimer=null,toastTimer=null,dialogOpener=null;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{localOnly=true;} $('storageWarning').hidden=!localOnly;}
function saveSlip(profileId=state.activeProfileId){try{sessionStorage.setItem(`fifabet-slip:v2:${profileId||'guest'}`,JSON.stringify({pick:ui.pick,stake:ui.stake}));}catch{}}
function switchSlip(previousId,nextId,carryGuest=true){
 saveSlip(previousId);const guestPick=!previousId&&nextId&&ui.pick&&carryGuest?{pick:ui.pick,stake:ui.stake}:null;
 const next=guestPick||readSlip(nextId);ui.pick=next.pick;ui.stake=next.stake;
 if(guestPick){try{sessionStorage.removeItem('fifabet-slip:v2:guest');}catch{}saveSlip(nextId);}
}
function commit(action,data={}){
  let base=state;const latest=localOnly?null:read(STORAGE_KEY);if(latest)base=restore(latest);
  if(data.profileId&&base.activeProfileId!==data.profileId)throw Error('O perfil mudou. Reabra a ação para continuar.');
  const next=change(base,action,data);if(state.activeProfileId!==next.activeProfileId)switchSlip(state.activeProfileId,next.activeProfileId);
  state=next;persist();return current(state);
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function withProfile(callback){if(current(state)){callback();return;}ui.afterLogin=callback;showAuth(Object.keys(state.profiles).length?'login':'create');}
function level(p){const xp=Object.keys(p?.achievements||{}).length*100;return {xp,number:1+Math.floor(xp/200),progress:xp%200};}
function guestBanner(title='Seu espaço na arena',description='Entre em um perfil demo para explorar esta área.'){
 return `<div class='guest-banner'><div><h3>${title}</h3><p>${description}</p></div><button class='btn primary' data-action='auth'>Entrar na demo ${icon('arrow')}</button></div>`;
}
function heading(title,description,actions=''){return `<section class='page-heading'><div><p class='eyebrow'>FIFABET ARENA</p><h1>${title}</h1><p>${description}</p></div>${actions?`<div class='actions'>${actions}</div>`:''}</section>`;}
function empty(title,description,action=''){return `<div class='empty-state'><div class='empty-emblem'>${icon('compass')}</div><h3>${title}</h3><p>${description}</p>${action}</div>`;}
function renderHeader(){
 const p=current(state);
 $('headerActions').innerHTML=p?`<button class='balance-button' data-route='wallet' aria-label='Abrir pontos demo, saldo ${points(p.balance)}'>${icon('wallet')}<span><small>PONTOS DEMO</small><strong>${points(p.balance)} <span class='muted'>pts</span></strong></span></button><button class='icon-only notify-button' data-action='activity' aria-label='Atividade${p.unread?', '+p.unread+' novidades':''}'>${icon('bell')}${p.unread?`<span class='notify-badge'>${p.unread>9?'9+':p.unread}</span>`:''}</button><button class='profile-button' data-action='profile' aria-label='Abrir perfil de ${esc(p.nickname)}'>${avatar(p.nickname,p.color,'small')}<span class='profile-name meta'>${esc(p.nickname)}</span>${icon('down')}</button>`:`<button class='btn secondary' data-action='auth' data-mode='login'>Entrar</button><button class='btn primary guest-register' data-action='auth' data-mode='create'>Criar perfil ${icon('arrow')}</button>`;
 $('breadcrumb').textContent=labels[ui.view];
 $('navigation').innerHTML=navViews.map(v=>`<a class='nav-item ${ui.view===v?'active':''}' href='#${Object.keys(routes).find(k=>routes[k]===v)}' ${ui.view===v?"aria-current='page'":''} aria-label='${labels[v]}'>${icon(navIcons[v])}<span>${labels[v]}</span>${v==='friends'&&p?.requests.filter(r=>r.direction==='in').length?`<b class='count'>${p.requests.filter(r=>r.direction==='in').length}</b>`:''}</a>`).join('');
}
function spotlight(){
 const m=MATCHES.find(x=>x.id===ui.featured)||MATCHES[0],r=state.results[m.id];
 return `<section class='spotlight' aria-label='Confronto em destaque'><div class='spotlight-header'><div><div class='league-name'>${m.league} <span class='meta'>/ ${m.stage}</span></div></div><span class='pill ${r?'subtle':m.phase==='live'?'live':'violet'}'>${r?'Encerrado':m.phase==='live'?"<i class='status-dot'></i>Ao vivo · demo":'Em breve'}</span></div><div class='spotlight-score'><div class='spotlight-player'>${avatar(m.home,'mint')}<strong>${m.home}</strong><small>JOGADOR 01</small></div><div><div class='score-main'>${r?'✓':m.phase==='live'?`${m.score[0]}<span>:</span>${m.score[1]}`:'VS'}</div><span class='game-clock'>${r?`Venceu ${m[r.winner]}`:m.phase==='live'?`${m.minute}′ · ${m.minute>45?'2º':'1º'} tempo`:m.stage}</span></div><div class='spotlight-player'>${avatar(m.away,'violet')}<strong>${m.away}</strong><small>JOGADOR 02</small></div></div><div class='spotlight-footer'><p>${icon('gamepad')} EA SPORTS FC <span class='muted'>· ${m.type==='professional'?'Profissional':'Comunidade'}</span></p><button class='btn small' data-action='match' data-id='${m.id}'>${icon('play')}Acompanhar</button></div></section>`;
}
function matchCard(m){
 const p=current(state),r=state.results[m.id],fav=p?.favorites.includes(m.id);
 return `<article class='match-card ${ui.pick?.matchId===m.id?'selected-match':''}'><div class='match-card-top'><span class='pill ${r?'subtle':m.phase==='live'?'live':'subtle'}'>${r?'Encerrado':m.phase==='live'?`<i class='status-dot'></i>${m.minute}′ · Ao vivo`:m.stage.split(' · ').slice(0,2).join(' · ')}</span><button class='icon-only ${fav?'selected':''}' data-action='favorite' data-id='${m.id}' aria-label='${fav?'Remover dos favoritos':'Favoritar'} ${m.home} contra ${m.away}' aria-pressed='${!!fav}'>${icon('star')}</button></div><h3>${m.league}</h3><p class='competition'>${m.type==='professional'?'Profissional':'Comunidade'} · ${m.phase==='live'?m.stage:'Próximo confronto'}</p><div class='team-row'>${avatar(m.home,'mint')}<span class='team-name'>${m.home}</span><span class='team-score'>${!r&&m.phase==='live'?m.score[0]:'—'}</span></div><div class='team-row'>${avatar(m.away,'violet')}<span class='team-name'>${m.away}</span><span class='team-score'>${!r&&m.phase==='live'?m.score[1]:'—'}</span></div>${r?`<div class='closed-note'>${icon('check')} ${m[r.winner]} venceu na simulação</div>`:`<div class='odds-grid' aria-label='Vencedor do confronto incluindo desempate'>${['home','away'].map((side,i)=>`<button class='odd ${ui.pick?.matchId===m.id&&ui.pick.side===side?'active':''}' data-action='pick' data-id='${m.id}' data-side='${side}' aria-pressed='${ui.pick?.matchId===m.id&&ui.pick.side===side}' aria-label='Palpite em ${m[side]}, odd ${m.odds[i].toFixed(2)}'><span>${m[side]}</span><strong>${m.odds[i].toFixed(2)}</strong></button>`).join('')}</div>`}<div class='match-card-footer'><button class='text-button muted' data-action='match' data-id='${m.id}'>Ver confronto ${icon('chevron')}</button>${m.phase==='soon'&&!r?`<button class='text-button' data-action='reminder' data-id='${m.id}' aria-pressed='${!!p?.reminders.includes(m.id)}'>${icon(p?.reminders.includes(m.id)?'check':'bell')}${p?.reminders.includes(m.id)?'Lembrete ativo':'Lembrar'}</button>`:''}</div></article>`;
}
function matchList(){
 const p=current(state),rows=MATCHES.filter(m=>(ui.category==='all'||m.type===ui.category)&&(ui.matchFilter==='all'||ui.matchFilter===m.phase&&!state.results[m.id]||ui.matchFilter==='favorites'&&p?.favorites.includes(m.id)));
 return rows.length?rows.map(matchCard).join(''):empty('Nenhuma partida por aqui',ui.matchFilter==='favorites'?'Toque na estrela de um confronto para encontrá-lo aqui.':'Experimente outra categoria ou veja todas as partidas.',`<button class='btn secondary' data-action='clearFilters'>Ver todas as partidas</button>`);
}
function slipHTML(modal=false){
 const p=current(state),pick=ui.pick,m=MATCHES.find(m=>m.id===pick?.matchId);
 if(!m)return `<div class='slip-title'><h2>Seu boletim</h2><span class='pill subtle'>SIMPLES</span></div><div class='slip-empty'><div class='empty-emblem'>${icon('ticket')}</div><h3>Qual é o seu palpite?</h3><p>Escolha a odd de um jogador para começar.</p></div><div class='slip-tip'>${icon('info')}<span>O mercado considera o vencedor do confronto, incluindo desempate.</span></div>`;
 const odd=m.odds[pick.side==='home'?0:1],error=validStake(ui.stake,p?.balance??Infinity),short=error==='Seu saldo demo é insuficiente.';
 return `${modal?'':"<div class='slip-title'><h2>Seu boletim</h2><span class='pill lime'>1 seleção</span></div>"}<p class='slip-label'>Vencedor do confronto · inclui desempate</p><div class='selection-box'><div class='selection-top'><span>${m.league}</span><button data-action='clearPick' aria-label='Remover palpite'>${icon('close')}</button></div><p class='selection-name'>${m.home} <span class='muted'>×</span> ${m.away}</p><div class='selection-odd'><span>${m[pick.side]}</span><strong>${odd.toFixed(2)}</strong></div></div><label class='form-label' for='${modal?'stakeModal':'stakeMain'}'>Seu palpite</label><div class='stake-field'><input id='${modal?'stakeModal':'stakeMain'}' data-stake type='number' inputmode='numeric' step='1' min='10' value='${esc(ui.stake)}' aria-describedby='${modal?'stakeErrorModal':'stakeErrorMain'}'><span>PTS</span></div><div class='quick-values'><button data-action='amount' data-value='50'>50 pts</button><button data-action='amount' data-value='100'>100 pts</button><button data-action='amount' data-value='250'>250 pts</button></div><p class='form-error' data-stake-error id='${modal?'stakeErrorModal':'stakeErrorMain'}'>${error}</p><div class='return-block'><div class='summary-line'><span>Retorno potencial</span><strong data-return>${error&&!short?'—':points(payout(Number(ui.stake)||0,odd))+' pts'}</strong></div><p class='meta'>Inclui os pontos usados no palpite.</p></div><button class='btn primary wide' data-action='reviewBet' data-review ${error&&!short?'disabled':''}>${short?'Adicionar saldo':p?'Revisar palpite':'Entrar para continuar'}${icon('arrow')}</button><p class='slip-note'>${p?`Disponível: <b>${points(p.balance)} pontos demo</b>.`:'Você começa com 1.000 pontos demo.'} Pontos sem valor financeiro.</p>`;
}
function rankingEntries(){
 const p=current(state),entries=PEOPLE.map(w=>({id:w.id,name:w.name,color:w.color,wins:w.wins+(p?.challenges.filter(c=>c.personId===w.id&&c.status==='completed'&&c.winner==='friend').length||0),medals:w.trophies,level:w.level,tag:w.tag,isYou:false}));
 if(p)entries.push({id:'you',name:p.nickname,color:p.color,wins:p.bets.filter(b=>b.status==='won').length+p.challenges.filter(c=>c.status==='completed'&&c.winner==='you').length,medals:Object.keys(p.achievements).length,level:level(p).number,tag:'Seu perfil',isYou:true});
 return entries.sort((a,b)=>b.wins-a.wins||b.medals-a.medals||b.level-a.level||a.name.localeCompare(b.name,'pt-BR'));
}
function leaderboardRow(player,index){
 const medal=['🥇','🥈','🥉'][index]||String(index+1).padStart(2,'0');
 return `<div class='leader-row ${player.isYou?'you':''}'><span class='rank-position ${index<3?'podium':''}'>${medal}</span>${avatar(player.name,player.color)}<div class='leader-copy'><strong>${esc(player.name)}${player.isYou?` <span class='pill lime'>VOCÊ</span>`:''}</strong><small>${player.wins} vitórias · ${player.medals} medalhas</small></div><span class='leader-level'>NV. ${player.level}</span></div>`;
}
function duelCard(c){
 const w=PEOPLE.find(person=>person.id===c.personId),status=c.status||'sent',label=status==='sent'?'Convite enviado':status==='accepted'?'Partida confirmada':c.winner==='you'?'Você venceu':'Amigo venceu';
 const actions=status==='sent'?`<div class='challenge-row-actions'><button class='btn small primary' data-action='acceptChallenge' data-id='${esc(c.id)}'>Simular aceite</button><button class='btn small secondary' data-action='cancelChallenge' data-id='${esc(c.id)}'>Cancelar</button></div>`:status==='accepted'?`<button class='btn small primary' data-action='challengeResult' data-id='${esc(c.id)}'>Registrar resultado</button>`:'';
 return `<div class='challenge-row ${status==='completed'?'completed':''}'>${avatar(w?.name||'Amigo',w?.color||'mint','small')}<div class='grow'><strong>vs ${esc(w?.name||'Amigo')}</strong><small>${esc(c.mode||'1v1')} · ${c.stake?`${points(c.stake)} pts simbólicos`:'amistoso'}</small></div><span class='pill ${status==='sent'?'amber':status==='accepted'?'mint':'subtle'}'>${label}</span>${actions}</div>`;
}
function renderArena(){
 const p=current(state),duels=p?.challenges||[],myWins=p?(p.bets.filter(b=>b.status==='won').length+duels.filter(c=>c.status==='completed'&&c.winner==='you').length):0,medals=Object.keys(p?.achievements||{}).length,nextFriend=p?.friends.map(id=>PEOPLE.find(w=>w.id===id)).find(Boolean);
 const heroOpponent=nextFriend||PEOPLE.find(w=>w.online);
 const hero=`<section class='duel-hero'><div class='duel-hero-copy'><span class='pill lime'>EA SPORTS FC · ARENA DE AMIGOS</span><p class='eyebrow'>O PRÓXIMO CLÁSSICO COMEÇA AQUI</p><h2>Hoje tem revanche?</h2><p>Escolha um amigo, combine o modo e defina pontos simbólicos. A rivalidade fica; o dinheiro real fica fora.</p><button class='btn primary' data-route='amigos'>${icon('gamepad')}Criar desafio ${icon('arrow')}</button><span class='duel-note'>Pontos de demonstração · sem depósitos ou transferências</span></div><div class='duel-faceoff' aria-label='Confronto de exemplo'><div class='faceoff-player'>${p?avatar(p.nickname,p.color,'large'):`<span class='avatar large'>?</span>`}<strong>${p?esc(p.nickname):'Você'}</strong><small>JOGA EM CASA</small></div><span class='faceoff-vs'>VS</span><div class='faceoff-player'>${avatar(heroOpponent.name,heroOpponent.color,'large')}<strong>${esc(heroOpponent.name)}</strong><small>${heroOpponent.online?'ONLINE AGORA':'NA SUA ARENA'}</small></div></div><div class='duel-decor' aria-hidden='true'>⚽</div></section>`;
 const openDuels=duels.filter(c=>['sent','accepted'].includes(c.status));
 const activeDuels=openDuels.length?openDuels.slice(0,3).map(duelCard).join(''):`<div class='duel-empty'><span class='empty-emblem'>${icon('gamepad')}</span><strong>Seu próximo clássico está esperando.</strong><p>Adicione um amigo e envie um desafio em poucos toques.</p><button class='text-button' data-route='amigos'>Encontrar amigos ${icon('arrow')}</button></div>`;
 const card=`<aside class='card player-card'><div class='card-top'><h2>Seu perfil</h2><button class='text-button' data-action='profile'>Editar</button></div>${p?`<div class='player-profile'>${avatar(p.nickname,p.color,'large')}<div><h3>${esc(p.nickname)}</h3><p class='meta'>Nível ${level(p).number} · Jogador da arena</p></div></div><div class='player-stats'><div><strong>${myWins}</strong><small>vitórias</small></div><div><strong>${medals}</strong><small>medalhas</small></div><div><strong>${p.friends.length}</strong><small>amigos</small></div></div><button class='btn secondary wide' data-route='conquistas'>Ver minhas medalhas ${icon('arrow')}</button>`:`<div class='profile-placeholder'><span class='avatar large'>?</span><h3>Crie seu perfil de jogador</h3><p>Escolha seu apelido e avatar para entrar no ranking da arena.</p><button class='btn primary wide' data-action='auth' data-mode='create'>Criar perfil ${icon('arrow')}</button></div>`}</aside>`;
 const leaders=rankingEntries().slice(0,3).map(leaderboardRow).join('');
 return heading('A bola está com vocês.','Desafie um amigo no EA SPORTS FC e transforme cada partida em clássico.',`<button class='btn secondary' data-route='ranking'>${icon('trophy')}Ver ranking</button>`)+hero+(!p?guestBanner('Monte seu perfil de jogador','Seu apelido, avatar e medalhas acompanham você pela arena.'):'')+`<div class='dashboard-columns'><section class='card dashboard-card'><div class='card-top'><div><p class='eyebrow'>CARA A CARA</p><h2>Desafios em aberto</h2></div><button class='text-button' data-route='amigos'>Ver amigos ${icon('arrow')}</button></div><div class='challenge-list'>${activeDuels}</div></section>${card}<section class='card dashboard-card leaderboard-preview'><div class='card-top'><div><p class='eyebrow'>TEMPORADA DE EXEMPLO</p><h2>Quem está no topo</h2></div><button class='text-button' data-route='ranking'>Classificação ${icon('arrow')}</button></div><div class='leader-list'>${leaders}</div><p class='ranking-note'>Ranking ilustrativo · os perfis desta demo não são jogadores conectados.</p></section><section class='card points-note'><span class='points-note-icon'>${icon('shield')}</span><div><h2>Jogue leve, jogue junto.</h2><p>Desafios usam pontos fictícios só para deixar a disputa mais divertida. Nada de dinheiro real, cobrança ou transferência.</p></div></section></div>`;
}
function renderRanking(){
 const entries=rankingEntries();
 return heading('A tabela da arena.','Vitórias, medalhas e uma boa história para contar.',`<button class='btn primary' data-route='amigos'>${icon('users')}Desafiar um amigo</button>`)+`<section class='ranking-hero'><div><p class='eyebrow'>TEMPORADA DEMONSTRATIVA</p><h2>Todo clássico conta.</h2><p>Ganhe partidas entre amigos, conquiste medalhas e suba na classificação.</p></div><div class='ranking-hero-medal' aria-hidden='true'>🏆</div></section><section class='card ranking-board'><div class='ranking-head'><span>POSIÇÃO · JOGADOR</span><span>VITÓRIAS</span><span>MEDALHAS</span><span>NÍVEL</span></div>${entries.map((player,index)=>`<div class='ranking-entry ${player.isYou?'you':''}'><span class='ranking-place'>${['🥇','🥈','🥉'][index]||String(index+1).padStart(2,'0')}</span><div class='ranking-person'>${avatar(player.name,player.color)}<div><strong>${esc(player.name)}${player.isYou?` <span class='pill lime'>VOCÊ</span>`:''}</strong><small>${esc(player.tag)}</small></div></div><strong class='ranking-number'>${player.wins}</strong><strong class='ranking-number medal-count'>${player.medals} <span aria-hidden='true'>🏅</span></strong><span class='ranking-level'>Nv. ${player.level}</span></div>`).join('')}</section><p class='ranking-note'>Classificação de exemplo para este protótipo. Os dados não são compartilhados entre dispositivos.</p>`;
}
function stats(items){return `<div class='stat-grid'>${items.map((x,i)=>`<div class='stat ${i===0?'lime-stat':''}'><span class='stat-icon'>${icon(x.icon||'target')}</span><p class='stat-label'>${x.label}</p><p class='stat-value'>${x.value}</p>${x.note?`<p class='stat-note'>${x.note}</p>`:''}</div>`).join('')}</div>`;}
function betCard(b,archived=false){
 const names={pending:'Pendente',won:'Vencedor',lost:'Encerrado'},colors={pending:'amber',won:'lime',lost:'subtle'};
 return `<article class='card bet-card'><div class='between'><span class='meta'>${esc(b.league)} · ${date(b.date)}</span><span class='pill ${colors[b.status]}'>${names[b.status]}</span></div><h3 class='bet-title'>${esc(b.home)} <span class='muted'>×</span> ${esc(b.away)}</h3><p class='bet-pick'>Seu escolhido: <strong>${esc(b.selection)}</strong></p><div class='bet-stats'><div><small>Palpite</small><strong>${points(b.stake)} pts</strong></div><div><small>Odd</small><strong>${Number(b.odd).toFixed(2)}</strong></div><div><small>${b.status==='pending'?'Retorno potencial':'Retorno'}</small><strong class='${b.status==='won'?'positive':''}'>${points(b.status==='lost'?0:b.potential)} pts</strong></div></div><div class='bet-actions'><span class='meta'>${b.status==='pending'?'Aguardando resultado demo':'Resultado demonstrativo finalizado'}</span>${!archived&&b.status==='pending'&&MATCHES.some(m=>m.id===b.matchId)?`<button class='btn small secondary' data-action='settle' data-id='${esc(b.matchId)}'>${icon('flag')}Simular resultado</button>`:''}</div></article>`;
}
function renderBets(){
 const p=current(state),bets=p?.bets||[],filtered=bets.filter(b=>ui.betFilter==='all'||b.status===ui.betFilter);
 return heading('Seus palpites. Tudo em jogo.','Do primeiro palpite ao resultado, acompanhe cada confronto.',`<button class='btn secondary' data-route='arena'>Explorar partidas ${icon('arrow')}</button>`)+(!p?guestBanner():'')+stats([{label:'Em andamento',value:bets.filter(b=>b.status==='pending').length,icon:'clock'},{label:'Palpites vencedores',value:bets.filter(b=>b.status==='won').length,icon:'trophy'},{label:'Retornos demo',value:points(bets.filter(b=>b.status==='won').reduce((s,b)=>s+b.potential,0)),note:'pontos devolvidos à carteira',icon:'wallet'}])+`<div class='filters'><div class='segmented' aria-label='Filtrar palpites'>${[['all','Todos'],['pending','Pendentes'],['won','Vencedores'],['lost','Encerrados']].map(([id,label])=>`<button class='segment ${ui.betFilter===id?'active':''}' data-action='betFilter' data-value='${id}' aria-pressed='${ui.betFilter===id}'>${label}</button>`).join('')}</div></div><div class='history-list'>${filtered.length?filtered.map(b=>betCard(b)).join(''):empty('Seu próximo palpite começa na arena.',ui.betFilter==='all'?'Escolha um confronto, selecione um jogador e experimente com pontos demo.':'Você ainda não tem palpites neste filtro.',`<button class='btn primary' data-route='arena'>Ver partidas ${icon('arrow')}</button>`)}</div>${state.legacyArchive.length?`<details class='archive'><summary>Histórico anterior sem perfil (${state.legacyArchive.length})</summary><p class='meta'>Registros preservados do protótipo anterior, sem associação a uma conta.</p><div class='history-list'>${state.legacyArchive.map(b=>betCard(b,true)).join('')}</div></details>`:''}`;
}
function transactionRows(){
 const p=current(state),rows=(p?.transactions||[]).filter(t=>ui.walletFilter==='all'||t.kind===ui.walletFilter);
 if(!rows.length)return empty('Nenhum movimento neste filtro.','Os pontos adicionados, palpites e retornos aparecem aqui.');
 return `<div class='table-scroll'><table class='transaction-table'><thead><tr><th>Movimentação</th><th class='date-column'>Data</th><th style='text-align:right'>Pontos</th></tr></thead><tbody>${rows.map(t=>`<tr><td><div class='transaction-description'><span class='transaction-icon'>${icon(t.amount<0?'arrowup':t.kind==='payout'?'trophy':'arrowdown')}</span><div>${esc(t.label)}<small>Simulação concluída · ${date(t.date)}, ${time(t.date)}</small></div></div></td><td class='date-column muted'>${date(t.date)}</td><td class='amount ${t.amount>=0?'positive':'muted'}'>${t.amount>=0?'+':'−'}${points(Math.abs(t.amount))}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderWallet(){
 const p=current(state),transactions=p?.transactions||[];
 return heading('Sua carteira. Seu ritmo.','Tudo sobre seus pontos de demonstração em um só lugar.')+(!p?guestBanner('Uma carteira para explorar','Entre para testar saldo e pagamentos simulados.'):'')+`<div class='wallet-grid'><section class='balance-card'><div class='balance-title'><span>Saldo disponível</span><span class='pill lime'>DEMONSTRAÇÃO</span></div><p class='balance-amount'>${p?points(p.balance):'—'} <span>pts</span></p><div class='balance-card-bottom'><button class='btn primary' data-action='deposit'>${icon('plus')}Adicionar saldo</button><span class='meta'>Pontos fictícios.<br>Sem depósitos reais.</span></div></section><section class='card method-overview'><h2>Teste o pagamento</h2><p class='meta'>Escolha um método para conhecer o fluxo.</p><div class='methods-row'><button class='method-preview text-button muted' data-action='deposit' data-method='pix'><span class='method-icon'>${icon('pix')}</span><span><strong>Pix demo</strong><small>Confirmação simulada</small></span></button><button class='method-preview text-button muted' data-action='deposit' data-method='card'><span class='method-icon'>${icon('credit')}</span><span><strong>Cartão demo</strong><small>Cartão de teste pronto</small></span></button></div></section></div>`+stats([{label:'Pontos adicionados',value:points(transactions.filter(t=>t.amount>0&&t.kind!=='payout').reduce((s,t)=>s+t.amount,0)),icon:'plus'},{label:'Pontos em palpites',value:points(-transactions.filter(t=>t.kind==='bet').reduce((s,t)=>s+t.amount,0)),icon:'ticket'},{label:'Retornos recebidos',value:points(transactions.filter(t=>t.kind==='payout').reduce((s,t)=>s+t.amount,0)),icon:'trophy'}])+`<section class='card pad'><div class='card-top wrap'><h2>Seu extrato</h2><select id='walletFilter' class='filter-select' aria-label='Filtrar extrato'>${[['all','Todos os movimentos'],['deposit','Saldo adicionado'],['bet','Palpites'],['payout','Retornos']].map(([id,label])=>`<option value='${id}' ${ui.walletFilter===id?'selected':''}>${label}</option>`).join('')}</select></div>${transactionRows()}</section>`;
}
function renderTrophies(){
 const p=current(state),count=Object.keys(p?.achievements||{}).length,l=level(p);
 return heading('Pequenas conquistas. Grandes histórias.','Explore a arena e complete sua coleção de troféus.')+(!p?guestBanner('Sua coleção começa com um perfil','Os troféus acompanham suas ações de demonstração.'):'')+`<section class='trophy-overview'><div class='trophy-large'>${icon('trophy')}</div><div class='grow'><p class='eyebrow' style='color:var(--purple)'>SEU CAMINHO NA ARENA</p><h2>${p?`Nível ${l.number} · ${count<2?'Novato da arena':count<4?'Olho no jogo':'Craque da comunidade'}`:'Colecione seus primeiros troféus'}</h2><p class='meta'>${p?`${l.xp} XP conquistados · ${200-l.progress} XP para o próximo nível`:'Cada conquista vale 100 XP de demonstração.'}</p><progress class='progress' max='200' value='${l.progress}' aria-label='Progresso do nível'></progress></div><div class='trophy-total'>${count}<span class='muted'>/6</span><small>TROFÉUS DESBLOQUEADOS</small></div></section><div class='trophy-grid'>${TROPHIES.map(t=>{const earned=p?.achievements[t.id],partial=t.id==='explorer'?(p?.visited.length||0):0,total=t.id==='explorer'?VIEWS.length:1;return `<article class='card trophy-card ${earned?'unlocked':'locked'}'><div class='between'><div class='trophy-icon'>${icon(t.icon)}</div><span class='meta'>100 XP</span></div><h3>${t.name}</h3><p>${t.description}</p><div class='trophy-status'>${icon(earned?'check':'lock')}<span>${earned?`Conquistado em ${date(earned)}`:t.id==='explorer'?`${partial} de ${VIEWS.length} áreas visitadas`:'Ainda por conquistar'}</span></div><progress class='progress' max='${total}' value='${earned?total:partial}' aria-label='Progresso: ${t.name}'></progress></article>`;}).join('')}</div>`;
}
function friendResults(){
 const p=current(state),search=ui.friendSearch.toLocaleLowerCase();
 const rows=PEOPLE.filter(w=>w.name.toLocaleLowerCase().includes(search)&&(ui.friendTab==='discover'?!p?.friends.includes(w.id):ui.friendTab==='friends'?p?.friends.includes(w.id):p?.requests.some(r=>r.personId===w.id)));
 return rows.length?rows.map(friendCard).join(''):empty(ui.friendSearch?'Nenhum jogador com esse apelido.':ui.friendTab==='friends'?'Monte seu time da arena.':'Nenhum convite por enquanto.',ui.friendSearch?'Tente outro nome entre os perfis de exemplo.':'Descubra jogadores e experimente os convites de amizade.',`<button class='btn secondary' data-action='friendTab' data-value='discover'>Descobrir jogadores</button>`);
}
function friendCard(w){
 const p=current(state),isFriend=p?.friends.includes(w.id),request=p?.requests.find(r=>r.personId===w.id),challenge=p?.challenges.find(c=>c.personId===w.id&&['sent','accepted'].includes(c.status));
 let actions=`<button class='btn secondary wide' data-action='invite' data-id='${w.id}'>${icon('plus')}Adicionar amigo</button>`;
 if(isFriend)actions=`<button class='btn ${challenge?'secondary':'primary'}' data-action='challenge' data-id='${w.id}' ${challenge?'disabled':''}>${icon('gamepad')}${challenge?'Desafio em aberto':'Desafiar'}</button><button class='icon-only' data-action='removeFriend' data-id='${w.id}' aria-label='Remover ${esc(w.name)} dos amigos'>${icon('trash')}</button>`;
 else if(request?.direction==='in')actions=`<button class='btn primary' data-action='accept' data-id='${w.id}'>${icon('check')}Aceitar</button><button class='btn secondary' data-action='decline' data-id='${w.id}'>Recusar</button>`;
 else if(request?.direction==='out')actions=`<button class='btn secondary' data-action='simulateAccept' data-id='${w.id}'>Simular aceite</button><button class='icon-only' data-action='cancelInvite' data-id='${w.id}' aria-label='Cancelar convite para ${esc(w.name)}'>${icon('close')}</button>`;
 return `<article class='card friend-card'><div class='friend-identity'>${avatar(w.name,w.color)}<div class='grow'><button class='friend-name' data-action='friendProfile' data-id='${w.id}'>${esc(w.name)}</button><div class='online ${w.online?'':'offline'}'><span class='status-dot'></span>${w.online?'Online':'Offline'} <span class='muted'>· Nv. ${w.level}</span></div></div><span class='friend-medals' title='${w.trophies} medalhas'>🏅 ${w.trophies}</span></div><p class='tagline'>${request?.direction==='out'?'Convite de amizade enviado':request?.direction==='in'?'Enviou um convite para você':`${w.wins} vitórias · ${esc(w.tag)}`}</p><div class='friend-card-actions'>${actions}</div></article>`;
}
function renderFriends(){
 const p=current(state),friends=p?.friends||[],incoming=p?.requests.filter(r=>r.direction==='in').length||0;
 return heading('Seu próximo rival pode ser um amigo.','Monte sua lista, escolha as regras e mande o convite para jogar.',`<button class='btn secondary' data-route='ranking'>${icon('trophy')}Ver ranking</button>`)+(!p?guestBanner('Entre na arena','Crie um perfil para adicionar amigos e combinar desafios.'):'')+`<div class='friends-layout'><section><div class='friend-tools'><div class='segmented' aria-label='Listas de amigos'>${[['discover','Descobrir'],['friends',`Amigos ${friends.length}`],['invites',`Convites ${p?.requests.length||0}`]].map(([id,label])=>`<button class='segment ${ui.friendTab===id?'active':''}' data-action='friendTab' data-value='${id}' aria-pressed='${ui.friendTab===id}'>${label}</button>`).join('')}</div><label class='search-field'>${icon('search')}<input id='friendSearch' placeholder='Buscar jogador' value='${esc(ui.friendSearch)}' aria-label='Buscar jogador por apelido'></label></div><div class='friend-grid' id='friendGrid'>${friendResults()}</div></section><aside class='card friend-side'><div class='card-top'><h2>Seu time</h2>${icon('users')}</div><p class='hint'><strong class='positive'>${friends.length}</strong> ${friends.length===1?'amigo':'amigos'} na sua arena.<br>${incoming?`${incoming} convite esperando sua resposta.`:'Convide alguém para o próximo clássico.'}</p><div class='side-invite'><strong>Desafios e resultados</strong>${p?.challenges.length?p.challenges.slice(-4).reverse().map(duelCard).join(''):'<p class="meta">Seus convites de jogo aparecerão aqui.</p>'}</div><div class='banner-note'>${icon('info')}<span>Os convites, aceites e resultados são simulados localmente. Os pontos são fictícios.</span></div></aside></div>`;
}
function renderMobileSlip(){
 const m=MATCHES.find(m=>m.id===ui.pick?.matchId);if(m&&state.results[m.id]){ui.pick=null;saveSlip();}
 const show=Boolean(ui.pick&&m);$('mobileSlip').hidden=!show;document.body.classList.toggle('has-pick',show);
 if(show)$('mobileSlip').innerHTML=`<div class='grow'><strong>${m[ui.pick.side]} <span class='muted'>· ${m.odds[ui.pick.side==='home'?0:1].toFixed(2)}</span></strong><small>1 seleção · ${points(Number(ui.stake)||0)} pontos demo</small></div><button class='btn primary' data-action='openSlip'>Ver boletim ${icon('arrow')}</button>`;
}
function render(){
 if(ui.pick&&state.results[ui.pick.matchId]){ui.pick=null;saveSlip();}
 renderHeader();$('screen').innerHTML=({arena:renderArena,bets:renderBets,wallet:renderWallet,trophies:renderTrophies,friends:renderFriends,ranking:renderRanking}[ui.view])();renderMobileSlip();
}
function go(view){if(!VIEWS.includes(view))return;closeDialog();const hash=Object.keys(routes).find(k=>routes[k]===view);if(location.hash===`#${hash}`){ui.view=view;visit();render();}else location.hash=hash;}
function visit(){if(current(state))commit('visit',{view:ui.view});}
function syncStake(){
 const m=MATCHES.find(m=>m.id===ui.pick?.matchId);if(!m)return;
 const p=current(state),error=validStake(ui.stake,p?.balance??Infinity),short=error==='Seu saldo demo é insuficiente.',odd=m.odds[ui.pick.side==='home'?0:1];
 document.querySelectorAll('[data-stake]').forEach(el=>{if(el!==document.activeElement)el.value=ui.stake;el.setAttribute('aria-invalid',String(Boolean(error)));});
 document.querySelectorAll('[data-stake-error]').forEach(el=>el.textContent=error);
 document.querySelectorAll('[data-return]').forEach(el=>el.textContent=error&&!short?'—':`${points(payout(Number(ui.stake)||0,odd))} pts`);
 document.querySelectorAll('[data-review]').forEach(el=>{el.disabled=Boolean(error&&!short);el.innerHTML=`${short?'Adicionar saldo':p?'Revisar palpite':'Entrar para continuar'}${icon('arrow')}`;});saveSlip();renderMobileSlip();
}

function showDialog(title,subtitle,body,kind){
 const modal=$('modal');if(!modal.open)dialogOpener=document.activeElement;
 ui.modalKind=kind;
 $('modalContent').innerHTML=`<div class='dialog-body'><div class='dialog-heading'><div><h2 id='dialogTitle'>${title}</h2><p>${subtitle}</p></div><button class='icon-only' data-action='closeDialog' aria-label='Fechar janela'>${icon('close')}</button></div>${body}<p id='dialogError' class='form-error' role='alert'></p></div>`;
 if(!modal.open)modal.showModal();
 requestAnimationFrame(()=>{if(modal.open)($('modalContent').querySelector('[autofocus]')||$('modalContent').querySelector('button,input'))?.focus();});
}
function closeDialog(){
 clearTimeout(paymentTimer);paymentTimer=null;ui.payment=null;ui.betReview=null;ui.afterLogin=null;ui.modalKind=null;
 if($('modal').open)$('modal').close();
 if(dialogOpener?.isConnected)dialogOpener.focus();else $('screen').focus({preventScroll:true});
}
function colorsHTML(){const names={mint:'Verde',violet:'Violeta',blue:'Azul',amber:'Dourado',pink:'Rosa'};return `<div class='color-choices' role='group' aria-label='Cor do avatar'>${COLORS.map(c=>`<button type='button' class='color-choice ${ui.color===c?'active':''}' data-action='color' data-color='${c}' aria-label='${names[c]}' aria-pressed='${ui.color===c}'>${avatar('FC',c)}</button>`).join('')}</div>`;}
function showAuth(tab='login'){
 ui.authTab=tab;
 const profiles=Object.values(state.profiles);
 const tabs=`<div class='segmented'><button class='segment ${tab==='login'?'active':''}' data-action='authTab' data-value='login'>Entrar</button><button class='segment ${tab==='create'?'active':''}' data-action='authTab' data-value='create'>Criar perfil</button></div>`;
 const body=tab==='login'?(profiles.length?`<p class='hint'>Escolha um perfil salvo neste navegador.</p><div class='profile-choices'>${profiles.map(p=>`<button class='profile-choice' data-action='login' data-id='${esc(p.id)}'>${avatar(p.nickname,p.color)}<span><strong>${esc(p.nickname)}</strong><small class='muted'>${points(p.balance)} pontos demo</small></span>${icon('arrow')}</button>`).join('')}</div>`:empty('Sua arena está esperando.','Crie seu primeiro perfil para começar com 1.000 pontos de demonstração.',`<button class='btn primary' data-action='authTab' data-value='create'>Criar perfil demo</button>`)):`<form data-form='create'><label class='form-label' for='nickname'>Seu apelido</label><input class='form-input' id='nickname' name='nickname' autocomplete='off' placeholder='Como vão te chamar na arena?' required minlength='2' maxlength='20' autofocus><p class='form-help'>De 2 a 20 caracteres. Use um apelido fictício.</p><span class='form-label'>Escolha seu avatar</span>${colorsHTML()}<label class='check-line'><input type='checkbox' name='demoConsent' required><span>Tenho 18 anos ou mais e entendo que este é um protótipo com pontos fictícios.</span></label><button class='btn primary wide' type='submit'>Criar perfil demo ${icon('arrow')}</button></form>`;
 showDialog('Entre para a arena','Um perfil para seus palpites, amigos e conquistas.',tabs+body+`<div class='banner-note'>${icon('info')}<span>Login demonstrativo, sem senha. Os perfis ficam apenas neste navegador e podem ser acessados por quem usa este dispositivo.</span></div>`,'auth');
}
function finishLogin(){
 const after=ui.afterLogin;visit();closeDialog();render();toast('Perfil demo conectado. Bom jogo!');
 if(after)setTimeout(()=>{try{after();}catch(e){toast(e.message);}},0);
}
function showProfile(){
 const p=current(state);if(!p){showAuth();return;}ui.color=p.color;
 showDialog('Seu perfil','Do seu jeito, dentro da demo.',`<div class='profile-summary'>${avatar(p.nickname,p.color,'large')}<div><h3>${esc(p.nickname)}</h3><p class='meta'>Nível ${level(p).number} · ${Object.keys(p.achievements).length} troféus</p><span class='pill subtle'>PERFIL LOCAL</span></div></div><form data-form='profile'><label class='form-label' for='editNickname'>Apelido</label><input class='form-input' id='editNickname' name='nickname' value='${esc(p.nickname)}' required minlength='2' maxlength='20'><p class='form-help'>Seu saldo e histórico acompanham este perfil.</p>${colorsHTML()}<button class='btn primary wide' type='submit'>${icon('check')}Salvar perfil</button></form><div class='divider'></div><div class='action-grid'><button class='btn secondary' data-action='switchProfile'>Trocar perfil</button><button class='btn secondary' data-action='logout'>${icon('logout')}Sair</button></div>`,'profile');
}
function logoutDialog(){showDialog('Sair do perfil?','Você pode voltar quando quiser.',`<p class='hint'>Seu saldo, palpites, amigos e troféus continuam salvos neste navegador.</p><div class='action-grid' style='margin-top:24px'><button class='btn secondary' data-action='closeDialog'>Continuar aqui</button><button class='btn primary' data-action='logoutConfirm'>Sair do perfil</button></div>`,'logout');}
function openPayment(method='pix'){
 withProfile(()=>{ui.payment={id:newId(),profileId:current(state).id,amount:1000,method:method==='card'?'card':'pix',step:'choose'};showPayment();});
}
function paymentSummary(p){return `<div class='receipt'><div class='summary-line'><span>Crédito na carteira</span><strong class='positive'>${points(p.amount)} pts</strong></div><div class='summary-line'><span>Método</span><strong>${p.method==='pix'?'Pix demo':'Cartão demo'}</strong></div><div class='summary-line'><span>Cobrança real</span><strong>Nenhuma</strong></div></div>`;}
function showPayment(){
 const p=ui.payment;if(!p)return;
 let title='Adicione pontos à sua arena',subtitle='Pagamento 100% simulado.',body='';
 if(p.step==='choose')body=`<span class='form-label'>1. Escolha a quantidade</span><div class='package-grid'>${[500,1000,2500,5000].map(n=>`<button class='package ${p.amount===n?'active':''}' data-action='package' data-value='${n}' aria-pressed='${p.amount===n}'><strong>${points(n)}</strong><small>pontos demo</small></button>`).join('')}</div><span class='form-label'>2. Escolha o método de teste</span><div class='payment-methods'><button class='payment-method ${p.method==='pix'?'active':''}' data-action='paymentMethod' data-value='pix' aria-pressed='${p.method==='pix'}'>${icon('pix')}Pix demo</button><button class='payment-method ${p.method==='card'?'active':''}' data-action='paymentMethod' data-value='card' aria-pressed='${p.method==='card'}'>${icon('credit')}Cartão demo</button></div><div class='banner-note'>${icon('shield')}<span>Sem transferência ou dados bancários. Você vai testar apenas a confirmação do pagamento.</span></div><button class='btn primary wide' data-action='paymentReview'>Revisar crédito ${icon('arrow')}</button>`;
 else if(['review','processing','declined'].includes(p.step)){
  title=p.step==='declined'?'Pagamento demo recusado':'Revise seu crédito';subtitle=p.step==='declined'?'Simulação concluída. Seu saldo permanece igual.':'Confira os pontos antes de confirmar.';
  body=(p.method==='pix'?`<div class='pix-demo'>${icon('pix')}<div><strong>Pix de demonstração</strong><p>A confirmação é feita pelo botão abaixo. Nenhum código pagável é gerado.</p></div></div>`:`<div class='demo-card'><div class='between'><span>FIFABET</span><span class='pill subtle'>CARTÃO DEMO</span></div><strong>•••• &nbsp;•••• &nbsp;•••• &nbsp;4242</strong><div class='between'><span>JOGADOR DE TESTE</span>${icon('credit')}</div></div>`)+paymentSummary(p);
  if(p.step==='processing')body+=`<button class='btn primary wide' disabled aria-busy='true'>Simulando confirmação…</button><p class='form-help center'>Fechar esta janela cancela a simulação em andamento.</p>`;
  else if(p.step==='declined')body+=`<p class='hint'>Esse cenário serve para testar uma recusa. Você pode tentar novamente com o mesmo método.</p><button class='btn primary wide' data-action='paymentRetry' style='margin-top:18px'>Tentar novamente</button>`;
  else body+=`<button class='btn primary wide' data-action='paymentApprove'>${icon('check')}Simular aprovação</button><div class='action-grid' style='margin-top:10px'><button class='btn secondary' data-action='paymentBack'>Alterar</button><button class='btn secondary' data-action='paymentDecline'>Simular recusa</button></div>`;
 }else if(p.step==='success'){
  title='Pontos na carteira!';subtitle='Seu pagamento de teste foi aprovado.';
  body=`<div class='success-mark'>${icon('check')}</div>${paymentSummary(p)}<p class='meta center'>Saldo disponível: <strong>${points(current(state)?.balance)} pts</strong><br>Comprovante demo ${esc(p.id.slice(0,8).toUpperCase())}</p><div class='stack' style='margin-top:22px'>${ui.pick?`<button class='btn primary wide' data-action='resumeBet'>Continuar meu palpite ${icon('arrow')}</button>`:''}<button class='btn ${ui.pick?'secondary':'primary'} wide' data-route='wallet'>Ver carteira</button></div>`;
 }
 showDialog(title,subtitle,body,'payment');
}
function approvePayment(){
 const p=ui.payment;if(!p||p.step!=='review')return;
 p.step='processing';showPayment();
 paymentTimer=setTimeout(()=>{
  if(ui.payment!==p||!$('modal').open)return;
  try{commit('deposit',{amount:p.amount,method:p.method,paymentId:p.id,profileId:p.profileId});p.step='success';render();showPayment();toast('Crédito demo confirmado.');}
  catch(e){closeDialog();render();toast(e.message);}
 },650);
}
function reviewBet(){
 withProfile(()=>{
  const m=MATCHES.find(m=>m.id===ui.pick?.matchId);if(!m)throw Error('Escolha um jogador na arena primeiro.');
  if(state.results[m.id])throw Error('Este confronto já foi encerrado.');
  const p=current(state),error=validStake(ui.stake,p.balance);
  if(error){if(error==='Seu saldo demo é insuficiente.'){openPayment();return;}throw Error(error);}
  const side=ui.pick.side,odd=m.odds[side==='home'?0:1],stake=Number(ui.stake);
  ui.betReview={matchId:m.id,side,stake,operationId:newId(),profileId:p.id};
  showDialog('Confira seu palpite','Vencedor do confronto, incluindo desempate.',`<span class='pill subtle'>${m.league}</span><h3 style='margin:15px 0'>${m.home} × ${m.away}</h3><div class='receipt'><div class='summary-line'><span>Seu escolhido</span><strong>${m[side]}</strong></div><div class='summary-line'><span>Odd</span><strong>${odd.toFixed(2)}</strong></div><div class='summary-line'><span>Pontos do palpite</span><strong>${points(stake)} pts</strong></div><div class='divider'></div><div class='summary-line'><span>Retorno potencial</span><strong class='positive'>${points(payout(stake,odd))} pts</strong></div><p class='meta'>O retorno total inclui os pontos do palpite.</p></div><p class='hint'>Após confirmar, seu saldo será de ${points(p.balance-stake)} pontos demo.</p><button class='btn primary wide' data-action='confirmBet' style='margin-top:22px'>Confirmar palpite demo ${icon('check')}</button>`,'betReview');
 });
}
function confirmBet(){
 const b=ui.betReview;if(!b)return;
 commit('bet',b);ui.betReview=null;ui.pick=null;saveSlip();render();
 showDialog('Palpite confirmado','Agora é só acompanhar o confronto de demonstração.',`<div class='success-mark'>${icon('ticket')}</div><p class='hint center'>${points(b.stake)} pontos registrados no seu histórico. Em <strong>Meus palpites</strong>, você pode simular o resultado para testar o retorno.</p><div class='stack' style='margin-top:22px'><button class='btn primary wide' data-route='bets'>Ver meus palpites ${icon('arrow')}</button><button class='btn secondary wide' data-action='closeDialog'>Continuar na arena</button></div>`,'betSuccess');
}
function showSettle(id){
 const m=MATCHES.find(m=>m.id===id);if(!m)return;
 if(state.results[id]){toast('Esse confronto já foi finalizado.');render();return;}
 showDialog('Simular resultado','Escolha o vencedor para concluir este confronto demo.',`<p class='hint'>${m.home} × ${m.away}</p><div class='banner-note'>${icon('info')}<span>O resultado encerra a partida para todos os perfis deste navegador. Palpites vencedores recebem o retorno total na carteira, uma única vez.</span></div><div class='action-grid'>${['home','away'].map(side=>`<button class='btn secondary' data-action='settleResult' data-id='${m.id}' data-side='${side}'>Vitória de ${m[side]}</button>`).join('')}</div><p class='form-help'>Esta escolha é definitiva nesta demonstração. Não representa um resultado real.</p>`,'settle');
}
function showMatch(id){
 const m=MATCHES.find(m=>m.id===id);if(!m)return;const result=state.results[id];
 const timeline=m.phase==='live'?`<div class='timeline'><div class='timeline-item'><span class='timeline-time'>${m.minute}′</span><span>Placar ilustrativo: ${m.score[0]} × ${m.score[1]}</span></div><div class='timeline-item'><span class='timeline-time'>00′</span><span>Início do confronto demo</span></div></div>`:`<p class='hint'>Início ilustrativo: ${m.stage}.</p>`;
 showDialog(`${m.home} × ${m.away}`,`${m.league} · ${m.type==='professional'?'Profissional':'Comunidade'}`,`<span class='pill ${result?'subtle':'violet'}'>${result?'Resultado simulado':m.phase==='live'?'Ao vivo · demo':'Em breve · demo'}</span>${result?`<div class='receipt center'><strong>${m[result.winner]} venceu na simulação.</strong></div>`:timeline}<div class='banner-note'>${icon('gamepad')}<span>Central de partida ilustrativa. Os jogadores, placares e horários são exemplos; esta demo não transmite vídeo.</span></div>${!result?`<p class='form-label'>Escolha seu favorito</p><div class='odds-grid'>${['home','away'].map((side,i)=>`<button class='odd' data-action='pick' data-id='${id}' data-side='${side}'><span>${m[side]}</span><strong>${m.odds[i].toFixed(2)}</strong></button>`).join('')}</div>`:''}<button class='btn secondary wide' data-action='feature' data-id='${id}' style='margin-top:18px'>Ver na arena ${icon('arrow')}</button>`,'match');
}
function showChallengeResult(id){
 const challenge=current(state)?.challenges.find(c=>c.id===id&&c.status==='accepted');if(!challenge)return;
 const rival=PEOPLE.find(person=>person.id===challenge.personId)?.name||'seu amigo';
 showDialog('Quem levou a melhor?','Registre o resultado da partida de demonstração.',`<p class='hint'>Desafio ${esc(challenge.mode||'1v1')} contra <strong>${esc(rival)}</strong> · ${points(challenge.stake)} pontos simbólicos.</p><div class='banner-note'>${icon('info')}<span>Este registro atualiza somente o ranking demonstrativo. Nenhum ponto é transferido.</span></div><div class='action-grid'><button class='btn primary' data-action='challengeWinner' data-id='${esc(id)}' data-side='you'>Eu venci</button><button class='btn secondary' data-action='challengeWinner' data-id='${esc(id)}' data-side='friend'>${esc(rival)} venceu</button></div>`,'challengeResult');
}
function showFriend(id){
 const w=PEOPLE.find(w=>w.id===id);if(!w)return;
 showDialog('Jogador da comunidade','Perfil fictício para explorar as interações.',`<div class='profile-summary'>${avatar(w.initials,w.color,'large')}<div><h3>${w.name}</h3><p class='meta'>${w.tag}</p><span class='pill subtle'>Nível ${w.level}</span></div></div>${stats([{label:'Vitórias demo',value:w.wins},{label:'Troféus demo',value:w.trophies},{label:'Nível demo',value:w.level}])}${friendCard(w)}`,'friend');
}
function confirmFriendAction(id,action){
 const w=PEOPLE.find(w=>w.id===id);if(!w)return;
 if(action==='challenge'){
  withProfile(()=>showDialog(`Desafie ${esc(w.name)}`,'Combine o formato e os pontos simbólicos.',`<form data-form='challenge' data-id='${esc(id)}'><label class='form-label' for='challengeMode'>Modo de jogo</label><select class='form-input' id='challengeMode' name='mode' required><option value='1v1'>1 contra 1</option><option value='Ultimate Team'>Ultimate Team</option><option value='Clubes'>Clubes</option></select><label class='form-label' for='challengeStake'>Pontos simbólicos</label><select class='form-input' id='challengeStake' name='stake' required><option value='50'>50 pontos</option><option value='100' selected>100 pontos</option><option value='250'>250 pontos</option><option value='500'>500 pontos</option></select><p class='form-help'>Pontos de demonstração: não são descontados, pagos ou transferidos.</p><button class='btn primary wide' type='submit'>Enviar convite ${icon('arrow')}</button></form>`,'challenge'));
  return;
 }
 withProfile(()=>showDialog('Remover amigo?',`${esc(w.name)} sairá da sua lista.`,`<p class='hint'>Você poderá enviar outro convite depois.</p><div class='action-grid' style='margin-top:22px'><button class='btn secondary' data-action='closeDialog'>Cancelar</button><button class='btn danger' data-action='removeFriendConfirm' data-id='${esc(id)}'>Remover amigo</button></div>`,'removeFriend'));
}
function showActivity(){
 withProfile(()=>{commit('readActivity');renderHeader();const p=current(state);showDialog('Atividade da arena','Suas novidades neste perfil de demonstração.',p.activity.length?p.activity.map(a=>`<div class='activity-row'><span class='activity-symbol'>${icon(a.icon)}</span><div><p>${esc(a.text)}</p><p class='meta'>${date(a.date)} · ${time(a.date)}</p></div></div>`).join(''):empty('Tudo em dia.','Suas conquistas e movimentações vão aparecer aqui.'),'activity');});
}
function showHelp(){showDialog('Como funciona a FifaBet Arena','Uma arena para jogar com os amigos.',`<div class='how-step'><span>1</span><div><h3>Monte seu perfil</h3><p>Escolha um apelido e um avatar para aparecer na arena e no ranking.</p></div></div><div class='how-step'><span>2</span><div><h3>Adicione seu amigo</h3><p>Encontre um jogador de exemplo ou aceite um convite para montar seu time.</p></div></div><div class='how-step'><span>3</span><div><h3>Combine o desafio</h3><p>Escolha o modo de jogo e pontos simbólicos para registrar a rivalidade.</p></div></div><div class='banner-note'>${icon('info')}<span>Esta versão é uma demonstração local: os convites não chegam a outra pessoa e os pontos são fictícios. Não há dinheiro real nem pagamentos.</span></div><button class='btn primary wide' data-action='closeDialog'>Entendi ${icon('arrow')}</button>`,'help');}
function reportError(error){const el=$('dialogError');if($('modal').open&&el){el.textContent=error.message;el.scrollIntoView({block:'nearest'});}else toast(error.message||'Não foi possível concluir esta ação.');}
function friendMutation(action,id){withProfile(()=>{commit(action,{id});closeDialog();render();const messages={invite:'Convite demo enviado.',accept:'Amigo adicionado à sua arena.',decline:'Convite recusado.',cancelInvite:'Convite cancelado.',simulateAccept:'Aceite simulado. Novo amigo na lista!',challenge:'Desafio demo enviado.',removeFriend:'Amigo removido.',cancelChallenge:'Desafio cancelado.'};toast(messages[action]);});}

document.addEventListener('click',event=>{
 if(event.target.closest('.skip-link')){event.preventDefault();$('screen').focus();return;}
 const button=event.target.closest('[data-action],[data-route]');if(!button||button.disabled)return;
 if(button.dataset.route){go(button.dataset.route);return;}
 const {action,id,value,side}=button.dataset;
 try{
  switch(action){
   case 'closeDialog':closeDialog();break;
   case 'help':showHelp();break;
   case 'auth':ui.afterLogin=null;showAuth(button.dataset.mode||(Object.keys(state.profiles).length?'login':'create'));break;
   case 'authTab':showAuth(value);break;
   case 'color':ui.color=button.dataset.color;document.querySelectorAll('.color-choice').forEach(el=>{el.classList.toggle('active',el.dataset.color===ui.color);el.setAttribute('aria-pressed',String(el.dataset.color===ui.color));});break;
   case 'login':commit('login',{id});finishLogin();break;
   case 'profile':showProfile();break;
   case 'switchProfile':ui.afterLogin=null;showAuth('login');break;
   case 'logout':logoutDialog();break;
   case 'logoutConfirm':commit('logout');closeDialog();render();toast('Você saiu. Seus dados demo continuam salvos.');break;
   case 'deposit':openPayment(button.dataset.method);break;
   case 'package':if(ui.payment?.step==='choose'){ui.payment.amount=Number(value);showPayment();}break;
   case 'paymentMethod':if(ui.payment?.step==='choose'){ui.payment.method=value;showPayment();}break;
   case 'paymentReview':if(ui.payment?.step==='choose'){ui.payment.step='review';showPayment();}break;
   case 'paymentBack':if(ui.payment?.step==='review'){ui.payment.step='choose';showPayment();}break;
   case 'paymentRetry':if(ui.payment?.step==='declined'){ui.payment.step='review';showPayment();}break;
   case 'paymentDecline':if(ui.payment?.step==='review'){ui.payment.step='declined';showPayment();}break;
   case 'paymentApprove':approvePayment();break;
   case 'resumeBet':closeDialog();reviewBet();break;
   case 'matchFilter':ui.matchFilter=value;render();break;
   case 'clearFilters':ui.matchFilter='all';ui.category='all';render();break;
   case 'betFilter':ui.betFilter=value;render();break;
   case 'pick':{
    if(state.results[id])throw Error('Este confronto já foi encerrado.');
    const same=ui.pick?.matchId===id&&ui.pick.side===side;ui.pick=same?null:{matchId:id,side};saveSlip();
    closeDialog();render();if(ui.pick)toast('Jogador selecionado. Confira seu boletim.');break;
   }
   case 'clearPick':ui.pick=null;saveSlip();if(ui.modalKind==='slip')closeDialog();render();break;
   case 'openSlip':showDialog('Seu boletim','Pontos demo. Sem valor financeiro.',slipHTML(true),'slip');break;
   case 'amount':ui.stake=value;syncStake();break;
   case 'reviewBet':reviewBet();break;
   case 'confirmBet':confirmBet();break;
   case 'settle':withProfile(()=>showSettle(id));break;
   case 'settleResult':commit('settle',{matchId:id,winner:side});closeDialog();render();toast('Resultado simulado. Histórico e carteira atualizados.');break;
   case 'match':showMatch(id);break;
   case 'feature':ui.featured=id;go('arena');window.scrollTo({top:0,behavior:'smooth'});break;
   case 'favorite':withProfile(()=>{commit('favorite',{id});render();toast(current(state).favorites.includes(id)?'Partida salva nos favoritos.':'Partida removida dos favoritos.');});break;
   case 'reminder':withProfile(()=>{commit('reminder',{id});render();toast(current(state).reminders.includes(id)?'Lembrete salvo nesta arena demo.':'Lembrete removido.');});break;
   case 'friendTab':ui.friendTab=value;ui.friendSearch='';render();break;
   case 'friendProfile':showFriend(id);break;
   case 'invite':case 'accept':case 'decline':case 'cancelInvite':case 'simulateAccept':case 'cancelChallenge':friendMutation(action,id);break;
   case 'challenge':case 'removeFriend':confirmFriendAction(id,action);break;
   case 'challengeConfirm':friendMutation('challenge',id);break;
   case 'removeFriendConfirm':friendMutation('removeFriend',id);break;
   case 'acceptChallenge':commit('acceptChallenge',{id});render();toast('Aceite de demonstração registrado.');break;
   case 'challengeResult':showChallengeResult(id);break;
   case 'challengeWinner':commit('resolveChallenge',{id,winner:side});closeDialog();render();toast(side==='you'?'Vitória registrada no ranking demo.':'Resultado registrado no ranking demo.');break;
   case 'activity':showActivity();break;
  }
 }catch(error){reportError(error);}
});
document.addEventListener('input',event=>{
 if(event.target.matches('[data-stake]')){ui.stake=event.target.value;syncStake();}
 if(event.target.id==='friendSearch'){ui.friendSearch=event.target.value;$('friendGrid').innerHTML=friendResults();}
});
document.addEventListener('change',event=>{
 if(event.target.id==='categoryFilter'){ui.category=event.target.value;$('matchGrid').innerHTML=matchList();}
 if(event.target.id==='walletFilter'){ui.walletFilter=event.target.value;render();}
});
document.addEventListener('submit',event=>{
 const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();
 if(!form.reportValidity())return;
 try{
  if(form.dataset.form==='challenge'){
   const data=new FormData(form);commit('challenge',{id:form.dataset.id,stake:Number(data.get('stake')),mode:data.get('mode')});closeDialog();render();toast('Convite enviado. Os pontos simbólicos não são debitados.');return;
  }
  const data={nickname:new FormData(form).get('nickname'),color:ui.color};
  if(form.dataset.form==='create'){commit('create',data);finishLogin();}
  if(form.dataset.form==='profile'){commit('profile',data);closeDialog();render();toast('Perfil atualizado.');}
 }catch(error){reportError(error);}
});
$('modal').addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
window.addEventListener('hashchange',()=>{closeDialog();ui.view=routes[location.hash.slice(1)]||'arena';visit();render();window.scrollTo({top:0});$('screen').focus({preventScroll:true});});
window.addEventListener('storage',event=>{
 if(event.key!==STORAGE_KEY&&event.key!==null)return;
 const prior=state.activeProfileId,next=restore(read(STORAGE_KEY));if(prior!==next.activeProfileId)switchSlip(prior,next.activeProfileId,false);state=next;
 if($('modal').open){closeDialog();toast(prior!==state.activeProfileId?'Perfil atualizado em outra aba.':'Dados atualizados em outra aba. Reabra a ação para continuar.');}
 render();
});
persist();visit();render();
