import {STORAGE_KEY,VIEWS,MATCHES,PEOPLE,COLORS,TEAM_FLAGS,STICKERS,TROPHIES,GAME_PLATFORMS,CLUBS,clubById,findClub,emptyState,current,points,payout,validStake,change,restore} from './model.mjs?v=10';
import {renderFootballTrophies} from './football-trophies.mjs?v=10';
import {renderRivalrySection} from './rivalry-section.mjs?v=11';
const ATHLETES=[
 {
  "name": "Erling Haaland",
  "image": "assets/players/haaland.jpg",
  "source": "https://commons.wikimedia.org/wiki/File:Erling_Haaland_2023.jpg",
  "author": "Jacek Stanislawek",
  "license": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "changes": "Miniatura reduzida pelo Wikimedia Commons. A interface pode aplicar enquadramento e sobreposição de gradiente; essas adaptações da fotografia são disponibilizadas sob CC BY-SA 4.0.",
  "tag": "PRESENÇA NA ÁREA",
  "caption": "Erling Haaland · fotografia de 2023",
  "alt": "Erling Haaland em campo pelo Manchester City em 2023"
 },
 {
  "name": "Alexia Putellas",
  "image": "assets/players/putellas.jpg",
  "source": "https://commons.wikimedia.org/wiki/File:Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5851_(cropped).jpg",
  "author": "MichaelEmilio; recorte e ajuste de exposição por Kingsif",
  "license": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "changes": "Miniatura reduzida pelo Wikimedia Commons de recorte preexistente. A interface pode aplicar enquadramento e sobreposição de gradiente; essas adaptações da fotografia são disponibilizadas sob CC BY-SA 4.0.",
  "tag": "VISÃO QUE MUDA O JOGO",
  "caption": "Alexia Putellas · fotografia de 2024",
  "alt": "Alexia Putellas no aquecimento do Barcelona em 2024"
 },
 {
  "name": "Kylian Mbappé",
  "image": "assets/players/mbappe.jpg",
  "source": "https://commons.wikimedia.org/wiki/File:Kylian_Mbappe_-_France_v_Senegal_-_16_June_2026.jpg",
  "author": "Bryan Berlin / WikiPortraits; recorte por Iojhug",
  "license": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "changes": "Arquivo do recorte preexistente preservado. A interface pode aplicar enquadramento e sobreposição de gradiente; essas adaptações da fotografia são disponibilizadas sob CC BY-SA 4.0.",
  "tag": "VELOCIDADE. TALENTO. DECISÃO.",
  "caption": "Kylian Mbappé · fotografia de 2026",
  "alt": "Kylian Mbappé com a seleção francesa em 2026"
 }
];
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 gamepad:'M6 9h12a3 3 0 0 1 3 3l1 5a2 2 0 0 1-3 2l-3-2H8l-3 2a2 2 0 0 1-3-2l1-5a3 3 0 0 1 3-3M7 11v4M5 13h4M16 12h.01M19 14h.01M9 9V7h6V5',
 ticket:'M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4M14 7v2m0 3v1m0 3v1',store:'M3 4h18v16H3zM7 8h10M7 12h4m2 0h4m-10 4h10',
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
function profileAvatar(p,size=''){
 const sticker=STICKERS.find(item=>item.id===p?.avatarSticker&&p.ownedStickers?.includes(item.id));
 if(sticker?.kind==='player-caricature')return `<span class='avatar collectible-avatar tier-${sticker.tier} ${size}' role='img' aria-label='Caricatura de ${esc(sticker.player)}, categoria ${tierLabel(sticker.tier)}'><img src='${esc(sticker.art)}' alt='' width='160' height='160'><span class='avatar-tier' aria-hidden='true'>★</span></span>`;
 return sticker?`<span class='avatar sticker-avatar ${sticker.theme} ${size}' role='img' aria-label='Figurinha demo de ${esc(sticker.player)}'><i class='portrait-hair'></i><i class='portrait-head'></i><i class='portrait-body'></i><b>${esc(initials(sticker.player))}</b></span>`:avatar(p?.nickname||p?.name||'FC',p?.color||'mint',size);
}
function teamBanner(p,compact=false){
 const club=clubById(p?.clubId)||findClub(p?.teamName);
 if(club)return `<div class='team-banner club-banner ${compact?'compact':''}' style='--club-primary:${club.colors[0]};--club-secondary:${club.colors[1]};--club-ink:${club.ink||'#ffffff'}'><img class='club-banner-watermark' src='${esc(club.crest)}' alt='' aria-hidden='true' width='130' height='130'><span class='club-banner-crest'><img src='${esc(club.crest)}' alt='Brasão do ${esc(club.name)}' width='68' height='68'></span><div><small>TIME DO CORAÇÃO</small><strong>${esc(club.name)}</strong><span>${esc(club.country)} · ${esc(club.shortName||club.name)}</span></div></div>`;
 const flag=TEAM_FLAGS.find(item=>item.id===p?.teamFlag)||TEAM_FLAGS[0],name=p?.teamName||'Escolha seu time';
 if(!p?.teamName)return `<div class='team-banner club-banner-empty ${compact?'compact':''}'><span class='team-banner-badge'>${icon('shield')}</span><div><small>TIME DO CORAÇÃO</small><strong>Sua torcida começa aqui.</strong><span>Escolha um clube no perfil.</span></div></div>`;
 const badge=name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase()||'FC';
 return `<div class='team-banner team-${flag.id} ${compact?'compact':''}'><span class='team-banner-badge' aria-hidden='true'>${esc(badge)}</span><div><small>TIME DO CORAÇÃO</small><strong>${esc(name)}</strong><span>${flag.name} · arte demonstrativa</span></div></div>`;
}
const tierLabel=tier=>({gold:'Ouro',silver:'Prata',bronze:'Bronze'}[tier]||'Legado');
function tierEmblem(tier){
 return `<span class='tier-emblem tier-${tier}' aria-hidden='true'><span>${tier==='gold'?'★★★':tier==='silver'?'★★':'★'}</span>${icon('trophy')}<b>${tierLabel(tier)}</b></span>`;
}
function stickerPortrait(item){
 if(item.kind==='player-caricature')return `<div class='collectible-art tier-${item.tier}'><div class='collectible-art-heading'><span>ARENA COLLECTION</span><span class='collectible-edition'>VOL. 01</span></div><div class='collectible-lines' aria-hidden='true'></div>${tierEmblem(item.tier)}<img class='caricature-image' src='${esc(item.art)}' alt='Caricatura ilustrada de ${esc(item.player)}' width='1280' height='1280' loading='lazy'><div class='collectible-autograph'><img src='${esc(item.signatureAsset)}' alt='Reprodução da assinatura atribuída a ${esc(item.player)}' width='240' height='68' loading='lazy'><span>REPRODUÇÃO DA ASSINATURA</span></div></div>`;
 return `<div class='sticker-art ${item.theme}' role='img' aria-label='Arte demonstrativa de ${esc(item.player)}, atleta fictício'><span class='sticker-top'><span>FIFABET · DEMO</span><b>${item.rating}</b></span><span class='sticker-player'><i class='portrait-hair'></i><i class='portrait-head'></i><i class='portrait-body'></i></span><span class='sticker-details'><strong>${esc(item.player)}</strong><small>${esc(item.club)} · ${item.position}</small></span><span class='sticker-signature'>${esc(item.signature)}</span><span class='sticker-disclaimer'>FICTÍCIO</span></div>`;
}
const date=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Agora';};
const time=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';};
const newId=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const routes={arena:'arena',amigos:'friends',loja:'store',store:'store',ranking:'ranking',palpites:'bets',historico:'bets',trofeus:'trophies',conquistas:'trophies',carteira:'wallet'};
const labels={arena:'Desafios',friends:'Amigos',store:'Loja',ranking:'Ranking',bets:'Histórico',wallet:'Pontos',trophies:'Conquistas'};
const navViews=['arena','friends','store','ranking','bets','trophies'];
const navIcons={arena:'gamepad',friends:'users',store:'store',ranking:'trophy',bets:'ticket',trophies:'shield',wallet:'wallet'};
let localOnly=false;
function read(key){try{return localStorage.getItem(key);}catch{localOnly=true;return null;}}
let state=restore(read(STORAGE_KEY),read('fifabet-profile'),read('fifabet-bets'));
function readSlip(profileId){
 let value;try{value=JSON.parse(sessionStorage.getItem(`fifabet-slip:v2:${profileId||'guest'}`)||'null');}catch{}
 const pick=value?.pick&&MATCHES.some(m=>m.id===value.pick.matchId&&['home','away'].includes(value.pick.side))?value.pick:null;
 return {pick,stake:typeof value?.stake==='string'||typeof value?.stake==='number'?String(value.stake):'100'};
}
const cachedPick=readSlip(state.activeProfileId);
const ui={view:routes[location.hash.slice(1)]||'arena',matchFilter:'all',category:'all',featured:'m1',pick:cachedPick?.pick||null,stake:cachedPick?.stake||'100',betFilter:'all',friendTab:'discover',friendSearch:'',walletFilter:'all',authTab:'login',color:'mint',payment:null,pendingSticker:null,modalKind:null,afterLogin:null};
if(ui.pick&&!MATCHES.some(m=>m.id===ui.pick.matchId&&['home','away'].includes(ui.pick.side)))ui.pick=null;
ui.challengeMode='1v1';
ui.storeTier='all';
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
 $('headerActions').innerHTML=p?`<button class='balance-button' data-route='wallet' aria-label='Abrir pontos demo, saldo ${points(p.balance)}'>${icon('wallet')}<span><small>PONTOS DEMO</small><strong>${points(p.balance)} <span class='muted'>pts</span></strong></span></button><button class='icon-only notify-button' data-action='activity' aria-label='Atividade${p.unread?', '+p.unread+' novidades':''}'>${icon('bell')}${p.unread?`<span class='notify-badge'>${p.unread>9?'9+':p.unread}</span>`:''}</button><button class='profile-button' data-action='profile' aria-label='Abrir perfil de ${esc(p.nickname)}'>${profileAvatar(p,'small')}<span class='profile-name meta'>${esc(p.nickname)}</span>${icon('down')}</button>`:`<button class='btn secondary' data-action='auth' data-mode='login'>Entrar</button><button class='btn primary guest-register' data-action='auth' data-mode='create'>Criar perfil ${icon('arrow')}</button>`;
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
 if(p)entries.push({id:'you',name:p.nickname,color:p.color,avatarSticker:p.avatarSticker,ownedStickers:p.ownedStickers,teamFlag:p.teamFlag,teamName:p.teamName,wins:p.challenges.filter(c=>c.status==='completed'&&c.winner==='you').length,medals:Object.keys(p.achievements).length,level:level(p).number,tag:'Seu perfil',isYou:true});
 return entries.sort((a,b)=>b.wins-a.wins||b.medals-a.medals||b.level-a.level||a.name.localeCompare(b.name,'pt-BR'));
}
function leaderboardRow(player,index){
 const medal=['🥇','🥈','🥉'][index]||String(index+1).padStart(2,'0');
 return `<div class='leader-row ${player.isYou?'you':''}'><span class='rank-position ${index<3?'podium':''}'>${medal}</span>${player.isYou?profileAvatar(player):avatar(player.name,player.color)}<div class='leader-copy'><strong>${esc(player.name)}${player.isYou?` <span class='pill lime'>VOCÊ</span>`:''}</strong><small>${player.isYou&&player.teamName?`${esc(player.teamName)} · `:''}${player.wins} vitórias · ${player.medals} medalhas</small></div><span class='leader-level'>NV. ${player.level}</span></div>`;
}
function duelCard(c){
 const w=PEOPLE.find(person=>person.id===c.personId),status=c.status||'sent',label=status==='sent'?'Convite enviado':status==='accepted'?'Partida confirmada':status==='review'?'Aguardando análise':status==='disputed'?'Fraude sinalizada · em análise':c.winner==='you'?'Você venceu':'Amigo venceu';
 const actions=status==='sent'?`<div class='challenge-row-actions'><button class='btn small primary' data-action='acceptChallenge' data-id='${esc(c.id)}'>Simular aceite</button><button class='btn small secondary' data-action='cancelChallenge' data-id='${esc(c.id)}'>Cancelar</button></div>`:status==='accepted'?`<div class='challenge-row-actions'><button class='btn small primary' data-action='challengeResult' data-id='${esc(c.id)}'>Enviar placar</button><button class='btn small secondary' data-action='reportFraud' data-id='${esc(c.id)}'>Sinalizar fraude</button></div>`:['review','disputed'].includes(status)?`<div class='challenge-row-actions'><button class='btn small secondary' data-action='challengeEvidence' data-id='${esc(c.id)}'>Ver evidência</button>${status==='review'?`<button class='btn small secondary' data-action='reportFraud' data-id='${esc(c.id)}'>Sinalizar fraude</button>`:''}</div>`:'';
 const pill=status==='sent'?'amber':status==='accepted'?'mint':status==='review'?'violet':status==='disputed'?'live':'subtle';
 return `<div class='challenge-row ${status==='completed'?'completed':''}'>${avatar(w?.name||'Amigo',w?.color||'mint','small')}<div class='grow'><strong>vs ${esc(w?.name||'Amigo')}</strong><small>${esc(c.mode||'1v1')} · ${c.stake?`${points(c.stake)} pts simbólicos`:'amistoso'}</small></div><span class='pill ${pill}'>${label}</span>${actions}</div>`;
}
function gameAccountCard(p){
 const account=p?.gameAccount;
 return `<button class='game-account-card' data-action='gameAccount'>${icon('gamepad')}<span><strong>${account?esc(account.eaId):'Seu EA ID na arena'}</strong><small>${account?'ID cadastrado · não verificado':'Cadastre seu ID e acompanhe os registros'}</small></span>${icon('arrow')}</button>`;
}
function renderGameModes(){
 const modes=[
  {theme:'duel',name:'1v1',tag:'CARA A CARA',description:'Seu amigo do outro lado. Seu orgulho em campo. Escolham os times e decidam quem manda no controle.',action:'selectMode',value:'1v1',cta:'Desafiar agora',label:'Desafiar um amigo no 1v1',art:`<div class='competitive-art duel-mode-art' aria-hidden='true'><span class='duel-mark'>1<span>V</span>1</span><span class='duel-label'>VOCÊ <span>VS</span> SEU AMIGO</span></div>`},
  {theme:'tournament',name:'Torneios',tag:'A GALERA NA DISPUTA',description:'Da resenha à final. Veja a proposta de um mata-mata entre quatro amigos e imagine quem levanta a taça.',action:'tournaments',cta:'Ver torneios',label:'Ver a prévia de torneios entre amigos',art:`<div class='competitive-art tournament-mode-art' aria-hidden='true'><span class='bracket-side bracket-left'><i></i><i></i></span><span class='bracket-cup'>${icon('trophy')}</span><span class='bracket-side bracket-right'><i></i><i></i></span><small>SEMIFINAL · FINAL</small></div>`},
  {theme:'wager',name:'Aposte agora',tag:'A PARTIDA VALE MAIS',description:'Escolha seu rival, combine o que vale a disputa e registre o desafio. A conversa acaba quando a bola começa a rolar.',action:'selectMode',value:'1v1',cta:'Aposte agora',label:'Aposte agora: escolher um amigo para um desafio demo',art:`<div class='competitive-art wager-mode-art' aria-hidden='true'><span class='wager-ticket'>${icon('ticket')}<b>VS</b></span><span class='wager-ring'>${icon('gamepad')}</span><small>UM COMBINADO.<br>UMA PARTIDA.</small></div>`}
 ];
 return `<section class='game-mode-section competitive-modes' aria-labelledby='modesTitle'><div class='section-heading'><div><p class='eyebrow'>EA SPORTS FC · RIVALIDADE ENTRE AMIGOS</p><h2 id='modesTitle'>Escolha a disputa. Chame seu rival.</h2></div></div><div class='mode-grid'>${modes.map((mode,index)=>`<article class='game-mode-card competitive-mode-card mode-${mode.theme}'><span class='mode-index'>0${index+1} / ${mode.tag}</span>${mode.art}<h3>${mode.name}</h3><p>${mode.description}</p><button class='btn primary' data-action='${mode.action}' ${mode.value?`data-value='${mode.value}'`:''} aria-label='${mode.label}'>${mode.cta} ${icon('arrow')}</button></article>`).join('')}</div><p class='competitive-modes-note'>Demonstração: desafios com pontos fictícios, sem dinheiro real. Torneios têm uma prévia de chave; as inscrições ainda não estão disponíveis.</p></section>`;
}
function showTournamentPreview(){
 const match=(number,first,second)=>`<article class='tournament-match'><span class='tournament-match-label'>JOGO ${number}</span><div>${icon('user')}<span>${first}</span><b>—</b></div><div>${icon('user')}<span>${second}</span><b>—</b></div></article>`;
 showDialog('Torneios entre amigos','Quatro rivais. Uma taça. Quem fica com ela?',`<div class='tournament-preview'><div class='tournament-preview-top'><span class='pill lime'>PRÉVIA · 4 JOGADORES</span><span>MATA-MATA</span></div><p class='hint'>Semifinais e final para transformar a resenha em campeonato. Esta chave é ilustrativa; as inscrições ainda não estão disponíveis.</p><div class='tournament-bracket'><section><h3>Semifinais</h3>${match(1,'Vaga 1','Vaga 2')}${match(2,'Vaga 3','Vaga 4')}</section><section class='tournament-final'><h3>Final</h3>${match(3,'Vencedor do jogo 1','Vencedor do jogo 2')}<div class='tournament-champion'>${icon('trophy')}<span>A taça espera seu campeão.</span></div></section></div><div class='tournament-preview-actions'><button class='btn primary wide' data-action='selectMode' data-value='1v1'>Começar com um 1v1 ${icon('arrow')}</button><button class='btn secondary wide' data-action='closeDialog'>Voltar à arena</button></div></div>`,'tournamentPreview');
}
function renderOfficialFC(){
 const links=[{icon:'star',title:'Classificações de atletas',subtitle:'Consulte as notas oficiais',url:'https://www.ea.com/pt-br/games/ea-sports-fc/ratings'},{icon:'target',title:'Estatísticas de atleta',subtitle:'Explore os dados do jogo',url:'https://www.ea.com/pt-br/games/ea-sports-fc/fc-26/player-stats'},{icon:'trophy',title:'FC Pro',subtitle:'Acompanhe o cenário competitivo',url:'https://www.ea.com/games/ea-sports-fc/fc-pro'}];
 return `<section class='official-fc-section' aria-labelledby='officialFCTitle'><div class='official-fc-intro'><div><p class='eyebrow'>NO UNIVERSO DO JOGO</p><h2 id='officialFCTitle'>Mais EA SPORTS FC.</h2><p>Atletas, classificações e competições nos canais oficiais da EA.</p></div><a class='btn primary' href='https://www.ea.com/pt-br/games/ea-sports-fc' target='_blank' rel='noopener noreferrer'>Explorar o jogo ${icon('arrow')}</a></div><div class='official-fc-links'>${links.map(link=>`<a class='official-fc-link' href='${link.url}' target='_blank' rel='noopener noreferrer'>${icon(link.icon)}<span><strong>${link.title}</strong><small>${link.subtitle} · site EA</small></span>${icon('arrow')}</a>`).join('')}</div></section>`;
}
function renderArena(){
 const p=current(state),duels=p?.challenges||[],myWins=p?duels.filter(c=>c.status==='completed'&&c.winner==='you').length:0,medals=Object.keys(p?.achievements||{}).length;
 const openDuels=duels.filter(c=>['sent','accepted','review','disputed'].includes(c.status));
 const inReview=openDuels.filter(c=>['review','disputed'].includes(c.status)).length;
 const hero=`<section class='arena-cover' aria-labelledby='coverTitle'><div class='cover-photo'><img src='${ATHLETES[0].image}' alt='${esc(ATHLETES[0].alt)}' width='960' height='1100' fetchpriority='high'></div><div class='cover-lines' aria-hidden='true'></div><div class='cover-content'><p class='cover-kicker'><span></span> SUA ARENA NO EA SPORTS FC</p><h1 id='coverTitle'>SEU JOGO.<br><em>SUA HISTÓRIA.</em></h1><p class='cover-description'>Desafie um amigo no EA SPORTS FC.<br>O próximo clássico começa com vocês.</p><div class='cover-actions'><button class='btn primary' data-route='amigos'>Criar desafio ${icon('arrow')}</button><button class='btn cover-secondary' data-route='ranking'>${icon('trophy')} Ranking</button></div><span class='cover-note'>ARENA INDEPENDENTE · PONTOS DE DEMONSTRAÇÃO</span></div><div class='cover-athlete'><span>INSPIRAÇÃO EM CAMPO</span><strong>${ATHLETES[0].name}</strong><button data-action='credits' aria-label='Ver créditos da fotografia'>${icon('info')} Crédito da foto</button></div></section>`;
 const activeDuels=openDuels.length?openDuels.slice().reverse().slice(0,3).map(duelCard).join(''):`<div class='duel-empty'><span class='empty-emblem'>${icon('gamepad')}</span><strong>A próxima rivalidade tem nome.</strong><p>Encontre seu amigo, escolha o modo e chame para o jogo.</p><button class='text-button' data-route='amigos'>Encontrar amigos ${icon('arrow')}</button></div>`;
 const card=`<aside class='card player-card'><div class='card-top'><div><p class='eyebrow'>IDENTIDADE</p><h2>Seu clube. Seu estilo.</h2></div><button class='text-button' data-action='profile'>Editar</button></div>${p?`${teamBanner(p,true)}<div class='player-profile'>${profileAvatar(p,'large')}<div><h3>${esc(p.nickname)}</h3><p class='meta'>Nível ${level(p).number} · Jogador da arena</p></div></div><div class='player-stats'><div><strong>${myWins}</strong><small>vitórias</small></div><div><strong>${medals}</strong><small>medalhas</small></div><div><strong>${p.friends.length}</strong><small>amigos</small></div></div>${gameAccountCard(p)}`:`<div class='profile-placeholder'><span class='avatar large'>?</span><h3>Entre para a arena</h3><p>Seu time, seu avatar e suas conquistas. Tudo começa com seu perfil.</p><button class='btn primary wide' data-action='auth' data-mode='create'>Criar perfil ${icon('arrow')}</button></div>`}</aside>`;
 return `<div class='arena-topline'><p class='eyebrow'>CENTRAL DA ARENA</p><span>EA SPORTS FC <span class='muted'>/</span> ENTRE AMIGOS</span></div>`+hero+`<div class='arena-quicklinks'><button data-route='amigos'><span class='quick-icon'>${icon('gamepad')}</span><span><small>SEU PRÓXIMO CONFRONTO</small><strong>${openDuels.length?openDuels.length+' desafios em aberto':'Chame seu rival'}</strong></span>${icon('arrow')}</button><button data-action='gameAccount'><span class='quick-icon'>${icon('user')}</span><span><small>IDENTIDADE DE JOGO</small><strong>${p?.gameAccount?'EA ID cadastrado':'Adicionar EA ID'}</strong></span>${icon('arrow')}</button><button data-route='loja'><span class='quick-icon'>${icon('store')}</span><span><small>SUA COLEÇÃO</small><strong>Vista sua personalidade</strong></span>${icon('arrow')}</button></div><div class='dashboard-columns'><section class='card dashboard-card'><div class='card-top'><div><p class='eyebrow'>MATCH CENTER</p><h2>Na sua arena</h2></div><span class='pill subtle'>${openDuels.length} ABERTOS</span></div><div class='challenge-list'>${activeDuels}</div>${inReview?`<p class='review-summary'>${icon('shield')} ${inReview} resultado(s) em análise local · pontuação bloqueada</p>`:''}</section>${card}<section class='card dashboard-card leaderboard-preview'><div class='card-top'><div><p class='eyebrow'>RANKING DEMONSTRATIVO</p><h2>A disputa pelo topo.</h2></div><button class='text-button' data-route='ranking'>Classificação ${icon('arrow')}</button></div><div class='leader-list'>${rankingEntries().slice(0,3).map(leaderboardRow).join('')}</div><p class='ranking-note'>Perfis de exemplo e resultados locais.</p></section></div>`+renderGameModes()+renderRivalrySection({icon,fcLogo:'assets/brand/ea-sports-fc.svg'})+renderOfficialFC()+`<section class='fair-play-strip'>${icon('shield')}<div><strong>Uma boa disputa começa com fair play.</strong><p>Envie a foto do placar e sinalize divergências. Resultados em análise não alteram a pontuação.</p></div><button class='text-button' data-action='help'>Como funciona ${icon('arrow')}</button></section>`;
}
function renderRanking(){
 const entries=rankingEntries();
 return heading('A tabela da arena.','Vitórias, medalhas e uma boa história para contar.',`<button class='btn primary' data-route='amigos'>${icon('users')}Desafiar um amigo</button>`)+`<section class='ranking-hero'><div><p class='eyebrow'>TEMPORADA DEMONSTRATIVA</p><h2>Todo clássico conta.</h2><p>Ganhe partidas entre amigos, conquiste medalhas e suba na classificação.</p></div><div class='ranking-hero-medal' aria-hidden='true'>🏆</div></section><section class='card ranking-board'><div class='ranking-head'><span>POSIÇÃO · JOGADOR</span><span>VITÓRIAS</span><span>MEDALHAS</span><span>NÍVEL</span></div>${entries.map((player,index)=>`<div class='ranking-entry ${player.isYou?'you':''}'><span class='ranking-place'>${['🥇','🥈','🥉'][index]||String(index+1).padStart(2,'0')}</span><div class='ranking-person'>${player.isYou?profileAvatar(player):avatar(player.name,player.color)}<div><strong>${esc(player.name)}${player.isYou?` <span class='pill lime'>VOCÊ</span>`:''}</strong><small>${esc(player.tag)}</small></div></div><strong class='ranking-number'>${player.wins}</strong><strong class='ranking-number medal-count'>${player.medals} <span aria-hidden='true'>🏅</span></strong><span class='ranking-level'>Nv. ${player.level}</span></div>`).join('')}</section><p class='ranking-note'>Classificação de exemplo. Figurinhas e perfis de exemplo são demonstrativos.</p>`;
}
function stats(items){return `<div class='stat-grid'>${items.map((x,i)=>`<div class='stat ${i===0?'lime-stat':''}'><span class='stat-icon'>${icon(x.icon||'target')}</span><p class='stat-label'>${x.label}</p><p class='stat-value'>${x.value}</p>${x.note?`<p class='stat-note'>${x.note}</p>`:''}</div>`).join('')}</div>`;}
function betCard(b,archived=false){
 const names={pending:'Pendente',won:'Vencedor',lost:'Encerrado'},colors={pending:'amber',won:'lime',lost:'subtle'};
 return `<article class='card bet-card'><div class='between'><span class='meta'>${esc(b.league)} · ${date(b.date)}</span><span class='pill ${colors[b.status]}'>${names[b.status]}</span></div><h3 class='bet-title'>${esc(b.home)} <span class='muted'>×</span> ${esc(b.away)}</h3><p class='bet-pick'>Seu escolhido: <strong>${esc(b.selection)}</strong></p><div class='bet-stats'><div><small>Palpite</small><strong>${points(b.stake)} pts</strong></div><div><small>Odd</small><strong>${Number(b.odd).toFixed(2)}</strong></div><div><small>${b.status==='pending'?'Retorno potencial':'Retorno'}</small><strong class='${b.status==='won'?'positive':''}'>${points(b.status==='lost'?0:b.potential)} pts</strong></div></div><div class='bet-actions'><span class='meta'>${b.status==='pending'?'Aguardando resultado demo':'Resultado demonstrativo finalizado'}</span>${!archived&&b.status==='pending'&&MATCHES.some(m=>m.id===b.matchId)?`<button class='btn small secondary' data-action='settle' data-id='${esc(b.matchId)}'>${icon('flag')}Simular resultado</button>`:''}</div></article>`;
}
function renderBets(){
 const p=current(state),bets=p?.bets||[],filtered=bets.filter(b=>ui.betFilter==='all'||b.status===ui.betFilter),recent=p?.challenges.slice().reverse()||[];
 const matches=`<section class='card recent-matches'><div class='card-top'><div><p class='eyebrow'>REGISTROS LOCAIS</p><h2>Partidas entre amigos</h2></div><button class='text-button' data-action='gameAccount'>EA ID ${icon('arrow')}</button></div><div class='challenge-list'>${recent.length?recent.map(duelCard).join(''):empty('Sua história começa no próximo jogo.','Os desafios e as evidências ficam reunidos aqui.',`<button class='btn primary' data-route='amigos'>Criar desafio</button>`)}</div><p class='ranking-note'>Histórico da arena · não importado da EA.</p></section>`;
 const legacy=bets.length?`<div class='section-heading'><div><p class='eyebrow'>SIMULAÇÕES ANTERIORES</p><h2>Palpites de demonstração</h2></div></div>`+stats([{label:'Em andamento',value:bets.filter(b=>b.status==='pending').length,icon:'clock'},{label:'Palpites vencedores',value:bets.filter(b=>b.status==='won').length,icon:'trophy'},{label:'Retornos demo',value:points(bets.filter(b=>b.status==='won').reduce((sum,b)=>sum+b.potential,0)),note:'pontos devolvidos à carteira',icon:'wallet'}])+`<div class='filters'><div class='segmented' aria-label='Filtrar palpites'>${[['all','Todos'],['pending','Pendentes'],['won','Vencedores'],['lost','Encerrados']].map(([id,label])=>`<button class='segment ${ui.betFilter===id?'active':''}' data-action='betFilter' data-value='${id}' aria-pressed='${ui.betFilter===id}'>${label}</button>`).join('')}</div></div><div class='history-list'>${filtered.length?filtered.map(b=>betCard(b)).join(''):empty('Nenhum palpite neste filtro.','Escolha outro filtro para consultar seus registros anteriores.')}</div>`:'';
 const archive=state.legacyArchive.length?`<details class='archive'><summary>Histórico anterior sem perfil (${state.legacyArchive.length})</summary><p class='meta'>Registros preservados do protótipo anterior, sem associação a uma conta.</p><div class='history-list'>${state.legacyArchive.map(b=>betCard(b,true)).join('')}</div></details>`:'';
 return heading('Cada partida tem uma história.','Acompanhe seus desafios, evidências e resultados.',`<button class='btn secondary' data-route='amigos'>Criar desafio ${icon('arrow')}</button>`)+(!p?guestBanner():'')+matches+legacy+archive;
}
function transactionRows(){
 const p=current(state),rows=(p?.transactions||[]).filter(t=>ui.walletFilter==='all'||t.kind===ui.walletFilter);
 if(!rows.length)return empty('Nenhum movimento neste filtro.','Os pontos adicionados, palpites e retornos aparecem aqui.');
 return `<div class='table-scroll'><table class='transaction-table'><thead><tr><th>Movimentação</th><th class='date-column'>Data</th><th style='text-align:right'>Pontos</th></tr></thead><tbody>${rows.map(t=>`<tr><td><div class='transaction-description'><span class='transaction-icon'>${icon(t.amount<0?'arrowup':t.kind==='payout'?'trophy':'arrowdown')}</span><div>${esc(t.label)}<small>Simulação concluída · ${date(t.date)}, ${time(t.date)}</small></div></div></td><td class='date-column muted'>${date(t.date)}</td><td class='amount ${t.amount>=0?'positive':'muted'}'>${t.amount>=0?'+':'−'}${points(Math.abs(t.amount))}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderWallet(){
 const p=current(state),transactions=p?.transactions||[];
 return heading('Sua carteira. Seu ritmo.','Tudo sobre seus pontos de demonstração em um só lugar.')+(!p?guestBanner('Uma carteira para explorar','Entre para testar saldo e pagamentos simulados.'):'')+`<div class='wallet-grid'><section class='balance-card'><div class='balance-title'><span>Saldo disponível</span><span class='pill lime'>DEMONSTRAÇÃO</span></div><p class='balance-amount'>${p?points(p.balance):'—'} <span>pts</span></p><div class='balance-card-bottom'><button class='btn primary' data-action='deposit'>${icon('plus')}Adicionar saldo</button><span class='meta'>Pontos fictícios.<br>Sem depósitos reais.</span></div></section><section class='card method-overview'><h2>Teste o pagamento</h2><p class='meta'>Escolha um método para conhecer o fluxo.</p><div class='methods-row'><button class='method-preview text-button muted' data-action='deposit' data-method='pix'><span class='method-icon'>${icon('pix')}</span><span><strong>Pix demo</strong><small>Confirmação simulada</small></span></button><button class='method-preview text-button muted' data-action='deposit' data-method='card'><span class='method-icon'>${icon('credit')}</span><span><strong>Cartão demo</strong><small>Cartão de teste pronto</small></span></button></div></section></div>`+stats([{label:'Pontos adicionados',value:points(transactions.filter(t=>t.amount>0&&t.kind!=='payout').reduce((s,t)=>s+t.amount,0)),icon:'plus'},{label:'Pontos em palpites',value:points(-transactions.filter(t=>t.kind==='bet').reduce((s,t)=>s+t.amount,0)),icon:'ticket'},{label:'Retornos recebidos',value:points(transactions.filter(t=>t.kind==='payout').reduce((s,t)=>s+t.amount,0)),icon:'trophy'}])+`<section class='card pad'><div class='card-top wrap'><h2>Seu extrato</h2><select id='walletFilter' class='filter-select' aria-label='Filtrar extrato'>${[['all','Todos os movimentos'],['deposit','Saldo adicionado'],['bet','Palpites'],['payout','Retornos'],['shop','Figurinhas']].map(([id,label])=>`<option value='${id}' ${ui.walletFilter===id?'selected':''}>${label}</option>`).join('')}</select></div>${transactionRows()}</section>`;
}
function renderStore(){
 const p=current(state),owned=new Set(p?.ownedStickers||[]);
 const card=item=>{
  const has=owned.has(item.id),active=p?.avatarSticker===item.id;
  const action=has?`<button class='btn ${active?'secondary':'primary'} wide' data-action='equipSticker' data-id='${item.id}' ${active?'disabled':''}>${active?'Avatar em uso':'Usar no perfil'} ${icon('check')}</button>`:p&&p.balance<item.price?`<button class='btn secondary wide' data-action='deposit'>Adicionar pontos demo ${icon('plus')}</button>`:`<button class='btn primary wide' data-action='buySticker' data-id='${item.id}'>${icon('store')}Obter avatar</button>`;
  if(item.kind==='player-caricature')return `<article class='card collectible-card tier-${item.tier}'>${stickerPortrait(item)}<div class='collectible-card-body'><div class='collectible-category'><span>${tierLabel(item.tier)} · ${esc(item.recognition)}</span>${has?`<span class='collection-owned'>${active?'EM USO':'NA COLEÇÃO'}</span>`:''}</div><h2>${esc(item.player)}</h2><p class='collectible-position'>${esc(item.nationality)} <span>/</span> ${esc(item.position)}</p><button class='signature-source-link' data-action='stickerDetails' data-id='${item.id}'>${icon('info')}Arte e fonte da assinatura ${icon('arrow')}</button><div class='collectible-price'><span><strong>${points(item.price)}</strong> pts<small>PONTOS DEMO</small></span>${action}</div></div></article>`;
  return `<article class='card sticker-card'>${stickerPortrait(item)}<div class='sticker-card-body'><div class='between'><span class='pill violet'>EDIÇÃO DEMO</span><strong class='sticker-rating'>${item.rating} <small>OVR</small></strong></div><h2>${esc(item.player)}</h2><p class='meta'>${esc(item.club)} · ${item.position}</p><p class='sticker-note'>Atleta fictício · ilustração original · rubrica inventada</p><div class='sticker-card-actions'>${has?`<span class='pill mint'>NA COLEÇÃO</span>`:''}${action}</div></div></article>`;
 };
 const catalog=STICKERS.filter(item=>!item.retired),legacy=STICKERS.filter(item=>item.retired&&owned.has(item.id));
 const filtered=catalog.filter(item=>ui.storeTier==='all'||ui.storeTier==='owned'&&owned.has(item.id)||item.tier===ui.storeTier);
 const filters=[['all','Todos'],['gold','Ouro'],['silver','Prata'],['bronze','Bronze'],['owned','Minha coleção']];
 return heading('Loja da arena.','Caricaturas para dar personalidade ao seu perfil.',`<button class='btn secondary' data-route='wallet'>${icon('wallet')}${p?`${points(p.balance)} pts demo`:'Pontos demo'}</button>`)+(!p?guestBanner('Sua coleção começa aqui','Crie um perfil para obter avatares com pontos de demonstração.'):'')+`<section class='collection-banner'><div><p class='eyebrow'>ARENA COLLECTION / VOL. 01</p><h2>SEU ÍDOLO.<br><em>SUA IDENTIDADE.</em></h2><p>Escolha seu jogador, monte sua coleção e entre em campo com outro estilo.</p></div><div class='collection-banner-emblems' aria-hidden='true'>${tierEmblem('bronze')}${tierEmblem('silver')}${tierEmblem('gold')}</div></section><div class='collection-scale' aria-label='Categorias editoriais de reconhecimento'><span><i class='tier-dot tier-bronze'></i><strong>Bronze</strong>Em ascensão</span><span><i class='tier-dot tier-silver'></i><strong>Prata</strong>Reconhecimento internacional</span><span><i class='tier-dot tier-gold'></i><strong>Ouro</strong>Ícone global</span></div><div class='collection-toolbar'><div class='collection-filters' role='group' aria-label='Filtrar avatares'>${filters.map(([value,label])=>`<button data-action='storeFilter' data-value='${value}' aria-pressed='${ui.storeTier===value}'>${label}</button>`).join('')}</div><span>${owned.size} ${owned.size===1?'avatar':'avatares'} na coleção</span></div><div class='collectible-grid'>${filtered.length?filtered.map(card).join(''):empty('Sua coleção começa em campo.','Escolha uma categoria e obtenha seu primeiro avatar.')}</div>${legacy.length&&['all','owned'].includes(ui.storeTier)?`<section class='legacy-collection'><h2>Sua coleção original</h2><p class='meta'>Figurinhas das edições anteriores, preservadas no seu perfil.</p><div class='sticker-grid'>${legacy.map(card).join('')}</div></section>`:''}${p?.avatarSticker?`<button class='text-button collection-reset' data-action='defaultAvatar'>Usar iniciais no perfil</button>`:''}<div class='collection-notes'><p>${icon('info')}Compras usam pontos fictícios, sem cobrança real. As categorias são uma seleção editorial da arena, sem relação com as notas da EA.</p><p>Caricaturas ilustradas com IA e reproduções de assinaturas publicadas, com fonte consultável em cada cartão. Não são autógrafos personalizados ou certificados pelos atletas.</p></div>`;
}
function renderTrophies(){
 return renderFootballTrophies({profile:current(state),level:level(current(state)),icon,esc,date});
}
function friendResults(){
 const p=current(state),search=ui.friendSearch.toLocaleLowerCase();
 const rows=PEOPLE.filter(w=>w.name.toLocaleLowerCase().includes(search)&&(ui.friendTab==='discover'?!p?.friends.includes(w.id):ui.friendTab==='friends'?p?.friends.includes(w.id):p?.requests.some(r=>r.personId===w.id)));
 return rows.length?rows.map(friendCard).join(''):empty(ui.friendSearch?'Nenhum jogador com esse apelido.':ui.friendTab==='friends'?'Monte seu time da arena.':'Nenhum convite por enquanto.',ui.friendSearch?'Tente outro nome entre os perfis de exemplo.':'Descubra jogadores e experimente os convites de amizade.',`<button class='btn secondary' data-action='friendTab' data-value='discover'>Descobrir jogadores</button>`);
}
function friendCard(w){
 const p=current(state),isFriend=p?.friends.includes(w.id),request=p?.requests.find(r=>r.personId===w.id),challenge=p?.challenges.find(c=>c.personId===w.id&&['sent','accepted','review','disputed'].includes(c.status));
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
 renderHeader();$('screen').innerHTML=({arena:renderArena,bets:renderBets,wallet:renderWallet,store:renderStore,trophies:renderTrophies,friends:renderFriends,ranking:renderRanking}[ui.view])();renderMobileSlip();
}
function go(view){const target=routes[view]||view;if(!VIEWS.includes(target))return;closeDialog();const hash=Object.keys(routes).find(k=>routes[k]===target);if(location.hash===`#${hash}`){ui.view=target;visit();render();}else location.hash=hash;}
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
 clearTimeout(paymentTimer);paymentTimer=null;ui.payment=null;ui.betReview=null;ui.pendingSticker=null;ui.afterLogin=null;ui.modalKind=null;
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
function clubPickerLabel(club,fallback=''){
 return `${club?`<img src='${esc(club.crest)}' alt='' width='32' height='32'>`:`<span class='club-picker-placeholder'>${icon('shield')}</span>`}<span><strong>${esc(club?.name||fallback||'Escolha seu clube')}</strong><small>${esc(club?.country||'Clubes do Brasil e da Europa')}</small></span>${icon('down')}`;
}
const clubSearchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
function clubOptions(search=''){
 const query=clubSearchText(search),clubs=CLUBS.filter(club=>clubSearchText([club.name,club.shortName,club.country,...(club.aliases||[])].join(' ')).includes(query));
 return ['Brasil','Europa'].map(region=>{
  const group=clubs.filter(club=>(club.country==='Brasil'?'Brasil':'Europa')===region);
  return group.length?`<div class='club-options-group' role='group' aria-label='${region}'><p>${region}</p>${group.map(club=>`<button type='button' role='option' aria-selected='${ui.profileClubId===club.id}' data-action='selectClub' data-id='${club.id}'><img src='${esc(club.crest)}' alt='' width='30' height='30' loading='lazy'><span><strong>${esc(club.name)}</strong><small>${esc(club.country)}</small></span>${ui.profileClubId===club.id?icon('check'):''}</button>`).join('')}</div>`:'';
 }).join('')||`<p class='club-search-empty'>Nenhum clube encontrado. Tente outro nome.</p>`;
}
function toggleClubPicker(open){
 const panel=$('clubPickerPanel'),button=$('heartClub');if(!panel||!button)return;
 panel.hidden=!open;button.setAttribute('aria-expanded',String(open));
 if(open)$('clubSearch')?.focus();else button.focus();
}
function selectHeartClub(id){
 const club=clubById(id);if(id&&!club)return;
 ui.profileClubId=club?.id||'';ui.profileClubChanged=true;
 $('profileClubId').value=ui.profileClubId;$('heartClub').innerHTML=clubPickerLabel(club);
 $('heartClub').setAttribute('aria-label',`Time do coração: ${club?.name||'selecionar clube'}`);
 $('teamPreview').innerHTML=teamBanner({...current(state),clubId:club?.id||null,teamName:club?.name||''},true);
 $('clubResults').innerHTML=clubOptions($('clubSearch').value);toggleClubPicker(false);
 $('teamPreview').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function showProfile(){
 const p=current(state);if(!p){showAuth();return;}ui.color=p.color;
 const club=clubById(p.clubId)||findClub(p.teamName);ui.profileClubId=club?.id||'';ui.profileClubChanged=false;ui.profileEditingId=p.id;
 showDialog('Seu perfil','Seu time no peito. Sua história na arena.',`<div class='profile-summary'>${profileAvatar(p,'large')}<div><h3>${esc(p.nickname)}</h3><p class='meta'>Nível ${level(p).number} · ${Object.keys(p.achievements).length} troféus</p><span class='pill subtle'>PERFIL LOCAL</span></div></div><div id='teamPreview'>${teamBanner(p,true)}</div><form data-form='profile' data-profile-id='${esc(p.id)}'><label class='form-label' for='editNickname'>Apelido</label><input class='form-input' id='editNickname' name='nickname' value='${esc(p.nickname)}' required minlength='2' maxlength='20'><span class='form-label' id='heartClubLabel'>Time do coração</span><div class='club-picker'><input type='hidden' id='profileClubId' name='clubId' value='${esc(ui.profileClubId)}'><button type='button' id='heartClub' class='club-picker-button' data-action='toggleClubPicker' aria-haspopup='listbox' aria-expanded='false' aria-controls='clubPickerPanel' aria-label='Time do coração: ${esc(club?.name||'selecionar clube')}'>${clubPickerLabel(club,p.teamName)}</button><div id='clubPickerPanel' class='club-picker-panel' hidden><label class='club-search-label' for='clubSearch'>${icon('search')}<input id='clubSearch' type='search' placeholder='Buscar clube ou país' autocomplete='off' aria-label='Buscar clube ou país'></label><div id='clubResults' class='club-options' role='listbox' aria-label='Clubes disponíveis'>${clubOptions()}</div><button type='button' class='club-clear-button' data-action='selectClub' data-id=''>Sem clube no banner</button></div></div><p class='form-help'>Escolha um clube para ver suas cores e seu brasão no banner. ${!club&&p.teamName?'Seu nome de time anterior será preservado até você escolher outro.':''}</p><span class='form-label'>Cor das suas iniciais</span>${colorsHTML()}<button class='btn primary wide' type='submit'>${icon('check')}Salvar perfil</button></form>${gameAccountCard(p)}<button class='btn secondary wide' data-route='loja' style='margin-top:12px'>${icon('store')}Abrir loja e coleção</button><div class='divider'></div><div class='action-grid'><button class='btn secondary' data-action='switchProfile'>Trocar perfil</button><button class='btn secondary' data-action='logout'>${icon('logout')}Sair</button></div>`,'profile');
}
function showGameAccount(){
 const p=current(state);if(!p)return;
 const account=p.gameAccount,platform=GAME_PLATFORMS.find(item=>item.id===account?.platform);
 const recent=p.challenges.slice().reverse().slice(0,5);
 showDialog('EA ID e partidas','Sua identidade de jogo e os registros da arena.',`<ol class='account-steps' aria-label='Etapas da integração'><li class='${account?'done':''}'><b>01</b>Cadastrar EA ID</li><li><b>02</b>Autorizar com a EA<br>(indisponível)</li><li><b>03</b>Sincronizar partidas<br>(indisponível)</li></ol><div class='account-status'><span class='pill amber'>${account?'ID NÃO VERIFICADO':'CONEXÃO OFICIAL INDISPONÍVEL'}</span><strong>${account?esc(account.eaId)+' · '+esc(platform?.label||''):'Conexão depende de autorização da EA'}</strong><p>Cadastrar seu ID não comprova a conta nem consulta seus jogos. A API oficial está limitada a parceiros aprovados; o acesso a placares recentes para a arena ainda não está disponível. <a href='https://help.ea.com/pt-br/articles/ea-sports-fc/community-api/' target='_blank' rel='noopener noreferrer'>Saiba mais na EA</a>.</p></div><form data-form='gameAccount' data-profile-id='${esc(p.id)}'><label class='form-label' for='eaId'>Seu EA ID público</label><input class='form-input' id='eaId' name='eaId' value='${esc(account?.eaId||'')}' placeholder='Ex.: DjowFC' autocomplete='off' autocapitalize='none' spellcheck='false' minlength='4' maxlength='16' required aria-describedby='eaIdHelp'><p class='form-help' id='eaIdHelp'>Use seu identificador público, de 4 a 16 caracteres. Não informe e-mail ou senha.</p><label class='form-label' for='gamePlatform'>Onde você joga?</label><select class='form-input' id='gamePlatform' name='platform' required><option value='' ${!account?'selected':''} disabled>Escolha a plataforma</option>${GAME_PLATFORMS.map(item=>`<option value='${item.id}' ${account?.platform===item.id?'selected':''}>${item.label}</option>`).join('')}</select><p class='form-help'>Salvo somente neste perfil, neste navegador.</p><button class='btn primary wide' type='submit'>${account?'Atualizar EA ID':'Salvar EA ID'} ${icon('check')}</button></form>${account?`<button class='text-button' data-action='unlinkGameAccount' data-profile-id='${esc(p.id)}'>Remover EA ID deste perfil</button>`:''}<section class='account-history'><h3>Últimas partidas da arena</h3><p class='meta'>Registros locais, sem sincronização com a EA. Somente uma integração autorizada poderá conferir dados oficiais.</p>${recent.length?recent.map(duelCard).join(''):`<p class='account-empty'>Nenhum desafio registrado. Combine sua primeira partida na área Amigos.</p>`}</section>`,'gameAccount');
}
function showCredits(){
 showDialog('Imagens e créditos','Referências do futebol, com origem identificada.',ATHLETES.map(a=>`<section class='credit-entry'><strong>${a.name}</strong><p>Foto: ${a.author} / Wikimedia Commons.</p><p><a href='${a.source}' target='_blank' rel='noopener noreferrer'>Fotografia original</a> · <a href='${a.licenseUrl}' target='_blank' rel='noopener noreferrer'>${a.license}</a></p><p>${a.changes}</p></section>`).join('')+`<section class='credit-entry'><strong>Caricaturas da loja</strong><p>Cristiano Ronaldo e Bruno Fernandes: ilustrações criadas com IA para a arena. Senne Lammens: adaptação com IA da fotografia de Bryan Berlin / WikiPortraits, sob <a href='https://creativecommons.org/licenses/by-sa/4.0/' target='_blank' rel='noopener noreferrer'>CC BY-SA 4.0</a>.</p><p><a href='https://commons.wikimedia.org/wiki/File:Senne_Lammens_USMNT_v_Belgium_Mar_28_2026-98_(cropped).jpg' target='_blank' rel='noopener noreferrer'>Fotografia de referência de Lammens</a> · <a href='https://github.com/djowww/fifabet-arena/blob/main/docs/ASSINATURAS_FONTES.md' target='_blank' rel='noopener noreferrer'>Fontes das reproduções de assinaturas</a></p></section><p class='form-help'>As imagens não representam parceria ou endosso. As reproduções de assinaturas não são autógrafos certificados ou personalizados.</p><a class='btn secondary wide' href='https://github.com/djowww/fifabet-arena/blob/main/THIRD_PARTY_NOTICES.md' target='_blank' rel='noopener noreferrer'>Ver todas as atribuições ${icon('arrow')}</a>`,'credits');
}
function showStickerDetails(id){
 const item=STICKERS.find(entry=>entry.id===id&&entry.kind==='player-caricature');if(!item)return;
 showDialog(esc(item.player),'Caricatura e reprodução de assinatura.',`${stickerPortrait(item)}<section class='signature-provenance'><h3>${tierLabel(item.tier)} · ${esc(item.recognition)}</h3><p>Categoria editorial de reconhecimento. A arte foi criada com IA; os traços da assinatura foram preservados de um arquivo publicado, sem geração de autógrafo.</p><a class='btn secondary wide' href='${esc(item.signatureSource)}' target='_blank' rel='noopener noreferrer'>Abrir origem citada ${icon('arrow')}</a><a class='signature-reference' href='${esc(item.signatureReference)}' target='_blank' rel='noopener noreferrer'>Consultar arquivo e atribuição no Wikimedia Commons ${icon('arrow')}</a><p class='form-help'>${item.id==='senne-lammens'?'A publicação do Manchester United é citada pela fonte; o acesso direto ao post não pôde ser confirmado. ':''}Reprodução com origem documentada, sem certificação do atleta ou autógrafo personalizado.</p>${item.id==='senne-lammens'?`<p class='form-help'>Caricatura adaptada da foto de Bryan Berlin / WikiPortraits. Alterações: estilo, proporções, uniforme e fundo. <a href='https://creativecommons.org/licenses/by-sa/4.0/' target='_blank' rel='noopener noreferrer'>CC BY-SA 4.0</a> · <a href='https://commons.wikimedia.org/wiki/File:Senne_Lammens_USMNT_v_Belgium_Mar_28_2026-98_(cropped).jpg' target='_blank' rel='noopener noreferrer'>Foto original</a>.</p>`:''}</section>`,'stickerDetails');
}
function showStickerPurchase(id){
 const item=STICKERS.find(entry=>entry.id===id),p=current(state);if(!item||!p)return;
 if(p.ownedStickers.includes(item.id)){toast('Essa figurinha já está na sua coleção.');return;}
 ui.pendingSticker={id:item.id,profileId:p.id};
 showDialog('Adicionar à coleção',`${esc(item.player)} · ${points(item.price)} pontos demo.`,`${stickerPortrait(item)}<p class='hint'>Saldo depois da compra: ${points(p.balance-item.price)} pts demo. Sem cobrança real.</p><button class='btn primary wide' data-action='confirmStickerPurchase'>Confirmar · ${points(item.price)} pts ${icon('check')}</button>`,'stickerPurchase');
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
 showDialog('Envie o placar para análise','Uma foto do resultado é obrigatória antes de qualquer pontuação.',`<p class='hint'>Desafio ${esc(challenge.mode||'1v1')} contra <strong>${esc(rival)}</strong> · ${points(challenge.stake)} pontos simbólicos.</p><form data-form='challengeResult' data-id='${esc(id)}'><label class='form-label' for='challengeWinner'>Quem venceu?</label><select class='form-input' id='challengeWinner' name='winner' required><option value='you'>Eu venci</option><option value='friend'>${esc(rival)} venceu</option></select>${evidenceField('challengeEvidence')}<div class='banner-note fraud-note'>${icon('shield')}<span>O resultado ficará pendente e não alterará ranking ou pontos enquanto não houver revisão. Neste protótipo, a foto fica somente neste navegador; a equipe ainda não recebe o envio.</span></div><button class='btn primary wide' type='submit'>Salvar placar e deixar em análise</button></form><button class='btn secondary wide fraud-trigger' data-action='reportFraud' data-id='${esc(id)}'>Sinalizar suspeita de fraude</button>`,'challengeResult');
}
function evidenceField(id){
 return `<label class='form-label' for='${id}'>Foto do resultado</label><input class='form-input evidence-input' id='${id}' name='evidence' type='file' accept='image/*' capture='environment' required><p class='form-help'>Tire uma foto da tela final ou selecione uma imagem do placar. A imagem será reduzida antes de ser salva.</p><div class='evidence-preview' id='evidencePreview'><span>Prévia da evidência aparecerá aqui.</span></div>`;
}
async function compressEvidence(file){
 if(!file||!String(file.type||'').startsWith('image/'))throw Error('Selecione uma foto válida do resultado.');
 if(file.size>15*1024*1024)throw Error('A foto precisa ter até 15 MB antes da compressão.');
 let bitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw Error('Não consegui abrir essa foto. Escolha outra imagem.');}
 try{
  let scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  for(let attempt=0;attempt<6;attempt++){
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d',{alpha:false});if(!context)throw Error('Não consegui preparar a foto neste navegador.');
   context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [.76,.64,.52,.4]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=450000)return data;}
   scale*=.72;
  }
 }finally{bitmap.close?.();}
 throw Error('A foto ainda ficou grande demais. Tire outra com menos detalhes ou resolução.');
}
function showFraudReport(id){
 const challenge=current(state)?.challenges.find(c=>c.id===id&&['accepted','review'].includes(c.status));if(!challenge)return;
 const rival=PEOPLE.find(person=>person.id===challenge.personId)?.name||'seu amigo';
 showDialog('Sinalizar suspeita de fraude','Anexe o placar e explique a divergência.',`<form data-form='fraudReport' data-id='${esc(id)}'><label class='form-label' for='fraudWinner'>Quem aparece como vencedor?</label><select class='form-input' id='fraudWinner' name='winner' required><option value='you' ${challenge.reportedWinner==='you'?'selected':''}>Eu venci</option><option value='friend' ${challenge.reportedWinner==='friend'?'selected':''}>${esc(rival)} venceu</option></select><label class='form-label' for='fraudReason'>O que precisa ser revisado?</label><textarea class='form-input fraud-reason' id='fraudReason' name='reason' minlength='8' maxlength='300' placeholder='Ex.: o resultado registrado não corresponde ao placar final.' required></textarea>${evidenceField('fraudEvidence')}<div class='banner-note fraud-note'>${icon('shield')}<span>A sinalização bloqueia a conclusão do desafio. A foto fica local neste protótipo e não é enviada para uma equipe.</span></div><button class='btn primary wide' type='submit'>Salvar denúncia e bloquear pontuação</button></form>`,'fraudReport');
}
function showChallengeEvidence(id){
 const challenge=current(state)?.challenges.find(c=>c.id===id&&['review','disputed','completed'].includes(c.status));if(!challenge?.evidenceDataUrl)return;
 const winner=challenge.reportedWinner==='you'?'Você':PEOPLE.find(person=>person.id===challenge.personId)?.name||'seu amigo';
 const original=challenge.originalReport;
 const originalWinner=original?.reportedWinner==='you'?'Você':PEOPLE.find(person=>person.id===challenge.personId)?.name||'seu amigo';
 const originalHTML=original?`<h3>Envio original</h3><figure class='evidence-figure'><img class='evidence-image' src='${esc(original.evidenceDataUrl)}' alt='Foto original do placar, preservada antes da denúncia'><figcaption>${esc(original.evidenceName||'Placar original')} · resultado informado: ${esc(originalWinner)}</figcaption></figure><h3>Evidência da denúncia</h3>`:'';
 showDialog('Evidência do desafio','Foto salva neste navegador para revisão demonstrativa.',`${originalHTML}<figure class='evidence-figure'><img class='evidence-image' src='${esc(challenge.evidenceDataUrl)}' alt='Foto do placar enviada para o desafio'><figcaption>${esc(challenge.evidenceName||'Foto do resultado')} · resultado informado: ${esc(winner)}</figcaption></figure>${challenge.fraudReason?`<div class='banner-note fraud-note'>${icon('shield')}<span>${esc(challenge.fraudReason)}</span></div>`:''}<div class='banner-note fraud-note'>${icon('info')}<span>Esta imagem não foi enviada a uma equipe. Para revisão real entre dispositivos, falta conectar o backend de moderação.</span></div><button class='btn secondary wide' data-action='closeDialog'>Fechar</button>`,'challengeEvidence');
}
function showFriend(id){
 const w=PEOPLE.find(w=>w.id===id);if(!w)return;
 showDialog('Jogador da comunidade','Perfil fictício para explorar as interações.',`<div class='profile-summary'>${avatar(w.initials,w.color,'large')}<div><h3>${w.name}</h3><p class='meta'>${w.tag}</p><span class='pill subtle'>Nível ${w.level}</span></div></div>${stats([{label:'Vitórias demo',value:w.wins},{label:'Troféus demo',value:w.trophies},{label:'Nível demo',value:w.level}])}${friendCard(w)}`,'friend');
}
function confirmFriendAction(id,action){
 const w=PEOPLE.find(w=>w.id===id);if(!w)return;
 if(action==='challenge'){
  withProfile(()=>showDialog(`Desafie ${esc(w.name)}`,'Combine o formato e os pontos simbólicos.',`<form data-form='challenge' data-id='${esc(id)}'><label class='form-label' for='challengeMode'>Modo de jogo</label><select class='form-input' id='challengeMode' name='mode' required><option value='1v1' ${ui.challengeMode==='1v1'?'selected':''}>1 contra 1</option><option value='Ultimate Team' ${ui.challengeMode==='Ultimate Team'?'selected':''}>Ultimate Team</option><option value='Clubes' ${ui.challengeMode==='Clubes'?'selected':''}>Clubes</option></select><label class='form-label' for='challengeStake'>Pontos simbólicos</label><select class='form-input' id='challengeStake' name='stake' required><option value='50'>50 pontos</option><option value='100' selected>100 pontos</option><option value='250'>250 pontos</option><option value='500'>500 pontos</option></select><p class='form-help'>Pontos de demonstração: não são descontados, pagos ou transferidos.</p><button class='btn primary wide' type='submit'>Enviar convite ${icon('arrow')}</button></form>`,'challenge'));
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
   case 'toggleClubPicker':toggleClubPicker($('clubPickerPanel').hidden);break;
   case 'selectClub':selectHeartClub(id);break;
   case 'gameAccount':withProfile(showGameAccount);break;
   case 'selectMode':if(['1v1','Ultimate Team','Clubes'].includes(value)){ui.challengeMode=value;go('amigos');toast('Modo '+value+' selecionado. Escolha seu amigo para desafiar.');}break;
   case 'tournaments':showTournamentPreview();break;
   case 'unlinkGameAccount':commit('unlinkGameAccount',{profileId:button.dataset.profileId});render();showGameAccount();toast('EA ID removido deste perfil.');break;
   case 'credits':showCredits();break;
   case 'storeFilter':if(['all','gold','silver','bronze','owned'].includes(value)){ui.storeTier=value;render();}break;
   case 'stickerDetails':showStickerDetails(id);break;
   case 'buySticker':withProfile(()=>showStickerPurchase(id));break;
   case 'confirmStickerPurchase':if(ui.pendingSticker){const item=STICKERS.find(entry=>entry.id===ui.pendingSticker.id);commit('purchaseSticker',ui.pendingSticker);closeDialog();render();toast(`${item?.player||'Figurinha'} adicionada à coleção.`);}break;
   case 'equipSticker':withProfile(()=>{commit('avatarSticker',{id});render();toast('Avatar atualizado.');});break;
   case 'defaultAvatar':withProfile(()=>{commit('avatarSticker',{id:null});render();toast('Avatar de iniciais restaurado.');});break;
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
   case 'reportFraud':showFraudReport(id);break;
   case 'challengeEvidence':showChallengeEvidence(id);break;
   case 'activity':showActivity();break;
  }
 }catch(error){reportError(error);}
});
document.addEventListener('input',event=>{
 if(event.target.matches('[data-stake]')){ui.stake=event.target.value;syncStake();}
 if(event.target.id==='friendSearch'){ui.friendSearch=event.target.value;$('friendGrid').innerHTML=friendResults();}
 if(event.target.id==='clubSearch')$('clubResults').innerHTML=clubOptions(event.target.value);
});
document.addEventListener('keydown',event=>{
 if(ui.modalKind!=='profile')return;
 const panel=$('clubPickerPanel');if(!panel)return;
 if(event.target.id==='heartClub'&&event.key==='ArrowDown'){event.preventDefault();toggleClubPicker(true);return;}
 if(panel.hidden)return;
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();toggleClubPicker(false);return;}
 if(!['ArrowDown','ArrowUp'].includes(event.key))return;
 const options=[...document.querySelectorAll('#clubResults [role=option]')];if(!options.length)return;
 const index=options.indexOf(event.target);if(index<0&&event.target.id!=='clubSearch')return;
 event.preventDefault();options[index<0?0:Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowDown'?1:-1)))].focus();
});
document.addEventListener('change',event=>{
 if(event.target.id==='categoryFilter'){ui.category=event.target.value;$('matchGrid').innerHTML=matchList();}
 if(event.target.id==='walletFilter'){ui.walletFilter=event.target.value;render();}
 if(['challengeEvidence','fraudEvidence'].includes(event.target.id)){
  const file=event.target.files?.[0],preview=$('evidencePreview');
  if(file)preview.innerHTML=`<img src='${esc(URL.createObjectURL(file))}' alt='Prévia da foto selecionada'><span>${esc(file.name)}</span>`;
 }
});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();
 if(!form.reportValidity())return;
 try{
  if(form.dataset.form==='gameAccount'){
   const values=new FormData(form);commit('saveGameAccount',{profileId:form.dataset.profileId,eaId:values.get('eaId'),platform:values.get('platform')});render();showGameAccount();toast('EA ID salvo como não verificado.');return;
  }
  if(form.dataset.form==='challenge'){
   const data=new FormData(form);commit('challenge',{id:form.dataset.id,stake:Number(data.get('stake')),mode:data.get('mode')});closeDialog();render();toast('Convite enviado. Os pontos simbólicos não são debitados.');return;
  }
  if(['challengeResult','fraudReport'].includes(form.dataset.form)){
   const values=new FormData(form),file=values.get('evidence'),submitter=event.submitter,profileId=state.activeProfileId;
   if(submitter)submitter.disabled=true;
   try{
    const evidenceDataUrl=await compressEvidence(file),payload={id:form.dataset.id,profileId,winner:values.get('winner'),evidenceDataUrl,evidenceName:file.name};
    if(form.dataset.form==='fraudReport')payload.reason=values.get('reason');
    commit(form.dataset.form==='fraudReport'?'reportFraud':'submitChallengeResult',payload);closeDialog();render();toast(form.dataset.form==='fraudReport'?'Denúncia salva. A pontuação continua bloqueada.':'Foto salva. O resultado aguarda revisão e não altera os pontos.');
   }catch(error){if(submitter)submitter.disabled=false;reportError(error);}
   return;
  }
  const values=new FormData(form),data={nickname:values.get('nickname'),color:ui.color};
  if(form.dataset.form==='create'){commit('create',data);finishLogin();}
  if(form.dataset.form==='profile'){
   data.profileId=form.dataset.profileId||ui.profileEditingId;
   if(ui.profileClubChanged||values.get('clubId'))data.clubId=values.get('clubId');
   commit('profile',data);closeDialog();render();toast('Perfil atualizado.');
  }
 }catch(error){reportError(error);}
});
$('modal').addEventListener('cancel',event=>{event.preventDefault();if(ui.modalKind==='profile'&&$('clubPickerPanel')&&!$('clubPickerPanel').hidden)toggleClubPicker(false);else closeDialog();});
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
window.addEventListener('hashchange',()=>{closeDialog();ui.view=routes[location.hash.slice(1)]||'arena';visit();render();window.scrollTo({top:0});$('screen').focus({preventScroll:true});});
window.addEventListener('storage',event=>{
 if(event.key!==STORAGE_KEY&&event.key!==null)return;
 const prior=state.activeProfileId,next=restore(read(STORAGE_KEY));if(prior!==next.activeProfileId)switchSlip(prior,next.activeProfileId,false);state=next;
 if($('modal').open){closeDialog();toast(prior!==state.activeProfileId?'Perfil atualizado em outra aba.':'Dados atualizados em outra aba. Reabra a ação para continuar.');}
 render();
});
persist();visit();render();
