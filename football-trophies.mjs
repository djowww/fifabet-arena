// Original arena collectibles. IDs match the persisted achievement records.
// Inspiration describes football culture, not an official competition award.
export const FOOTBALL_TROPHY_DESIGNS = [
  {id:'welcome',name:'Taça de estreia',description:'Crie seu perfil e entre em campo na arena.',art:'estreia',metal:'gold',category:'TAÇA',inspiration:'BRASIL · PRIMEIRO APITO',rule:'Criar um perfil local.'},
  {id:'favorite',name:'Alma de arquibancada',description:'A paixão pelo jogo começa na torcida.',art:'torcida',metal:'gold',category:'MEDALHA',inspiration:'BRASIL · ARQUIBANCADA',rule:'Salvar uma partida demo nos favoritos.'},
  {id:'firstbet',name:'Camisa 10',description:'Uma homenagem a quem enxerga a próxima jogada.',art:'camisa-10',metal:'silver',category:'MEDALHA',inspiration:'BRASIL + EUROPA · CRIAÇÃO',rule:'Registrar o primeiro palpite na simulação demo.'},
  {id:'winner',name:'Chuteira de ouro',description:'O brilho de quem faz a rede balançar.',art:'chuteira',metal:'gold',category:'CHUTEIRA',inspiration:'EUROPA · ARTILHARIA',rule:'Concluir um palpite vencedor na simulação demo.'},
  {id:'friend',name:'Clássico entre amigos',description:'Rivais em campo. Parceiros fora dele.',art:'classico',metal:'bronze',category:'TAÇA',inspiration:'BRASIL + EUROPA · RIVALIDADE',rule:'Adicionar o primeiro amigo de demonstração.'},
  {id:'explorer',name:'Noites europeias',description:'Toda grande jornada pede uma taça à altura.',art:'europeia',metal:'silver',category:'TAÇA',inspiration:'EUROPA · NOITE DE COPA',rule:'Visitar as sete áreas principais da arena.'}
];

const areas=['arena','friends','store','ranking','bets','trophies','wallet'];
const fallbackEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function nextObjective(profile){
  const earned=profile?.achievements||{};
  // Prioritize actions the current arena makes available to everyone.
  for(const id of ['welcome','friend','explorer','favorite','firstbet','winner']){
    if(!earned[id])return FOOTBALL_TROPHY_DESIGNS.find(item=>item.id===id);
  }
  return null;
}

