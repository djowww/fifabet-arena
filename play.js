import * as M from './model.mjs?v=15';
import * as API from './backend-client.mjs?v=15';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=M.points;
const when=x=>new Date(x).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const read=()=>{try{return M.restore(localStorage.getItem(M.STORAGE_KEY),localStorage.getItem('fifabet-profile'),localStorage.getItem('fifabet-bets'));}catch{return M.emptyState();}};
let state=read(),online=false,arena=null,busy=false,foundPlayer=null,invite=null,reviewDuels=[],opener,toastTimer;
const ui={view:'arena',filter:'all',search:'',mode:'1v1',platform:'pc',stake:'100',rival:'',rules:''};
const names={invited:'Convite pendente',active:'Em jogo',review:'Aguardando equipe',disputed:'Resultado contestado',settled:'Finalizado',rejected:'Recusado',cancelled:'Cancelado',expired:'Expirado'};
const tones={invited:'amber',active:'mint',review:'violet',disputed:'live',settled:'lime'};
const profile=()=>online?arena?.user:M.current(state);
const open=d=>['invited','active','review','disputed'].includes(d.status);
const btn=(action,id,label,primary=false)=>`<button class='btn ${primary?'primary':'secondary'}' data-action='${action}' data-id='${esc(id)}'>${label}</button>`;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
function save(next=state){try{localStorage.setItem(M.STORAGE_KEY,JSON.stringify(next));state=next;$('storageWarning').hidden=true;}catch{$('storageWarning').hidden=false;throw Error('Não foi possível salvar. Libere espaço no navegador para continuar.');}}
function localChange(action,data={}){const latest=read();if(latest.activeProfileId!==state.activeProfileId)throw Error('O perfil mudou em outra aba. Atualize antes de continuar.');save(M.change(latest,action,data));}
function avatar(p,size=''){
 const sticker=M.STICKERS.find(s=>s.id===p?.avatarSticker&&p?.ownedStickers?.includes(s.id));
 const club=M.clubById(p?.clubId)||M.findClub(p?.teamName),art=sticker?.art||club?.kit?.file;
 return art?`<span class='avatar kit-avatar ${size}' role='img' aria-label='${esc(sticker?sticker.player:`Uniforme do ${club.name}`)}'><img src='${esc(art)}' alt='' width='92' height='92'></span>`:`<span class='avatar neutral-kit-avatar ${size}' role='img' aria-label='Camisa de futebol'><svg viewBox='0 0 64 64' aria-hidden='true'><path d='M22 9 10 14 3 28l11 6 5-8v30h26V26l5 8 11-6-7-14-12-5c-2 5-5 7-10 7s-8-2-10-7Z' fill='#172d21' stroke='#07F468' stroke-width='2'/></svg></span>`;
}
function normalize(d){
 if(!online)return {...d,host:state.profiles[d.creatorId],guest:state.profiles[d.opponentId],hostId:d.creatorId,guestId:d.opponentId,result:d.report,peerConfirmed:!!d.peerConfirmed};
 const host=d.host,guest=d.guest||d.recipient||{id:d.recipientId,nickname:'Amigo convidado'};
 return {...d,host,guest,status:d.cancellationReason==='declined'?'rejected':({in_progress:'active',pending_review:'review',completed:'settled'}[d.status]||d.status),result:d.result?{...d.result,submittedBy:d.result.reporterId}:null,peerConfirmed:!!d.result?.confirmedBy,cancelRequestedBy:d.cancellationRequestedBy?.[0],winnerId:d.winnerId||(d.winner==='host'?d.hostId:d.winner==='guest'?d.guestId:null)};
}
function duels(){return online?[...(arena?.duels||[]),...(arena?.history||[])].map(normalize).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)):(M.duelsForProfile(state)||[]).map(normalize);}
const opponent=d=>d.hostId===profile()?.id?d.guest:d.host;
const score=d=>d.result?`${d.result.homeScore} × ${d.result.awayScore}`:'—';
const playerScore=d=>d.result?(d.hostId===profile()?.id?score(d):`${d.result.awayScore} × ${d.result.homeScore}`):'—';
const resultText=d=>d.status==='settled'?(d.winnerId===profile()?.id?'Você venceu':d.winnerId?'Você perdeu':'Empate'):names[d.status];
const photoUrl=r=>r?(online?API.evidenceUrl(r.evidenceId):r.evidenceDataUrl):'';
function reportHistory(d){
 const previous=(d.reports||[]).filter(r=>r.id!==d.result?.id);
 return previous.length?`<details class='evidence-history'><summary>Versões anteriores do placar (${previous.length})</summary>${previous.map(r=>`<p class='meta'>${when(r.submittedAt||r.date)} · ${r.homeScore} × ${r.awayScore}</p><img class='review-image' loading='lazy' src='${esc(photoUrl(r))}' alt='Foto de uma versão anterior do placar'>`).join('')}</details>`:'';
}
const reserved=()=>online?(arena?.stats?.reserved||0):(profile()?M.duelReservedPoints(state,profile().id):0);
function byId(id){const d=duels().find(d=>d.id===id)||(profile()?.isReviewer?reviewDuels.find(d=>d.id===id):null);if(!d)throw Error('Partida não encontrada. Atualize a arena.');return d;}
async function refresh(){if(online)arena=await API.getArena();else state=read();render();}
function modal(title,subtitle,html){opener=document.activeElement;$('modalContent').innerHTML=`<div class='dialog-head'><div><h2 id='dialogTitle'>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class='icon-only' data-action='close' aria-label='Fechar janela'>×</button></div><div class='dialog-body'>${html}<p id='dialogError' class='error-message' role='alert' hidden></p></div>`;if(!$('modal').open)$('modal').showModal();}
function closeModal(){if($('modal').open)$('modal').close();if(opener?.isConnected)opener.focus();}
function fail(message){if($('dialogError')&&$('modal').open){$('dialogError').textContent=message;$('dialogError').hidden=false;}else toast(message);}
function intro(title,description){return `<div class='practical-intro'><div><p class='eyebrow'>FIFABET · ENTRE AMIGOS</p><h1>${title}</h1><p class='muted'>${description}</p></div></div>`;}
function header(){
 const p=profile(),items=[['arena','Desafios','↔'],['historico','Histórico','◷'],['ranking','Ranking','🏆'],['perfil','Meu perfil','♙']];
 if(p?.isReviewer)items.push(['revisao','Revisão','✓']);
 $('navigation').innerHTML=items.map(([hash,label,symbol])=>`<a class='nav-item ${ui.view===hash?'active':''}' href='#${hash}' ${ui.view===hash?`aria-current='page'`:''}><span aria-hidden='true'>${symbol}</span><span>${label}</span></a>`).join('');
 $('breadcrumb').textContent=items.find(([hash])=>ui.view===hash)?.[1]||'Desafios';
 $('headerActions').innerHTML=p?`<span class='meta'>${online?'Conta conectada':'Neste navegador'}</span><button class='profile-button' data-action='profile' aria-label='Abrir perfil de ${esc(p.nickname)}'>${avatar(p,'small')}<span>${esc(p.nickname)}</span></button>`:`<button class='btn secondary' data-action='login'>Entrar</button><button class='btn primary' data-action='signup'>Criar conta</button>`;
}
function summaries(){return `<div class='summary-grid'><div><small>DISPONÍVEL</small><strong>${fmt(profile()?.balance||0)} <small>pts</small></strong></div><div><small>EM DISPUTA</small><strong>${fmt(reserved())} <small>pts</small></strong></div><div><small>DESAFIOS ABERTOS</small><strong>${duels().filter(open).length}</strong></div></div>`;}
function identity(){
 const p=profile();
 if(!p)return `<aside class='card arena-sidebar pad'><h2>Seu próximo rival está aqui.</h2><p class='muted'>Crie seu perfil, receba seu ID FifaBet e comece com 1.000 pontos de demonstração.</p><button class='btn primary wide' data-action='signup'>Criar conta</button><p class='meta'>Pontos fictícios, sem valor financeiro.</p></aside>`;
 return `<aside class='card arena-sidebar pad'><div class='row'>${avatar(p)}<div><strong>${esc(p.nickname)}</strong><p class='meta'>${esc(M.clubById(p.clubId)?.name||'Escolha seu time no perfil')}</p></div></div><p class='form-label'>Seu ID FifaBet</p><div class='player-id'><code>${esc(p.publicPlayerId)}</code><button class='btn secondary small' data-action='copy-id'>Copiar</button></div><p class='meta'>Envie seu ID para um amigo te desafiar.</p><div class='divider'></div><ol class='step-list'><li>Combine pontos e regras.</li><li>Seu rival aceita o convite.</li><li>Envie o placar com uma foto.</li><li>A equipe revisa e libera os pontos.</li></ol><button class='text-button' data-action='profile'>Editar perfil</button></aside>`;
}
function composer(){
 const p=profile(),others=Object.values(state.profiles).filter(x=>x.id!==p?.id);
 const rivals=online?`<input class='form-input' id='rivalId' name='rivalId' maxlength='16' value='${esc(ui.rival)}' placeholder='FBA-XXXXXXXX ou deixe vazio para gerar convite'><button class='text-button' type='button' data-action='find'>Buscar jogador</button><p id='rivalPreview' class='meta'>${foundPlayer?esc(foundPlayer.nickname):'Com o ID, só esse jogador poderá aceitar.'}</p>`:`<select class='form-input' id='rivalId' name='rivalId' ${!others.length?'disabled':''}><option value=''>Selecione um jogador</option>${others.map(x=>`<option value='${esc(x.publicPlayerId)}' ${ui.rival===x.publicPlayerId?'selected':''}>${esc(x.nickname)} · ${esc(x.publicPlayerId)}</option>`).join('')}</select>${p&&!others.length?`<p class='meta'>Crie outro perfil para experimentar os dois lados do desafio.</p><button class='text-button' type='button' data-action='signup'>Adicionar outro jogador</button>`:''}`;
 return `<section class='card duel-composer pad'><div class='card-top'><h2>Criar desafio</h2><span class='pill lime'>1 CONTRA 1</span></div><form data-form='duel'><fieldset ${!p?'disabled':''} style='border:0;padding:0;margin:0'><label class='form-label' for='rivalId'>${online?'ID do amigo · opcional':'Seu amigo'}</label>${rivals}<div class='form-grid'><div><label class='form-label' for='gameMode'>Modo de jogo</label><select class='form-input' id='gameMode' name='mode'>${['1v1','Ultimate Team','Clubes'].map(m=>`<option ${ui.mode===m?'selected':''}>${m}</option>`).join('')}</select></div><div><label class='form-label' for='duelStake'>Pontos por jogador</label><input class='form-input' id='duelStake' name='stake' type='number' min='10' max='5000' step='1' value='${esc(ui.stake)}' required></div></div><div class='stake-options'>${[50,100,250,500].map(n=>`<button class='btn secondary small' type='button' data-action='stake' data-id='${n}'>${n} pts</button>`).join('')}</div><label class='form-label' for='gamePlatform'>Plataforma</label><select class='form-input' id='gamePlatform' name='platform'>${[['pc','PC'],['playstation','PlayStation'],['xbox','Xbox'],['switch','Nintendo Switch']].map(([v,label])=>`<option value='${v}' ${ui.platform===v?'selected':''}>${label}</option>`).join('')}</select><label class='form-label' for='duelRules'>Regras combinadas · opcional</label><input class='form-input' id='duelRules' name='rules' maxlength='240' placeholder='Ex.: jogo único, 6 minutos, sem times personalizados' value='${esc(ui.rules)}'><div class='between wrap' style='margin-top:20px'><p class='meta'>Total em disputa: <strong id='potPreview'>${fmt(Number(ui.stake||0)*2)} pts</strong></p><button class='btn primary' type='submit' ${!online&&!others.length?'disabled':''}>Enviar desafio →</button></div></fieldset></form>${!p?`<div class='row wrap' style='margin-top:18px'><button class='btn primary' data-action='signup'>Criar conta para desafiar</button><button class='btn secondary' data-action='login'>Já tenho conta</button></div>`:''}<p class='meta' style='margin-top:14px'>Sem dinheiro real, depósitos ou saques.</p></section>`;
}
function actions(d){
 const p=profile(),host=d.hostId===p?.id;if(!p||(!host&&d.guestId!==p.id&&d.recipientId!==p.id))return '';
 if(d.status==='invited')return host?btn('cancel',d.id,'Cancelar convite')+(online&&d.inviteToken?btn('share',d.id,'Copiar convite'):''):btn('accept',d.id,'Aceitar desafio',true)+btn('decline',d.id,'Recusar');
 if(d.cancelRequestedBy&&(!online||d.status==='active'))return d.cancelRequestedBy!==p.id?btn('cancel',d.id,'Confirmar cancelamento')+btn('withdraw-cancel',d.id,'Recusar cancelamento'):btn('withdraw-cancel',d.id,'Retirar pedido de cancelamento');
 if(d.status==='active'){
  return btn('result',d.id,'Enviar placar',true)+btn('cancel',d.id,'Pedir cancelamento');
 }
 if(['review','disputed'].includes(d.status))return btn('details',d.id,'Ver placar e foto')+(d.result?.submittedBy!==p.id&&!d.peerConfirmed&&d.status==='review'?btn('confirm',d.id,'Confirmar placar',true):'')+(d.result?.submittedBy!==p.id&&d.status==='review'?btn('dispute',d.id,'Sinalizar fraude / divergência'):'')+(d.status==='disputed'?btn('result',d.id,'Enviar novo placar'):'')+(!online?btn('cancel',d.id,'Pedir cancelamento'):'');
 return btn('details',d.id,'Ver detalhes');
}
function duelCard(d){const other=opponent(d);return `<article class='duel-entry'><div class='duel-players'>${avatar(other)}<div><h3>${esc(other?.nickname||'Amigo convidado')}</h3><small>${esc(other?.publicPlayerId||'Convite por link')} · ${esc(d.mode)}</small></div><span class='pill ${tones[d.status]||'subtle'}'>${esc(resultText(d))}</span></div><div class='duel-metrics'><span><small>POR JOGADOR</small><strong>${fmt(d.stake)} pts</strong></span><span><small>TOTAL</small><strong>${fmt(d.stake*2)} pts</strong></span><span><small>VOCÊ × RIVAL</small><strong>${playerScore(d)}</strong></span></div>${d.peerConfirmed&&d.status==='review'?`<p class='meta'>Placar confirmado pelo rival. Aguardando a equipe.</p>`:''}${d.cancelRequestedBy?`<p class='meta'>Cancelamento solicitado. Os dois precisam concordar.</p>`:''}<div class='duel-actions'>${actions(d)}</div></article>`;}
function queue(){
 const list=duels().filter(d=>open(d)&&(ui.filter==='all'||(ui.filter==='review'?['review','disputed'].includes(d.status):d.status===ui.filter)));
 return `<section class='duel-queue'><div class='card-top'><h2>Seus desafios</h2><button class='text-button' data-action='refresh'>Atualizar</button></div><div class='tabs' role='group' aria-label='Filtrar desafios'>${[['all','Todos'],['invited','Convites'],['active','Em jogo'],['review','Em análise']].map(([v,label])=>`<button class='tab ${ui.filter===v?'active':''}' data-action='filter' data-id='${v}' aria-pressed='${ui.filter===v}'>${label}</button>`).join('')}</div>${list.length?list.map(duelCard).join(''):`<div class='card pad'><h3>${ui.filter==='all'?'Seu próximo desafio começa acima.':'Nenhum desafio nessa etapa.'}</h3><p class='muted'>Os convites recebidos e enviados aparecerão aqui.</p></div>`}</section>`;
}
function arenaView(){return intro('Aposte com seu amigo.','Combine os pontos, jogue e acompanhe o resultado.')+(!online?`<div class='connection-note'><span><strong>Modo local</strong> · Perfis e desafios neste navegador.</span><button class='text-button' data-action='connection'>Jogar em dispositivos diferentes</button></div>`:'')+summaries()+`<div class='arena-workspace'>${composer()}${identity()}</div>`+queue();}
function historyView(){
 const list=duels().filter(d=>{const other=opponent(d);return (!ui.search||`${other?.nickname} ${other?.publicPlayerId} ${d.id}`.toLocaleLowerCase().includes(ui.search.toLocaleLowerCase()))&&(ui.filter==='all'||(ui.filter==='review'?['review','disputed'].includes(d.status):ui.filter==='cancelled'?['cancelled','rejected','expired'].includes(d.status):d.status===ui.filter));});
 return intro('Histórico das partidas.','Rival, placar, pontos e andamento de cada desafio.')+`<div class='history-tools'><label class='grow' for='historySearch'><span class='form-label'>Buscar rival ou ID da partida</span><input class='form-input' id='historySearch' value='${esc(ui.search)}' placeholder='Nome ou ID FifaBet'></label><label for='historyStatus'><span class='form-label'>Situação</span><select id='historyStatus' class='form-input'>${[['all','Todos'],['settled','Finalizados'],['review','Em análise'],['cancelled','Cancelados / recusados']].map(([v,label])=>`<option value='${v}' ${ui.filter===v?'selected':''}>${label}</option>`).join('')}</select></label></div>${list.length?`<div class='card history-table'><table><thead><tr><th>PARTIDA</th><th>RIVAL</th><th>VOCÊ × RIVAL</th><th>PTS / JOGADOR</th><th>RESULTADO</th><th></th></tr></thead><tbody>${list.map(d=>`<tr><td><strong>${esc(d.publicDuelId||d.id.slice(0,8).toUpperCase())}</strong><small>${when(d.createdAt)} · ${esc(d.mode)}</small></td><td><strong>${esc(opponent(d)?.nickname||'Amigo convidado')}</strong><small>${esc(opponent(d)?.publicPlayerId||'Convite por link')}</small></td><td>${playerScore(d)}</td><td>${fmt(d.stake)} pts</td><td><span class='pill ${tones[d.status]||'subtle'}'>${esc(resultText(d))}</span></td><td>${btn('details',d.id,'Detalhes')}</td></tr>`).join('')}</tbody></table></div>`:`<div class='card pad'><h2>Nenhuma partida encontrada.</h2><p class='muted'>Seu histórico é preenchido com os desafios da arena.</p><a class='btn primary' href='#arena' style='margin-top:16px'>Criar desafio</a></div>`}`;
}
function rankingView(){
 const p=profile();
 if(online){const ds=duels();return intro('Seus resultados.','Somente partidas revisadas pela equipe.')+`<section class='card pad'><h2>${esc(p?.nickname||'Entre para ver seus resultados')}</h2><div class='summary-grid'><div><small>VITÓRIAS</small><strong>${ds.filter(d=>d.status==='settled'&&d.winnerId===p?.id).length}</strong></div><div><small>EMPATES</small><strong>${ds.filter(d=>d.status==='settled'&&!d.winnerId).length}</strong></div><div><small>DERROTAS</small><strong>${ds.filter(d=>d.status==='settled'&&d.winnerId&&d.winnerId!==p?.id).length}</strong></div></div><p class='meta'>Resultados em análise não entram na contagem. Não há jogadores fictícios nesta classificação.</p></section>`;}
 const entries=Object.values(state.profiles).map(p=>({p,wins:Object.values(state.duels||{}).filter(d=>d.status==='settled'&&d.winnerId===p.id).length})).sort((a,b)=>b.wins-a.wins||a.p.nickname.localeCompare(b.p.nickname));
 return intro('Ranking dos jogadores.','Somente resultados da arena local após revisão de teste.')+`<section class='card pad'>${entries.length?entries.map(({p,wins},i)=>`<div class='row' style='padding:14px 0;border-bottom:1px solid var(--line)'><strong>${i+1}</strong>${avatar(p)}<div class='grow'><strong>${esc(p.nickname)}</strong><p class='meta'>${esc(p.publicPlayerId)}</p></div><strong>${wins} vitórias</strong></div>`).join(''):`<p class='muted'>Crie um perfil para participar.</p>`}</section>`;
}
async function sharedRankingView(){
 if(!profile())return intro('Ranking dos jogadores.','Entre para consultar os resultados revisados.')+`<button class='btn primary' data-action='login'>Entrar na arena</button>`;
 const data=await API.getLeaderboard(),items=data.entries||[];
 const rows=items.map((e,i)=>`<tr><td>${i+1}</td><td><div class='row'>${avatar(e.player)}<div><strong>${esc(e.player.nickname)}${e.player.id===profile().id?' · você':''}</strong><small>${esc(e.player.publicPlayerId)}</small></div></div></td><td>${e.played}</td><td>${e.wins}</td><td>${e.draws}</td><td>${e.losses}</td></tr>`).join('');
 const content=items.length?`<div class='history-table'><table><thead><tr><th>POSIÇÃO</th><th>JOGADOR</th><th>JOGOS</th><th>VITÓRIAS</th><th>EMPATES</th><th>DERROTAS</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<h2 style='margin-top:20px'>A primeira vitória ainda está em jogo.</h2><p class='muted'>Partidas em análise aparecem no histórico. Entram no ranking após a revisão.</p>`;
 return intro('Ranking dos jogadores.','Vitórias e empates de partidas revisadas pela equipe.')+`<section class='card pad'><p class='meta'>Ordem: vitórias, depois empates. Apenas jogadores com partidas aprovadas.</p>${content}</section>`;
}
function profileView(){const p=profile();return intro('Seu perfil.','Seu time no avatar e seu ID para encontrar amigos.')+(p?`<section class='card pad'><div class='row'>${avatar(p,'large')}<div><h2>${esc(p.nickname)}</h2><code>${esc(p.publicPlayerId)}</code></div></div><div class='row wrap' style='margin-top:20px'><button class='btn primary' data-action='profile'>Editar perfil</button><button class='btn secondary' data-action='copy-id'>Copiar ID</button><a class='btn secondary' href='#historico'>Ver histórico</a><button class='btn secondary' data-action='login'>${online?'Trocar conta':'Trocar perfil'}</button><button class='btn secondary' data-action='logout'>Sair</button></div>${!online?`<div class='divider'></div><a class='text-button' href='colecao.html#loja'>Abrir minha coleção e personalização</a><p class='meta'>Sua coleção anterior foi preservada neste navegador.</p>`:''}</section>`:`<button class='btn primary' data-action='signup'>Criar conta</button>`);}
async function reviewView(){
 if(!profile()?.isReviewer)return `<div class='card pad'><h1>Revisão restrita à equipe.</h1></div>`;
 const data=await API.listReviews(),items=data.duels||data.reviews||[];reviewDuels=items.map(normalize);
 return intro('Revisão dos resultados.','Confira as fotos antes de registrar uma decisão.')+`<section class='stack'>${items.length?items.map(raw=>{const d=normalize(raw);return `<article class='card pad'><h2>${esc(d.host.nickname)} × ${esc(d.guest.nickname)}</h2><p class='meta'>${d.stake} pts por jogador · ${esc(d.mode)}</p><p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do resultado enviada para revisão'>${d.disputes?.map(x=>`<p class='hint'>Contestação: ${esc(x.reason)}<img class='review-image' src='${API.evidenceUrl(x.evidenceId)}' alt='Foto da contestação'></p>`).join('')}<button class='btn primary' data-action='review' data-id='${esc(d.id)}'>Revisar partida</button></article>`;}).join(''):`<div class='card pad'>Nenhuma partida aguardando revisão.</div>`}</section>`;
}
let renderRevision=0;
function render(){
 const revision=++renderRevision,hash=location.hash.slice(1);
 ui.view=({palpites:'historico',amigos:'arena'}[hash]||(['arena','historico','ranking','perfil','revisao'].includes(hash)?hash:'arena'));
 header();
 const asyncView=ui.view==='revisao'?reviewView:ui.view==='ranking'&&online?sharedRankingView:null;
 $('screen').innerHTML=asyncView?`<div class='card pad' role='status'>Carregando…</div>`:ui.view==='historico'?historyView():ui.view==='ranking'?rankingView():ui.view==='perfil'?profileView():arenaView();
 if(asyncView)asyncView().then(html=>{if(renderRevision===revision)$('screen').innerHTML=html;}).catch(e=>{if(renderRevision===revision)$('screen').innerHTML=`<section class='card pad'><h2>Não foi possível carregar.</h2><p>${esc(e.message)}</p><button class='btn secondary' data-action='refresh'>Tentar novamente</button></section>`;});
}
function showAuth(signup=false){
 if(!online&&!signup){const ps=Object.values(state.profiles);return modal('Entrar na arena','Escolha um perfil deste navegador.',`<div class='session-picker'>${ps.length?ps.map(p=>`<button class='btn secondary' data-action='select-profile' data-id='${esc(p.id)}'>${avatar(p)}<span>${esc(p.nickname)}<small>${esc(p.publicPlayerId)}</small></span></button>`).join(''):`<p class='muted'>Crie seu primeiro perfil para começar.</p>`}</div><button class='btn primary wide' data-action='signup' style='margin-top:14px'>Criar outro perfil</button>`);}
 modal(signup?'Criar conta':'Entrar na arena',online?'Conta de jogador no servidor FifaBet.':'Perfil local para experimentar os desafios.',`<form data-form='${signup?'signup':'login'}'><label class='form-label' for='authNickname'>${signup?'Apelido':'Apelido ou ID FifaBet'}</label><input class='form-input' id='authNickname' name='nickname' minlength='2' maxlength='20' autocomplete='username' required>${online?`<label class='form-label' for='authPassword'>Senha</label><input class='form-input' id='authPassword' name='password' type='password' minlength='10' maxlength='256' autocomplete='${signup?'new-password':'current-password'}' required><p class='meta'>Use no mínimo 10 caracteres.</p>`:''}<button class='btn primary wide' type='submit' style='margin-top:20px'>${signup?'Criar conta e receber meu ID':'Entrar'}</button></form><button class='text-button' data-action='${signup?'login':'signup'}'>${signup?'Já tenho uma conta':'Criar uma conta'}</button>`);
}
function showProfile(){
 const p=profile();if(!p)return showAuth(true);
 modal('Meu perfil','Seu uniforme e seu ID dentro do FifaBet.',`<div class='row'>${avatar(p,'large')}<div><strong>${esc(p.nickname)}</strong><p class='meta'>${esc(p.publicPlayerId)}</p></div></div><form data-form='profile'><label class='form-label' for='profileName'>Apelido</label><input class='form-input' id='profileName' name='nickname' value='${esc(p.nickname)}' minlength='2' maxlength='20' required><label class='form-label' for='profileClub'>Time do coração</label><select class='form-input' id='profileClub' name='clubId'><option value=''>Escolha seu clube</option>${M.CLUBS.map(c=>`<option value='${esc(c.id)}' ${c.id===p.clubId?'selected':''}>${esc(c.name)} · ${esc(c.country)}</option>`).join('')}</select><div id='clubPreview' class='compact-club-preview' style='margin-top:14px'>${avatar(p,'large')}</div><label class='form-label' for='avatarStyle'>Avatar</label><select class='form-input' id='avatarStyle' name='avatarStyle'><option value='club'>Uniforme do meu time</option>${p.avatarSticker?`<option value='collection' selected>Minha figurinha atual</option>`:''}</select><button class='btn primary wide' style='margin-top:20px' type='submit'>Salvar perfil</button></form>`);
}
function fileField(){return `<label class='form-label' for='resultImage'>Foto do placar</label><input class='evidence-input' id='resultImage' name='evidence' type='file' accept='image/jpeg,image/png,image/webp' capture='environment' required><p class='meta'>Fotografe o placar final com os dois jogadores visíveis. JPG, PNG ou WebP, até 8 MB.</p><div id='photoPreview' class='evidence-preview' hidden></div>`;}
function showResult(id){const d=byId(id);modal('Enviar resultado','O placar e a foto ficarão aguardando revisão.',`<form data-form='result' data-id='${esc(id)}'><div class='form-grid score-entry'><label for='homeScore'><span class='form-label'>${esc(d.host.nickname)}</span><input id='homeScore' class='form-input' name='homeScore' type='number' min='0' max='99' step='1' required value='${d.result?.homeScore??''}'></label><label for='awayScore'><span class='form-label'>${esc(d.guest.nickname)}</span><input id='awayScore' class='form-input' name='awayScore' type='number' min='0' max='99' step='1' required value='${d.result?.awayScore??''}'></label></div>${fileField()}<p class='hint'>Os pontos ficam reservados até a decisão da equipe.${online?'':' No modo local, a foto fica neste navegador e não chega à equipe.'}</p><button type='submit' class='btn primary wide' style='margin-top:20px'>Enviar placar e foto</button></form>`);}
function showDetails(id){const d=byId(id);modal('Detalhes da partida',`${d.host.nickname} × ${d.guest.nickname}`,`<span class='pill ${tones[d.status]||'subtle'}'>${esc(resultText(d))}</span><p class='meta' style='margin-top:14px'>ID: ${esc(d.id)}<br>${when(d.createdAt)} · ${esc(d.mode)} · ${d.stake} pts por jogador</p>${d.rules?`<p class='hint'>Regras: ${esc(d.rules)}</p>`:''}${d.result?`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do placar desta partida'>`:`<p class='hint'>Resultado ainda não enviado.</p>`}${reportHistory(d)}${(d.disputes||[d.dispute].filter(Boolean)).map(x=>`<p class='hint'>Divergência: ${esc(x.reason)}</p>`).join('')}${d.review?`<p class='hint'>Decisão da equipe: ${esc(d.review.reason)}</p>`:''}<div class='duel-actions'>${actions(d).replaceAll(`data-action='details'`,`data-action='close'`)}</div>`);}
function showDispute(id){modal('Sinalizar divergência','Os pontos seguem bloqueados durante a análise.',`<form data-form='dispute' data-id='${esc(id)}' data-report='${esc(byId(id).result?.id)}'><label class='form-label' for='disputeReason'>O que aconteceu?</label><textarea class='form-input' id='disputeReason' name='reason' minlength='10' maxlength='300' required placeholder='Explique a divergência ou a suspeita de fraude.'></textarea>${fileField()}<button class='btn primary wide' style='margin-top:20px' type='submit'>Enviar contestação e foto</button></form>`);}
function showHelp(){modal('Como funciona','Do convite ao resultado revisado.',`<ol class='step-list'><li>Envie seu ID FifaBet ao amigo ou procure o ID dele.</li><li>Combine modo, regras e pontos por jogador.</li><li>O amigo aceita pelo próprio perfil.</li><li>Joguem e enviem o placar com uma foto.</li><li>O rival confirma ou sinaliza divergência.</li><li>A equipe revisa a evidência. Só a aprovação libera pontos.</li></ol><p class='hint'>${online?'As contas, as fotos e as partidas ficam no servidor.':'Na publicação do GitHub, o fluxo é local. Crie dois perfis e alterne entre eles para experimentar. Não há envio de fotos à equipe nem revisão real nessa modalidade.'}</p><p class='meta'>Pontos fictícios, sem valor financeiro.</p>`);}
function showConnection(){modal('Amigos em dispositivos diferentes','O servidor de contas e partidas está incluído no projeto.',`<p>O GitHub Pages hospeda esta versão local. Para compartilhar partidas entre celulares, a aplicação precisa ser publicada junto com o servidor FifaBet em uma hospedagem própria.</p><p class='hint'>O servidor pode rodar em uma hospedagem Node.js separada do Tibia.</p><a class='btn primary wide' href='https://github.com/djowww/fifabet-arena/blob/main/docs/SERVIDOR.md' target='_blank' rel='noopener noreferrer'>Ver instruções do servidor</a>`);}
async function preparePhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Escolha uma foto JPG, PNG ou WebP de até 8 MB.');
 const bitmap=await createImageBitmap(file);try{
 const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
 let dataUrl=canvas.toDataURL('image/jpeg',.8);
 for(let q=.65;dataUrl.length>440000&&q>=.2;q-=.15)dataUrl=canvas.toDataURL('image/jpeg',q);
 if(dataUrl.length>440000)throw Error('A foto está muito grande. Escolha uma imagem menor do placar.');
 const blob=await(await fetch(dataUrl)).blob();return {dataUrl,blob,name:'placar.jpg'};
 }finally{bitmap.close();}
}
async function copy(value){try{await navigator.clipboard.writeText(value);toast('Copiado.');}catch{modal('Copie este texto','Selecione e copie para compartilhar.',`<input class='form-input' value='${esc(value)}' readonly>`);}}
const inviteLink=d=>new URL(`?convite=${encodeURIComponent(d.inviteToken)}#arena`,location.href).href;
async function showInvite(){
 if(!profile())return modal('Você recebeu um desafio','Entre ou crie sua conta FifaBet para ver e aceitar o convite.',`<button class='btn primary wide' data-action='signup'>Criar conta</button><button class='btn secondary wide' data-action='login' style='margin-top:12px'>Já tenho conta</button>`);
 const data=await API.getInvite(invite.token),d=data.invite;
 modal('Você recebeu um desafio',`${d.host.nickname} te chamou para jogar.`,`<p><strong>${esc(d.mode)}</strong> · ${fmt(d.stake)} pontos por jogador.</p><p class='hint'>${esc(d.rules||'Combine as regras com seu amigo antes de aceitar.')}</p><button class='btn primary wide' data-action='accept-invite'>Aceitar desafio</button>`);
}
async function execute(action,id){
 if(action==='close')return closeModal();
 if(action==='signup')return showAuth(true);
 if(action==='login')return showAuth(false);
 if(action==='profile')return showProfile();
 if(action==='help')return showHelp();
 if(action==='connection')return showConnection();
 if(action==='copy-id')return copy(profile()?.publicPlayerId||'');
 if(action==='stake'){ui.stake=id;$('duelStake').value=id;$('potPreview').textContent=`${fmt(Number(id)*2)} pts`;return;}
 if(action==='filter'){ui.filter=id;return render();}
 if(action==='details')return showDetails(id);
 if(action==='result')return showResult(id);
 if(action==='dispute')return showDispute(id);
 if(action==='select-profile'){save(M.change(read(),'login',{id}));ui.rival='';foundPlayer=null;closeModal();render();return;}
 if(action==='logout'){if(online){await API.logoutAccount();arena=null;}else localChange('logout');closeModal();render();return;}
 if(action==='refresh'){await refresh();return toast('Arena atualizada.');}
 if(action==='retry')return start();
 if(action==='credits')return modal('Créditos das imagens','Fontes dos uniformes e figurinhas.',`<a class='btn secondary wide' href='https://github.com/djowww/fifabet-arena/blob/main/THIRD_PARTY_NOTICES.md' target='_blank' rel='noopener noreferrer'>Abrir créditos e fontes</a>`);
 if(action==='find'){const data=await API.findPlayer($('rivalId').value.trim().toUpperCase());foundPlayer=data.player||data.user||data;$('rivalPreview').textContent=`${foundPlayer.nickname} · ${foundPlayer.publicPlayerId}`;return;}
 if(action==='accept-invite'){if(!profile())return showAuth(true);await API.acceptInvite(invite.token);invite=null;history.replaceState(null,'',location.pathname+'#arena');closeModal();await refresh();return toast('Desafio aceito. Os pontos foram reservados.');}
 const d=byId(id);
 if(action==='share')return copy(inviteLink(d));
 if(action==='review'){return modal('Decisão da equipe',`${d.host.nickname} × ${d.guest.nickname}`,`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do resultado atual para revisão'>${reportHistory(d)}<form data-form='review' data-id='${esc(id)}' data-report='${esc(d.result.id)}'><label class='form-label' for='reviewWinner'>Resultado validado</label><select class='form-input' id='reviewWinner' name='winner' required><option value=''>Escolha o resultado conferido</option><option value='host'>${esc(d.host.nickname)} venceu</option><option value='guest'>${esc(d.guest.nickname)} venceu</option><option value='draw'>Empate</option></select><label class='form-label' for='reviewReason'>Justificativa da revisão</label><textarea id='reviewReason' class='form-input' name='reason' minlength='10' maxlength='300' required></textarea><p class='hint'>A decisão será registrada e os pontos serão distribuídos uma única vez.</p><button class='btn primary wide' type='submit'>Aprovar resultado e distribuir pontos</button></form>`);}
 if(action==='accept'){if(online)await API.acceptDuel(id);else localChange('acceptDuel',{id});}
 else if(action==='decline'){if(online)await API.cancelDuel(id);else localChange('rejectDuel',{id});}
 else if(action==='cancel'){if(online)await API.cancelDuel(id);else localChange(d.status==='invited'?'cancelDuel':d.cancelRequestedBy&&d.cancelRequestedBy!==profile().id?'confirmDuelCancel':'requestDuelCancel',{id});}
 else if(action==='withdraw-cancel'){if(online)await API.withdrawCancellation(id);else localChange('withdrawDuelCancel',{id});}
 else if(action==='confirm'){if(online)await API.confirmResult(id,d.result.id);else localChange('confirmDuelResult',{id,reportId:d.result.id});}
 else return;
 closeModal();await refresh();toast(action==='confirm'?'Placar confirmado. A liberação aguarda a equipe.':'Desafio atualizado.');
}
document.addEventListener('click',async event=>{
 if(event.target.closest('.skip-link')){event.preventDefault();$('screen').focus();return;}
 const button=event.target.closest('[data-action]');if(!button||busy)return;
 try{busy=true;button.disabled=true;await execute(button.dataset.action,button.dataset.id);}catch(e){fail(e.message);}finally{busy=false;if(button.isConnected)button.disabled=false;}
});
document.addEventListener('input',event=>{
 const t=event.target;
 if(t.id==='duelStake'){ui.stake=t.value;$('potPreview').textContent=`${fmt(Number(t.value||0)*2)} pts`;}
 if(t.id==='rivalId'){ui.rival=t.value;foundPlayer=null;}
 if(t.id==='duelRules')ui.rules=t.value;
 if(t.id==='historySearch'){ui.search=t.value;const cursor=t.selectionStart;render();$('historySearch').focus();$('historySearch').setSelectionRange(cursor,cursor);}
});
document.addEventListener('change',async event=>{
 const t=event.target;if(t.id==='gameMode')ui.mode=t.value;if(t.id==='gamePlatform')ui.platform=t.value;if(t.id==='rivalId')ui.rival=t.value;
 if(t.id==='historyStatus'){ui.filter=t.value;render();}
 if(t.id==='profileClub')$('clubPreview').innerHTML=avatar({...profile(),clubId:t.value,avatarSticker:null,teamName:''},'large');
 if(t.id==='resultImage')try{const photo=await preparePhoto(t.files[0]);if(t.isConnected){$('photoPreview').innerHTML=`<img src='${photo.dataUrl}' alt='Prévia da foto do placar'>`;$('photoPreview').hidden=false;}}catch(e){fail(e.message);}
});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();if(busy)return;
 const data=new FormData(form),kind=form.dataset.form,submit=form.querySelector('[type=submit]'),profileId=profile()?.id;
 try{
 busy=true;if(submit)submit.disabled=true;
 if(kind==='signup'||kind==='login'){
  if(online){if(kind==='signup')await API.registerAccount({nickname:data.get('nickname'),password:data.get('password')});else await API.loginAccount({nickname:data.get('nickname'),password:data.get('password')});arena=await API.getArena();}
  else save(M.change(read(),'create',{nickname:data.get('nickname')}));
  ui.rival='';foundPlayer=null;closeModal();render();window.scrollTo({top:0});if(invite)return await showInvite();return toast(kind==='signup'?'Seu ID FifaBet está pronto.':'Você entrou na arena.');
 }
 if(!profile()||profile().id!==profileId)throw Error('Entre na sua conta para continuar.');
 if(kind==='profile'){const payload={nickname:data.get('nickname'),clubId:data.get('clubId')||null,avatarStyle:data.get('avatarStyle')};if(online)await API.updateAccount(payload);else localChange('profile',payload);}
 else if(kind==='duel'){
  const payload={stake:Number(data.get('stake')),mode:data.get('mode'),rules:data.get('rules'),opponentPlayerId:String(data.get('rivalId')||'').trim().toUpperCase(),platform:data.get('platform')||'pc'};
  if(online){const created=await API.createDuel(payload);await refresh();const d=created.duel||created;if(d.inviteToken)modal('Convite criado','Envie o link ao seu amigo.',`<input class='form-input' value='${esc(inviteLink(d))}' readonly><p class='hint'>A partida começa quando o amigo aceita pelo próprio perfil.</p>`);}
  else{const other=M.findProfileByPlayerId(state,payload.opponentPlayerId);if(!other)throw Error('Escolha outro perfil deste navegador.');localChange('createDuel',{opponentId:other.id,stake:payload.stake,mode:payload.mode,rules:payload.rules,operationId:crypto.randomUUID()});render();}
  return toast('Convite enviado. Seus pontos ficaram reservados.');
 }
 else if(kind==='result'||kind==='dispute'){
  const photo=await preparePhoto(data.get('evidence')),id=form.dataset.id,d=byId(id);
  if(profile()?.id!==profileId)throw Error('O perfil mudou. Reabra o envio.');
  if(online){const uploaded=await API.uploadEvidence(photo.blob,id),evidenceId=uploaded.evidenceId||uploaded.evidence?.id||uploaded.id;if(kind==='result')await API.submitResult(id,{homeScore:Number(data.get('homeScore')),awayScore:Number(data.get('awayScore')),evidenceId});else await API.disputeResult(id,{reportId:form.dataset.report,reason:data.get('reason'),evidenceId});}
  else localChange(kind==='result'?'submitDuelResult':'disputeDuelResult',{id,reportId:form.dataset.report,evidenceDataUrl:photo.dataUrl,evidenceName:photo.name,reason:data.get('reason'),homeScore:Number(data.get('homeScore')),awayScore:Number(data.get('awayScore'))});
 }
 else if(kind==='review')await API.reviewDuel(form.dataset.id,{reportId:form.dataset.report,winner:data.get('winner'),reason:data.get('reason')});
 closeModal();await refresh();toast(kind==='result'?'Placar e foto enviados. Aguardando revisão.':kind==='dispute'?'Contestação enviada. Os pontos seguem bloqueados.':kind==='review'?'Resultado revisado e pontos distribuídos.':'Perfil atualizado.');
 }catch(e){fail(e.message);}finally{busy=false;if(submit?.isConnected)submit.disabled=false;}
});
$('modal').addEventListener('cancel',event=>{event.preventDefault();closeModal();});
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
window.addEventListener('hashchange',()=>{closeModal();ui.filter='all';render();window.scrollTo({top:0});});
window.addEventListener('storage',event=>{if(!online&&event.key===M.STORAGE_KEY){state=read();closeModal();render();}});
window.addEventListener('focus',()=>{if(online&&!busy&&!$('modal').open)refresh().catch(()=>{});});
async function start(){
 online=!!(await API.detectBackend());if(online){const session=await API.loadSession();if(session.user)arena=await API.getArena();}else save();
 render();const token=new URL(location.href).searchParams.get('convite');
 if(token&&online){invite={token};await showInvite();}
 else if(token)toast('Abra este convite no endereço do servidor FifaBet.');
}
start().catch(e=>{$('screen').innerHTML=`<section class='card pad'><h1>A arena não conseguiu iniciar.</h1><p>${esc(e.message)}</p><button class='btn primary' data-action='retry'>Tentar novamente</button></section>`;});
