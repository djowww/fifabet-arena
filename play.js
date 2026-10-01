import * as M from './model.mjs?v=19';
import * as API from './backend-client.mjs?v=22';
import {COUNTRY_CODES,TERMS_VERSION} from './account-policy.mjs?v=1';
import {createAdminPanel,adminIcon} from './admin-panel.mjs?v=2';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=M.points;
const when=x=>new Date(x).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const brl=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents||0)/100);
const read=()=>{try{return M.restore(localStorage.getItem(M.STORAGE_KEY),localStorage.getItem('fifabet-profile'),localStorage.getItem('fifabet-bets'));}catch{return M.emptyState();}};
let state=read(),online=false,arena=null,busy=false,foundPlayer=null,invite=null,reviewDuels=[],walletData=null,depositReviews=[],pendingIntent=null,opener,toastTimer,backendStatus=null,serviceUnavailable=false;
const ui={view:'arena',filter:'all',search:'',mode:'1v1',platform:'pc',stake:'100',rival:'',rules:'',duelStep:1,duelOwner:null,duelRevision:0,duelOperation:'',duelError:''};
const names={invited:'Convite pendente',awaiting_funds:'Aguardando os valores',active:'Partida em andamento...',review:'Resultado em análise',disputed:'Resultado contestado',settled:'Resultado concluído',rejected:'Recusado',cancelled:'Cancelado',expired:'Expirado'};
const tones={invited:'amber',awaiting_funds:'amber',active:'mint',review:'violet',disputed:'live',settled:'lime'};
const profile=()=>serviceUnavailable?null:online?arena?.user:M.current(state);
let adminPanel;
const administration=()=>adminPanel??=createAdminPanel({api:API,getUser:()=>online?profile():null,render,syncAccount:async()=>{arena=await API.getArena();},avatar});
const productionHost=()=>['betfifa.com.br','www.betfifa.com.br'].includes(new URL(location.href).hostname);
const creditUnit=()=>online?(backendStatus?.paymentMode==='pix_manual'?'créditos comprados':backendStatus?.paymentMode==='demo'?'créditos de teste':'créditos'):'créditos de teste';
const creditAction=()=>online?(backendStatus?.paymentMode==='pix_manual'&&backendStatus?.paymentsAvailable?'Comprar créditos via Pix':backendStatus?.paymentMode==='demo'?'Adicionar créditos de teste':'Comprar créditos'):'Adicionar créditos de teste';
const friendlyMode=()=>online&&!backendStatus?.paymentsAvailable;
const duelUnit=d=>d.creditMode==='legacy_demo'?'créditos antigos de demonstração':d.creditMode==='pix_manual'?'créditos comprados':creditUnit();
const matchCode=d=>d.publicMatchId||d.publicDuelId||(!online?d.id.slice(0,8).toUpperCase():'');
const runtimeCopy=html=>html;
function runtimeLabels(){
 const label=serviceUnavailable?'INDISPONÍVEL':online?'ONLINE':'DEMO';
 for(const selector of ['.demo-side .pill','.mobile-brand small','.breadcrumb .pill']){const node=document.querySelector?.(selector);if(node)node.textContent=label;}
 const description=document.querySelector?.('.demo-side p');if(description)description.textContent=serviceUnavailable?'A conexão com a arena precisa ser restabelecida.':online?backendStatus?.paymentMode==='demo'?'Conta conectada. Créditos de teste, sem valor financeiro.':backendStatus?.paymentsAvailable?'Conta conectada. Créditos comprados via Pix e confirmados pela equipe.':'Conta e partidas conectadas. Pagamentos em configuração.':'Demonstração local com créditos fictícios, sem valor financeiro.';
}
const open=d=>['invited','awaiting_funds','active','review','disputed'].includes(d.status);
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
let resultDraft=null,resultDraftRevision=0;
function clearResultDraft(){resultDraft=null;resultDraftRevision++;}
function modal(title,subtitle,html,{account=false}={}){clearResultDraft();opener=document.activeElement;$('modal').classList.toggle('account-dialog',account);$('modalContent').innerHTML=runtimeCopy(`<div class='dialog-head'><div><h2 id='dialogTitle'>${esc(title)}</h2><p>${esc(subtitle)}</p></div>${account?accountPitch():''}<button class='icon-only' data-action='close' aria-label='Fechar janela'>×</button></div><div class='dialog-body'>${html}<p id='dialogError' class='error-message' tabindex='-1' role='alert' hidden></p></div>`);if(!$('modal').open)$('modal').showModal();}
function closeModal(){clearResultDraft();if($('modal').open)$('modal').close();if(opener?.isConnected)opener.focus();}
function fail(message){if($('dialogError')&&$('modal').open){$('dialogError').textContent=message;$('dialogError').hidden=false;}else if($('roomError')){$('roomError').textContent=message;$('roomError').hidden=false;}else toast(message);}
function joinFeedback(message){if($('modal').open)return fail(message);const feedback=$('joinError');if(feedback){feedback.textContent=message;feedback.hidden=false;}else toast(message);}
function intro(title,description){return `<div class='practical-intro'><div><p class='eyebrow'>FIFA GO · ENTRE AMIGOS</p><h1>${title}</h1><p class='muted'>${description}</p></div></div>`;}
function header(){
 const p=profile(),items=[['arena','Início','⌂'],['carteira','Carteira','▣'],['historico','Histórico','◷'],['ranking','Ranking','🏆'],['perfil','Meu perfil','♙']];
 if(p?.isReviewer&&!p?.isAdmin)items.push(['revisao','Revisão','✓']);
 if(online&&p?.isAdmin)items.push(['admin','Admin',adminIcon]);
 $('navigation').innerHTML=items.map(([hash,label,symbol])=>`<a class='nav-item ${ui.view===hash?'active':''}' href='#${hash}' ${ui.view===hash?`aria-current='page'`:''}><span aria-hidden='true'>${symbol}</span><span>${label}</span></a>`).join('');
 $('breadcrumb').textContent=ui.view==='sala'?'Sala da partida':ui.view==='admin'?'Administração':items.find(([hash])=>ui.view===hash)?.[1]||(ui.view==='criar'?'Criar partida':ui.view==='revisao'?'Revisão':'Início');
 $('headerActions').innerHTML=p?`<span class='meta'>${online?'Conta conectada':'Neste navegador'}</span><button class='profile-button' data-action='profile' aria-label='Abrir perfil de ${esc(p.nickname)}'>${avatar(p,'small')}<span>${esc(p.nickname)}</span></button>`:`<button class='btn secondary' data-action='login'>Entrar</button><button class='text-button header-signup' data-action='signup'>Criar conta</button>`;
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
  if(!other?.publicPlayerId||other.publicPlayerId!==code)throw Error('Jogador não encontrado. Confira o ID ou crie um convite por link.');
 }else if(!online){
  const latest=read();other=M.findProfileByPlayerId(latest,code);
  if(!other)throw Error('Selecione um amigo cadastrado neste navegador.');
 }
 if((online&&other?.publicPlayerId===profile()?.publicPlayerId)||(!online&&other?.id===owner))throw Error('Escolha outro jogador para receber seu desafio.');
 if(profile()?.id!==owner||ui.duelRevision!==revision)throw Error('Os dados mudaram durante a conferência. Revise a partida e continue novamente.');
 ensureDuelOwner();
 if(includeCredits){
  const balance=online?profile().balance:M.current(read()).balance,amount=Number(ui.stake);
  if(friendlyMode()&&amount!==0)throw Error('Enquanto os pagamentos estão em configuração, crie uma partida amistosa sem créditos.');
  if(!friendlyMode()&&(!Number.isSafeInteger(amount)||amount<10||amount>5000))throw Error('Escolha de 10 a 5.000 créditos, sem casas decimais.');
  if(!online&&amount>balance)throw Error('Créditos de teste insuficientes. Reduza o valor ou adicione créditos pela carteira.');
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
 else if(step===2)content=`<h3 class='wizard-heading' id='wizardHeading' tabindex='-1'>Combinem créditos e regras.</h3><p class='wizard-available'>Você tem <strong>${fmt(p?.balance||0)} ${creditUnit()} disponíveis</strong>.</p><label class='form-label' for='duelStake'>${online?'Créditos':'Créditos de teste'} por jogador</label><input class='form-input' id='duelStake' name='stake' type='number' min='10' max='5000' step='1' value='${esc(ui.stake)}' required aria-describedby='stakeHint'><div class='stake-options'>${[50,100,250,500].map(n=>`<button class='btn secondary small' type='button' data-action='stake' data-id='${n}'>${n} créditos</button>`).join('')}</div><p class='meta' id='stakeHint'>De 10 a 5.000 créditos. Total com as duas partes reservadas: <strong id='potPreview'>${fmt(Number(ui.stake||0)*2)} ${creditUnit()}</strong>.</p>${online?`<p class='meta'>Na sala, cada participante confirma a reserva da própria conta. Na vitória, o prêmio desconta a taxa da casa de 9% do total.</p>`:''}<label class='form-label' for='duelRules'>Regras combinadas · opcional</label><textarea class='form-input' id='duelRules' name='rules' maxlength='240' rows='3' placeholder='Ex.: jogo único, 6 minutos, sem times personalizados'>${esc(ui.rules)}</textarea><div class='duel-wizard-actions'><button class='btn secondary' type='button' data-action='duel-back'>← Voltar</button><button class='btn primary' type='submit'>Revisar desafio →</button></div>`;
 else{const rival=foundPlayer||(!online?M.findProfileByPlayerId(state,ui.rival):null);content=`<h3 class='wizard-heading' id='wizardHeading' tabindex='-1'>Tudo certo para chamar seu rival?</h3><dl class='duel-summary'><div><dt>Amigo</dt><dd>${esc(rival?.nickname||'Convite por link')}<button class='text-button' type='button' data-action='duel-edit' data-id='1'>Editar partida</button></dd></div><div><dt>Modo e plataforma</dt><dd>${esc(ui.mode)} · ${esc(platforms.find(([id])=>id===ui.platform)?.[1]||ui.platform)}</dd></div><div><dt>Por jogador</dt><dd>${fmt(Number(ui.stake))} ${creditUnit()}<button class='text-button' type='button' data-action='duel-edit' data-id='2'>Editar créditos e regras</button></dd></div><div><dt>Total em disputa</dt><dd>${fmt(Number(ui.stake)*2)} ${creditUnit()}, ${online?'com as duas reservas confirmadas':'após o aceite do amigo'}</dd></div>${online?`<div><dt>Taxa da casa na vitória</dt><dd>9% do total, arredondado para o crédito inteiro mais próximo</dd></div><div><dt>Prêmio previsto do vencedor</dt><dd>${fmt(Number(ui.stake)*2-Math.round(Number(ui.stake)*2*.09))} ${creditUnit()}, após revisão da equipe</dd></div>`:''}<div><dt>Regras</dt><dd class='duel-summary-rules'>${esc(ui.rules.trim()||'Sem regras extras. Combine os detalhes com seu amigo antes de jogar.')}</dd></div></dl><p class='hint'>${online?'Criar o convite e aceitar não debitam o saldo. Cada jogador reserva a própria parte na sala. O placar e a foto seguem para revisão antes de liberar o prêmio.':`Ao confirmar, ${fmt(Number(ui.stake))} créditos de teste serão reservados do seu saldo. Seu amigo reserva a parte dele ao aceitar. No modo local, resultado e foto ficam neste navegador. A revisão pela equipe exige um servidor conectado.`}</p><div class='duel-wizard-actions'><button class='btn secondary' type='button' data-action='duel-back'>← Voltar</button><button class='btn primary' type='submit'>Confirmar e criar convite</button></div>`;}
 return `<section class='card duel-composer pad'><div class='card-top'><h2>Criar minha partida</h2><span class='pill subtle'>ETAPA ${step} DE 3</span></div>${progress}<form data-form='duel' data-step='${step}' data-owner='${esc(ui.duelOwner||'')}' data-revision='${ui.duelRevision}' data-operation='${esc(ui.duelOperation)}'><fieldset ${!p?'disabled':''} class='duel-wizard-fields'>${friendlyMode()&&step>1?friendlyComposerContent(step,platforms):content}</fieldset><p id='composerError' class='error-message' role='alert' ${ui.duelError?'':'hidden'}>${esc(ui.duelError)}</p></form>${!p?`<div class='row wrap wizard-signup'><button class='btn primary' data-action='signup'>Criar conta para desafiar</button><button class='btn secondary' data-action='login'>Já tenho conta</button></div>`:!online&&!others.length?`<div class='wizard-signup'><p class='meta'>Adicione outro perfil para testar uma partida entre dois jogadores.</p><button class='btn secondary' data-action='signup'>Adicionar outro jogador</button></div>`:''}<p class='meta wizard-test-note'>${online?(friendlyMode()?'Partidas amistosas enquanto os pagamentos estão em configuração.':'Créditos reservados somente após sua confirmação.'):'Créditos fictícios, sem cobrança ou saques. Nenhum crédito é reservado antes da sua confirmação.'}</p></section>`;
}
function actions(d){
 const p=profile(),host=d.hostId===p?.id;if(!p||(!host&&d.guestId!==p.id&&d.recipientId!==p.id))return '';
 if(d.status==='invited')return host?btn('copy-code',matchCode(d),'Copiar código',true)+(online&&d.inviteToken?btn('share',d.id,'Copiar link')+btn('share-native',d.id,'Compartilhar'):'')+btn('cancel',d.id,'Cancelar convite'):btn('accept-preview',d.id,'Ver e aceitar',true)+btn('decline',d.id,'Recusar');
 if(d.status==='awaiting_funds')return btn('room',d.id,'Entrar na sala',true);
 if(d.cancelRequestedBy&&(!online||d.status==='active'))return d.cancelRequestedBy!==p.id?btn('cancel',d.id,'Confirmar cancelamento')+btn('withdraw-cancel',d.id,'Recusar cancelamento'):btn('withdraw-cancel',d.id,'Retirar pedido de cancelamento');
 if(d.status==='active'){
  return btn('room',d.id,'Entrar na sala',true);
 }
 if(['review','disputed'].includes(d.status))return btn('room',d.id,'Ver placar e foto')+(d.result?.submittedBy!==p.id&&!d.peerConfirmed&&d.status==='review'?btn('confirm',d.id,'Confirmar placar',true):'')+(d.result?.submittedBy!==p.id&&d.status==='review'?btn('dispute',d.id,'Sinalizar divergência'):'')+(d.status==='disputed'?btn('result',d.id,'Enviar novo placar'):'');
 return btn('details',d.id,'Ver detalhes');
}
function duelCard(d){const other=opponent(d);return `<article class='duel-entry'><div class='duel-players'>${avatar(other)}<div><h3>${esc(other?.nickname||'Amigo convidado')}</h3><small>${esc(matchCode(d))} · ${esc(d.mode)}</small></div><span class='pill ${tones[d.status]||'subtle'}'>${esc(resultText(d))}</span></div><div class='duel-metrics'>${d.stake===0?`<span><small>PARTIDA</small><strong>Amistosa · sem créditos</strong></span>`:`<span><small>POR JOGADOR</small><strong>${fmt(d.stake)} ${duelUnit(d)}</strong></span><span><small>${d.status==='invited'?'APÓS O ACEITE':'TOTAL'}</small><strong>${fmt(d.stake*2)} ${duelUnit(d)}</strong></span>`}<span><small>VOCÊ × RIVAL</small><strong>${playerScore(d)}</strong></span></div>${d.peerConfirmed&&d.status==='review'?`<p class='meta'>Placar confirmado pelo rival. Aguardando a equipe.</p>`:''}${d.cancelRequestedBy?`<p class='meta'>Cancelamento solicitado. Os dois precisam concordar.</p>`:''}<div class='duel-actions'>${actions(d)}</div></article>`;}
function queue(){
 const p=profile(),incoming=d=>d.status==='invited'&&d.hostId!==p?.id,all=duels().filter(open),count=all.filter(incoming).length;
 const list=all.filter(d=>ui.filter==='all'||(ui.filter==='incoming'?incoming(d):ui.filter==='review'?['review','disputed'].includes(d.status):d.status===ui.filter)).sort((a,b)=>Number(incoming(b))-Number(incoming(a)));
 const filters=all.length?`<div class='tabs' role='group' aria-label='Filtrar convites e partidas'>${[['all','Todos'],['incoming',`Recebidos (${count})`],['invited','Convites'],['active','Em andamento'],['review','Em análise']].map(([v,label])=>`<button class='tab ${ui.filter===v?'active':''}' data-action='filter' data-id='${v}' aria-pressed='${ui.filter===v}'>${label}</button>`).join('')}</div>`:'';
 const empty=all.length?`<div class='card pad'><h3>Nenhuma partida nessa etapa.</h3><p class='muted'>Escolha outro filtro para consultar seus convites e partidas.</p></div>`:`<div class='lobby-empty-activity'><strong>Nenhum convite ou partida em andamento.</strong><p>Quando você receber ou criar um desafio, ele aparecerá aqui.</p></div>`;
 return `<section class='duel-queue lobby-queue' aria-labelledby='queueTitle'><div class='card-top'><h2 id='queueTitle'>Convites e partidas</h2><button class='text-button' data-action='refresh'>Atualizar</button></div>${count?`<p class='queue-nudge'>${count===1?'Você recebeu um convite.':`Você recebeu ${count} convites.`} Confira as regras antes de aceitar.</p>`:''}${filters}${list.length?list.map(duelCard).join(''):empty}</section>`;
}
function joinForm(dialog=false){const id=dialog?'dialogJoinCode':'joinCode';return `<form data-form='join' class='join-form'><label class='form-label' for='${id}'>Código ou link de convite</label><input class='form-input' id='${id}' name='code' maxlength='1024' value='${esc(ui.joinCode||'')}' required placeholder='Ex.: FG-0123456789 ou cole o link' autocomplete='off' spellcheck='false' ${!dialog?`aria-describedby='joinError'`:''}><button class='btn primary' type='submit'>Conferir convite</button>${!dialog?`<p id='joinError' class='error-message' role='alert' hidden></p>`:''}</form>`;}
function balanceHint(p){
 if(online&&backendStatus?.paymentMode==='demo')return 'Créditos de teste, sem valor financeiro. Cada jogador reserva a própria parte na sala; as reservas permanecem bloqueadas até a revisão do resultado ou o cancelamento.';
 if(online)return !p?'Crie sua conta para receber seu ID e jogar amistosas com amigos. O saldo inicial é zero.':!p.balance?backendStatus?.paymentsAvailable?'Compre créditos via Pix; eles entram após confirmação no banco pela equipe.':'Você pode criar uma amistosa sem créditos. A compra de créditos está em configuração.':backendStatus?.paymentsAvailable?'Créditos reservados ficam bloqueados até a revisão do resultado ou o cancelamento. Créditos comprados não podem ser sacados.':'Créditos reservados ficam bloqueados até revisão do resultado ou cancelamento. Pagamentos em configuração.';
 return !p?'Crie seu perfil local. O saldo inicial é zero.':!p.balance?(reserved()?'Seu saldo está reservado em partidas. Adicione créditos de teste para criar outro desafio.':'Seu saldo está zerado. Adicione créditos de teste para experimentar uma partida.'):'Créditos fictícios, sem valor financeiro. Reservas só são liberadas após o resultado revisado ou cancelamento.';
}
function arenaView(){
 const p=profile(),arrow=`<svg viewBox='0 0 24 24' fill='none' aria-hidden='true'><path d='M5 12h14m-6-6 6 6-6 6' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
 const createFootnote=online?(!p?'Entre ou crie sua conta para continuar · amistosa sem créditos':friendlyMode()?'Partida amistosa · sem créditos':'Confira os créditos antes de confirmar'):(!p?'Crie um perfil local para continuar · créditos fictícios':'Créditos fictícios · sem valor financeiro');
 const secondStep=friendlyMode()?'Combine as regras da amistosa':'Combine créditos e regras';
 return `<div class='lobby-intro'><div><h1>Crie o próximo clássico.</h1><p class='muted'>Chame um amigo no EA SPORTS FC e combine o desafio antes de enviar o convite.</p></div></div>
 ${!online?`<div class='local-demo-note'><span><strong>Demonstração neste navegador</strong> Experimente com dois perfis aqui. Convites entre aparelhos precisam da versão conectada.</span><button class='text-button' data-action='connection'>Entenda</button></div>`:''}
 <div class='lobby-layout'>
  <section class='lobby-create' aria-labelledby='createTitle'><div class='lobby-create-copy'><h2 id='createTitle'>Chame seu rival.</h2><p>Escolha o amigo, defina o modo e revise as regras antes de criar o convite.</p><button class='btn primary' data-action='create'>Criar minha partida ${arrow}</button><span class='choice-footnote'>${createFootnote}</span></div><ol class='lobby-create-steps' aria-label='Etapas da criação'><li><span aria-hidden='true'>1</span><span>Escolha o rival e o modo</span></li><li><span aria-hidden='true'>2</span><span>${secondStep}</span></li><li><span aria-hidden='true'>3</span><span>Revise e envie o convite</span></li></ol></section>
  <section class='lobby-invite' aria-labelledby='joinTitle'><div class='lobby-invite-copy'><h2 id='joinTitle'>Já tem um convite?</h2><p>Cole o link ou código para conferir a partida antes de aceitar.</p></div>${joinForm()}</section>
 </div>
 ${p&&(online||duels().some(open))?queue():''}
 <section class='lobby-balance ${p?'':'lobby-onboarding'}' aria-label='${p?'Carteira':'Primeiros passos'}'>${p?`<div><span class='form-label'>DISPONÍVEIS</span><strong>${fmt(p.balance)} <small>${creditUnit()}</small></strong></div><div><span class='form-label'>RESERVADOS</span><strong>${fmt(reserved())} <small>em partidas</small></strong></div><button class='btn secondary' ${online&&!backendStatus?.paymentsAvailable?'disabled aria-describedby="paymentTodo"':"data-action='deposit'"}>${creditAction()}</button>${online&&!backendStatus?.paymentsAvailable?`<p class='meta' id='paymentTodo'>Pagamentos em configuração</p>`:''}<p class='balance-help'>${balanceHint(p)}</p>`:`<div class='guest-start'><strong>${online?'Receba seu ID Fifa GO para chamar amigos.':'Crie um perfil local para testar partidas.'}</strong><p>${online?'Entre ou crie sua conta no topo. Partidas amistosas não exigem créditos.':'Convites entre aparelhos precisam da versão conectada. O saldo começa em zero.'}</p></div>${online?`<span class='pill subtle'>Saldo inicial zero</span>`:`<button class='btn primary' data-action='signup'>Criar perfil</button><span class='pill subtle'>Demonstração local</span>`}`}</section>
 ${p?`<div class='lobby-meta'><span>Seu ID <code>${esc(p.publicPlayerId)}</code> <button class='text-button' data-action='copy-id'>Copiar</button></span><span>${online?'Conta conectada':'Perfil neste navegador'}</span></div>`:''}
 `;
}
function createView(){return intro('Criar minha partida.','Combine as regras, escolha os créditos e chame seu rival.')+`<a class='text-button' href='#arena'>← Voltar ao início</a>`+`<div class='arena-workspace' style='margin-top:18px'>${composer()}${identity()}</div>`;}
function roomFunders(d){
 if(online)return d.fundedBy||[];
 return [d.hostId,d.guestId].filter(id=>id&&state.profiles[id]?.transactions.some(t=>t.ref===`duel:${d.id}:reserve`&&t.amount===-d.stake));
}
const roomDraw=d=>d.status==='settled'&&(d.settlement?.winner==='draw'||!d.winnerId);
function economicsContent(d){
 if(!d.stake)return `<p class='room-friendly'>Amistosa · sem créditos ou prêmio</p>`;
 const e=d.economics,funded=roomFunders(d),refunds=funded.map(id=>`<div><dt>Devolvido para ${esc(id===d.hostId?d.host.nickname:d.guest.nickname)}</dt><dd>${fmt(d.stake)} ${duelUnit(d)}</dd></div>`).join('');
 if(['cancelled','expired','rejected'].includes(d.status))return `<dl class='room-economics'>${refunds}<div><dt>Taxa da casa</dt><dd>0 ${duelUnit(d)}</dd></div></dl><p class='meta'>${funded.length?'As partes efetivamente reservadas foram devolvidas.':'Nenhuma parte foi reservada. Não há créditos a devolver.'} Esta partida não distribuiu prêmio.</p>`;
 if(d.status==='settled'){
  if(roomDraw(d))return `<dl class='room-economics'>${refunds}<div><dt>Taxa da casa</dt><dd>${fmt(d.settlement?.fee||0)} ${duelUnit(d)}</dd></div></dl><p class='meta'>Empate aprovado. Cada jogador recebeu de volta a própria reserva, sem taxa.</p>`;
  const settled=d.settlement||(d.fundingVersion!==1?{pot:d.stake*2,fee:0,prize:d.stake*2,winnerId:d.winnerId}:null);
  if(!settled)return `<p class='meta'>Os valores da liquidação ainda não estão disponíveis. Atualize a sala para conferir.</p>`;
  const winner=settled.winnerId===d.hostId?d.host.nickname:d.guest.nickname;
  return `<dl class='room-economics'><div><dt>Total liquidado</dt><dd>${fmt(settled.pot)} ${duelUnit(d)}</dd></div><div><dt>Taxa da casa retida</dt><dd>${fmt(settled.fee)} ${duelUnit(d)}</dd></div><div class='room-net'><dt>Prêmio creditado a ${esc(winner)}</dt><dd>${fmt(settled.prize)} ${duelUnit(d)}</dd></div></dl><p class='meta'>Liquidação registrada pela equipe.${settled.fee?'':' Condições originais desta partida, sem taxa.'}</p>`;
 }
 if(!e)return `<dl class='room-economics'><div><dt>Total em disputa</dt><dd>${fmt(d.stake*2)} ${duelUnit(d)}</dd></div></dl><p class='meta'>${online?'Desafio anterior: distribuição conforme as regras registradas.':'Créditos fictícios. A revisão da equipe exige a versão conectada.'}</p>`;
 const percent=Number(e.feeBps||0)/100;
 return `<dl class='room-economics'><div><dt>Total das duas partes</dt><dd>${fmt(e.pot)} ${duelUnit(d)}</dd></div><div><dt>Taxa da casa · ${fmt(percent)}%</dt><dd>− ${fmt(e.houseFee)} ${duelUnit(d)}</dd></div><div class='room-net'><dt>Prêmio do vencedor</dt><dd>${fmt(e.winnerPayout)} ${duelUnit(d)}</dd></div></dl><p class='meta'>${e.feeBps?'Taxa arredondada para o crédito inteiro mais próximo.':'Condições originais desta partida.'} O prêmio só é liberado após a revisão da equipe. Em empate aprovado, cada jogador recebe sua parte de volta.</p>`;
}
function issuesContent(d){
 const issues=d.issueReports||[],reviewer=online&&profile()?.isReviewer&&![d.hostId,d.guestId].includes(profile().id);
 return issues.length?`<details class='room-issues' ${reviewer?'open':''}><summary>Problemas sinalizados (${issues.length})</summary>${issues.map(x=>`<div class='room-issue-report'><p><strong>${esc(x.authorId===d.hostId?d.host.nickname:x.authorId===d.guestId?d.guest.nickname:'Participante')}</strong><span class='meta'>${x.createdAt?` · ${when(x.createdAt)}`:''}</span><br>${esc(x.reason)}</p>${x.status==='resolved'?`<p class='meta'>${x.review?.decision==='cancel'?'Partida cancelada pela equipe':'Relato revisado pela equipe'}${x.review?.reason?` · ${esc(x.review.reason)}`:''}</p>`:reviewer?btn('issue-review',`${d.id}:${x.id}`,'Revisar problema'):`<p class='meta'>Aguardando análise da equipe.</p>`}</div>`).join('')}<p class='meta'>Sinalizar um problema não encerra a partida. A equipe confere os relatos e as evidências.</p></details>`:'';
}
function roomView(){
 if(!profile())return `<section class='card pad'><h1>Sala da partida</h1><p class='muted'>Entre com sua conta para acompanhar esta partida.</p><button class='btn primary' data-action='login'>Entrar</button><a class='text-button' href='#arena'>Voltar ao início</a></section>`;
 let d;try{d=byId(ui.roomId);}catch{return `<section class='card pad'><h1>Partida não encontrada.</h1><p class='muted'>Confira suas partidas ou atualize para tentar novamente.</p><div class='duel-actions'><a class='btn secondary' href='#arena'>Voltar ao início</a><button class='btn primary' data-action='refresh'>Atualizar</button></div></section>`;}
 const p=profile(),participant=[d.hostId,d.guestId,d.recipientId].includes(p.id),newFunding=online&&d.fundingVersion===1,funded=roomFunders(d),ownFunded=funded.includes(p.id),incoming=d.status==='invited'&&d.hostId!==p.id;
 if(!participant)return `<section class='card pad'><a class='text-button muted' href='#revisao'>← Voltar à revisão</a><h1>${esc(d.host.nickname)} × ${esc(d.guest.nickname)}</h1><p class='muted'>${esc(names[d.status])}</p>${d.result?`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do resultado enviada para revisão'>`:''}${issuesContent(d)}${economicsContent(d)}</section>`;
 const closed=!open(d),playerRow=(player,id)=>{const paid=funded.includes(id),label=!d.stake?'Sem créditos':closed?paid?(d.status==='settled'&&!roomDraw(d)?'Reserva liquidada':'Créditos devolvidos'):'Sem reserva realizada':paid?'Parte reservada':d.status==='invited'?'Reserva após entrar na sala':'Aguardando a própria reserva';return `<div class='room-player'>${avatar(player)}<div><strong>${esc(player.nickname)}${id===p.id?` <span class='meta'>· você</span>`:''}</strong><span class='meta'>${label}</span></div><span class='room-player-value'>${d.stake?`${fmt(d.stake)} <small>créditos</small>`:'Amistosa'}</span></div>`;};
 let main='';
 if(d.status==='invited')main=`<div class='room-state'><h2>${incoming?'Confira o convite.':'Aguardando seu amigo entrar.'}</h2><p>${incoming?'Ao aceitar, você entra na sala. Cada jogador confirma a própria parte antes de jogar.':'Envie o código ou o link. Cada jogador confirma a própria parte quando estiver na sala.'}</p><div class='duel-actions'>${incoming?btn('accept',d.id,newFunding?'Aceitar e entrar na sala':'Aceitar desafio',true)+btn('decline',d.id,'Recusar'):actions(d)}</div></div>`;
 else if(d.status==='awaiting_funds'){
  const enough=p.balance>=d.stake,canFund=backendStatus?.paymentsAvailable&&backendStatus.paymentMode===d.creditMode;
  main=`<div class='room-state'><h2>${ownFunded?'Sua parte está pronta.':'Confirme sua parte para jogar.'}</h2><p>${ownFunded?'Aguardando seu amigo reservar a parte dele. A sala inicia quando as duas reservas estiverem confirmadas.':`Cada participante reserva ${fmt(d.stake)} ${duelUnit(d)} da própria conta. Nenhum jogador confirma pelo outro.`}</p>${ownFunded?`<p class='room-waiting' role='status'>Aguardando a reserva do rival...</p>`:!canFund?`<p class='hint'>A reserva está indisponível na configuração atual dos pagamentos. Atualize a sala ou solicite o cancelamento.</p>`:enough?`<form data-form='fund' data-id='${esc(d.id)}' data-owner='${esc(p.id)}' data-stake='${d.stake}'><p class='meta'>Seu saldo disponível: ${fmt(p.balance)} ${creditUnit()}.</p><button class='btn primary room-main-action' type='submit'>Reservar meus ${fmt(d.stake)} créditos</button></form>`:`<p class='hint'>Você tem ${fmt(p.balance)} créditos disponíveis. Faltam ${fmt(d.stake-p.balance)} para reservar sua parte.</p>${backendStatus?.paymentMode==='pix_manual'?btn('deposit',d.id,'Comprar créditos via Pix',true):btn('deposit',d.id,'Adicionar créditos de teste',true)}`}<button class='text-button muted' data-action='cancel' data-id='${esc(d.id)}'>Pedir cancelamento</button></div>`;
 }
 else if(d.status==='active')main=`<div class='room-state room-live'><p class='room-live-status' role='status'><span aria-hidden='true'></span>Partida em andamento...</p><h2>Boa partida, ${esc(p.nickname)}.</h2><p>Joguem no EA SPORTS FC. Volte aqui quando a partida terminar para fotografar o placar.</p><button class='btn primary room-main-action' data-action='result' data-id='${esc(d.id)}'>Partida encerrada</button>${online?`<button class='text-button muted room-issue-action' data-action='issue' data-id='${esc(d.id)}'>Sinalizar um problema</button>`:`<p class='meta'>Demonstração local: fotos e placar ficam neste navegador.</p>`}</div>`;
 else if(['review','disputed'].includes(d.status))main=`<div class='room-state'><h2>${d.status==='disputed'?'Resultado contestado.':'Resultado aguardando revisão.'}</h2><p>${d.peerConfirmed?'Seu rival confirmou o placar. A equipe ainda precisa revisar a foto.':'Confira o placar e a foto. A decisão da equipe registra o resultado e libera o prêmio.'}</p><div class='duel-actions'>${d.result?.submittedBy!==p.id&&d.status==='review'?(!d.peerConfirmed?btn('confirm',d.id,'Confirmar placar',true):'')+btn('dispute',d.id,'Sinalizar divergência'):''}${d.status==='disputed'?btn('result',d.id,'Enviar novo placar',true):''}</div></div>`;
 else main=`<div class='room-state'><h2>${esc(resultText(d))}</h2><p>${d.status==='settled'?d.stake?'A equipe registrou a decisão e a distribuição dos créditos.':'A equipe registrou o resultado desta amistosa.':'Confira o histórico e a situação desta partida.'}</p></div>`;
 const cancel=!closed&&d.cancelRequestedBy?`<div class='hint'>Cancelamento solicitado. Os dois precisam concordar.<div class='duel-actions'>${d.cancelRequestedBy!==p.id?btn('cancel',d.id,'Confirmar cancelamento')+btn('withdraw-cancel',d.id,'Recusar cancelamento'):btn('withdraw-cancel',d.id,'Retirar pedido')}</div></div>`:'';
 return `<section class='match-room' aria-labelledby='roomTitle'><a class='text-button muted' href='#arena'>← Voltar ao início</a><div class='room-heading'><div><h1 id='roomTitle'>Sala da partida</h1><p class='muted'><code>${esc(matchCode(d))}</code> · ${esc(d.mode)} · ${esc(({pc:'PC',playstation:'PlayStation',xbox:'Xbox',switch:'Nintendo Switch'})[d.platform]||'PC')}</p></div><button class='text-button' data-action='refresh'>Atualizar</button></div><div class='room-layout'><div class='room-play'><div class='room-participants'>${playerRow(d.host,d.hostId)}${playerRow(d.guest,d.guestId)}</div>${cancel}${main}${d.result?`<figure class='room-result'><figcaption><strong>${esc(d.host.nickname)} ${d.result.homeScore} × ${d.result.awayScore} ${esc(d.guest.nickname)}</strong><span class='meta'>Foto enviada por um participante · resultado ${d.status==='settled'?'revisado':closed?'encerrado':'em análise'}</span></figcaption><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do placar enviada para esta partida'></figure>`:''}${reportHistory(d)}${issuesContent(d)}${(d.disputes||[d.dispute].filter(Boolean)).map(x=>`<p class='hint'>Divergência: ${esc(x.reason)}</p>`).join('')}${d.review?`<p class='hint'>Decisão da equipe: ${esc(d.review.reason)}</p>`:''}<p id='roomError' class='error-message' role='alert' hidden></p></div><aside class='room-summary'><h2>${d.stake?(d.status==='settled'?'Liquidação da partida':closed?'Devolução dos créditos':'Valores da partida'):'Partida amistosa'}</h2>${economicsContent(d)}${d.rules?`<div class='room-rules'><h3>Regras combinadas</h3><p>${esc(d.rules)}</p></div>`:''}<p class='meta'>A foto ajuda a conferir o resultado. O Fifa GO não acessa o histórico do jogo automaticamente.</p></aside></div></section>`;
}
function openRoom(id){go(`partida/${encodeURIComponent(id)}`);}
function showIssue(id){const d=byId(id);if(!online||d.status!=='active')throw Error('Problemas durante a partida podem ser sinalizados na versão conectada.');modal('Sinalizar um problema','A equipe verá seu relato junto ao resultado.',`<form data-form='issue' data-id='${esc(id)}' data-owner='${esc(profile().id)}'><label class='form-label' for='issueReason'>O que aconteceu?</label><textarea class='form-input' id='issueReason' name='reason' minlength='10' maxlength='300' required placeholder='Descreva desconexão, regras descumpridas ou outro problema.'></textarea><p class='meta'>O relato é registrado sem encerrar a partida ou liberar créditos. A equipe decide depois de conferir as evidências.</p><button class='btn primary wide' type='submit'>Enviar relato para a equipe</button></form>`);}
function showIssueReview(value){
 const [id,issueId]=String(value).split(':'),d=byId(id),issue=(d.issueReports||[]).find(x=>x.id===issueId&&x.status==='open');
 if(!online||!profile()?.isReviewer||[d.hostId,d.guestId].includes(profile().id)||!issue)throw Error('Este problema não está disponível para revisão por esta conta. Atualize a fila.');
 modal('Revisar problema',`${d.host.nickname} × ${d.guest.nickname}`,`<p class='hint'>${esc(issue.reason)}</p>${d.result?`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto atual do resultado para conferir o relato'>`:`<p class='meta'>Nenhum resultado enviado. O relato não comprova sozinho o encerramento da partida.</p>`}<form data-form='issue-review' data-id='${esc(id)}' data-issue='${esc(issueId)}' data-report='${esc(d.result?.id||'')}' data-owner='${esc(profile().id)}'><label class='form-label' for='issueDecision'>Decisão da equipe</label><select class='form-input' id='issueDecision' name='decision' required><option value=''>Escolha uma decisão</option><option value='dismiss'>Registrar revisão e manter a partida</option><option value='cancel'>Cancelar a partida e devolver as reservas</option></select><label class='form-label' for='issueReviewReason'>Justificativa</label><textarea class='form-input' id='issueReviewReason' name='reason' minlength='10' maxlength='300' required></textarea><p class='meta'>Cancelar devolve somente as partes efetivamente reservadas, sem taxa. A decisão fica registrada.</p><button class='btn primary wide' type='submit'>Registrar decisão</button></form>`);
}
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
  const realPix=data.paymentMode==='pix_manual';
  const deposits=data.deposits.slice(0,20).map(raw=>{const d=normalizeDeposit(raw);return `<article class='deposit-row'><div class='grow'><strong>${fmt(d.amount)} ${d.paymentMode==='demo'?'créditos antigos de demonstração':d.paymentMode==='pix_manual'?'créditos comprados':'créditos'} · ${esc(paymentLabels[d.method]||'Recarga')}${d.priceCents?` · ${brl(d.priceCents)}`:''}</strong><small>${when(d.createdAt)}${d.paymentMode==='demo'?' · Registro antigo de demonstração':''}</small></div><span class='wallet-status ${esc(d.status)}'>${esc(depositLabels[d.status]||'Aguardando atualização')}</span>${btn('deposit-details',d.id,'Detalhes')}</article>`;}).join('');
  const paymentCard=realPix?`<section class='payment-todo card pad' aria-labelledby='paymentTodoTitle'><h2 id='paymentTodoTitle'>Adicionar créditos via Pix</h2><p class='muted'>Escolha um pacote e pague pelo Pix. A equipe confere a entrada no extrato antes de liberar os créditos.</p><div class='pix-price-list'>${(data.catalog||[]).map(pack=>`<span>${fmt(pack.amount)} créditos <strong>${brl(pack.priceCents)}</strong></span>`).join('')}</div><button class='btn primary' data-action='deposit'>Comprar créditos via Pix</button><p class='meta'>Créditos comprados não podem ser sacados. O comprovante não confirma o pagamento por si só.</p></section>`:`<section class='payment-todo card pad' aria-labelledby='paymentTodoTitle'><h2 id='paymentTodoTitle'>Pagamentos em configuração</h2><p class='muted'>A compra de créditos será ativada depois de concluir a configuração do Pix.</p><button class='btn primary' disabled>Comprar créditos</button><p class='meta'>Sua conta começa com saldo zero. Nenhuma cobrança pode ser iniciada nesta etapa.</p></section>`;
  return intro('Sua carteira.','Saldo, créditos disponíveis e reservas das partidas.')+`<div class='wallet-overview'><div><small>DISPONÍVEIS</small><strong>${fmt(data.balance)} <small>créditos</small></strong><p>Prontos para usar</p></div><div><small>RESERVADOS</small><strong>${fmt(data.reserved)} <small>créditos</small></strong><p>Em convites e partidas</p></div><div><small>RECARGAS PENDENTES</small><strong>${fmt(pending)} <small>créditos</small></strong><p>Aguardando conferência</p></div></div>${!data.balance?`<p class='hint'>Seu saldo está zerado. ${realPix?'Escolha um pacote Pix para começar; os créditos entram depois que a equipe confirmar o recebimento no banco.':'A compra de créditos está em configuração.'}</p>`:''}${paymentCard}${legacyDemoView(data)}<section class='wallet-extract'><div class='card-top'><h2>Minhas recargas</h2><button class='text-button' data-action='refresh'>Atualizar</button></div>${deposits||`<div class='card pad'><p class='muted'>Nenhuma compra de créditos realizada.</p></div>`}</section><section class='wallet-extract'><h2>Extrato</h2><div class='card history-table'><table><thead><tr><th>DATA</th><th>MOVIMENTAÇÃO</th><th>CRÉDITOS</th></tr></thead><tbody>${rows||`<tr><td colspan='3'>Nenhuma movimentação.</td></tr>`}</tbody></table></div></section>`;
 }
 const deposits=data.deposits.slice(0,20).map(raw=>{const d=normalizeDeposit(raw);return `<article class='deposit-row'><div class='grow'><strong>${fmt(d.amount)} créditos demo · ${paymentLabels[d.method]}</strong><small>${when(d.createdAt)}${d.method==='card'?` · ${d.installments}x de teste`:''}</small></div><span class='wallet-status ${d.status}'>${depositLabels[d.status]}</span>${btn('deposit-details',d.id,'Detalhes')}</article>`;}).join('');
 const rows=data.transactions.slice(0,40).map(t=>`<tr><td>${when(t.date)}</td><td>${esc(t.label)}</td><td class='${t.amount>=0?'credit-positive':''}'>${t.amount>0?'+':''}${fmt(t.amount)} créditos</td></tr>`).join('');
 return intro('Sua carteira.','Créditos de teste, reservas e movimentações. Sem valor financeiro.')+`<div class='wallet-overview'><div><small>DISPONÍVEIS</small><strong>${fmt(data.balance)} <small>créditos de teste</small></strong><p>Prontos para suas partidas</p></div><div><small>RESERVADOS</small><strong>${fmt(data.reserved)} <small>créditos de teste</small></strong><p>Em convites e partidas</p></div><div><small>RECARGAS PENDENTES</small><strong>${fmt(pending)} <small>créditos de teste</small></strong><p>Aguardando confirmação</p></div></div>${!data.balance?`<p class='hint'>${data.reserved?'Seus créditos estão reservados em partidas.':'Seu saldo está zerado.'} Adicione créditos de teste e confirme a simulação para começar outro desafio.${pending?' Você também pode conferir suas recargas pendentes abaixo.':''}</p>`:''}<div class='between wrap'><button class='btn primary' data-action='deposit'>Adicionar créditos de teste</button><span class='meta'>Ambiente de teste · nenhum dinheiro é cobrado</span></div><section class='wallet-extract'><div class='card-top'><h2>Minhas recargas</h2><button class='text-button' data-action='refresh'>Atualizar</button></div>${deposits||`<div class='card pad'><p class='muted'>Você ainda não fez uma recarga. Escolha cartão, Pix ou transferência para testar.</p></div>`}</section><section class='wallet-extract'><h2>Extrato</h2><div class='card history-table'><table><thead><tr><th>DATA</th><th>MOVIMENTAÇÃO</th><th>CRÉDITOS DE TESTE</th></tr></thead><tbody>${rows||`<tr><td colspan='3'>Nenhuma movimentação.</td></tr>`}</tbody></table></div></section>`;
}
async function showDeposit({amount=100,method='pix',installments=1}={}){
 if(!profile()){pendingIntent='deposit';return showAuth(true);}
 await loadWallet();
 if(online){
  if(!walletData?.paymentsAvailable||walletData.paymentMode!=='pix_manual')return modal('Pix em configuração','A compra de créditos ainda está desativada.',`<p class='hint'>Nenhuma cobrança pode ser iniciada até concluir a configuração.</p><button class='btn secondary wide' data-action='wallet'>Ver minha carteira</button>`);
  const catalog=walletData.catalog||[],selected=catalog.find(pack=>pack.amount===Number(amount))||catalog[0];
  return modal('Comprar créditos via Pix','O crédito só entra depois que a equipe conferir o recebimento.',`<form class='wallet-form' data-form='deposit' data-operation='${crypto.randomUUID()}'><label class='form-label' for='depositAmount'>Pacote</label><select class='form-input' id='depositAmount' name='amount'>${catalog.map(pack=>`<option value='${pack.amount}' ${pack.amount===selected?.amount?'selected':''}>${fmt(pack.amount)} créditos · ${brl(pack.priceCents)}</option>`).join('')}</select><input name='method' type='hidden' value='pix'><input name='installments' type='hidden' value='1'><div class='banner-note'><span>Pix manual para <strong>${esc(walletData.pixRecipientLabel||'a chave informada pelo recebedor')}</strong>. O comprovante serve como apoio; a confirmação é feita no extrato bancário.</span></div><p class='hint'>Créditos comprados não podem ser sacados. Ao continuar, você gera um pedido Pix para sua conta.</p><button class='btn primary wide' type='submit'>Gerar pedido Pix</button></form>`);
 }
 const descriptions={card:'Até 6 parcelas no teste',pix:'Confirmação de teste',transfer:'Comprovante fictício'};
 const methods=['card','pix','transfer'].map(id=>`<button type='button' class='wallet-method ${method===id?'selected':''}' aria-pressed='${method===id}' data-action='payment-method' data-id='${id}'><strong>${paymentLabels[id]}</strong><small>${descriptions[id]}</small></button>`).join('');
 modal('Adicionar créditos de teste','Escolha a quantidade e o método para simular.',`<ol class='wallet-steps'><li class='active'><b>1</b>Escolher</li><li><b>2</b>Confirmar</li><li><b>3</b>Jogar</li></ol><form class='wallet-form' data-form='deposit' data-operation='${crypto.randomUUID()}'><label class='form-label' for='depositAmount'>Quantidade de créditos demo</label><select class='form-input' id='depositAmount' name='amount'>${[100,250,500,1000].map(n=>`<option value='${n}' ${Number(amount)===n?'selected':''}>${fmt(n)} créditos</option>`).join('')}</select><p class='form-label'>Forma de pagamento</p><div class='wallet-methods'>${methods}</div><input id='depositMethod' name='method' type='hidden' value='${method}'>${method==='card'?`<label class='form-label' for='depositInstallments'>Parcelas demonstrativas</label><select class='form-input' id='depositInstallments' name='installments'>${[1,2,3,4,5,6].map(n=>`<option value='${n}' ${Number(installments)===n?'selected':''}>${n===1?'À vista':`${n} parcelas`}</option>`).join('')}</select>`:`<input name='installments' type='hidden' value='1'>`}<p class='hint'>Teste com créditos fictícios, sem cobrança.${method==='card'?' Não informe dados de cartão real.':method==='pix'?' Não é gerada uma chave Pix para pagamento.':' Use um comprovante fictício, sem dados bancários reais.'}</p><button class='btn primary wide' type='submit'>Continuar com ${paymentLabels[method]}</button></form>`);
}
function showDepositDetails(id){
 const d=byDeposit(id),photo=receiptUrl(d);
 if(online){
  const realPix=d.paymentMode==='pix_manual',info=d.paymentInfo;
  const pix=realPix&&info&&['pending','review'].includes(d.status)?`<div class='pix-order'><p><strong>Valor exato</strong><span>${brl(info.amountCents)}</span></p><p><strong>Chave Pix (e-mail)</strong><code>${esc(info.pixKey)}</code></p>${btn('copy-pix',id,'Copiar chave Pix',true)}<p class='meta'>No aplicativo do seu banco, confira o nome do recebedor e o valor antes de pagar.</p></div>`:'';
  const actions=realPix&&['pending','review'].includes(d.status)?`${d.status==='pending'?btn('deposit-proof',id,'Anexar comprovante',true):btn('deposit-proof',id,'Atualizar comprovante')} ${btn('deposit-cancel',id,'Cancelar pedido')}`:'';
  return modal(realPix?'Pedido Pix':'Detalhes da recarga',realPix?`${fmt(d.amount)} créditos · ${brl(d.priceCents)}`:'Recarga de créditos',`<span class='wallet-status ${esc(d.status)}'>${esc(depositLabels[d.status]||'Aguardando atualização')}</span><p class='meta'>Criado em ${when(d.createdAt)}</p>${d.paymentMode==='demo'?`<p class='hint'>Registro antigo de demonstração. Estes créditos não são dinheiro real.</p>`:''}${pix}${photo?`<img class='wallet-proof' src='${esc(photo)}' alt='Comprovante Pix privado, visível somente para sua conta e a equipe'>`:''}<p class='hint'>${realPix?d.status==='approved'?'O recebimento foi conferido pela equipe e os créditos foram liberados.':d.status==='review'?'Comprovante recebido. A equipe ainda precisa conferir a entrada no extrato bancário.':'Faça o Pix exato e anexe o comprovante. O saldo só muda depois da conferência no banco.':d.paymentMode==='demo'?'Este é um registro antigo de demonstração.':'Esta recarga não pode ser alterada por aqui.'}</p>${d.decision?.reason?`<p class='meta'>Decisão: ${esc(d.decision.reason)}</p>`:''}${d.status==='approved'&&realPix?`<p class='meta'>${fmt(d.amount)} créditos comprados · pagamento de ${brl(d.priceCents)}</p>`:''}<div class='duel-actions'>${actions}</div>`);
 }
 const actions=d.status==='pending'?(d.method==='transfer'?btn('deposit-proof',id,'Enviar comprovante',true):btn('deposit-confirm',id,'Simular aprovação',true)+btn('deposit-reject',id,'Simular recusa'))+btn('deposit-cancel',id,'Cancelar recarga'):d.status==='review'&&d.method==='transfer'?btn('deposit-proof',id,'Substituir comprovante')+btn('deposit-cancel',id,'Cancelar recarga'):'';
 modal('Recarga de créditos',`${paymentLabels[d.method]} · ambiente de teste`,`<p class='wallet-value'>${fmt(d.amount)} créditos demo</p><span class='wallet-status ${d.status}'>${depositLabels[d.status]}</span><p class='meta' style='margin-top:12px'>Criada em ${when(d.createdAt)}${d.method==='card'?` · ${d.installments} parcela(s) demonstrativa(s)`:''}</p>${photo?`<img class='wallet-proof' src='${esc(photo)}' alt='Comprovante fictício anexado à recarga'>`:''}<p class='hint'>${d.status==='approved'?'A confirmação de teste adicionou os créditos uma única vez.':d.status==='review'?(online?'A equipe vai conferir o comprovante antes de adicionar os créditos.':'O comprovante está salvo neste navegador. A revisão pela equipe funciona na versão com servidor.'):'O saldo só muda após a confirmação. Esta operação não cobra dinheiro real.'}</p>${d.decision?.reason?`<p class='meta'>Revisão: ${esc(d.decision.reason)}</p>`:''}<div class='duel-actions'>${actions}</div>`);
}
function showDepositProof(id){
 if(online){const d=byDeposit(id);if(d.paymentMode!=='pix_manual'||!['pending','review'].includes(d.status))return modal('Comprovante indisponível','Este pedido não aceita novos comprovantes.',`<button class='btn secondary wide' data-action='wallet'>Ver minha carteira</button>`);return modal('Anexar comprovante Pix','A equipe ainda confirmará o recebimento no extrato bancário.',`<form data-form='deposit-proof' data-id='${esc(id)}' data-version='${d.version}'><label class='form-label' for='receiptImage'>Comprovante da transferência</label><input class='evidence-input' id='receiptImage' name='evidence' type='file' accept='image/jpeg,image/png,image/webp' required><p class='meta'>JPG, PNG ou WebP, até 8 MB. O arquivo fica privado para você e a equipe.</p><div id='receiptPreview' class='wallet-proof' hidden></div><p class='hint'>A imagem não comprova sozinha que o dinheiro caiu. Não envie imagens com dados desnecessários de terceiros.</p><button type='submit' class='btn primary wide' style='margin-top:18px'>Enviar para conferência</button></form>`);}
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
 const rows=items.map((e,i)=>`<tr><td>${i+1}</td><td><div class='row'>${avatar(e.player)}<div><strong>${esc(e.player.nickname)}${e.player.publicPlayerId===profile().publicPlayerId?' · você':''}</strong><small>${esc(e.player.publicPlayerId)}</small></div></div></td><td>${e.played}</td><td>${e.wins}</td><td>${e.draws}</td><td>${e.losses}</td></tr>`).join('');
 const content=items.length?`<div class='history-table'><table><thead><tr><th>POSIÇÃO</th><th>JOGADOR</th><th>JOGOS</th><th>VITÓRIAS</th><th>EMPATES</th><th>DERROTAS</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<h2 style='margin-top:20px'>A primeira vitória ainda está em jogo.</h2><p class='muted'>Partidas em análise aparecem no histórico. Entram no ranking após a revisão.</p>`;
 return intro('Ranking dos jogadores.','Vitórias e empates de partidas revisadas pela equipe.')+`<section class='card pad'><p class='meta'>Ordem: vitórias, depois empates. Apenas jogadores com partidas aprovadas.</p>${content}</section>`;
}
function profileView(){const p=profile();return intro('Seu perfil.','Seu time no avatar e seu ID para encontrar amigos.')+(p?`<section class='card pad'><div class='row'>${avatar(p,'large')}<div><h2>${esc(p.nickname)}</h2><code>${esc(p.publicPlayerId)}</code></div></div><div class='row wrap' style='margin-top:20px'><button class='btn primary' data-action='profile'>Editar perfil</button><button class='btn secondary' data-action='copy-id'>Copiar ID</button><a class='btn secondary' href='#historico'>Ver histórico</a><button class='btn secondary' data-action='login'>${online?'Trocar conta':'Trocar perfil'}</button><button class='btn secondary' data-action='logout'>Sair</button></div>${!online?`<div class='divider'></div><a class='text-button' href='colecao.html#loja'>Abrir minha coleção e personalização</a><p class='meta'>Sua coleção anterior foi preservada neste navegador.</p>`:''}</section>`:`<button class='btn primary' data-action='signup'>Criar conta</button>`);}
async function reviewView(){
 if(!profile()?.isReviewer)return `<div class='card pad'><h1>Revisão restrita à equipe.</h1></div>`;
 const owner=profile().id,[data,wallet]=await Promise.all([API.listReviews(),API.listDepositReviews()]);
 if(profile()?.id!==owner)throw Error('A conta mudou. Abra a revisão novamente.');
 const items=data.duels||data.reviews||[];reviewDuels=items.map(normalize);depositReviews=wallet.deposits||[];
 return intro('Revisão da arena.','Confira os relatos e as fotos para registrar as decisões.')+`<h2 style='margin-bottom:16px'>Partidas e problemas sinalizados</h2><section class='stack'>${items.length?items.map(raw=>{const d=normalize(raw);return `<article class='card pad'><h2>${esc(d.host.nickname)} × ${esc(d.guest.nickname)}</h2><p class='meta'>${d.stake===0?'Amistosa · sem créditos':`${d.stake} ${duelUnit(d)} por jogador`} · ${esc(d.mode)} · ${esc(names[d.status])}</p>${d.result?`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do resultado enviada para revisão'>${reportHistory(d)}`:`<p class='hint'>A partida ainda não tem resultado enviado.</p>`}${issuesContent(d)}${(d.disputes||[]).map(x=>`<p class='hint'>Contestação: ${esc(x.reason)}<img class='review-image' src='${esc(API.evidenceUrl(x.evidenceId))}' alt='Foto da contestação'></p>`).join('')}${d.result?btn('review',d.id,'Revisar resultado da partida',true):''}</article>`;}).join(''):`<div class='card pad'>Nenhuma partida aguardando revisão.</div>`}</section><h2 style='margin:28px 0 16px'>${wallet.realMoney?'Pedidos Pix':'Transferências de teste'}</h2><section class='stack'>${depositReviews.length?depositReviews.map(d=>`<article class='card pad'><h3>${esc(d.owner.nickname)} · ${fmt(d.amount)} créditos${wallet.realMoney?` · ${brl(d.priceCents)}`:''}</h3><p class='meta'>${when(d.createdAt)} · ${wallet.realMoney?'confira o recebimento Pix no extrato bancário antes de decidir':'pedido fictício do ambiente local'}</p><img class='wallet-proof' src='${esc(receiptUrl(d))}' alt='Comprovante privado ${wallet.realMoney?'Pix':'de teste'} enviado pelo jogador'>${btn('deposit-review',d.id,wallet.realMoney?'Conferir Pix':'Revisar transferência',true)}</article>`).join(''):`<div class='card pad'>${wallet.realMoney?'Nenhum Pix aguardando conferência.':'Nenhuma transferência de teste aguardando revisão.'}</div>`}</section>`;
}
let renderRevision=0;
function render(){
 const revision=++renderRevision,hash=location.hash.slice(1);
  if(resultDraft&&resultDraft.owner!==profile()?.id)clearResultDraft();
  const roomMatch=/^partida\/([A-Za-z0-9_-]{1,100})$/.exec(hash);ui.roomId=roomMatch?decodeURIComponent(roomMatch[1]):null;
  ui.view=roomMatch?'sala':({palpites:'historico',amigos:'arena'}[hash]||(['arena','criar','carteira','historico','ranking','perfil','revisao','admin'].includes(hash)?hash:'arena'));
 if(!online||!profile()?.isAdmin)adminPanel?.reset();
 header();runtimeLabels();
 if(serviceUnavailable){$('headerActions').innerHTML='';$('screen').innerHTML=`<section class='card pad connection-unavailable' role='status'><p class='eyebrow'>FIFA GO</p><h1>A arena está temporariamente indisponível.</h1><p class='muted'>Não conseguimos conectar ao servidor de contas e partidas. Tente novamente em instantes.</p><button class='btn primary' data-action='retry'>Tentar novamente</button></section>`;return;}
 if(online&&profile()?.needsOnboarding){$('screen').innerHTML=`<section class='card pad'><h1>Falta só seu perfil.</h1><p class='muted'>Escolha seu apelido, informe seu país e confira os termos antes de criar ou aceitar uma partida.</p><div class='duel-actions'><button class='btn primary' data-action='complete-signup'>Completar cadastro</button><button class='text-button' data-action='logout'>Sair da conta</button></div></section>`;return;}
 const asyncView=ui.view==='admin'?()=>administration().view():ui.view==='revisao'?reviewView:ui.view==='carteira'?walletView:ui.view==='ranking'&&online?sharedRankingView:null;
  $('screen').innerHTML=runtimeCopy(asyncView?(ui.view==='admin'?administration().loading():`<div class='card pad' role='status'>Carregando…</div>`):ui.view==='sala'?roomView():ui.view==='criar'?createView():ui.view==='historico'?historyView():ui.view==='ranking'?rankingView():ui.view==='perfil'?profileView():arenaView());
 if(asyncView)asyncView().then(html=>{if(renderRevision===revision){$('screen').innerHTML=runtimeCopy(html);if(ui.view==='admin')administration().afterRender();}}).catch(e=>{if(renderRevision===revision)$('screen').innerHTML=`<section class='card pad'><h2>Não foi possível carregar.</h2><p>${esc(e.message)}</p><button class='btn secondary' data-action='refresh'>Tentar novamente</button></section>`;});
}
function focusScreen(){ $('screen').focus({preventScroll:true}); }
function go(view){history.replaceState(null,'',new URL('#'+view,location.href).href);closeModal();ui.filter='all';render();focusScreen();window.scrollTo({top:0});}
function accountPitch(){return `<svg class='account-pitch' viewBox='0 0 88 62' fill='none' aria-hidden='true'><rect x='1.5' y='1.5' width='85' height='59' rx='5'/><path d='M44 2v58M2 17h15v28H2m84-28H71v28h15'/><circle cx='44' cy='31' r='10'/><circle class='account-pitch-ball' cx='57' cy='40' r='3'/></svg>`;}
const countryNames=new Intl.DisplayNames(['pt-BR'],{type:'region'});
const countryOptions=selected=>`<option value=''>Selecione seu país</option>${COUNTRY_CODES.map(code=>({code,name:countryNames.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(({code,name})=>`<option value='${code}' ${code===selected?'selected':''}>${esc(name)}</option>`).join('')}`;
function accountFields({signup=false,onboarding=false}={}){
 const completing=signup||onboarding,realSignup=online&&completing;
 return `<div class='account-fields'>
 <div class='account-field'><label class='form-label' for='authNickname'>${completing?'Apelido':'Apelido ou ID Fifa GO'}</label><input class='form-input' id='authNickname' name='nickname' minlength='2' maxlength='20' autocomplete='username' autocapitalize='none' autocorrect='off' spellcheck='false' required placeholder='${completing?'Ex.: Cado10':'Seu apelido ou FBA-…'}' aria-describedby='${completing?'nicknameHelp ':''}authNicknameError'>${completing?`<p class='account-help' id='nicknameHelp'>Visível aos jogadores · de 2 a 20 caracteres.</p>`:''}<p class='account-field-error' id='authNicknameError' role='alert' hidden></p></div>
 ${realSignup?`<div class='account-field'><label class='form-label' for='authCountry'>País de residência</label><select class='form-input' id='authCountry' name='countryCode' autocomplete='country' aria-describedby='authCountryError' required>${countryOptions(onboarding?profile()?.countryCode:null)}</select><p class='account-field-error' id='authCountryError' role='alert' hidden></p></div>`:''}
 ${online&&!onboarding?`<div class='account-field'><label class='form-label' for='authPassword'>Senha</label><div class='account-password'><input class='form-input' id='authPassword' name='password' type='password' minlength='10' maxlength='256' autocomplete='${signup?'new-password':'current-password'}' aria-describedby='${signup?'passwordHelp ':''}authPasswordError' required><button class='account-password-toggle' type='button' data-action='toggle-password' aria-controls='authPassword' aria-label='Mostrar senha' aria-pressed='false'>Mostrar</button></div>${signup?`<p class='account-help' id='passwordHelp'>Use no mínimo 10 caracteres.</p>`:''}<p class='account-field-error' id='authPasswordError' role='alert' hidden></p></div>`:''}
 </div>${realSignup?`<div class='account-consent'><label class='account-consent-label' for='authTerms'><input id='authTerms' type='checkbox' name='acceptedTerms' value='yes' required aria-describedby='authTermsError'><span>Li e aceito os <a href='legal.html#termos' target='_blank' rel='noopener'>Termos de uso</a> das partidas entre amigos e estou ciente da <a href='legal.html#privacidade' target='_blank' rel='noopener'>Política de privacidade</a>.</span></label><p class='account-field-error' id='authTermsError' role='alert' hidden></p></div>`:''}`;
}
function accountSocials(signup){
 if(!online)return '';
 const providers=signup?['google',...(backendStatus?.authProviders?.apple?.available?['apple']:[])]:['google','apple'];
 return `<div class='account-socials'>${providers.map(id=>{const label=id==='google'?'Google':'Apple',available=backendStatus?.authProviders?.[id]?.available;return `<button class='btn secondary social-login-button' data-action='oauth' data-id='${id}' ${available?'':`disabled aria-describedby='${id}LoginHint'`}>Continuar com ${label}</button>${available?'':`<p class='account-help' id='${id}LoginHint'>${id==='google'&&['localhost','127.0.0.1'].includes(location.hostname)?'Google não está conectado neste ambiente.':`Login com ${label} em configuração.`}</p>`}`;}).join('')}</div><div class='auth-divider'><span>${signup?'ou crie com apelido e senha':'ou use sua conta Fifa GO'}</span></div>`;
}
function accountError(form,error){
 const code=error.code||'',field=code==='country_invalid'?'authCountry':['terms_required','terms_updated'].includes(code)?'authTerms':code==='nickname_taken'||(/apelido/.test(error.message)&&error.status===409)?'authNickname':null;
 if(code==='terms_updated'){
  if($('authTerms'))$('authTerms').checked=false;
  error.message='Os termos foram atualizados. Recarregue esta página para ler e aceitar a versão atual.';
 }
 if(field&&$(field)){setAccountFieldError(field,error.message);$(field).focus();}
 else{const feedback=$('dialogError');if(feedback){feedback.textContent=error.message;feedback.hidden=false;feedback.focus();}}
}
function setAccountFieldError(id,message){const input=$(id),feedback=$(id+'Error');input?.setAttribute('aria-invalid','true');if(feedback){feedback.textContent=message;feedback.hidden=false;}}
function validateAccountForm(form){
 for(const field of form.querySelectorAll('input,select')){field.removeAttribute('aria-invalid');const feedback=$(field.id+'Error');if(feedback)feedback.hidden=true;}
 if($('dialogError'))$('dialogError').hidden=true;
 const name=form.elements.nickname.value.trim(),completing=form.dataset.form!=='login';let first=null;
 const invalid=(id,message)=>{setAccountFieldError(id,message);first??=$(id);};
 if(!name||name.length<2||name.length>20||(completing&&!/^[\p{L}\p{N}_ .-]+$/u.test(name)))invalid('authNickname',completing?'Use de 2 a 20 letras, números, espaços, ponto, hífen ou sublinhado.':'Informe seu apelido ou ID Fifa GO.');
 if(form.elements.countryCode&&!COUNTRY_CODES.includes(form.elements.countryCode.value))invalid('authCountry','Selecione seu país de residência.');
 const password=form.elements.password;if(password&&(password.value.length<10||password.value.length>256))invalid('authPassword','Use uma senha de 10 a 256 caracteres.');
 if(form.elements.acceptedTerms&&!form.elements.acceptedTerms.checked)invalid('authTerms','Leia os documentos e marque o aceite para continuar.');
 if(first){first.focus();return false;}return true;
}
function showCompleteSignup(){
 if(!online||!profile()?.needsOnboarding)return;
 modal('Complete seu perfil','Sua conta foi conectada. Escolha como aparecer para os amigos.',`<form data-form='onboarding' data-owner='${esc(profile().id)}' data-terms='${TERMS_VERSION}' class='account-form' novalidate>${accountFields({onboarding:true})}<button class='btn primary wide account-submit' type='submit'>Concluir cadastro e receber meu ID</button><p class='account-zero'>Seu saldo começa em zero.</p></form><button class='text-button account-switch' data-action='logout'>Sair e usar outra conta</button>`,{account:true});
}
function showAuth(signup=false){
 if(serviceUnavailable)return render();
 if(profile()?.needsOnboarding)return showCompleteSignup();
 if(!online&&!signup){const ps=Object.values(state.profiles);return modal('Entrar na arena','Escolha um perfil deste navegador.',`<div class='session-picker'>${ps.length?ps.map(p=>`<button class='btn secondary' data-action='select-profile' data-id='${esc(p.id)}'>${avatar(p)}<span>${esc(p.nickname)}<small>${esc(p.publicPlayerId)}</small></span></button>`).join(''):`<p class='muted'>Crie seu primeiro perfil para começar.</p>`}</div><button class='btn primary wide' data-action='signup' style='margin-top:14px'>Criar outro perfil</button>`);}
 modal(signup?(online?'Crie sua conta Fifa GO':'Crie um perfil de demonstração'):'Entre na arena',online?(signup?'Seu apelido, seu ID e suas partidas entre amigos.':'Use sua conta para voltar às partidas.'):'Este perfil fica somente neste navegador.',`${accountSocials(signup)}<form data-form='${signup?'signup':'login'}' data-terms='${TERMS_VERSION}' class='account-form' novalidate>${accountFields({signup})}<button class='btn primary wide account-submit' type='submit'>${signup?(online?'Criar conta e receber meu ID':'Criar meu perfil local'):'Entrar'}</button>${signup?`<p class='account-zero'>Seu saldo começa em zero.${online&&!backendStatus?.paymentsAvailable?' Pagamentos em configuração.':''}${!online?' Esta demonstração não cria uma conta no servidor.':''}</p>`:''}</form><button class='text-button account-switch' data-action='${signup?'login':'signup'}'>${signup?'Já tenho uma conta · Entrar':'Ainda não tenho uma conta'}</button>`,{account:true});
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
function fileField(){return `<div class='result-photo-picker'><span class='form-label' id='resultPhotoLabel'>Foto do placar final</span><div class='result-photo-actions'><label class='btn secondary' for='resultCamera'>Tirar foto</label><input class='result-file-input' id='resultCamera' type='file' accept='image/jpeg,image/png,image/webp' capture='environment' aria-label='Tirar foto do placar final'><label class='btn secondary' for='resultImage'>Escolher foto</label><input class='result-file-input' id='resultImage' name='evidence' type='file' accept='image/jpeg,image/png,image/webp' required aria-label='Escolher foto do placar final'></div><p class='meta'>Mostre o placar final e os dois lados do jogo. JPG, PNG ou WebP, até 8 MB.</p><p class='meta' id='photoSelection' role='status'>Nenhuma foto selecionada.</p><div id='photoPreview' class='evidence-preview' hidden></div></div>`;}
function showResult(id){const d=byId(id);modal('Partida encerrada','Envie a foto e confira os gols antes de registrar o resultado.',`<form data-form='result' data-id='${esc(id)}' data-owner='${esc(profile()?.id)}' class='match-result-form'>${fileField()}${online?`<div class='result-recognition'><button class='btn secondary' type='button' data-action='recognize' data-id='${esc(id)}' disabled>Ler placar da foto</button><p class='meta'>A leitura pode sugerir os gols. Você confere a foto e identifica os jogadores.</p><div id='recognitionFeedback' role='status' aria-live='polite'></div></div>`:`<p class='meta'>Leitura da foto disponível na versão conectada. Informe os gols abaixo.</p>`}<h3 class='result-score-heading'>Confira os gols de cada jogador</h3><div class='form-grid score-entry'><label for='homeScore'><span class='form-label'>${esc(d.host.nickname)}</span><input id='homeScore' class='form-input' name='homeScore' type='number' inputmode='numeric' min='0' max='99' step='1' required value='${d.result?.homeScore??''}'></label><label for='awayScore'><span class='form-label'>${esc(d.guest.nickname)}</span><input id='awayScore' class='form-input' name='awayScore' type='number' inputmode='numeric' min='0' max='99' step='1' required value='${d.result?.awayScore??''}'></label></div><p class='hint'>${d.stake===0?'Partida amistosa, sem créditos. O resultado será registrado após revisão.':`Os ${duelUnit(d)} ficam reservados até a decisão da equipe. ${d.economics?`Prêmio do vencedor: ${fmt(d.economics.winnerPayout)} créditos. ${d.economics.feeBps?`Taxa da casa: ${fmt(Number(d.economics.feeBps)/100)}%.`:'Condições originais desta partida.'}`:''}`}${online?'':' No modo local, a foto fica neste navegador e não chega à equipe.'}</p><button type='submit' class='btn primary wide'>Enviar placar e foto para revisão</button></form>`);}
function showDetails(id){
  const d=byId(id),incoming=d.status==='invited'&&d.hostId!==profile()?.id,balance=d.creditMode==='legacy_demo'?Number(arena?.user?.demoBalance||arena?.user?.legacyDemoBalance||0):profile()?.balance||0,enough=d.fundingVersion===1||balance>=d.stake;
  if(!incoming||d.fundingVersion===1)return openRoom(id);
 const controls=incoming?(enough?btn('accept',d.id,'Aceitar desafio',true):online?`<button class='btn primary' disabled>Créditos indisponíveis</button>`:btn('deposit',d.id,'Adicionar créditos de teste',true))+btn('decline',d.id,'Recusar'):actions(d).replaceAll(`data-action='details'`,`data-action='close'`);
 modal(incoming?'Confira o convite':'Detalhes da partida',`${d.host.nickname} × ${d.guest.nickname}`,`<span class='pill ${tones[d.status]||'subtle'}'>${esc(resultText(d))}</span><p class='meta' style='margin-top:14px'>Código: ${esc(matchCode(d))}<br>${when(d.createdAt)} · ${esc(d.mode)} · ${esc(({pc:'PC',playstation:'PlayStation',xbox:'Xbox',switch:'Nintendo Switch'})[d.platform]||'PC')}<br>${d.stake===0?'Amistosa · sem créditos':`${fmt(d.stake)} ${duelUnit(d)} por jogador`}</p>${d.rules?`<p class='hint'>Regras: ${esc(d.rules)}</p>`:''}${incoming?`<p class='hint'>${d.stake===0?'Esta partida é amistosa, sem cobrança ou reserva de créditos.':enough?`Ao aceitar, ${fmt(d.stake)} ${duelUnit(d)} serão reservados do seu saldo.`:`Saldo insuficiente: você tem ${fmt(balance)} ${duelUnit(d)} disponíveis.`} O resultado precisa da foto e revisão da equipe.${!online?' Aqui, as fotos ficam neste navegador e não são enviadas à equipe.':''}</p>`:''}${d.result?`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do placar desta partida'>`:!incoming?`<p class='hint'>Resultado ainda não enviado.</p>`:''}${reportHistory(d)}${(d.disputes||[d.dispute].filter(Boolean)).map(x=>`<p class='hint'>Divergência: ${esc(x.reason)}</p>`).join('')}${d.review?`<p class='hint'>Decisão da equipe: ${esc(d.review.reason)}</p>`:''}<div class='duel-actions'>${controls}</div>`);
}
function showDispute(id){modal('Sinalizar divergência','O resultado ficará aguardando análise da equipe.',`<form data-form='dispute' data-id='${esc(id)}' data-report='${esc(byId(id).result?.id)}'><label class='form-label' for='disputeReason'>O que aconteceu?</label><textarea class='form-input' id='disputeReason' name='reason' minlength='10' maxlength='300' required placeholder='Explique a divergência ou a suspeita de fraude.'></textarea>${fileField()}<button class='btn primary wide' style='margin-top:20px' type='submit'>Enviar contestação e foto</button></form>`);}
function showHelp(){modal('Como funciona','Do convite ao resultado revisado.',`<ol class='step-list'><li>Envie seu ID Fifa GO ao amigo ou crie um convite.</li><li>Combine modo, plataforma e regras da partida.</li><li>Compartilhe o código da partida ou o link.</li><li>O amigo aceita pelo próprio perfil.</li><li>Joguem e enviem o placar com uma foto.</li><li>O rival confirma ou sinaliza divergência. O resultado aguarda revisão pela equipe.</li></ol><p class='hint'>${online?(friendlyMode()?'As contas, as fotos e as partidas ficam no servidor. No momento, novas partidas são amistosas e não cobram ou reservam créditos.':'Cada participante reserva a própria parte na sala. O prêmio segue as condições registradas na partida e só é liberado após revisão da equipe.'):'Na publicação estática, o fluxo é local. Crie dois perfis e alterne entre eles para experimentar. Não há envio de fotos à equipe nem revisão real nessa modalidade.'}</p><p class='meta'>${online?(backendStatus?.paymentMode==='demo'?'Créditos de teste, sem valor financeiro.':friendlyMode()?'A compra de créditos está em configuração.':'Créditos comprados não podem ser sacados.'):'Créditos fictícios, sem valor financeiro.'}</p>`);}
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
function currentResultDraft(draft){return resultDraft===draft&&draft.form.isConnected&&profile()?.id===draft.owner&&draft.form.dataset.id===draft.id;}
function setResultPhoto(form,file){
 clearResultDraft();
 const draft={form,id:form.dataset.id,owner:profile()?.id,file,photo:null,evidenceId:null,uploadPromise:null,scores:null};resultDraft=draft;
 draft.photoPromise=preparePhoto(file).then(photo=>{if(!currentResultDraft(draft))throw Error('O envio mudou. Escolha a foto novamente.');draft.photo=photo;return photo;});
 return draft;
}
async function resultPhoto(form){
 let draft=resultDraft;
 if(!draft||draft.form!==form){const file=form.querySelector('#resultImage')?.files[0];if(!file)throw Error('Tire ou escolha uma foto do placar para continuar.');draft=setResultPhoto(form,file);}
 if(!currentResultDraft(draft))throw Error('A conta ou o envio mudou. Reabra o resultado e escolha a foto novamente.');
 await draft.photoPromise;return draft;
}
async function uploadResultPhoto(draft){
 if(!currentResultDraft(draft))throw Error('A conta ou a foto mudou. Reabra o envio.');
 if(draft.evidenceId)return draft.evidenceId;
 if(!draft.uploadPromise)draft.uploadPromise=API.uploadEvidence(draft.photo.blob,draft.id).then(uploaded=>{
  if(!currentResultDraft(draft))throw Error('A conta ou a foto mudou durante o envio. Reabra o resultado.');
  const evidenceId=uploaded.evidenceId||uploaded.evidence?.id||uploaded.id;
  if(typeof evidenceId!=='string'||!evidenceId)throw Error('O servidor não confirmou a foto. Tente enviar novamente.');
  draft.evidenceId=evidenceId;return evidenceId;
 }).catch(error=>{draft.uploadPromise=null;throw error;});
 return draft.uploadPromise;
}
function invalidateRecognition(form){
 if(resultDraft?.form!==form)return;
 resultDraftRevision++;resultDraft.scores=null;
 const feedback=$('recognitionFeedback');if(feedback)feedback.innerHTML=`<p class='meta'>Dados alterados. Confira os gols informados ou leia a foto novamente.</p>`;
}
async function recognizePhoto(id){
 const form=$('modalContent').querySelector("[data-form='result']");
 if(!online||!form||form.dataset.id!==id)throw Error('Reabra o envio do resultado para ler a foto.');
 const draft=await resultPhoto(form),revision=resultDraftRevision,feedback=$('recognitionFeedback'),button=form.querySelector("[data-action='recognize']"),label=button.textContent;
 feedback.innerHTML=`<p class='meta'>Lendo o placar da foto...</p>`;button.textContent='Lendo foto...';button.setAttribute('aria-busy','true');
 try{
  const evidenceId=await uploadResultPhoto(draft);
  if(!currentResultDraft(draft)||revision!==resultDraftRevision)return;
  const response=await API.recognizeResult(id,evidenceId);
  if(!currentResultDraft(draft)||revision!==resultDraftRevision)return;
  const recognition=response.recognition,scores=recognition?.scores;
  if(recognition?.status==='suggested'&&Number.isInteger(scores?.left)&&Number.isInteger(scores?.right)&&scores.left>=0&&scores.left<=99&&scores.right>=0&&scores.right<=99){
   draft.scores={left:scores.left,right:scores.right};const d=byId(id);
   feedback.innerHTML=`<div class='recognition-suggestion'><p><strong>Esquerda: ${scores.left} · Direita: ${scores.right}</strong></p><p class='meta'>Confira se a leitura corresponde ao placar final. A foto não identifica automaticamente os participantes.</p><label class='form-label' for='recognitionLeft'>Quem está à esquerda na foto?</label><select class='form-input' id='recognitionLeft'><option value=''>Escolha o jogador à esquerda</option><option value='host'>${esc(d.host.nickname)}</option><option value='guest'>${esc(d.guest.nickname)}</option></select></div>`;
  }else feedback.innerHTML=`<p class='hint'>${recognition?.status==='unreadable'?'Não foi possível ler os gols com segurança.':'A leitura da foto está indisponível.'} Confira a foto e informe os gols nos campos abaixo.</p>`;
 }catch(error){if(currentResultDraft(draft)&&revision===resultDraftRevision)feedback.innerHTML=`<p class='hint'>A leitura da foto está indisponível. Confira a foto e informe os gols nos campos abaixo.</p>`;}
 finally{if(button.isConnected){button.textContent=label;button.removeAttribute('aria-busy');}}
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
 const enough=d.fundingVersion===1||(d.creditMode==='legacy_demo'?Number(arena?.user?.demoBalance||arena?.user?.legacyDemoBalance||0)>=d.stake:profile().balance>=d.stake);
 modal('Você recebeu um desafio',d.host?.nickname?`${d.host.nickname} te chamou para jogar.`:'Confira a partida antes de aceitar.',`${summary}<p class='meta'>${d.stake===0?'Esta partida é amistosa, sem cobrança ou reserva de créditos.':d.fundingVersion===1?`Ao aceitar, você entra na sala. Depois, cada jogador confirma a reserva de ${fmt(d.stake)} ${duelUnit(d)} da própria conta.`:`Ao aceitar, ${fmt(d.stake)} ${duelUnit(d)} serão reservados.`} O resultado precisa da foto e revisão da equipe.</p>${enough?`<button class='btn primary wide' data-action='accept-invite'>Aceitar e entrar na sala</button>`:`<p class='hint'>Saldo insuficiente para este convite. ${backendStatus?.paymentsAvailable?'Compre créditos via Pix e aguarde a confirmação da equipe.':'A compra de créditos está em configuração.'}</p>${backendStatus?.paymentsAvailable?`<button class='btn primary wide' data-action='deposit'>Comprar créditos via Pix</button>`:`<button class='btn primary wide' disabled>Comprar créditos</button>`}<button class='btn secondary wide' data-action='view-invite'>Conferir convite novamente</button>`}<p class='meta invite-privacy'>Seu saldo, fotos e resultados ficam privados.</p>`);
}
async function execute(action,id){
 if(action==='toggle-password'){const input=$('authPassword'),button=document.querySelector("[data-action='toggle-password']");if(!input||!button)return;const visible=input.type==='password';input.type=visible?'text':'password';button.textContent=visible?'Ocultar':'Mostrar';button.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');button.setAttribute('aria-pressed',String(visible));return;}
 if(action==='complete-signup')return showCompleteSignup();
 if(online&&profile()?.needsOnboarding&&!['logout','close','help','credits'].includes(action))return showCompleteSignup();
 if(action==='close')return closeModal();
 if(action.startsWith('admin-')){if(!online||!profile()?.isAdmin)throw Error('Entre com uma conta administradora para continuar.');return administration().handleAction(action,id);}
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
 if(action==='copy-pix'){const d=byDeposit(id);if(!d.paymentInfo?.pixKey)throw Error('A chave Pix não está disponível neste pedido.');return copy(d.paymentInfo.pixKey,'Chave Pix copiada. Confira o recebedor no seu banco antes de pagar.');}
 if(action==='deposit-review'){
  if(online){const d=byDeposit(id);if(d.paymentMode!=='pix_manual'||!profile()?.isReviewer||d.userId===profile()?.id)throw Error('Este pedido não pode ser revisado por esta conta.');return modal('Conferir recebimento Pix',`${esc(d.owner.nickname)} · ${fmt(d.amount)} créditos · ${brl(d.priceCents)}`,`${d.evidenceId?`<img class='wallet-proof' src='${esc(receiptUrl(d))}' alt='Comprovante privado anexado ao pedido'>`:`<p class='hint'>Nenhum comprovante anexado. Confira o extrato e localize a transferência pelo valor e pelo pagador.</p>`}<p class='hint'><strong>Abra o aplicativo do banco e confirme o crédito recebido no extrato.</strong> Não aprove com base apenas nesta imagem: comprovantes podem ser editados.</p><form data-form='deposit-review' data-id='${esc(id)}' data-version='${d.version}'><label class='form-label' for='depositDecision'>Decisão</label><select class='form-input' id='depositDecision' name='decision' required><option value=''>Escolha uma decisão</option><option value='approve'>Pix confirmado no extrato · liberar créditos</option><option value='reject'>Pix não localizado · recusar pedido</option></select><label class='form-label' for='depositReason'>Nota da revisão</label><textarea class='form-input' id='depositReason' name='reason' minlength='10' maxlength='1000' required placeholder='Ex.: transferência de R$ 25,00 confirmada no extrato em 30/09.'></textarea><p class='hint'>A conta compradora não pode revisar o próprio pedido. A decisão é registrada e o crédito só é liberado uma vez.</p><button class='btn primary wide' type='submit' style='margin-top:16px'>Registrar decisão</button></form>`);}
  const d=byDeposit(id);
  return modal('Revisar transferência de teste',`${d.owner.nickname} · ${fmt(d.amount)} créditos demo`,`<img class='wallet-proof' src='${esc(receiptUrl(d))}' alt='Comprovante atual da transferência'><form data-form='deposit-review' data-id='${esc(id)}' data-version='${d.version}'><label class='form-label' for='depositDecision'>Decisão após conferir o comprovante</label><select class='form-input' id='depositDecision' name='decision' required><option value=''>Escolha uma decisão</option><option value='approve'>Aprovar e adicionar créditos de teste</option><option value='reject'>Recusar transferência</option></select><label class='form-label' for='depositReason'>Justificativa</label><textarea class='form-input' id='depositReason' name='reason' minlength='10' maxlength='1000' required></textarea><p class='hint'>A decisão fica registrada. A aprovação adiciona os créditos uma única vez.</p><button class='btn primary wide' type='submit' style='margin-top:16px'>Registrar decisão</button></form>`);
 }
 if(['deposit-confirm','deposit-reject','deposit-cancel'].includes(action)){
  const d=byDeposit(id);
  if(online){if(action==='deposit-cancel')await API.cancelDeposit(id,d.version);else throw Error('Uma recarga real não pode ser aprovada pelo comprador.');}
  else localChange(action==='deposit-cancel'?'cancelDemoDeposit':action==='deposit-confirm'?'confirmDemoDeposit':'rejectDemoDeposit',{id});
  await refresh();await loadWallet();showDepositDetails(id);return toast(action==='deposit-confirm'?'Créditos de teste adicionados.':action==='deposit-reject'?'Pagamento de teste recusado. O saldo não mudou.':'Pedido cancelado. Nenhum crédito foi liberado.');
 }
 if(action==='profile')return showProfile();
 if(action==='help')return showHelp();
 if(action==='connection')return showConnection();
 if(action==='copy-id')return copy(profile()?.publicPlayerId||'');
 if(action==='stake'){updateDuelDraft({stake:id});$('duelStake').value=id;$('potPreview').textContent=`${fmt(Number(id)*2)} ${creditUnit()}`;return;}
 if(action==='duel-back'||action==='duel-edit'){
  ensureDuelOwner();const next=action==='duel-back'?ui.duelStep-1:Number(id);
  if(!Number.isInteger(next)||next<1||next>=ui.duelStep)throw Error('Volte a uma etapa anterior para editar sua partida.');
  ui.duelStep=next;ui.duelRevision++;ui.duelOperation='';ui.duelError='';render();$('wizardHeading')?.focus();return;
 }
 if(action==='filter'){ui.filter=id;return render();}
 if(action==='details'||action==='accept-preview')return showDetails(id);
 if(action==='room')return openRoom(id);
 if(action==='issue')return showIssue(id);
 if(action==='issue-review')return showIssueReview(id);
 if(action==='recognize')return recognizePhoto(id);
 if(action==='result')return showResult(id);
 if(action==='dispute')return showDispute(id);
 if(action==='select-profile'){save(M.change(read(),'login',{id}));ui.rival='';foundPlayer=null;walletData=null;closeModal();render();return continueIntent();}
 if(action==='logout'){if(online){await API.logoutAccount();arena=null;}else localChange('logout');adminPanel?.reset();walletData=null;pendingIntent=null;closeModal();render();return;}
 if(action==='copy-code')return copy(id,online?'Convite copiado. Pronto para compartilhar.':'Código copiado. Use no perfil convidado deste navegador.');
 if(action==='refresh'){await refresh();return toast('Arena atualizada.');}
 if(action==='retry')return start();
 if(action==='credits')return modal('Créditos das imagens','Ilustração da entrada, uniformes e figurinhas.',`<a class='btn secondary wide' href='https://github.com/djowww/fifabet-arena/blob/main/THIRD_PARTY_NOTICES.md' target='_blank' rel='noopener noreferrer'>Abrir créditos e fontes</a>`);
 if(action==='find'){updateDuelDraft({rival:$('rivalId').value.trim().toUpperCase()});if(!ui.rival)throw Error('Informe o ID do amigo para conferir ou continue para criar um convite por link.');const other=await validateDuelDraft();$('rivalPreview').textContent=`Jogador encontrado: ${other.nickname} · ${other.publicPlayerId}`;return;}
 if(action==='accept-invite'){
  if(!profile())return showAuth(true);
  if(!invite||invite.owner!==profile().id)return showInvite();
  let accepted;const code=invite.code;
  try{accepted=invite.code?await API.acceptInviteCode(invite.code):await API.acceptInvite(invite.token);}catch(e){if(inviteErrors[e.code])return inviteNotice(inviteErrors[e.code]);throw e;}
  invite=null;ui.joinCode='';history.replaceState(null,'',location.pathname+'#arena');closeModal();await refresh();const joined=accepted.duel||accepted,id=joined.id||duels().find(d=>matchCode(d)===code)?.id;if(id)openRoom(id);return toast('Convite aceito. Você entrou na sala.');
 }
 const d=byId(id);
 if(action==='share'||action==='share-native'){
  if(!online||d.status!=='invited'||d.hostId!==profile()?.id||!d.inviteToken)throw Error('Este convite não está disponível para compartilhar.');
  const url=inviteLink(d);
  if(action==='share-native'&&navigator.share)try{await navigator.share({title:'Convite Fifa GO',text:'Joga aí! Confira este desafio no Fifa GO.',url});return toast('Convite compartilhado.');}catch(e){if(e.name==='AbortError')return;}
  return copy(url,'Link do convite copiado. Pronto para compartilhar.');
 }
 if(action==='review'){return modal('Decisão da equipe',`${d.host.nickname} × ${d.guest.nickname}`,`<p class='score-pair'>${score(d)}</p><img class='review-image' src='${esc(photoUrl(d.result))}' alt='Foto do resultado atual para revisão'>${reportHistory(d)}${economicsContent(d)}${issuesContent(d)}<form data-form='review' data-id='${esc(id)}' data-report='${esc(d.result.id)}'><label class='form-label' for='reviewWinner'>Resultado validado</label><select class='form-input' id='reviewWinner' name='winner' required><option value=''>Escolha o resultado conferido</option><option value='host'>${esc(d.host.nickname)} venceu</option><option value='guest'>${esc(d.guest.nickname)} venceu</option><option value='draw'>Empate</option></select><label class='form-label' for='reviewReason'>Justificativa da revisão</label><textarea id='reviewReason' class='form-input' name='reason' minlength='10' maxlength='300' required></textarea><p class='hint'>${d.stake===0?'A decisão registrará o resultado desta amistosa.':'A decisão será registrada e os créditos serão distribuídos uma única vez.'}</p><button class='btn primary wide' type='submit'>${d.stake===0?'Aprovar resultado':'Aprovar resultado e distribuir créditos'}</button></form>`);}
 if(action==='accept'){if(online)await API.acceptDuel(id);else localChange('acceptDuel',{id});}
 else if(action==='decline'){if(online)await API.cancelDuel(id);else localChange('rejectDuel',{id});}
 else if(action==='cancel'){if(online)await API.cancelDuel(id);else localChange(d.status==='invited'?'cancelDuel':d.cancelRequestedBy&&d.cancelRequestedBy!==profile().id?'confirmDuelCancel':'requestDuelCancel',{id});}
 else if(action==='withdraw-cancel'){if(online)await API.withdrawCancellation(id);else localChange('withdrawDuelCancel',{id});}
 else if(action==='confirm'){if(online)await API.confirmResult(id,d.result.id);else localChange('confirmDuelResult',{id,reportId:d.result.id});}
 else return;
 closeModal();await refresh();if(action==='accept')openRoom(id);toast(action==='confirm'?'Placar confirmado. O resultado aguarda revisão pela equipe.':action==='accept'?'Convite aceito. Você entrou na sala.':'Desafio atualizado.');
}
document.addEventListener('click',async event=>{
 if(event.target.closest('.skip-link')){event.preventDefault();$('screen').focus();return;}
 const button=event.target.closest('[data-action]');if(!button||busy)return;
 try{busy=true;button.disabled=true;await execute(button.dataset.action,button.dataset.id);}catch(e){fail(e.message);}finally{busy=false;if(button.isConnected)button.disabled=false;}
});
document.addEventListener('input',event=>{
 const t=event.target;
 if(t.closest('.account-form')){t.removeAttribute('aria-invalid');const feedback=$(t.id+'Error');if(feedback)feedback.hidden=true;if($('dialogError'))$('dialogError').hidden=true;}
 adminPanel?.handleInput(t);
 if(t.id==='joinCode'||t.id==='dialogJoinCode'){ui.joinCode=t.value;if($('joinError'))$('joinError').hidden=true;}
 if(t.id==='duelStake'){updateDuelDraft({stake:t.value});$('potPreview').textContent=`${fmt(Number(t.value||0)*2)} ${creditUnit()}`;}
 if(['homeScore','awayScore','disputeReason'].includes(t.id))invalidateRecognition(t.closest('[data-form]'));
 if(t.id==='rivalId'){updateDuelDraft({rival:t.value});if($('rivalPreview'))$('rivalPreview').textContent=online?'Com o ID, só esse jogador aceita. Sem ID, você compartilha um convite.':'';}
 if(t.id==='duelRules')updateDuelDraft({rules:t.value});
 if(t.id==='historySearch'){ui.search=t.value;const cursor=t.selectionStart;render();$('historySearch').focus();$('historySearch').setSelectionRange(cursor,cursor);}
});
document.addEventListener('change',async event=>{
 const t=event.target;if(t.closest('.account-form')){t.removeAttribute('aria-invalid');const feedback=$(t.id+'Error');if(feedback)feedback.hidden=true;}if(t.id==='gameMode')updateDuelDraft({mode:t.value});if(t.id==='gamePlatform')updateDuelDraft({platform:t.value});if(t.id==='rivalId')updateDuelDraft({rival:t.value});
 if(t.id==='historyStatus'){ui.filter=t.value;render();$('historyStatus').focus();}
 if(t.id==='profileClub')$('clubPreview').innerHTML=avatar({...profile(),clubId:t.value,avatarSticker:null,teamName:''},'large');
 if(t.id==='recognitionLeft'){
  const draft=resultDraft,scores=draft?.scores;if(!draft||!currentResultDraft(draft)||!scores)return;
  if(!['host','guest'].includes(t.value))return;
  resultDraftRevision++;$('homeScore').value=t.value==='host'?scores.left:scores.right;$('awayScore').value=t.value==='host'?scores.right:scores.left;
  $('recognitionApplied')?.remove();const confirmation=document.createElement('p');confirmation.id='recognitionApplied';confirmation.className='meta';confirmation.textContent='Sugestão preenchida. Confira os gols com a foto antes de enviar.';$('recognitionFeedback').append(confirmation);$('homeScore').focus();
 }
 if(t.id==='resultImage'||t.id==='resultCamera'){
  const file=t.files[0],form=t.closest('[data-form]');if(!file||!form)return;
  const draft=setResultPhoto(form,file),preview=$('photoPreview'),feedback=$('recognitionFeedback'),recognize=form.querySelector("[data-action='recognize']");
  if(recognize)recognize.disabled=true;if(feedback)feedback.innerHTML='';preview.hidden=true;$('photoSelection').textContent='Preparando foto...';
  try{const photo=await draft.photoPromise;if(currentResultDraft(draft)){preview.innerHTML=`<img src='${photo.dataUrl}' alt='Prévia da foto do placar selecionada'>`;preview.hidden=false;$('photoSelection').textContent=`Foto selecionada: ${file.name}`;$('resultImage').required=false;if(recognize)recognize.disabled=false;}}
  catch(e){if(currentResultDraft(draft)){$('resultImage').required=true;$('photoSelection').textContent='Escolha outra foto do placar.';fail(e.message);}}
 }
 if(t.id==='receiptImage')try{const photo=await preparePhoto(t.files[0]),preview=$('receiptPreview');if(t.isConnected&&preview){preview.innerHTML=`<img src='${photo.dataUrl}' alt='Prévia da imagem enviada'>`;preview.hidden=false;}}catch(e){fail(e.message);}
});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();if(busy)return;
 const data=new FormData(form),kind=form.dataset.form,submit=form.querySelector('[type=submit]'),profileId=profile()?.id,submitLabel=submit?.textContent;
 if(['signup','login','onboarding'].includes(kind)&&!validateAccountForm(form))return;
 try{
 busy=true;if(submit)submit.disabled=true;
 if(serviceUnavailable)throw Error('A conexão com a arena está indisponível. Tente novamente em instantes.');
 if(['signup','login','onboarding'].includes(kind)){
  if(submit){submit.textContent=kind==='signup'?'Criando conta…':kind==='onboarding'?'Concluindo cadastro…':'Entrando…';submit.setAttribute?.('aria-busy','true');}
  if(online){
   const details={nickname:data.get('nickname').trim(),countryCode:data.get('countryCode'),acceptedTerms:data.get('acceptedTerms')==='yes',termsVersion:form.dataset.terms};
   if(kind==='signup')await API.registerAccount({...details,password:data.get('password')});
   else if(kind==='onboarding'){
    if(form.dataset.owner!==profileId)throw Error('A conta mudou. Abra o cadastro novamente.');
    try{await API.completeAccountSignup(details);}catch(error){if(error.code!=='onboarding_complete')throw error;await API.loadSession();const latest=await API.getArena();if(latest.user?.id!==profileId||latest.user.needsOnboarding)throw error;arena=latest;}
   }else await API.loginAccount({nickname:data.get('nickname'),password:data.get('password')});
   arena=await API.getArena();
  }
  else save(M.change(read(),'create',{nickname:data.get('nickname')}));
  ui.rival='';foundPlayer=null;walletData=null;adminPanel?.reset();closeModal();if(online&&profile()?.needsOnboarding){render();return showCompleteSignup();}if(online&&profile()?.isAdmin)go('admin');else render();window.scrollTo({top:0});await continueIntent();return toast(kind==='login'?'Você entrou na arena.':'Seu ID Fifa GO está pronto.');
 }
 if(kind==='join'){
  return await findInvitation(data.get('code'));
 }
 if(!profile()||profile().id!==profileId)throw Error('Entre na sua conta para continuar.');
 if(kind.startsWith('admin-')){if(!online||!profile()?.isAdmin)throw Error('Entre com uma conta administradora para continuar.');await administration().handleForm(form,data);return;}
 if(kind==='deposit'){
  const payload={amount:Number(data.get('amount')),method:data.get('method'),installments:Number(data.get('installments')),idempotencyKey:form.dataset.operation};let id;
  if(online){if(!walletData?.paymentsAvailable||walletData.paymentMode!=='pix_manual')throw Error('Pagamentos em configuração. Nenhuma cobrança está disponível.');const created=await API.createDeposit(payload);id=(created.deposit||created).id;}
  else{localChange('createDemoDeposit',{...payload,operationId:payload.idempotencyKey});id=profile().depositRequests.find(d=>d.operationId===payload.idempotencyKey).id;}
  closeModal();await refresh();await loadWallet();go('carteira');showDepositDetails(id);return toast(online?'Pedido Pix criado. O saldo aguarda conferência no banco.':'Recarga de teste criada. O saldo aguarda confirmação.');
 }
 if(kind==='deposit-proof'){
  const id=form.dataset.id,version=Number(form.dataset.version),photo=await preparePhoto(data.get('evidence'));
  if(profile()?.id!==profileId)throw Error('A conta mudou. Reabra o envio.');
  if(online)await API.uploadDepositProof(photo.blob,id,version);
  else localChange('attachDemoReceipt',{id,evidenceDataUrl:photo.dataUrl,evidenceName:'comprovante.jpg'});
  closeModal();await refresh();await loadWallet();go('carteira');showDepositDetails(id);return toast(online?'Comprovante recebido. Ainda falta confirmar o Pix no banco.':'Comprovante em análise. Nenhum crédito foi liberado.');
 }
 if(kind==='deposit-review'){
  if(online){await API.reviewDeposit(form.dataset.id,{decision:data.get('decision'),reason:data.get('reason'),version:Number(form.dataset.version)});closeModal();walletData=null;await refresh();return toast(data.get('decision')==='approve'?'Pix confirmado. Créditos liberados.':'Pedido Pix recusado. Nenhum crédito foi liberado.');}
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
  openRoom(d.id);
  if(d.status!=='invited'){showDetails(d.id);return toast('A partida já foi criada. Confira o andamento.');}
  const shareable=online&&d.inviteToken,code=matchCode(d);
  modal('Partida criada','Envie o código ou o link ao seu amigo.',`<span class='pill amber'>Convite pendente</span><label class='form-label' for='shareCode'>Código da partida</label><input id='shareCode' class='form-input match-public-code' value='${esc(code)}' readonly>${btn('copy-code',code,'Copiar código',true)}<p class='meta'>Seu amigo pode digitar este código no Fifa GO pelo celular, mesmo jogando no PlayStation ou Xbox.</p>${shareable?`<label class='form-label' for='shareInvite'>Link do convite</label><input id='shareInvite' class='form-input' value='${esc(inviteLink(d))}' readonly><div class='duel-actions'>${btn('copy-code',inviteLink(d),'Copiar link')}${btn('share-native',d.id,'Compartilhar')}</div>`:''}<p class='hint'>${shareable?'O amigo confere as regras e aceita pelo próprio perfil. O link não expõe saldo, fotos ou resultados.':'Este código funciona entre perfis neste navegador. Para jogar entre aparelhos, é necessária a versão conectada.'}</p>`);
  return toast(d.stake===0?'Convite de amistosa criado. Nenhum crédito foi reservado.':online?'Convite enviado. Cada jogador reserva a própria parte na sala.':'Convite enviado. Seus créditos de teste ficaram reservados.');
 }
 else if(kind==='fund'){
  const d=byId(form.dataset.id),stake=Number(form.dataset.stake);
  if(!online||d.fundingVersion!==1||d.status!=='awaiting_funds'||form.dataset.owner!==profileId||d.stake!==stake)throw Error('A sala mudou. Atualize e confira sua parte antes de reservar.');
  await API.fundDuel(d.id,stake);await refresh();return toast('Sua parte foi reservada. Confira o andamento da sala.');
 }
 else if(kind==='issue'){
  if(!online||form.dataset.owner!==profileId)throw Error('A conta mudou. Reabra o relato.');
  await API.reportDuelIssue(form.dataset.id,String(data.get('reason')||''));
 }
 else if(kind==='issue-review'){
  if(!online||!profile()?.isReviewer||form.dataset.owner!==profileId)throw Error('A conta mudou. Reabra a revisão.');
  await API.reviewIssue(form.dataset.id,form.dataset.issue,{decision:data.get('decision'),reason:data.get('reason'),reportId:form.dataset.report||null});
 }
 else if(kind==='result'||kind==='dispute'){
  const revision=resultDraftRevision,draft=await resultPhoto(form),photo=draft.photo,id=form.dataset.id;
  if(profile()?.id!==profileId||!currentResultDraft(draft)||revision!==resultDraftRevision)throw Error('O envio mudou. Confira a foto e os dados antes de enviar novamente.');
  const payload={homeScore:Number(data.get('homeScore')),awayScore:Number(data.get('awayScore'))};
  if(kind==='result'&&(!Number.isInteger(payload.homeScore)||!Number.isInteger(payload.awayScore)||payload.homeScore<0||payload.homeScore>99||payload.awayScore<0||payload.awayScore>99))throw Error('Informe os gols de cada jogador, de 0 a 99.');
  if(online){const evidenceId=await uploadResultPhoto(draft);if(profile()?.id!==profileId||!currentResultDraft(draft)||revision!==resultDraftRevision)throw Error('O envio mudou. Confira os dados e envie novamente.');if(kind==='result')await API.submitResult(id,{...payload,evidenceId});else await API.disputeResult(id,{reportId:form.dataset.report,reason:data.get('reason'),evidenceId});}
  else localChange(kind==='result'?'submitDuelResult':'disputeDuelResult',{id,reportId:form.dataset.report,evidenceDataUrl:photo.dataUrl,evidenceName:photo.name,reason:data.get('reason'),...payload});
 }
 else if(kind==='review')await API.reviewDuel(form.dataset.id,{reportId:form.dataset.report,winner:data.get('winner'),reason:data.get('reason')});
 closeModal();await refresh();toast(kind==='result'?'Placar e foto enviados. Aguardando revisão.':kind==='dispute'?'Contestação enviada. O resultado aguarda revisão.':kind==='issue'?'Problema registrado para a equipe. A partida continua em andamento.':kind==='issue-review'?'Decisão sobre o problema registrada.':kind==='review'?'Resultado revisado e registrado.':'Perfil atualizado.');
 }catch(e){if(['signup','login','onboarding'].includes(kind))accountError(form,e);else if(kind==='duel'){ui.duelError=e.message;const error=$('composerError');if(error){error.textContent=e.message;error.hidden=false;}toast(e.message);}else if(kind==='join')joinFeedback(e.message);else fail(e.message);}finally{busy=false;if(submit?.isConnected){submit.disabled=false;if(submitLabel!==undefined)submit.textContent=submitLabel;submit.removeAttribute?.('aria-busy');}}
});
$('modal').addEventListener('cancel',event=>{event.preventDefault();closeModal();});
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
window.addEventListener('hashchange',()=>{closeModal();ui.filter='all';render();focusScreen();window.scrollTo({top:0});});
window.addEventListener('storage',event=>{if(!online&&event.key===M.STORAGE_KEY){state=read();closeModal();render();}});
window.addEventListener('focus',()=>{if(online&&!busy&&!$('modal').open)refresh().catch(()=>{});});
let roomPollRunning=false;
setInterval(async()=>{
 const active=document.activeElement;
 if(roomPollRunning||!online||!profile()||ui.view!=='sala'||busy||document.hidden||$('modal').open||($('screen').contains(active)&&active.matches('input,select,textarea,[contenteditable]')))return;
 const owner=profile().id,room=ui.roomId,revision=renderRevision,action=active?.dataset.action,actionId=active?.dataset.id;roomPollRunning=true;
 try{const latest=await API.getArena();if(profile()?.id===owner&&latest.user?.id===owner&&ui.view==='sala'&&ui.roomId===room&&renderRevision===revision&&!busy&&!$('modal').open&&!document.hidden){arena=latest;render();if(action){const control=[...$('screen').querySelectorAll('[data-action]')].find(x=>x.dataset.action===action&&x.dataset.id===actionId);control?.focus({preventScroll:true});}}}catch{}finally{roomPollRunning=false;}
},8000);
async function start(){
 serviceUnavailable=false;backendStatus=await API.detectBackend();online=!!backendStatus;
 if(!online&&productionHost()){serviceUnavailable=true;arena=null;closeModal();render();return;}
 if(online){const session=await API.loadSession();arena=session.user?await API.getArena():null;}else save();
 const url=new URL(location.href),auth=url.searchParams.get('auth'),authError=url.searchParams.get('auth_error'),token=url.searchParams.get('convite');
 if(auth||authError)restoreAuthIntent();
 if(auth||authError||token){url.searchParams.delete('auth');url.searchParams.delete('auth_error');url.searchParams.delete('convite');history.replaceState(null,'',url.href);}
 if(online&&profile()?.isAdmin&&(auth==='success'||!location.hash||location.hash==='#arena'))history.replaceState(null,'',location.pathname+'#admin');
 render();if(auth==='success'&&profile())toast(profile().isAdmin?'Bem-vindo, administrador.':'Você entrou na arena.');else if(authError)toast(authErrors[authError]||'Não foi possível concluir o login. Use sua conta Fifa GO ou tente novamente.');
 if(token&&online)invite={token};
 if(online&&profile()?.needsOnboarding)return showCompleteSignup();
 if(invite&&online)await showInvite();
 else if(token)inviteNotice('Este convite precisa da versão conectada. Nesta demonstração, use um código entre perfis neste navegador.');
}
start().catch(e=>{if(productionHost()){serviceUnavailable=true;arena=null;render();}else $('screen').innerHTML=`<section class='card pad'><h1>A arena não conseguiu iniciar.</h1><p>${esc(e.message)}</p><button class='btn primary' data-action='retry'>Tentar novamente</button></section>`;});