export function renderFootballTrophies({profile,level,icon=()=>'',esc=fallbackEscape,date=value=>new Date(value).toLocaleDateString('pt-BR')}={}){
  const p=profile||null;
  const collected=FOOTBALL_TROPHY_DESIGNS.filter(item=>p?.achievements?.[item.id]);
  const count=collected.length;
  const computed={xp:count*100,number:1+Math.floor(count/2),progress:(count*100)%200};
  const l=(typeof level==='function'?level(p):level)||computed;
  const xp=Number.isFinite(l.xp)?l.xp:computed.xp;
  const number=Number.isFinite(l.number)?l.number:computed.number;
  const progress=Number.isFinite(l.progress)?Math.max(0,Math.min(199,l.progress)):computed.progress;
  const visited=areas.filter(area=>p?.visited?.includes(area)).length;
  const next=nextObjective(p);
  const nextAction=!p?`<button class='btn primary' data-action='auth' data-mode='create'>Criar meu perfil ${icon('arrow')}</button>`:
    next?.id==='friend'?`<button class='btn primary' data-route='amigos'>Encontrar um rival ${icon('arrow')}</button>`:
    next?.id==='explorer'?`<button class='btn primary' data-route='ranking'>Explorar a arena ${icon('arrow')}</button>`:
    next?`<button class='btn secondary' data-action='help'>Como conquistar ${icon('arrow')}</button>`:
    `<button class='btn primary' data-route='amigos'>Chamar para o clássico ${icon('arrow')}</button>`;

  const cards=FOOTBALL_TROPHY_DESIGNS.map((item,index)=>{
    const earned=p?.achievements?.[item.id];
    const value=earned?1:item.id==='explorer'?visited/areas.length:0;
    const status=earned?`Conquistado em ${esc(date(earned))}`:item.id==='explorer'?`${visited} de ${areas.length} áreas visitadas`:'Ainda por conquistar';
    return `<article class='football-trophy ${earned?'is-earned':'is-locked'} metal-${item.metal}' aria-labelledby='footballTrophy-${item.id}'>
      <div class='football-trophy-top'><span class='football-collectible-type'>${item.category}</span><span class='football-edition'>${String(index+1).padStart(2,'0')} / 06</span></div>
      <div class='football-trophy-stage'><div class='football-trophy-halo' aria-hidden='true'></div><img src='assets/trophies/${item.art}.svg' alt='${esc(item.name)}: arte original da coleção da arena' width='600' height='600' loading='lazy'><span class='football-trophy-xp'>100 XP</span></div>
      <div class='football-trophy-copy'><p class='football-inspiration'>${item.inspiration}</p><h3 id='footballTrophy-${item.id}'>${item.name}</h3><p class='football-trophy-story'>${item.description}</p><p class='football-trophy-rule'>${item.rule}</p></div>
      <div class='football-trophy-bottom'><span class='football-trophy-status'>${icon(earned?'check':'lock')} ${status}</span><progress max='1' value='${value}' aria-label='Progresso: ${esc(item.name)}'></progress></div>
    </article>`;
  }).join('');

  return `<div class='football-room'>
    <header class='football-room-heading'><div><p class='eyebrow'>SEU LEGADO NA ARENA</p><h1>O jogo passa.<br><em>A história fica.</em></h1><p>Taças, medalhas e a paixão que une o futebol brasileiro ao europeu.</p></div><span class='football-season-tag'>COLEÇÃO DA ARENA <b>01</b></span></header>
    <section class='football-room-hero' aria-label='Sua sala de troféus'>
      <div class='football-room-pitch' aria-hidden='true'><i></i><i></i><i></i></div>
      <div class='football-hero-copy'><p class='eyebrow'>${p?'SUA SALA DE TROFÉUS':'BEM-VINDO À SUA SALA DE TROFÉUS'}</p><h2>${p?`Cada conquista<br>tem seu <em>brilho.</em>`:`Seu primeiro<br><em>troféu te espera.</em>`}</h2><p>${p?`A coleção de ${esc(p.nickname)}. Do primeiro apito às grandes noites, construa seu caminho na arena.`:'Entre em campo, encontre seus amigos e comece uma coleção com a sua história.'}</p><div class='football-room-count'><strong>${count}<small>/ 6</small></strong><span>PEÇAS<br>CONQUISTADAS</span></div></div>
      <div class='football-hero-display' aria-hidden='true'><span class='football-display-beam'></span><img class='football-display-medal' src='assets/trophies/torcida.svg' alt='' width='600' height='600'><img class='football-display-boot' src='assets/trophies/chuteira.svg' alt='' width='600' height='600'><img class='football-display-cup' src='assets/trophies/europeia.svg' alt='' width='600' height='600'><span class='football-display-shelf'></span><span class='football-display-caption'>DA ARQUIBANCADA AO TOPO</span></div>
    </section>
    <section class='football-progression' aria-label='Progresso da coleção'><div class='football-level-number'><small>NÍVEL</small><strong>${number}</strong></div><div class='football-level-copy'><strong>${count<2?'Primeiro apito':count<4?'Nome na camisa':'História de craque'}</strong><span>${xp} XP conquistados · ${200-progress} XP para o próximo nível</span><progress max='200' value='${progress}' aria-label='Progresso do nível'></progress></div><div class='football-next-objective'><span>PRÓXIMA CONQUISTA</span><strong>${next?next.name:'Vitrine completa'}</strong><small>${next?.id==='explorer'?`${visited} de ${areas.length} áreas visitadas`:next?next.rule:'Sua coleção está completa. Continue jogando com seus amigos.'}</small></div>${nextAction}</section>
    <div class='football-collection-header'><div><p class='eyebrow'>AS PEÇAS DA SUA HISTÓRIA</p><h2>Uma vitrine com alma de futebol.</h2></div><span>${count} conquistadas · ${6-count} para desbloquear</span></div>
    <div class='football-trophy-grid'>${cards}</div>
    <p class='football-room-note'>Colecionáveis originais da arena, inspirados na cultura do futebol. As conquistas registram ações locais de demonstração; os palpites usam resultados simulados.</p>
  </div>`;
}
