import * as M from './model.mjs?v=19';
import * as API from './backend-client.mjs?v=19';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=M.points;
const when=x=>new Date(x).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const read=()=>{try{return M.restore(localStorage.getItem(M.STORAGE_KEY),localStorage.getItem('fifabet-profile'),localStorage.getItem('fifabet-bets'));}catch{return M.emptyState();}};
let state=read(),online=false,arena=null,busy=false,foundPlayer=null,invite=null,reviewDuels=[],walletData=null,depositReviews=[],pendingIntent=null,opener,toastTimer,backendStatus=null,serviceUnavailable=false;
const ui={view:'arena',filter:'all',search:'',mode:'1v1',platform:'pc',stake:'100',rival:'',rules:'',duelStep:1,duelOwner:null,duelRevision:0,duelOperation:'',duelError:''};
const names={invited:'Convite pendente',active:'Partida confirmada',review:'Resultado em análise',disputed:'Resultado contestado',settled:'Resultado concluído',rejected:'Recusado',cancelled:'Cancelado',expired:'Expirado'};
const tones={invited:'amber',active:'mint',review:'violet',disputed:'live',settled:'lime'};
const profile=()=>serviceUnavailable?null:online?arena?.user:M.current(state);
const productionHost=()=>['betfifa.com.br','www.betfifa.com.br'].includes(new URL(location.href).hostname);
const creditUnit=()=>online?'créditos':'créditos de teste';
const creditAction=()=>online?'Comprar créditos':'Adicionar créditos de teste';
const friendlyMode=()=>online&&backendStatus?.paymentMode==='unconfigured';
const duelUnit=d=>d.creditMode==='legacy_demo'?'créditos antigos de demonstração':creditUnit();
const matchCode=d=>d.publicMatchId||d.publicDuelId||(!online?d.id.slice(0,8).toUpperCase():'');
const runtimeCopy=html=>html;
function runtimeLabels(){
 const label=serviceUnavailable?'INDISPONÍVEL':online?'ONLINE':'DEMO';
 for(const selector of ['.demo-side .pill','.mobile-brand small','.breadcrumb .pill']){const node=document.querySelector?.(selector);if(node)node.textContent=label;}
 const description=document.querySelector?.('.demo-side p');if(description)description.textContent=serviceUnavailable?'A conexão com a arena precisa ser restabelecida.':online?'Contas e partidas conectadas. Pagamentos em configuração.':'Demonstração local com créditos fictícios, sem valor financeiro.';
}
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
const resultText=d=>d.status==='settled'?`Resultado concluído · ${d.winnerId===profile()?.id?'Você venceu':d.winnerId?'Você perdeu':'Empate'}`:names[d.status];
const photoUrl=r=>r?(online?API.evidenceUrl(r.evidenceId):r.evidenceDataUrl):'';
function reportHistory(d){
 const previous=(d.reports||[]).filter(r=>r.id!==d.result?.id);
 return previous.length?`<details class='evidence-history'><summary>Versões anteriores do placar (${previous.length})</summary>${previous.map(r=>`<p class='meta'>${when(r.submittedAt||r.date)} · ${r.homeScore} × ${r.awayScore}</p><img class='review-image' loading='lazy' src='${esc(photoUrl(r))}' alt='Foto de uma versão anterior do placar'>`).join('')}</details>`:'';
}
const reserved=()=>online?(arena?.stats?.reserved||0):(profile()?M.duelReservedPoints(state,profile().id):0);
function byId(id){const d=duels().find(d=>d.id===id)||(profile()?.isReviewer?reviewDuels.find(d=>d.id===id):null);if(!d)throw Error('Partida não encontrada. Atualize a arena.');return d;}
async function refresh(){if(online)arena=await API.getArena();else state=read();render();}
function modal(title,subtitle,html){opener=document.activeElement;$('modalContent').innerHTML=runtimeCopy(`<div class='dialog-head'><div><h2 id='dialogTitle'>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class='icon-only' data-action='close' aria-label='Fechar janela'>×</button></div><div class='dialog-body'>${html}<p id='dialogError' class='error-message' role='alert' hidden></p></div>`);if(!$('modal').open)$('modal').showModal();}
function closeModal(){if($('modal').open)$('modal').close();if(opener?.isConnected)opener.focus();}
function fail(message){if($('dialogError')&&$('modal').open){$('dialogError').textContent=message;$('dialogError').hidden=false;}else toast(message);}
function joinFeedback(message){if($('modal').open)return fail(message);const feedback=$('joinError');if(feedback){feedback.textContent=message;feedback.hidden=false;}else toast(message);}
function intro(title,description){return `<div class='practical-intro'><div><p class='eyebrow'>FIFA GO · ENTRE AMIGOS</p><h1>${title}</h1><p class='muted'>${description}</p></div></div>`;}
function header(){
 const p=profile(),items=[['arena','Início','⌂'],['carteira','Carteira','▣'],['historico','Histórico','◷'],['ranking','Ranking','🏆'],['perfil','Meu perfil','♙']];
 if(p?.isReviewer)items.push(['revisao','Revisão','✓']);
 $('navigation').innerHTML=items.map(([hash,label,symbol])=>`<a class='nav-item ${ui.view===hash?'active':''}' href='#${hash}' ${ui.view===hash?`aria-current='page'`:''}><span aria-hidden='true'>${symbol}</span><span>${label}</span></a>`).join('');
 $('breadcrumb').textContent=items.find(([hash])=>ui.view===hash)?.[1]||(ui.view==='criar'?'Criar partida':'Início');
 $('headerActions').innerHTML=p?`<span class='meta'>${online?'Conta conectada':'Neste navegador'}</span><button class='profile-button' data-action='profile' aria-label='Abrir perfil de ${esc(p.nickname)}'>${avatar(p,'small')}<span>${esc(p.nickname)}</span></button>`:`<button class='btn secondary' data-action='login'>Entrar</button><button class='btn primary' data-action='signup'>Criar conta</button>`;
}
function summaries(){return `<div class='summary-grid'><div><small>DISPONÍVEL</small><strong>${fmt(profile()?.balance||0)} <small>pts</small></strong></div><div><small>EM DISPUTA</small><strong>${fmt(reserved())} <small>pts</small></strong></div><div><small>DESAFIOS ABERTOS</small><strong>${duels().filter(open).length}</strong></div></div>`;}
function identity(){
 const p=profile();
 if(!p)return `<aside class='card arena-sidebar pad'><h2>Seu próximo rival está aqui.</h2><p class='muted'>Crie seu perfil e receba seu ID Fifa GO para encontrar amigos.</p><button class='btn primary wide' data-action='signup'>Criar conta</button><p class='meta'>${online?'Sua conta começa com saldo zero. Pagamentos em configuração.':'Demonstração local com saldo inicial zero e créditos fictícios.'}</p></aside>`;
 return `<aside class='card arena-sidebar pad'><div class='row'>${avatar(p)}<div><strong>${esc(p.nickname)}</strong><p class='meta'>${esc(M.clubById(p.clubId)?.name||'Escolha seu time no perfil')}</p></div></div><p class='form-label'>Seu ID Fifa GO</p><div class='player-id'><code>${esc(p.publicPlayerId)}</code><button class='btn secondary small' data-action='copy-id'>Copiar</button></div><p class='meta'>Envie seu ID para um amigo te desafiar.</p><div class='divider'></div><ol class='step-list'><li>${friendlyMode()?'Combine o modo e as regras.':'Combine créditos e regras.'}</li><li>Seu rival aceita o convite.</li><li>Envie o placar com uma foto.</li><li>${online?"A equipe revisa e libera os créditos.":"A revisão da equipe funciona na versão conectada."}</li></ol><button class='text-button' data-action='profile'>Editar perfil</button></aside>`;
}
function resetDuelDraft(owner=profile()?.id||null){ui.duelOwner=owner;ui.duelStep=1;ui.duelRevision++;ui.duelOperation='';ui.duelError='';ui.rival='';ui.mode='1v1';ui.platform='pc';ui.stake=friendlyMode()?'0':'100';ui.rules='';foundPlayer=null;}
function updateDuelDraft(values){
 let changed=false;for(const [key,value] of Object.entries(values)){if(ui[key]!==value){ui[key]=value;changed=true;if(key==='rival')foundPlayer=null;}}
 if(changed){ui.duelRevision++;ui.duelOperation='';ui.duelError='';const form=$('screen').querySelector?.("[data-form='duel']");if(form){form.dataset.revision=String(ui.duelRevision);form.dataset.operation='';}if($('composerError'))$('composerError').hidden=true;}
}
function ensureDuelOwner(){
 if(!profile()||profile().id!==ui.duelOwner)throw Error('A conta mudou. Abra a criação de partida novamente.');
 if(!online&&read().activeProfileId!==ui.duelOwner)throw Error('O perfil mudou em outra aba. Atualize antes de criar a partida.');
}
async function validateDuelDraft(includeCredits=false){
 ensureDuelOwner();
 const revision=ui.duelRevision,owner=ui.duelOwner,code=ui.rival.trim().toUpperCase();
 if(!['1v1','Ultimate Team','Clubes'].includes(ui.mode))throw Error('Escolha um modo de jogo válido.');
 if(!['pc','playstation','xbox','switch'].includes(ui.platform))throw Error('Escolha uma plataforma válida.');
 let other=null;
 if(online&&code){
  if(!/^FBA-[A-F0-9]{10}$/.test(code))throw Error('Confira o ID do amigo: use FBA- seguido de 10 letras ou números.');
  const data=await API.findPlayer(code);other=data.player||data.user||data;
  if(!other?.id||other.publicPlayerId!==code)throw Error('Jogador não encontrado. Confira o ID ou crie um convite por link.');
 }else if(!online){
  const latest=read();other=M.findProfileByPlayerId(latest,code);
  if(!other)throw Error('Selecione um amigo cadastrado neste navegador.');
 }
 if(other?.id===owner)throw Error('Escolha outro jogador para receber seu desafio.');
 if(profile()?.id!==owner||ui.duelRevision!==revision)throw Error('Os dados mudaram durante a conferência. Revise a partida e continue novamente.');
 ensureDuelOwner();
 if(includeCredits){
  const balance=online?profile().balance:M.current(read()).balance,amount=Number(ui.stake);
  if(friendlyMode()&&amount!==0)throw Error('Enquanto os pagamentos estão em configuração, crie uma partida amistosa sem créditos.');
  if(!friendlyMode()&&(!Number.isSafeInteger(amount)||amount<10||amount>5000))throw Error('Escolha de 10 a 5.000 créditos, sem casas decimais.');
  if(amount>balance)throw Error('Créditos de teste insuficientes. Reduza o valor ou adicione créditos pela carteira.');
  if(ui.rules.length>240)throw Error('Escreva as regras em até 240 caracteres.');
 }
 foundPlayer=other;return other;
}
function friendlyComposerContent(step,platforms){
 if(step===2)return `<h3 class='wizard-heading' id='wizardHeading' tabindex='-1'>Combinem as regras.</h3><p class='hint'><strong>Partida amistosa · sem créditos</strong><br>Vocês podem jogar e registrar o resultado. A compra de créditos será liberada após configurar os pagamentos.</p><input type='hidden' name='stake' value='0'><label class='form-label' for='duelRules'>Regras combinadas · opcional</label><textarea class='form-input' id='duelRules' name='rules' maxlength='240' rows='3' placeholder='Ex.: jogo único, 6 minutos, sem times personalizados'>${esc(ui.rules)}</textarea><div class='duel-wizard-actions'><button class='btn secondary' type='button' data-action='duel-back'>← Voltar</button><button class='btn primary' type='submit'>Revisar desafio →</button></div>`;
 return `<h3 class='wizard-heading' id='wizardHeading' tabindex='-1'>Tudo certo para chamar seu rival?</h3><dl class='duel-summary'><div><dt>Amigo</dt><dd>${esc(foundPlayer?.nickname||'Convite por link')}<button class='text-button' type='button' data-action='duel-edit' data-id='1'>Editar partida</button></dd></div><div><dt>Modo e plataforma</dt><dd>${esc(ui.mode)} · ${esc(platforms.find(([id])=>id===ui.platform)?.[1]||ui.platform)}</dd></div><div><dt>Partida</dt><dd>Amistosa · sem créditos</dd></div><div><dt>Regras</dt><dd class='duel-summary-rules'>${esc(ui.rules.trim()||'Sem regras extras. Combine os detalhes com seu amigo antes de jogar.')}<button class='text-button' type='button' data-action='duel-edit' data-id='2'>Editar regras</button></dd></div></dl><p class='hint'>Nenhum crédito será cobrado ou reservado. Seu amigo confirma o convite pelo próprio perfil. Vocês enviam o placar com uma foto para revisão do resultado.</p><div class='duel-wizard-actions'><button class='btn secondary' type='button' data-action='duel-back'>← Voltar</button><button class='btn primary' type='submit'>Confirmar e criar convite</button></div>`;
}
function composer(){
 const p=profile();if(ui.duelOwner!==(p?.id||null))resetDuelDraft(p?.id||null);
 const others=Object.values(state.profiles).filter(x=>x.id!==p?.id),step=ui.duelStep,platforms=[['pc','PC'],['playstation','PlayStation'],['xbox','Xbox'],['switch','Nintendo Switch']];
 const progress=`<ol class='duel-wizard-steps' aria-label='Etapas da criação'>${['Partida',friendlyMode()?'Regras':'Créditos e regras','Confirmar'].map((label,i)=>`<li class='${step===i+1?'current':step>i+1?'done':''}' ${step===i+1?"aria-current='step'":''}><span aria-hidden='true'>${i+1}</span>${label}</li>`).join('')}</ol>`;
 const rivals=online?`<input class='form-input' id='rivalId' name='rivalId' maxlength='14' value='${esc(ui.rival)}' placeholder='FBA-XXXXXXXXXX ou deixe vazio para convidar por link' aria-describedby='rivalPreview'><button class='text-button' type='button' data-action='find'>Conferir ID do amigo</button><p id='rivalPreview' class='meta'>${foundPlayer?`Jogador encontrado: ${esc(foundPlayer.nickname)}`:'Com o ID, só esse jogador aceita. Sem ID, você compartilha um convite.'}</p>`:`<select class='form-input' id='rivalId' name='rivalId' ${!others.length?'disabled':''} required><option value=''>Selecione um jogador</option>${others.map(x=>`<option value='${esc(x.publicPlayerId)}' ${ui.rival===x.publicPlayerId?'selected':''}>${esc(x.nickname)} · ${esc(x.publicPlayerId)}</option>`).join('')}</select><p class='meta'>Perfis cadastrados neste navegador. Convites entre aparelhos precisam da versão com servidor.</p>`;
 let content;
 if(step===1)content=`<h3 class='wizard-heading' id='wizardHeading' tabindex='-1'>Quem joga com você?</h3><label class='form-label' for='rivalId'>${online?'ID Fifa GO do amigo · opcional':'Seu amigo'}</label>${rivals}<div class='form-grid'><div><label class='form-label' for='gameMode'>Modo de jogo</label><select class='form-input' id='gameMode' name='mode'>${['1v1','Ultimate Team','Clubes'].map(m=>`<option ${ui.mode===m?'selected':''}>${m}</option>`).join('')}</select></div><div><label class='form-label' for='gamePlatform'>Plataforma</label><select class='form-input' id='gamePlatform' name='platform'>${platforms.map(([v,label])=>`<option value='${v}' ${ui.platform===v?'selected':''}>${label}</option>`).join('')}</select></div></div><div class='duel-wizard-actions'><button class='btn primary' type='submit' ${!online&&!others.length?'disabled':''}>Continuar →</button></div>`;
 else if(step===2)content=`<h3 class='wizard-heading' id='wizardHeading' tabindex='-1'>Combinem créditos e regras.</h3><p class='wizard-available'>Você tem <strong>${fmt(p?.balance||0)} créditos de teste disponíveis</strong>.</p><label class='form-label' for='duelStake'>Créditos de teste por jogador</label><input class='form-input' id='duelStake' name='stake' type='number' min='10' max='5000' step='1' value='${esc(ui.stake)}' required aria-describedby='stakeHint'><div class='stake-options'>${[50,100,250,500].map(n=>`<button class='btn secondary small' type='button' data-action='stake' data-id='${n}'>${n} créditos</button>`).join('')}</div><p class='meta' id='stakeHint'>De 10 a 5.000 créditos. Total quando os dois aceitarem: <strong id='potPreview'>${fmt(Number(ui.stake||0)*2)} créditos de teste</strong>.</p><label class='form-label' for='duelRules'>Regras combinadas · opcional</label><textarea class='form-input' id='duelRules' name='rules' maxlength='240' rows='3' placeholder='Ex.: jogo único, 6 minutos, sem times personalizados'>${esc(ui.rules)}</textarea><div class='duel-wizard-actions'><button class='btn secondary' type='button' data-action='duel-back'>← Voltar</button><button class='btn primary' type='submit'>Revisar desafio →</button></div>`;
 else{const rival=foundPlayer||(!online?M.findProfileByPlayerId(state,ui.rival):null);content=`<h3 class='wizard-heading' id='wizardHeading' tabindex='-1'>Tudo certo para chamar seu rival?</h3><dl class='duel-summary'><div><dt>Amigo</dt><dd>${esc(rival?.nickname||'Convite por link')}<button class='text-button' type='button' data-action='duel-edit' data-id='1'>Editar partida</button></dd></div><div><dt>Modo e plataforma</dt><dd>${esc(ui.mode)} · ${esc(platforms.find(([id])=>id===ui.platform)?.[1]||ui.platform)}</dd></div><div><dt>Por jogador</dt><dd>${fmt(Number(ui.stake))} créditos de teste<button class='text-button' type='button' data-action='duel-edit' data-id='2'>Editar créditos e regras</button></dd></div><div><dt>Total em disputa</dt><dd>${fmt(Number(ui.stake)*2)} créditos de teste, após o aceite do amigo</dd></div><div><dt>Regras</dt><dd class='duel-summary-rules'>${esc(ui.rules.trim()||'Sem regras extras. Combine os detalhes com seu amigo antes de jogar.')}</dd></div></dl><p class='hint'>Ao confirmar, ${fmt(Number(ui.stake))} créditos de teste serão reservados do seu saldo. Seu amigo reserva a parte dele ao aceitar. ${online?'O placar e a foto seguem para revisão antes de liberar os créditos.':'No modo local, resultado e foto ficam neste navegador. A revisão pela equipe exige um servidor conectado.'}</p><div class='duel-wizard-actions'><button class='btn secondary' type='button' data-action='duel-back'>← Voltar</button><button class='btn primary' type='submit'>Confirmar e criar convite</button></div>`;}
 return `<section class='card duel-composer pad'><div class='card-top'><h2>Criar minha partida</h2><span class='pill subtle'>ETAPA ${step} DE 3</span></div>${progress}<form data-form='duel' data-step='${step}' data-owner='${esc(ui.duelOwner||'')}' data-revision='${ui.duelRevision}' data-operation='${esc(ui.duelOperation)}'><fieldset ${!p?'disabled':''} class='duel-wizard-fields'>${friendlyMode()&&step>1?friendlyComposerContent(step,platforms):content}</fieldset><p id='composerError' class='error-message' role='alert' ${ui.duelError?'':'hidden'}>${esc(ui.duelError)}</p></form>${!p?`<div class='row wrap wizard-signup'><button class='btn primary' data-action='signup'>Criar conta para desafiar</button><button class='btn secondary' data-action='login'>Já tenho conta</button></div>`:!online&&!others.length?`<div class='wizard-signup'><p class='meta'>Adicione outro perfil para testar uma partida entre dois jogadores.</p><button class='btn secondary' data-action='signup'>Adicionar outro jogador</button></div>`:''}<p class='meta wizard-test-note'>${online?(friendlyMode()?'Partidas amistosas enquanto os pagamentos estão em configuração.':'Créditos reservados somente após sua confirmação.'):'Créditos fictícios, sem cobrança ou saques. Nenhum crédito é reservado antes da sua confirmação.'}</p></section>`;
}
function actions(d){
 const p=profile(),host=d.hostId===p?.id;if(!p||(!host&&d.guestId!==p.id&&d.recipientId!==p.id))return '';
 if(d.status==='invited')return host?btn('copy-code',matchCode(d),'Copiar código',true)+(online&&d.inviteToken?btn('share',d.id,'Copiar link')+btn('share-native',d.id,'Compartilhar'):'')+btn('cancel',d.id,'Cancelar convite'):btn('accept-preview',d.id,'Ver e aceitar',true)+btn('decline',d.id,'Recusar');
 if(d.cancelRequestedBy&&(!online||d.status==='active'))return d.cancelRequestedBy!==p.id?btn('cancel',d.id,'Confirmar cancelamento')+btn('withdraw-cancel',d.id,'Recusar cancelamento'):btn('withdraw-cancel',d.id,'Retirar pedido de cancelamento');
 if(d.status==='active'){
  return btn('result',d.id,'Enviar placar',true)+btn('cancel',d.id,'Pedir cancelamento');
 }
 if(['review','disputed'].includes(d.status))return btn('details',d.id,'Ver placar e foto')+(d.result?.submittedBy!==p.id&&!d.peerConfirmed&&d.status==='review'?btn('confirm',d.id,'Confirmar placar',true):'')+(d.result?.submittedBy!==p.id&&d.status==='review'?btn('dispute',d.id,'Sinalizar fraude / divergência'):'')+(d.status==='disputed'?btn('result',d.id,'Enviar novo placar'):'')+(!online?btn('cancel',d.id,'Pedir cancelamento'):'');
 return btn('details',d.id,'Ver detalhes');
}
function duelCard(d){const other=opponent(d);return `<article class='duel-entry'><div class='duel-players'>${avatar(other)}<div><h3>${esc(other?.nickname||'Amigo convidado')}</h3><small>${esc(matchCode(d))} · ${esc(d.mode)}</small></div><span class='pill ${tones[d.status]||'subtle'}'>${esc(resultText(d))}</span></div><div class='duel-metrics'>${d.stake===0?`<span><small>PARTIDA</small><strong>Amistosa · sem créditos</strong></span>`:`<span><small>POR JOGADOR</small><strong>${fmt(d.stake)} ${duelUnit(d)}</strong></span><span><small>${d.status==='invited'?'APÓS O ACEITE':'TOTAL'}</small><strong>${fmt(d.stake*2)} ${duelUnit(d)}</strong></span>`}<span><small>VOCÊ × RIVAL</small><strong>${playerScore(d)}</strong></span></div>${d.peerConfirmed&&d.status==='review'?`<p class='meta'>Placar confirmado pelo rival. Aguardando a equipe.</p>`:''}${d.cancelRequestedBy?`<p class='meta'>Cancelamento solicitado. Os dois precisam concordar.</p>`:''}<div class='duel-actions'>${actions(d)}</div></article>`;}
function queue(){
 const p=profile(),incoming=d=>d.status==='invited'&&d.hostId!==p?.id,all=duels(),count=all.filter(incoming).length;
 const list=all.filter(d=>open(d)&&(ui.filter==='all'||(ui.filter==='incoming'?incoming(d):ui.filter==='review'?['review','disputed'].includes(d.status):d.status===ui.filter))).sort((a,b)=>Number(incoming(b))-Number(incoming(a)));
 return `<section class='duel-queue lobby-queue' aria-labelledby='queueTitle'><div class='card-top'><h2 id='queueTitle'>Suas partidas</h2><button class='text-button' data-action='refresh'>Atualizar</button></div>${count?`<p class='queue-nudge'>${count===1?'Você recebeu um convite.':`Você recebeu ${count} convites.`} Confira as regras antes de aceitar.</p>`:''}<div class='tabs' role='group' aria-label='Filtrar desafios'>${[['all','Todos'],['incoming',`Recebidos (${count})`],['invited','Convites'],['active','Confirmadas'],['review','Em análise']].map(([v,label])=>`<button class='tab ${ui.filter===v?'active':''}' data-action='filter' data-id='${v}' aria-pressed='${ui.filter===v}'>${label}</button>`).join('')}</div>${list.length?list.map(duelCard).join(''):`<div class='card pad'><h3>Nenhuma partida nessa etapa.</h3><p class='muted'>Seus convites e partidas aparecerão aqui.</p></div>`}</section>`;
}
function joinForm(dialog=false){const id=dialog?'dialogJoinCode':'joinCode';return `<form data-form='join' class='join-form'><label class='form-label' for='${id}'>Código ou link de convite</label><input class='form-input' id='${id}' name='code' maxlength='1024' value='${esc(ui.joinCode||'')}' required placeholder='Ex.: FG-0123456789 ou cole o link' autocomplete='off' spellcheck='false' ${!dialog?`aria-describedby='joinError'`:''}><button class='btn primary' type='submit'>Buscar partida →</button>${!dialog?`<p id='joinError' class='error-message' role='alert' hidden></p>`:''}</form>`;}
function balanceHint(p){
 if(online)return !p?'Crie sua conta para receber seu ID e jogar amistosas com amigos. O saldo inicial é zero.':!p.balance?'Você pode criar uma amistosa sem créditos. A compra de créditos será liberada após a configuração dos pagamentos.':'Créditos reservados ficam bloqueados até revisão do resultado ou cancelamento. Pagamentos em configuração.';
 return !p?'Crie seu perfil local. O saldo inicial é zero.':!p.balance?(reserved()?'Seu saldo está reservado em partidas. Adicione créditos de teste para criar outro desafio.':'Seu saldo está zerado. Adicione créditos de teste para experimentar uma partida.'):'Créditos fictícios, sem valor financeiro. Reservas só são liberadas após o resultado revisado ou cancelamento.';
}
function arenaView(){
 const p=profile(),arrow=`<svg viewBox='0 0 24 24' fill='none' aria-hidden='true'><path d='M5 12h14m-6-6 6 6-6 6' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
 return `<div class='lobby-intro'><div><p class='eyebrow'>FIFA GO · PARTIDAS ENTRE AMIGOS</p><h1>Joga aí com seus amigos.</h1><p class='muted'>Recebeu um convite ou vai chamar seu rival?</p></div><span class='game-compatibility'>Para jogar EA SPORTS FC</span></div>
 ${!online?`<div class='local-demo-note'><span><strong>Demonstração neste navegador</strong> Experimente com dois perfis aqui. Convites entre aparelhos precisam da versão conectada.</span><button class='text-button' data-action='connection'>Entenda</button></div>`:''}
 <div class='lobby-layout'>
  <section class='lobby-choice join' aria-labelledby='joinTitle'><div class='choice-content'><p class='eyebrow'>TENHO UM CONVITE</p><h2 class='choice-title' id='joinTitle'>Entrar em uma partida</h2><p class='choice-description'>Cole o convite e confira o desafio antes de aceitar.</p>${joinForm()}${p?`<button class='text-button received-link' data-action='join'>Ver convites recebidos</button>`:''}</div></section>
  <section class='lobby-choice create' aria-labelledby='createTitle'><div class='choice-content'><div class='create-choice-heading'><div><p class='eyebrow'>EU CHAMO O RIVAL</p><h2 class='choice-title' id='createTitle'>Criar minha partida</h2></div><img class='football-duel-art' src='assets/brand/football-duel.webp' alt='' aria-hidden='true' width='640' height='640' decoding='async'></div><p class='choice-description'>Escolha seu amigo, combine as regras e confira tudo antes de enviar.</p><button class='btn primary' data-action='create'>Criar minha partida ${arrow}</button><span class='choice-footnote'>3 passos · ${friendlyMode()?'amistosa sem créditos':creditUnit()}</span></div></section>
 </div>
 <section class='lobby-balance' aria-label='Carteira'>${p?`<div><span class='form-label'>DISPONÍVEIS</span><strong>${fmt(p.balance)} <small>${creditUnit()}</small></strong></div><div><span class='form-label'>RESERVADOS</span><strong>${fmt(reserved())} <small>em partidas</small></strong></div><button class='btn secondary' ${online?'disabled aria-describedby="paymentTodo"':"data-action='deposit'"}>${creditAction()}</button>${online?`<p class='meta' id='paymentTodo'>Pagamentos em configuração</p>`:''}`:`<div class='guest-start'><strong>Seu primeiro desafio começa aqui.</strong></div><button class='btn secondary' data-action='signup'>Criar meu perfil</button>`}<p class='balance-help'>${balanceHint(p)}</p></section>
 ${p?`<div class='lobby-meta'><span>Seu ID <code>${esc(p.publicPlayerId)}</code> <button class='text-button' data-action='copy-id'>Copiar</button></span><span>${online?'Conta conectada':'Perfil neste navegador'}</span></div>`:''}
 ${duels().some(open)?queue():''}`;
}
function createView(){return intro('Criar minha partida.','Combine as regras, escolha os créditos e chame seu rival.')+`<a class='text-button' href='#arena'>← Voltar ao início</a>`+`<div class='arena-workspace' style='margin-top:18px'>${composer()}${identity()}</div>`;}
function showJoin(){
 const p=profile();
 const incoming=duels().filter(d=>d.status==='invited'&&d.hostId!==p?.id);
 const invitations=incoming.length?`<h3 style='margin-top:24px'>Seus convites recebidos</h3><div class='stack'>${incoming.map(duelCard).join('')}</div>`:`<p class='meta' style='margin-top:18px'>Seus convites recebidos aparecerão aqui.</p>`;
 modal('Entrar em uma partida','Confira o convite e confirme com seu próprio perfil.',`${joinForm(true)}${invitations}${!online?`<p class='hint'>Neste modo, o código funciona entre perfis cadastrados no mesmo navegador.</p>`:''}`);
}
async function continueIntent(){
 if(invite)return showInvite();
 const next=pendingIntent;pendingIntent=null;
 if(next==='create')go('criar');
 else if(next==='join')showJoin();
 else if(next==='join-code')await findInvitation(ui.joinCode);
 else if(next==='deposit')await showDeposit();
}
const paymentLabels={card:'Cartão',pix:'Pix',transfer:'Transferência'};
const depositLabels={pending:'Aguardando confirmação',review:'Comprovante em análise',approved:'Créditos adicionados',rejected:'Recusado',cancelled:'Cancelado'};
function normalizeDeposit(d){return {...d,status:d.status==='confirmed'?'approved':d.status,version:d.version||1};}
function localWallet(){const p=profile();return {balance:p?.balance||0,reserved:reserved(),transactions:p?.transactions||[],deposits:(p?.depositRequests||[]).map(normalizeDeposit)};}
function legacyDemoView(data){
 const rows=(data.legacyDemoTransactions||[]).slice(0,40).map(t=>`<tr><td>${when(t.date||t.createdAt)}</td><td>${esc(t.label)}</td><td>${t.amount>0?'+':''}${fmt(t.amount)} créditos de demonstração</td></tr>`).join('');
 if(!rows&&!Number(data.legacyDemoBalance)&&!Number(data.legacyDemoReserved))return '';
 return `<details class='legacy-demo-history card pad'><summary>Histórico antigo de demonstração</summary><p class='meta'>Estes registros foram preservados como créditos fictícios. Não foram convertidos em dinheiro ou saldo de compras.</p><p>${fmt(data.legacyDemoBalance)} créditos de demonstração disponíveis${Number(data.legacyDemoReserved)?` · ${fmt(data.legacyDemoReserved)} em partidas antigas`:''}</p>${rows?`<div class='history-table'><table><thead><tr><th>DATA</th><th>MOVIMENTAÇÃO ANTIGA</th><th>CRÉDITOS FICTÍCIOS</th></tr></thead><tbody>${rows}</tbody></table></div>`:''}</details>`;
}
async function loadWallet(){
 if(!online)return localWallet();
 const owner=profile()?.id,data=await API.getWallet();
 if(profile()?.id!==owner)throw Error('A conta mudou. Abra sua carteira novamente.');
 walletData={deposits:[],transactions:[],...data};return walletData;
}
function byDeposit(id){const d=(online?walletData?.deposits:localWallet().deposits)?.find(x=>x.id===id)||(profile()?.isReviewer?depositReviews.find(x=>x.id===id):null);if(!d)throw Error('Recarga não encontrada. Atualize sua carteira.');return normalizeDeposit(d);}
const receiptUrl=d=>online?(d.evidenceId?API.depositEvidenceUrl(d.evidenceId):''):(d.receipt?.evidenceDataUrl||'');
async function walletView(){
 if(!profile())return intro('Sua carteira.','Entre para consultar seu saldo e as movimentações da conta.')+`<button class='btn primary' data-action='signup'>Criar minha conta</button>`;
 const data=await loadWallet(),pending=data.deposits.filter(d=>['pending','review'].includes(d.status)&&(!online||d.paymentMode!=='demo')).reduce((n,d)=>n+d.amount,0);
 if(online){
  const rows=data.transactions.slice(0,40).map(t=>`<tr><td>${when(t.date)}</td><td>${esc(t.label)}</td><td class='${t.amount>=0?'credit-positive':''}'>${t.amount>0?'+':''}${fmt(t.amount)} créditos</td></tr>`).join('');
  const deposits=data.deposits.slice(0,20).map(raw=>{const d=normalizeDeposit(raw);return `<article class='deposit-row'><div class='grow'><strong>${fmt(d.amount)} ${d.paymentMode==='demo'?'créditos antigos de demonstração':'créditos'} · ${esc(paymentLabels[d.method]||'Recarga')}</strong><small>${when(d.createdAt)}${d.paymentMode==='demo'?' · Registro antigo de demonstração':''}</small></div><span class='wallet-status ${esc(d.status)}'>${esc(depositLabels[d.status]||'Aguardando atualização')}</span>${btn('deposit-details',d.id,'Detalhes')}</article>`;}).join('');
  return intro('Sua carteira.','Saldo e reservas da sua conta conectada.')+`<div class='wallet-overview'><div><small>DISPONÍVEIS</small><strong>${fmt(data.balance)} <small>créditos</small></strong><p>Saldo da conta</p></div><div><small>RESERVADOS</small><strong>${fmt(data.reserved)} <small>créditos</small></strong><p>Em convites e partidas</p></div><div><small>RECARGAS PENDENTES</small><strong>${fmt(pending)} <small>créditos</small></strong><p>Aguardando confirmação</p></div></div><section class='payment-todo card pad' aria-labelledby='paymentTodoTitle'><h2 id='paymentTodoTitle'>Pagamentos em configuração</h2><p class='muted'>A conexão com o provedor de pagamentos está pendente. A compra de créditos será disponibilizada aqui após essa configuração.</p><button class='btn primary' disabled>Comprar créditos</button><p class='meta'>Sua conta começa com saldo zero. Nenhuma cobrança pode ser iniciada nesta etapa.</p></section>${legacyDemoView(data)}<section class='wallet-extract'><div class='card-top'><h2>Minhas recargas</h2><button class='text-button' data-action='refresh'>Atualizar</button></div>${deposits||`<div class='card pad'><p class='muted'>Nenhuma compra de créditos realizada.</p></div>`}</section><section class='wallet-extract'><h2>Extrato</h2><div class='card history-table'><table><thead><tr><th>DATA</th><th>MOVIMENTAÇÃO</th><th>CRÉDITOS</th></tr></thead><tbody>${rows||`<tr><td colspan='3'>Nenhuma movimentação.</td></tr>`}</tbody></table></div></section>`;
 }
 const deposits=data.deposits.slice(0,20).map(raw=>{const d=normalizeDeposit(raw);return `<article class='deposit-row'><div class='grow'><strong>${fmt(d.amount)} créditos demo · ${paymentLabels[d.method]}</strong><small>${when(d.createdAt)}${d.method==='card'?` · ${d.installments}x de teste`:''}</small></div><span class='wallet-status ${d.status}'>${depositLabels[d.status]}</span>${btn('deposit-details',d.id,'Detalhes')}</article>`;}).join('');
 const rows=data.transactions.slice(0,40).map(t=>`<tr><td>${when(t.date)}</td><td>${esc(t.label)}</td><td class='${t.amount>=0?'credit-positive':''}'>${t.amount>0?'+':''}${fmt(t.amount)} créditos</td></tr>`).join('');
 return intro('Sua carteira.','Créditos de teste, reservas e movimentações. Sem valor financeiro.')+`<div class='wallet-overview'><div><small>DISPONÍVEIS</small><strong>${fmt(data.balance)} <small>créditos de teste</small></strong><p>Prontos para suas partidas</p></div><div><small>RESERVADOS</small><strong>${fmt(data.reserved)} <small>créditos de teste</small></strong><p>Em convites e partidas</p></div><div><small>RECARGAS PENDENTES</small><strong>${fmt(pending)} <small>créditos de teste</small></strong><p>Aguardando confirmação</p></div></div>${!data.balance?`<p class='hint'>${data.reserved?'Seus créditos estão reservados em partidas.':'Seu saldo está zerado.'} Adicione créditos de teste e confirme a simulação para começar outro desafio.${pending?' Você também pode conferir suas recargas pendentes abaixo.':''}</p>`:''}<div class='between wrap'><button class='btn primary' data-action='deposit'>Adicionar créditos de teste</button><span class='meta'>Ambiente de teste · nenhum dinheiro é cobrado</span></div><section class='wallet-extract'><div class='card-top'><h2>Minhas recargas</h2><button class='text-button' data-action='refresh'>Atualizar</button></div>${deposits||`<div class='card pad'><p class='muted'>Você ainda não fez uma recarga. Escolha cartão, Pix ou transferência para testar.</p></div>`}</section><section class='wallet-extract'><h2>Extrato</h2><div class='card history-table'><table><thead><tr><th>DATA</th><th>MOVIMENTAÇÃO</th><th>CRÉDITOS DE TESTE</th></tr></thead><tbody>${rows||`<tr><td colspan='3'>Nenhuma movimentação.</td></tr>`}</tbody></table></div></section>`;
}
async function showDeposit({amount=100,method='pix',installments=1}={}){
 if(!profile()){pendingIntent='deposit';return showAuth(true);}
 await loadWallet();
 if(online)return modal('Pagamentos em configuração','A compra de créditos será disponibilizada após conectar o provedor.',`<p class='hint'>Ainda não é possível pagar por cartão, Pix ou transferência nesta etapa.</p><button class='btn primary wide' disabled>Comprar créditos</button><button class='btn secondary wide' data-action='wallet'>Ver minha carteira</button>`);
 const descriptions={card:'Até 6 parcelas no teste',pix:'Confirmação de teste',transfer:'Comprovante fictício'};
 const methods=['card','pix','transfer'].map(id=>`<button type='button' class='wallet-method ${method===id?'selected':''}' aria-pressed='${method===id}' data-action='payment-method' data-id='${id}'><strong>${paymentLabels[id]}</strong><small>${descriptions[id]}</small></button>`).join('');
 modal('Adicionar créditos de teste','Escolha a quantidade e o método para simular.',`<ol class='wallet-steps'><li class='active'><b>1</b>Escolher</li><li><b>2</b>Confirmar</li><li><b>3</b>Jogar</li></ol><form class='wallet-form' data-form='deposit' data-operation='${crypto.randomUUID()}'><label class='form-label' for='depositAmount'>Quantidade de créditos demo</label><select class='form-input' id='depositAmount' name='amount'>${[100,250,500,1000].map(n=>`<option value='${n}' ${Number(amount)===n?'selected':''}>${fmt(n)} créditos</option>`).join('')}</select><p class='form-label'>Forma de pagamento</p><div class='wallet-methods'>${methods}</div><input id='depositMethod' name='method' type='hidden' value='${method}'>${method==='card'?`<label class='form-label' for='depositInstallments'>Parcelas demonstrativas</label><select class='form-input' id='depositInstallments' name='installments'>${[1,2,3,4,5,6].map(n=>`<option value='${n}' ${Number(installments)===n?'selected':''}>${n===1?'À vista':`${n} parcelas`}</option>`).join('')}</select>`:`<input name='installments' type='hidden' value='1'>`}<p class='hint'>Teste com créditos fictícios, sem cobrança.${method==='card'?' Não informe dados de cartão real.':method==='pix'?' Não é gerada uma chave Pix para pagamento.':' Use um comprovante fictício, sem dados bancários reais.'}</p><button class='btn primary wide' type='submit'>Continuar com ${paymentLabels[method]}</button></form>`);
}
function showDepositDetails(id){
 const d=byDeposit(id),photo=receiptUrl(d);
 if(online)return modal('Detalhes da recarga',paymentLabels[d.method]||'Recarga de créditos',`<p class='wallet-value'>${fmt(d.amount)} créditos</p><span class='wallet-status ${esc(d.status)}'>${esc(depositLabels[d.status]||'Aguardando atualização')}</span><p class='meta'>Criada em ${when(d.createdAt)}</p>${d.paymentMode==='demo'?`<p class='hint'>Registro antigo de demonstração. Estes créditos não são dinheiro real.</p>`:''}${photo?`<img class='wallet-proof' src='${esc(photo)}' alt='Comprovante da recarga, visível somente para sua conta e a equipe'>`:''}<p class='hint'>Pagamentos em configuração. Esta tela não permite aprovar ou simular um pagamento.</p>${d.decision?.reason?`<p class='meta'>Revisão: ${esc(d.decision.reason)}</p>`:''}`);
 const actions=d.status==='pending'?(d.method==='transfer'?btn('deposit-proof',id,'Enviar comprovante',true):btn('deposit-confirm',id,'Simular aprovação',true)+btn('deposit-reject',id,'Simular recusa'))+btn('deposit-cancel',id,'Cancelar recarga'):d.status==='review'&&d.method==='transfer'?btn('deposit-proof',id,'Substituir comprovante')+btn('deposit-cancel',id,'Cancelar recarga'):'';
 modal('Recarga de créditos',`${paymentLabels[d.method]} · ambiente de teste`,`<p class='wallet-value'>${fmt(d.amount)} créditos demo</p><span class='wallet-status ${d.status}'>${depositLabels[d.status]}</span><p class='meta' style='margin-top:12px'>Criada em ${when(d.createdAt)}${d.method==='card'?` · ${d.installments} parcela(s) demonstrativa(s)`:''}</p>${photo?`<img class='wallet-proof' src='${esc(photo)}' alt='Comprovante fictício anexado à recarga'>`:''}<p class='hint'>${d.status==='approved'?'A confirmação de teste adicionou os créditos uma única vez.':d.status==='review'?(online?'A equipe vai conferir o comprovante antes de adicionar os créditos.':'O comprovante está salvo neste navegador. A revisão pela equipe funciona na versão com servidor.'):'O saldo só muda após a confirmação. Esta operação não cobra dinheiro real.'}</p>${d.decision?.reason?`<p class='meta'>Revisão: ${esc(d.decision.reason)}</p>`:''}<div class='duel-actions'>${actions}</div>`);
}
function showDepositProof(id){
 if(online)return modal('Pagamentos em configuração','O envio de comprovantes será liberado após conectar o provedor.',`<p class='hint'>Ainda não é possível iniciar uma transferência nesta etapa.</p><button class='btn secondary wide' data-action='wallet'>Ver minha carteira</button>`);
 const d=byDeposit(id);
 modal('Comprovante de transferência','Envie uma imagem fictícia para testar a revisão.',`<form data-form='deposit-proof' data-id='${esc(id)}' data-version='${d.version}'><label class='form-label' for='receiptImage'>Comprovante de teste</label><input class='evidence-input' id='receiptImage' name='evidence' type='file' accept='image/jpeg,image/png,image/webp' required><p class='meta'>JPG, PNG ou WebP, até 8 MB. Não envie dados bancários reais.</p><div id='receiptPreview' class='wallet-proof' hidden></div><p class='hint'>Anexar um comprovante não adiciona créditos automaticamente.${!online?' No modo local, a imagem fica neste navegador.':''}</p><button type='submit' class='btn primary wide' style='margin-top:18px'>Enviar para análise</button></form>`);
}
function historyView(){
 const list=duels().filter(d=>{const other=opponent(d);return (!ui.search||`${other?.nickname} ${other?.publicPlayerId} ${d.id}`.toLocaleLowerCase().includes(ui.search.toLocaleLowerCase()))&&(ui.filter==='all'||(ui.filter==='review'?['review','disputed'].includes(d.status):ui.filter==='cancelled'?['cancelled','rejected','expired'].includes(d.status):d.status===ui.filter));});
 return intro('Histórico das partidas.','Rival, placar, créditos e andamento de cada desafio.')+`<div class='history-tools'><label class='grow' for='historySearch'><span class='form-label'>Buscar rival ou ID da partida</span><input class='form-input' id='historySearch' value='${esc(ui.search)}' placeholder='Nome ou ID Fifa GO'></label><label for='historyStatus'><span class='form-label'>Situação</span><select id='historyStatus' class='form-input'>${[['all','Todos'],['settled','Finalizados'],['review','Em análise'],['cancelled','Cancelados / recusados']].map(([v,label])=>`<option value='${v}' ${ui.filter===v?'selected':''}>${label}</option>`).join('')}</select></label></div>${list.length?`<div class='card history-table'><table><thead><tr><th>PARTIDA</th><th>RIVAL</th><th>VOCÊ × RIVAL</th><th>CRÉDITOS / JOGADOR</th><th>RESULTADO</th><th></th></tr></thead><tbody>${list.map(d=>`<tr><td><strong>${esc(matchCode(d))}</strong><small>${when(d.createdAt)} · ${esc(d.mode)}</small></td><td><strong>${esc(opponent(d)?.nickname||'Amigo convidado')}</strong><small>${esc(opponent(d)?.publicPlayerId||'Convite por link')}</small></td><td>${playerScore(d)}</td><td>${fmt(d.stake)} créditos</td><td><span class='pill ${tones[d.status]||'subtle'}'>${esc(resultText(d))}</span></td><td>${btn('details',d.id,'Detalhes')}</td></tr>`).join('')}</tbody></table></div>`:`<div class='card pad'><h2>Nenhuma partida encontrada.</h2><p class='muted'>Seu histórico é preenchido com os desafios da arena.</p><a class='btn primary' href='#arena' style='margin-top:16px'>Criar desafio</a></div>`}`;
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
 const owner=profile().id,[data,wallet]=await Promise.all([API.listReviews(),API.listDepositReviews()]);
 if(profile()?.id!==owner)throw Error('A conta mudou. Abra a revisão novamente.');
 const items=data.duels||data.reviews||[];reviewDuels=items.map(normalize);depositReviews=wallet.deposits||[];
 return intro('Revisão da arena.','Confira as fotos para registrar os resultados.')+`<h2 style='margin-bottom:16px'>Resultados das partidas</h2><section class='stack'>${items.length?items.map(raw=>{const d=normalize(raw);return `<article class='card pad'><h2>${esc(d.host.nickname)} × ${esc(d.guest.nickname)}</h2><p class='meta'>${d.stake===0?'Amistosa · sem créditos':`${d.stake} ${duelUnit(d)} por jogador`} · ${esc(d.mode)}</p><p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do resultado enviada para revisão'>${d.disputes?.map(x=>`<p class='hint'>Contestação: ${esc(x.reason)}<img class='review-image' src='${API.evidenceUrl(x.evidenceId)}' alt='Foto da contestação'></p>`).join('')}<button class='btn primary' data-action='review' data-id='${esc(d.id)}'>Revisar partida</button></article>`;}).join(''):`<div class='card pad'>Nenhuma partida aguardando revisão.</div>`}</section><h2 style='margin:28px 0 16px'>Transferências de teste</h2><section class='stack'>${depositReviews.length?depositReviews.map(d=>`<article class='card pad'><h3>${esc(d.owner.nickname)} · ${fmt(d.amount)} créditos demo</h3><p class='meta'>${when(d.createdAt)} · comprovante em análise</p><img class='wallet-proof' src='${esc(receiptUrl(d))}' alt='Comprovante fictício enviado para revisão'>${btn('deposit-review',d.id,'Revisar comprovante',true)}</article>`).join(''):`<div class='card pad'>Nenhuma transferência aguardando revisão.</div>`}</section>`;
}
let renderRevision=0;
function render(){
 const revision=++renderRevision,hash=location.hash.slice(1);
 ui.view=({palpites:'historico',amigos:'arena'}[hash]||(['arena','criar','carteira','historico','ranking','perfil','revisao'].includes(hash)?hash:'arena'));
 header();runtimeLabels();
 if(serviceUnavailable){$('headerActions').innerHTML='';$('screen').innerHTML=`<section class='card pad connection-unavailable' role='status'><p class='eyebrow'>FIFA GO</p><h1>A arena está temporariamente indisponível.</h1><p class='muted'>Não conseguimos conectar ao servidor de contas e partidas. Tente novamente em instantes.</p><button class='btn primary' data-action='retry'>Tentar novamente</button></section>`;return;}
 const asyncView=ui.view==='revisao'?reviewView:ui.view==='carteira'?walletView:ui.view==='ranking'&&online?sharedRankingView:null;
 $('screen').innerHTML=runtimeCopy(asyncView?`<div class='card pad' role='status'>Carregando…</div>`:ui.view==='criar'?createView():ui.view==='historico'?historyView():ui.view==='ranking'?rankingView():ui.view==='perfil'?profileView():arenaView());
 if(asyncView)asyncView().then(html=>{if(renderRevision===revision)$('screen').innerHTML=runtimeCopy(html);}).catch(e=>{if(renderRevision===revision)$('screen').innerHTML=`<section class='card pad'><h2>Não foi possível carregar.</h2><p>${esc(e.message)}</p><button class='btn secondary' data-action='refresh'>Tentar novamente</button></section>`;});
}
function focusScreen(){ $('screen').focus({preventScroll:true}); }
function go(view){history.replaceState(null,'',new URL('#'+view,location.href).href);closeModal();ui.filter='all';render();focusScreen();window.scrollTo({top:0});}
function showAuth(signup=false){
 if(serviceUnavailable)return render();
 if(!online&&!signup){const ps=Object.values(state.profiles);return modal('Entrar na arena','Escolha um perfil deste navegador.',`<div class='session-picker'>${ps.length?ps.map(p=>`<button class='btn secondary' data-action='select-profile' data-id='${esc(p.id)}'>${avatar(p)}<span>${esc(p.nickname)}<small>${esc(p.publicPlayerId)}</small></span></button>`).join(''):`<p class='muted'>Crie seu primeiro perfil para começar.</p>`}</div><button class='btn primary wide' data-action='signup' style='margin-top:14px'>Criar outro perfil</button>`);}
 const socials=online?`<div class='social-login' aria-label='Entrar com uma conta existente'>${[['google','Google','G'],['apple','Apple','●']].map(([id,label,symbol])=>`<button class='btn secondary social-login-button' data-action='oauth' data-id='${id}' ${backendStatus?.authProviders?.[id]?.available?'':`disabled aria-describedby='${id}LoginHint'`}><span aria-hidden='true'>${symbol}</span>Continuar com ${label}</button>${backendStatus?.authProviders?.[id]?.available?'':`<p class='meta' id='${id}LoginHint'>Login com ${label} em configuração.</p>`}`).join('')}</div><div class='auth-divider'><span>ou use sua conta Fifa GO</span></div>`:'';
 modal(signup?'Criar conta':'Entrar na arena',online?'Sua conta, seu ID e suas partidas em qualquer aparelho.':'Perfil local para experimentar os desafios.',`${socials}<form data-form='${signup?'signup':'login'}' class='auth-form'><label class='form-label' for='authNickname'>${signup?'Apelido':'Apelido ou ID Fifa GO'}</label><input class='form-input' id='authNickname' name='nickname' minlength='2' maxlength='20' autocomplete='username' required>${online?`<label class='form-label' for='authPassword'>Senha</label><input class='form-input' id='authPassword' name='password' type='password' minlength='10' maxlength='256' autocomplete='${signup?'new-password':'current-password'}' required><p class='meta'>Use no mínimo 10 caracteres.</p>`:''}<button class='btn primary wide' type='submit' style='margin-top:20px'>${signup?'Criar conta e receber meu ID':'Entrar'}</button></form>${signup?`<p class='meta'>Saldo inicial zero. ${online?'Compra de créditos em configuração.':'Créditos de demonstração adicionados somente pela simulação local.'}</p>`:''}<button class='text-button' data-action='${signup?'login':'signup'}'>${signup?'Já tenho uma conta':'Criar uma conta'}</button>`);
}
const authErrors={oauth_unavailable:'Esse login ainda está em configuração. Use sua conta Fifa GO.',oauth_expired:'A solicitação de login expirou. Tente novamente.',oauth_invalid_state:'A solicitação de login expirou. Tente novamente.',oauth_cancelled:'O login foi cancelado. Você pode tentar novamente.',oauth_rejected:'O provedor não autorizou o login. Tente novamente.',oauth_invalid_response:'Não foi possível concluir o login. Tente novamente.',oauth_provider_unavailable:'O provedor de login está indisponível. Use sua conta Fifa GO.',failed:'Não foi possível concluir o login. Tente novamente.',account_conflict:'Essa conta já está vinculada. Use o método de login original.'};
const AUTH_PENDING_KEY='fifago-pending-invitation';
function saveAuthIntent(){
 let pending=invite?.token?{type:'token',value:invite.token}:invite?.code?{type:'code',value:invite.code}:null;
 if(!pending&&ui.joinCode){try{const parsed=invitationInput(ui.joinCode);pending={type:parsed.token?'token':'code',value:parsed.token||parsed.code};}catch{}}
 try{if(pending)sessionStorage.setItem(AUTH_PENDING_KEY,JSON.stringify({...pending,expiresAt:Date.now()+30*60*1000}));else sessionStorage.removeItem(AUTH_PENDING_KEY);}catch{throw Error('Não foi possível guardar seu convite para o login. Permita o armazenamento do navegador e tente novamente.');}
}
function restoreAuthIntent(){
 try{const raw=sessionStorage.getItem(AUTH_PENDING_KEY);sessionStorage.removeItem(AUTH_PENDING_KEY);if(!raw)return;const pending=JSON.parse(raw);if(pending.expiresAt<Date.now())return;if(pending.type==='token'&&/^[A-Za-z0-9_-]{43}$/.test(pending.value))invite={token:pending.value};else if(pending.type==='code'&&/^FG-[A-F0-9]{10}$/.test(pending.value))invite={code:pending.value};}catch{}
}
function showProfile(){
 const p=profile();if(!p)return showAuth(true);
 modal('Meu perfil','Seu uniforme e seu ID dentro do Fifa GO.',`<div class='row'>${avatar(p,'large')}<div><strong>${esc(p.nickname)}</strong><p class='meta'>${esc(p.publicPlayerId)}</p></div></div><form data-form='profile'><label class='form-label' for='profileName'>Apelido</label><input class='form-input' id='profileName' name='nickname' value='${esc(p.nickname)}' minlength='2' maxlength='20' required><label class='form-label' for='profileClub'>Time do coração</label><select class='form-input' id='profileClub' name='clubId'><option value=''>Escolha seu clube</option>${M.CLUBS.map(c=>`<option value='${esc(c.id)}' ${c.id===p.clubId?'selected':''}>${esc(c.name)} · ${esc(c.country)}</option>`).join('')}</select><div id='clubPreview' class='compact-club-preview' style='margin-top:14px'>${avatar(p,'large')}</div><label class='form-label' for='avatarStyle'>Avatar</label><select class='form-input' id='avatarStyle' name='avatarStyle'><option value='club'>Uniforme do meu time</option>${p.avatarSticker?`<option value='collection' selected>Minha figurinha atual</option>`:''}</select><button class='btn primary wide' style='margin-top:20px' type='submit'>Salvar perfil</button></form>`);
}
function fileField(){return `<label class='form-label' for='resultImage'>Foto do placar</label><input class='evidence-input' id='resultImage' name='evidence' type='file' accept='image/jpeg,image/png,image/webp' capture='environment' required><p class='meta'>Fotografe o placar final com os dois jogadores visíveis. JPG, PNG ou WebP, até 8 MB.</p><div id='photoPreview' class='evidence-preview' hidden></div>`;}
function showResult(id){const d=byId(id);modal('Enviar resultado','O placar e a foto ficarão aguardando revisão.',`<form data-form='result' data-id='${esc(id)}'><div class='form-grid score-entry'><label for='homeScore'><span class='form-label'>${esc(d.host.nickname)}</span><input id='homeScore' class='form-input' name='homeScore' type='number' min='0' max='99' step='1' required value='${d.result?.homeScore??''}'></label><label for='awayScore'><span class='form-label'>${esc(d.guest.nickname)}</span><input id='awayScore' class='form-input' name='awayScore' type='number' min='0' max='99' step='1' required value='${d.result?.awayScore??''}'></label></div>${fileField()}<p class='hint'>${d.stake===0?'Partida amistosa, sem créditos. O resultado será registrado após revisão.':`Os ${duelUnit(d)} ficam reservados até a decisão da equipe.`}${online?'':' No modo local, a foto fica neste navegador e não chega à equipe.'}</p><button type='submit' class='btn primary wide' style='margin-top:20px'>Enviar placar e foto</button></form>`);}
function showDetails(id){
 const d=byId(id),incoming=d.status==='invited'&&d.hostId!==profile()?.id,balance=d.creditMode==='legacy_demo'?Number(arena?.user?.demoBalance||arena?.user?.legacyDemoBalance||0):profile()?.balance||0,enough=balance>=d.stake;
 const controls=incoming?(enough?btn('accept',d.id,'Aceitar desafio',true):online?`<button class='btn primary' disabled>Créditos indisponíveis</button>`:btn('deposit',d.id,'Adicionar créditos de teste',true))+btn('decline',d.id,'Recusar'):actions(d).replaceAll(`data-action='details'`,`data-action='close'`);
 modal(incoming?'Confira o convite':'Detalhes da partida',`${d.host.nickname} × ${d.guest.nickname}`,`<span class='pill ${tones[d.status]||'subtle'}'>${esc(resultText(d))}</span><p class='meta' style='margin-top:14px'>Código: ${esc(matchCode(d))}<br>${when(d.createdAt)} · ${esc(d.mode)} · ${esc(({pc:'PC',playstation:'PlayStation',xbox:'Xbox',switch:'Nintendo Switch'})[d.platform]||'PC')}<br>${d.stake===0?'Amistosa · sem créditos':`${fmt(d.stake)} ${duelUnit(d)} por jogador`}</p>${d.rules?`<p class='hint'>Regras: ${esc(d.rules)}</p>`:''}${incoming?`<p class='hint'>${d.stake===0?'Esta partida é amistosa, sem cobrança ou reserva de créditos.':enough?`Ao aceitar, ${fmt(d.stake)} ${duelUnit(d)} serão reservados do seu saldo.`:`Saldo insuficiente: você tem ${fmt(balance)} ${duelUnit(d)} disponíveis.`} O resultado precisa da foto e revisão da equipe.${!online?' Aqui, as fotos ficam neste navegador e não são enviadas à equipe.':''}</p>`:''}${d.result?`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do placar desta partida'>`:!incoming?`<p class='hint'>Resultado ainda não enviado.</p>`:''}${reportHistory(d)}${(d.disputes||[d.dispute].filter(Boolean)).map(x=>`<p class='hint'>Divergência: ${esc(x.reason)}</p>`).join('')}${d.review?`<p class='hint'>Decisão da equipe: ${esc(d.review.reason)}</p>`:''}<div class='duel-actions'>${controls}</div>`);
}
function showDispute(id){modal('Sinalizar divergência','O resultado ficará aguardando análise da equipe.',`<form data-form='dispute' data-id='${esc(id)}' data-report='${esc(byId(id).result?.id)}'><label class='form-label' for='disputeReason'>O que aconteceu?</label><textarea class='form-input' id='disputeReason' name='reason' minlength='10' maxlength='300' required placeholder='Explique a divergência ou a suspeita de fraude.'></textarea>${fileField()}<button class='btn primary wide' style='margin-top:20px' type='submit'>Enviar contestação e foto</button></form>`);}
function showHelp(){modal('Como funciona','Do convite ao resultado revisado.',`<ol class='step-list'><li>Envie seu ID Fifa GO ao amigo ou crie um convite.</li><li>Combine modo, plataforma e regras da partida.</li><li>Compartilhe o código da partida ou o link.</li><li>O amigo aceita pelo próprio perfil.</li><li>Joguem e enviem o placar com uma foto.</li><li>O rival confirma ou sinaliza divergência. O resultado aguarda revisão pela equipe.</li></ol><p class='hint'>${online?'As contas, as fotos e as partidas ficam no servidor. No momento, novas partidas são amistosas e não cobram ou reservam créditos.':'Na publicação estática, o fluxo é local. Crie dois perfis e alterne entre eles para experimentar. Não há envio de fotos à equipe nem revisão real nessa modalidade.'}</p><p class='meta'>${online?'A compra de créditos está em configuração.':'Créditos fictícios, sem valor financeiro.'}</p>`);}
function showConnection(){modal('Amigos em dispositivos diferentes',online?'Sua conta e suas partidas estão conectadas.':'Esta demonstração está no modo local.',`${online?`<p>Crie a partida e envie o código ou o link. Seu amigo entra com a própria conta no celular ou computador, mesmo jogando no console.</p><p class='hint'>A aplicação registra os convites e as fotos enviadas. Ela não acessa automaticamente sua conta ou o histórico do EA SPORTS FC.</p>`:`<p>Para compartilhar partidas entre aparelhos, abra a versão com servidor conectado. Na publicação estática, os perfis e as partidas ficam neste navegador.</p>`}<a class='btn primary wide' href='https://github.com/djowww/fifabet-arena/blob/main/docs/SERVIDOR.md' target='_blank' rel='noopener noreferrer'>Ver instruções do servidor</a>`);}
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
async function copy(value,message='Copiado.'){try{await navigator.clipboard.writeText(value);toast(message);}catch{modal('Copie este texto','Selecione e copie para compartilhar.',`<label class='form-label' for='manualCopy'>Convite ou código</label><input id='manualCopy' class='form-input' value='${esc(value)}' readonly>`);}}
const inviteLink=d=>new URL(`?convite=${encodeURIComponent(d.inviteToken)}#arena`,location.origin+location.pathname).href;
function invitationInput(value){
 const raw=String(value||'').trim();if(!raw)throw Error('Cole um link de convite ou digite o código da partida.');
 if(/^https?:\/\//i.test(raw)){
  let url;try{url=new URL(raw);}catch{throw Error('Esse link não é um convite válido. Peça um novo ao seu amigo.');}
  if(url.origin!==location.origin)throw Error('Use um convite do mesmo endereço da sua arena Fifa GO.');
  const token=url.searchParams.get('convite');if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('Esse link não contém um convite válido. Peça um novo ao seu amigo.');
  return {token,code:''};
 }
 if(/^[A-Za-z0-9_-]{43}$/.test(raw))return {token:raw,code:''};
 if(online?!/^FG-[A-F0-9]{10}$/i.test(raw):!/^(?:FG-[A-F0-9]{10}|JOGO-[A-Z0-9]{8}|[a-f0-9]{8}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(raw))throw Error('Código inválido. Copie o código completo ou o link que seu amigo enviou.');
 return {token:'',code:raw.toUpperCase()};
}
async function findInvitation(value){
 const parsed=invitationInput(value);ui.joinCode=String(value).trim();
 if(parsed.token&&!online)throw Error('Este link precisa da versão conectada. Aqui você pode testar um código entre dois perfis neste navegador.');
 if(online){invite=parsed.token?{token:parsed.token}:{code:parsed.code};return showInvite();}
 if(!profile()){pendingIntent='join-code';return showAuth(false);}
 if(parsed.token){
  invite={token:parsed.token};return showInvite();
 }
 const candidates=duels().filter(d=>matchCode(d)===parsed.code||d.id.toUpperCase()===parsed.code||d.id.slice(0,8).toUpperCase()===parsed.code);
 if(candidates.length>1)throw Error('Esse código corresponde a mais de uma partida. Peça o convite completo.');
 const d=candidates[0];
 if(!d)throw Error(online?'Convite não encontrado. Confira o código ou cole o link completo.':'Partida não encontrada para este perfil. No modo local, os dois jogadores precisam estar cadastrados neste navegador.');
 if(d.hostId===profile().id)throw Error('Este é o seu próprio convite. Envie o código ao seu amigo.');
 if(d.status==='expired')throw Error('Este convite expirou. Peça ao seu amigo para criar uma nova partida.');
 if(d.status!=='invited')throw Error(['cancelled','rejected'].includes(d.status)?'Este convite foi cancelado ou recusado. Peça um novo ao seu amigo.':'Esta partida já saiu da etapa de convite. Veja o andamento no início ou histórico.');
 showDetails(d.id);
}
const inviteErrors={invite_invalid:'Esse convite é inválido. Copie o link completo.',invite_not_found:'Convite não encontrado. Confira o link com seu amigo.',invite_expired:'Este convite expirou. Peça ao seu amigo para criar uma nova partida.',invite_cancelled:'Este convite foi cancelado. Peça um novo ao seu amigo.',invite_already_accepted:'Este convite já foi aceito. Confira suas partidas no início ou histórico.',invite_wrong_recipient:'Este convite foi enviado a outro jogador. Entre com o perfil convidado.',invite_own:'Este é seu próprio convite. Compartilhe o link com seu amigo.'};
function inviteNotice(message){modal('Confira seu convite',message,`<p class='hint'>Nenhum crédito foi reservado por esta consulta.</p><button class='btn secondary wide' data-action='clear-invite'>Voltar ao início</button>`);}
async function showInvite(){
 const token=invite?.token,code=invite?.code;
 if(!invite||(!token&&!code)||(token&&!/^[A-Za-z0-9_-]{43}$/.test(token))||(code&&!/^FG-[A-F0-9]{10}$/.test(code)))return inviteNotice(inviteErrors.invite_invalid);
 const owner=profile()?.id;
 if(!owner&&!code)return modal('Você recebeu um desafio','Entre ou crie sua conta Fifa GO para ver e aceitar o convite.',`<button class='btn primary wide' data-action='signup'>Criar conta</button><button class='btn secondary wide' data-action='login' style='margin-top:12px'>Já tenho conta</button>`);
 if(owner&&duels().some(d=>d.hostId===owner&&(token?d.inviteToken===token:matchCode(d)===code)))return inviteNotice(inviteErrors.invite_own);
 let data;try{data=code?await API.getInviteCode(code):await API.getInvite(token);}catch(e){return inviteNotice(inviteErrors[e.code]||e.message);}
 if(profile()?.id!==owner||invite?.token!==token||invite?.code!==code)return;
 const d=data.invite;if(d.status!=='invited')return inviteNotice(inviteErrors[d.status==='expired'?'invite_expired':d.status==='cancelled'?'invite_cancelled':'invite_already_accepted']);
 if(d.expiresAt&&Date.parse(d.expiresAt)<=Date.now())return inviteNotice(inviteErrors.invite_expired);
 invite={...(code?{code}:{token}),...(owner?{owner}:{})};
 const summary=`<span class='pill amber'>Convite pendente</span>${d.publicMatchId||code?`<p class='form-label'>Código da partida <code>${esc(d.publicMatchId||code)}</code></p>`:''}<dl class='invite-summary'><div><dt>Modo</dt><dd>${esc(d.mode)}</dd></div><div><dt>Plataforma</dt><dd>${esc(({pc:'PC',playstation:'PlayStation',xbox:'Xbox',switch:'Nintendo Switch'})[d.platform]||'Combinada com o amigo')}</dd></div><div><dt>Partida</dt><dd>${d.stake===0?'Amistosa · sem créditos':`${fmt(d.stake)} ${duelUnit(d)} por jogador`}</dd></div></dl>${owner?`<p class='hint'>${esc(d.rules||'Combine as regras com seu amigo antes de aceitar.')}</p>`:''}${d.expiresAt?`<p class='meta'>Convite válido até ${when(d.expiresAt)}.</p>`:''}`;
 if(!owner)return modal('Encontrei sua partida','Entre ou crie sua conta para conferir os participantes e aceitar.',`${summary}<button class='btn primary wide' data-action='signup'>Criar conta</button><button class='btn secondary wide' data-action='login'>Já tenho conta</button><p class='meta invite-privacy'>Os nomes dos participantes e os resultados são visíveis após entrar.</p>`);
 const enough=d.creditMode==='legacy_demo'?Number(arena?.user?.demoBalance||arena?.user?.legacyDemoBalance||0)>=d.stake:profile().balance>=d.stake;
 modal('Você recebeu um desafio',d.host?.nickname?`${d.host.nickname} te chamou para jogar.`:'Confira a partida antes de aceitar.',`${summary}<p class='meta'>${d.stake===0?'Esta partida é amistosa, sem cobrança ou reserva de créditos.':`Ao aceitar, ${fmt(d.stake)} ${duelUnit(d)} serão reservados.`} O resultado precisa da foto e revisão da equipe.</p>${enough?`<button class='btn primary wide' data-action='accept-invite'>Aceitar desafio</button>`:`<p class='hint'>Saldo insuficiente para este convite. A compra de créditos está em configuração.</p><button class='btn primary wide' disabled>Comprar créditos</button><button class='btn secondary wide' data-action='view-invite'>Conferir convite novamente</button>`}<p class='meta invite-privacy'>Seu saldo, fotos e resultados ficam privados.</p>`);
}
async function execute(action,id){
 if(action==='close')return closeModal();
 if(serviceUnavailable&&!['retry','credits'].includes(action))throw Error('A conexão com a arena está indisponível. Tente novamente em instantes.');
 if(action==='oauth'){
  if(!online||!['google','apple'].includes(id)||!backendStatus?.authProviders?.[id]?.available)throw Error('Esse método de login está em configuração. Use sua conta Fifa GO.');
  saveAuthIntent();location.assign(API.socialLoginUrl(id));return;
 }
 if(action==='wallet')return go('carteira');
 if(action==='signup')return showAuth(true);
 if(action==='login')return showAuth(false);
 if(action==='join')return showJoin();
 if(action==='view-invite')return showInvite();
 if(action==='clear-invite'){invite=null;ui.joinCode='';pendingIntent=null;const url=new URL(location.href);url.searchParams.delete('convite');url.hash='arena';history.replaceState(null,'',url.href);return go('arena');}
 if(action==='create'){if(!profile()){pendingIntent='create';return showAuth(true);}return go('criar');}
 if(action==='deposit')return showDeposit();
 if(action==='payment-method')return showDeposit({method:id,amount:Number($('depositAmount').value),installments:Number($('depositInstallments')?.value||1)});
 if(action==='deposit-details')return showDepositDetails(id);
 if(action==='deposit-proof')return showDepositProof(id);
 if(action==='deposit-review'){
  if(online)throw Error('Pagamentos em configuração. A revisão de transferências será disponibilizada após conectar o provedor.');
  const d=byDeposit(id);
  return modal('Revisar transferência de teste',`${d.owner.nickname} · ${fmt(d.amount)} créditos demo`,`<img class='wallet-proof' src='${esc(receiptUrl(d))}' alt='Comprovante atual da transferência'><form data-form='deposit-review' data-id='${esc(id)}' data-version='${d.version}'><label class='form-label' for='depositDecision'>Decisão após conferir o comprovante</label><select class='form-input' id='depositDecision' name='decision' required><option value=''>Escolha uma decisão</option><option value='approve'>Aprovar e adicionar créditos de teste</option><option value='reject'>Recusar transferência</option></select><label class='form-label' for='depositReason'>Justificativa</label><textarea class='form-input' id='depositReason' name='reason' minlength='10' maxlength='1000' required></textarea><p class='hint'>A decisão fica registrada. A aprovação adiciona os créditos uma única vez.</p><button class='btn primary wide' type='submit' style='margin-top:16px'>Registrar decisão</button></form>`);
 }
 if(['deposit-confirm','deposit-reject','deposit-cancel'].includes(action)){
  if(online)throw Error('Pagamentos em configuração. A carteira conectada não permite simular aprovação ou alterar créditos.');
  const d=byDeposit(id);
  if(online){if(action==='deposit-cancel')await API.cancelDeposit(id,d.version);else await API.simulateDeposit(id,{mode:'demo',outcome:action==='deposit-confirm'?'approved':'rejected',version:d.version});}
  else localChange(action==='deposit-cancel'?'cancelDemoDeposit':action==='deposit-confirm'?'confirmDemoDeposit':'rejectDemoDeposit',{id});
  await refresh();await loadWallet();showDepositDetails(id);return toast(action==='deposit-confirm'?'Créditos de teste adicionados.':action==='deposit-reject'?'Pagamento de teste recusado. O saldo não mudou.':'Recarga cancelada. O saldo não mudou.');
 }
 if(action==='profile')return showProfile();
 if(action==='help')return showHelp();
 if(action==='connection')return showConnection();
 if(action==='copy-id')return copy(profile()?.publicPlayerId||'');
 if(action==='stake'){updateDuelDraft({stake:id});$('duelStake').value=id;$('potPreview').textContent=`${fmt(Number(id)*2)} créditos de teste`;return;}
 if(action==='duel-back'||action==='duel-edit'){
  ensureDuelOwner();const next=action==='duel-back'?ui.duelStep-1:Number(id);
  if(!Number.isInteger(next)||next<1||next>=ui.duelStep)throw Error('Volte a uma etapa anterior para editar sua partida.');
  ui.duelStep=next;ui.duelRevision++;ui.duelOperation='';ui.duelError='';render();$('wizardHeading')?.focus();return;
 }
 if(action==='filter'){ui.filter=id;return render();}
 if(action==='details'||action==='accept-preview')return showDetails(id);
 if(action==='result')return showResult(id);
 if(action==='dispute')return showDispute(id);
 if(action==='select-profile'){save(M.change(read(),'login',{id}));ui.rival='';foundPlayer=null;walletData=null;closeModal();render();return continueIntent();}
 if(action==='logout'){if(online){await API.logoutAccount();arena=null;}else localChange('logout');walletData=null;pendingIntent=null;closeModal();render();return;}
 if(action==='copy-code')return copy(id,online?'Convite copiado. Pronto para compartilhar.':'Código copiado. Use no perfil convidado deste navegador.');
 if(action==='refresh'){await refresh();return toast('Arena atualizada.');}
 if(action==='retry')return start();
 if(action==='credits')return modal('Créditos das imagens','Ilustração da entrada, uniformes e figurinhas.',`<a class='btn secondary wide' href='https://github.com/djowww/fifabet-arena/blob/main/THIRD_PARTY_NOTICES.md' target='_blank' rel='noopener noreferrer'>Abrir créditos e fontes</a>`);
 if(action==='find'){updateDuelDraft({rival:$('rivalId').value.trim().toUpperCase()});if(!ui.rival)throw Error('Informe o ID do amigo para conferir ou continue para criar um convite por link.');const other=await validateDuelDraft();$('rivalPreview').textContent=`Jogador encontrado: ${other.nickname} · ${other.publicPlayerId}`;return;}
 if(action==='accept-invite'){
  if(!profile())return showAuth(true);
  if(!invite||invite.owner!==profile().id)return showInvite();
  try{if(invite.code)await API.acceptInviteCode(invite.code);else await API.acceptInvite(invite.token);}catch(e){if(inviteErrors[e.code])return inviteNotice(inviteErrors[e.code]);throw e;}
  invite=null;ui.joinCode='';history.replaceState(null,'',location.pathname+'#arena');closeModal();await refresh();return toast('Convite aceito. Partida confirmada.');
 }
 const d=byId(id);
 if(action==='share'||action==='share-native'){
  if(!online||d.status!=='invited'||d.hostId!==profile()?.id||!d.inviteToken)throw Error('Este convite não está disponível para compartilhar.');
  const url=inviteLink(d);
  if(action==='share-native'&&navigator.share)try{await navigator.share({title:'Convite Fifa GO',text:'Joga aí! Confira este desafio no Fifa GO.',url});return toast('Convite compartilhado.');}catch(e){if(e.name==='AbortError')return;}
  return copy(url,'Link do convite copiado. Pronto para compartilhar.');
 }
 if(action==='review'){return modal('Decisão da equipe',`${d.host.nickname} × ${d.guest.nickname}`,`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do resultado atual para revisão'>${reportHistory(d)}<form data-form='review' data-id='${esc(id)}' data-report='${esc(d.result.id)}'><label class='form-label' for='reviewWinner'>Resultado validado</label><select class='form-input' id='reviewWinner' name='winner' required><option value=''>Escolha o resultado conferido</option><option value='host'>${esc(d.host.nickname)} venceu</option><option value='guest'>${esc(d.guest.nickname)} venceu</option><option value='draw'>Empate</option></select><label class='form-label' for='reviewReason'>Justificativa da revisão</label><textarea id='reviewReason' class='form-input' name='reason' minlength='10' maxlength='300' required></textarea><p class='hint'>${d.stake===0?'A decisão registrará o resultado desta amistosa.':'A decisão será registrada e os créditos serão distribuídos uma única vez.'}</p><button class='btn primary wide' type='submit'>${d.stake===0?'Aprovar resultado':'Aprovar resultado e distribuir créditos'}</button></form>`);}
 if(action==='accept'){if(online)await API.acceptDuel(id);else localChange('acceptDuel',{id});}
 else if(action==='decline'){if(online)await API.cancelDuel(id);else localChange('rejectDuel',{id});}
 else if(action==='cancel'){if(online)await API.cancelDuel(id);else localChange(d.status==='invited'?'cancelDuel':d.cancelRequestedBy&&d.cancelRequestedBy!==profile().id?'confirmDuelCancel':'requestDuelCancel',{id});}
 else if(action==='withdraw-cancel'){if(online)await API.withdrawCancellation(id);else localChange('withdrawDuelCancel',{id});}
 else if(action==='confirm'){if(online)await API.confirmResult(id,d.result.id);else localChange('confirmDuelResult',{id,reportId:d.result.id});}
 else return;
 closeModal();await refresh();toast(action==='confirm'?'Placar confirmado. O resultado aguarda revisão pela equipe.':action==='accept'?'Convite aceito. Partida confirmada e créditos de teste reservados.':'Desafio atualizado.');
}
document.addEventListener('click',async event=>{
 if(event.target.closest('.skip-link')){event.preventDefault();$('screen').focus();return;}
 const button=event.target.closest('[data-action]');if(!button||busy)return;
 try{busy=true;button.disabled=true;await execute(button.dataset.action,button.dataset.id);}catch(e){fail(e.message);}finally{busy=false;if(button.isConnected)button.disabled=false;}
});
document.addEventListener('input',event=>{
 const t=event.target;
 if(t.id==='joinCode'||t.id==='dialogJoinCode'){ui.joinCode=t.value;if($('joinError'))$('joinError').hidden=true;}
 if(t.id==='duelStake'){updateDuelDraft({stake:t.value});$('potPreview').textContent=`${fmt(Number(t.value||0)*2)} créditos de teste`;}
 if(t.id==='rivalId'){updateDuelDraft({rival:t.value});if($('rivalPreview'))$('rivalPreview').textContent=online?'Com o ID, só esse jogador aceita. Sem ID, você compartilha um convite.':'';}
 if(t.id==='duelRules')updateDuelDraft({rules:t.value});
 if(t.id==='historySearch'){ui.search=t.value;const cursor=t.selectionStart;render();$('historySearch').focus();$('historySearch').setSelectionRange(cursor,cursor);}
});
document.addEventListener('change',async event=>{
 const t=event.target;if(t.id==='gameMode')updateDuelDraft({mode:t.value});if(t.id==='gamePlatform')updateDuelDraft({platform:t.value});if(t.id==='rivalId')updateDuelDraft({rival:t.value});
 if(t.id==='historyStatus'){ui.filter=t.value;render();$('historyStatus').focus();}
 if(t.id==='profileClub')$('clubPreview').innerHTML=avatar({...profile(),clubId:t.value,avatarSticker:null,teamName:''},'large');
 if(t.id==='resultImage'||t.id==='receiptImage')try{const photo=await preparePhoto(t.files[0]),preview=$(t.id==='receiptImage'?'receiptPreview':'photoPreview');if(t.isConnected&&preview){preview.innerHTML=`<img src='${photo.dataUrl}' alt='Prévia da imagem enviada'>`;preview.hidden=false;}}catch(e){fail(e.message);}
});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();if(busy)return;
 const data=new FormData(form),kind=form.dataset.form,submit=form.querySelector('[type=submit]'),profileId=profile()?.id,submitLabel=submit?.textContent;
 try{
 busy=true;if(submit)submit.disabled=true;
 if(serviceUnavailable)throw Error('A conexão com a arena está indisponível. Tente novamente em instantes.');
 if(kind==='signup'||kind==='login'){
  if(submit){submit.textContent=kind==='signup'?'Criando conta…':'Entrando…';submit.setAttribute?.('aria-busy','true');}
  if(online){if(kind==='signup')await API.registerAccount({nickname:data.get('nickname'),password:data.get('password')});else await API.loginAccount({nickname:data.get('nickname'),password:data.get('password')});arena=await API.getArena();}
  else save(M.change(read(),'create',{nickname:data.get('nickname')}));
  ui.rival='';foundPlayer=null;walletData=null;closeModal();render();window.scrollTo({top:0});await continueIntent();return toast(kind==='signup'?'Seu ID Fifa GO está pronto.':'Você entrou na arena.');
 }
 if(kind==='join'){
  return await findInvitation(data.get('code'));
 }
 if(!profile()||profile().id!==profileId)throw Error('Entre na sua conta para continuar.');
 if(kind==='deposit'){
  if(online)throw Error('Pagamentos em configuração. Nenhuma cobrança ou compra de créditos está disponível nesta etapa.');
  const payload={amount:Number(data.get('amount')),method:data.get('method'),installments:Number(data.get('installments')),idempotencyKey:form.dataset.operation};let id;
  if(online){const created=await API.createDeposit(payload);id=(created.deposit||created).id;}
  else{localChange('createDemoDeposit',{...payload,operationId:payload.idempotencyKey});id=profile().depositRequests.find(d=>d.operationId===payload.idempotencyKey).id;}
  await refresh();await loadWallet();go('carteira');showDepositDetails(id);return toast('Recarga de teste criada. O saldo aguarda confirmação.');
 }
 if(kind==='deposit-proof'){
  if(online)throw Error('O envio de comprovantes estará disponível após configurar os pagamentos.');
  const id=form.dataset.id,version=Number(form.dataset.version),photo=await preparePhoto(data.get('evidence'));
  if(profile()?.id!==profileId)throw Error('A conta mudou. Reabra o envio.');
  if(online)await API.uploadDepositProof(photo.blob,id,version);
  else localChange('attachDemoReceipt',{id,evidenceDataUrl:photo.dataUrl,evidenceName:'comprovante.jpg'});
  await refresh();await loadWallet();go('carteira');showDepositDetails(id);return toast('Comprovante em análise. Nenhum crédito foi liberado.');
 }
 if(kind==='deposit-review'){
  if(online)throw Error('A revisão de transferências estará disponível após configurar os pagamentos.');
  await API.reviewDeposit(form.dataset.id,{decision:data.get('decision'),reason:data.get('reason'),version:Number(form.dataset.version)});
  closeModal();await refresh();return toast(data.get('decision')==='approve'?'Transferência de teste aprovada. Créditos adicionados.':'Transferência recusada. O saldo não mudou.');
 }
 if(kind==='profile'){const payload={nickname:data.get('nickname'),clubId:data.get('clubId')||null,avatarStyle:data.get('avatarStyle')};if(online)await API.updateAccount(payload);else localChange('profile',payload);}
 else if(kind==='duel'){
  ensureDuelOwner();
  if(form.dataset.owner!==ui.duelOwner||Number(form.dataset.step)!==ui.duelStep||Number(form.dataset.revision)!==ui.duelRevision)throw Error('Esta etapa mudou. Revise os dados da partida e continue novamente.');
  if(ui.duelStep===1){
   updateDuelDraft({rival:String(data.get('rivalId')||'').trim().toUpperCase(),mode:String(data.get('mode')||''),platform:String(data.get('platform')||'pc')});
   await validateDuelDraft();ui.duelStep=2;ui.duelError='';render();$('wizardHeading')?.focus();return;
  }
  if(ui.duelStep===2){
   updateDuelDraft({stake:String(data.get('stake')??''),rules:String(data.get('rules')||'')});
   await validateDuelDraft(true);ui.duelStep=3;ui.duelOperation=crypto.randomUUID();ui.duelError='';render();$('wizardHeading')?.focus();return;
  }
  if(ui.duelStep!==3||!ui.duelOperation||form.dataset.operation!==ui.duelOperation)throw Error('Confira o resumo antes de confirmar a criação da partida.');
  const revision=ui.duelRevision;let d;
  if(online){const latest=await API.getArena();if(latest.user?.id!==ui.duelOwner)throw Error('A conta mudou no servidor. Entre novamente e revise a partida.');arena=latest;d=[...(latest.duels||[]),...(latest.history||[])].find(x=>x.hostId===ui.duelOwner&&x.operationId===ui.duelOperation);}
  else{const latest=read(),existing=Object.values(latest.duels||{}).find(x=>x.creatorId===ui.duelOwner&&x.operationId===ui.duelOperation);if(existing)d=normalize(existing);}
  const payload={stake:Number(ui.stake),mode:ui.mode,rules:ui.rules.trim(),opponentPlayerId:ui.rival.trim().toUpperCase(),platform:ui.platform,operationId:ui.duelOperation,expectedHostId:ui.duelOwner};
  if(!d){
   const other=await validateDuelDraft(true);
   if(ui.duelRevision!==revision)throw Error('Os dados mudaram. Confira o resumo antes de confirmar.');
   if(online){const created=await API.createDuel(payload);d=created.duel||created;}
   else{localChange('createDuel',{opponentId:other.id,stake:payload.stake,mode:payload.mode,platform:payload.platform,rules:payload.rules,operationId:payload.operationId});d=duels().find(x=>x.operationId===payload.operationId);}
  }
  if(online)await refresh();
  resetDuelDraft();
  go('arena');
  if(d.status!=='invited'){showDetails(d.id);return toast('A partida já foi criada. Confira o andamento.');}
  const shareable=online&&d.inviteToken,code=matchCode(d);
  modal('Partida criada','Envie o código ou o link ao seu amigo.',`<span class='pill amber'>Convite pendente</span><label class='form-label' for='shareCode'>Código da partida</label><input id='shareCode' class='form-input match-public-code' value='${esc(code)}' readonly>${btn('copy-code',code,'Copiar código',true)}<p class='meta'>Seu amigo pode digitar este código no Fifa GO pelo celular, mesmo jogando no PlayStation ou Xbox.</p>${shareable?`<label class='form-label' for='shareInvite'>Link do convite</label><input id='shareInvite' class='form-input' value='${esc(inviteLink(d))}' readonly><div class='duel-actions'>${btn('copy-code',inviteLink(d),'Copiar link')}${btn('share-native',d.id,'Compartilhar')}</div>`:''}<p class='hint'>${shareable?'O amigo confere as regras e aceita pelo próprio perfil. O link não expõe saldo, fotos ou resultados.':'Este código funciona entre perfis neste navegador. Para jogar entre aparelhos, é necessária a versão conectada.'}</p>`);
  return toast(d.stake===0?'Convite de amistosa criado. Nenhum crédito foi reservado.':'Convite enviado. Seus créditos ficaram reservados.');
 }
 else if(kind==='result'||kind==='dispute'){
  const photo=await preparePhoto(data.get('evidence')),id=form.dataset.id,d=byId(id);
  if(profile()?.id!==profileId)throw Error('O perfil mudou. Reabra o envio.');
  if(online){const uploaded=await API.uploadEvidence(photo.blob,id),evidenceId=uploaded.evidenceId||uploaded.evidence?.id||uploaded.id;if(kind==='result')await API.submitResult(id,{homeScore:Number(data.get('homeScore')),awayScore:Number(data.get('awayScore')),evidenceId});else await API.disputeResult(id,{reportId:form.dataset.report,reason:data.get('reason'),evidenceId});}
  else localChange(kind==='result'?'submitDuelResult':'disputeDuelResult',{id,reportId:form.dataset.report,evidenceDataUrl:photo.dataUrl,evidenceName:photo.name,reason:data.get('reason'),homeScore:Number(data.get('homeScore')),awayScore:Number(data.get('awayScore'))});
 }
 else if(kind==='review')await API.reviewDuel(form.dataset.id,{reportId:form.dataset.report,winner:data.get('winner'),reason:data.get('reason')});
 closeModal();await refresh();toast(kind==='result'?'Placar e foto enviados. Aguardando revisão.':kind==='dispute'?'Contestação enviada. O resultado aguarda revisão.':kind==='review'?'Resultado revisado e registrado.':'Perfil atualizado.');
 }catch(e){if(kind==='duel'){ui.duelError=e.message;const error=$('composerError');if(error){error.textContent=e.message;error.hidden=false;}toast(e.message);}else if(kind==='join')joinFeedback(e.message);else fail(e.message);}finally{busy=false;if(submit?.isConnected){submit.disabled=false;if(submitLabel!==undefined)submit.textContent=submitLabel;submit.removeAttribute?.('aria-busy');}}
});
$('modal').addEventListener('cancel',event=>{event.preventDefault();closeModal();});
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
window.addEventListener('hashchange',()=>{closeModal();ui.filter='all';render();focusScreen();window.scrollTo({top:0});});
window.addEventListener('storage',event=>{if(!online&&event.key===M.STORAGE_KEY){state=read();closeModal();render();}});
window.addEventListener('focus',()=>{if(online&&!busy&&!$('modal').open)refresh().catch(()=>{});});
async function start(){
 serviceUnavailable=false;backendStatus=await API.detectBackend();online=!!backendStatus;
 if(!online&&productionHost()){serviceUnavailable=true;arena=null;closeModal();render();return;}
 if(online){const session=await API.loadSession();arena=session.user?await API.getArena():null;}else save();
 const url=new URL(location.href),auth=url.searchParams.get('auth'),authError=url.searchParams.get('auth_error');
 if(auth||authError){restoreAuthIntent();url.searchParams.delete('auth');url.searchParams.delete('auth_error');history.replaceState(null,'',url.href);}
 render();if(auth==='success'&&profile())toast('Você entrou na arena.');else if(authError)toast(authErrors[authError]||'Não foi possível concluir o login. Use sua conta Fifa GO ou tente novamente.');
 const token=url.searchParams.get('convite');
 if(token&&online)invite={token};
 if(invite&&online)await showInvite();
 else if(token)inviteNotice('Este convite precisa da versão conectada. Nesta demonstração, use um código entre perfis neste navegador.');
}
start().catch(e=>{if(productionHost()){serviceUnavailable=true;arena=null;render();}else $('screen').innerHTML=`<section class='card pad'><h1>A arena não conseguiu iniciar.</h1><p>${esc(e.message)}</p><button class='btn primary' data-action='retry'>Tentar novamente</button></section>`;});
