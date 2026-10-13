import test from 'node:test';
import assert from 'node:assert/strict';
import * as views from './account-views.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const c={user:{id:'h',nickname:'Host',publicPlayerId:'FG-HOST'},online:true,esc,fmt:String,when:value=>`DATA ${value}`,brl:String,avatar:()=>'',btn:(action,id,label)=>`<button data-action='${action}' data-id='${esc(id)}'>${label}</button>`,intro:()=>'',empty:(_icon,title,description)=>`${title} ${description}`,guest:()=> 'Entre na conta',legacyDemoView:()=>''};
const wallet={balance:0,reserved:0,deposits:[],transactions:[],paymentMode:'unconfigured'};

test('wallet uses all pending deposits returned by server even when the current page is empty',()=>{
 const html=views.renderWalletView({...c,wallet:{...wallet,pendingDepositAmount:875,depositsNextCursor:'next'}});
 assert.match(html,/Recargas pendentes<\/span><strong>875<\/strong>/);
});
test('local wallet calculates demo pending amounts when no server aggregate is present',()=>{
 const html=views.renderWalletView({...c,online:false,wallet:{...wallet,deposits:[{id:'a',status:'review',amount:125,paymentMode:'demo',method:'pix'}]}});
 assert.match(html,/Recargas pendentes<\/span><strong>125<\/strong>/);
});
test('server aggregate zero stays zero despite a stale pending deposit page',()=>{
 const html=views.renderWalletView({...c,wallet:{...wallet,pendingDepositAmount:0,deposits:[{id:'a',status:'review',amount:125,paymentMode:'pix_manual',method:'pix'}]}});
 assert.match(html,/Recargas pendentes<\/span><strong>0<\/strong>/);
});
test('ranking explains Elo in Portuguese and renders only returned account evolution',()=>{
 const html=views.renderRankingView({...c,entries:[{player:c.user,rating:1012,points:3,played:1,wins:1,draws:0,losses:0}],ownId:c.user.publicPlayerId,policy:{},personal:{rank:1,rating:1012,points:3,played:1,wins:1,recent:[{publicMatchId:'FG-REAL',approvedAt:'2026-10-01',rating:1012,change:12,outcome:'win'},{publicMatchId:'<script>',approvedAt:'2026-10-02',rating:1000,change:-12,outcome:'loss'}]}});
 assert.match(html,/Pontuação de habilidade \(Elo\)/);
 assert.match(html,/Evolução/);assert.match(html,/FG-REAL/);assert.match(html,/\+12/);assert.match(html,/-12/);
 assert.match(html,/Vitória/);assert.match(html,/Derrota/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|Rating/);
});
test('ranking without recent server results does not invent an evolution chart or matches',()=>{
 const html=views.renderRankingView({...c,personal:{rank:null,rating:1000,points:0,played:0,wins:0},entries:[]});
 assert.doesNotMatch(html,/FG-REAL|Evolução das partidas/);
});
test('connected profile offers private security, optional notices and deletion request controls',()=>{
 const html=views.renderProfileView(c);
 for(const action of ['security','notifications','delete-account'])assert.match(html,new RegExp(`data-action='${action}'`));
 assert.match(html,/sessões|Sessões/);assert.match(html,/recuperação/);assert.match(html,/aberto|aberta/);assert.match(html,/pendentes|financeiros/);
});
test('anonymous and local profile never offer connected security or claim browser notices keep working after close',()=>{
 const anonymous=views.renderProfileView({...c,user:null}),local=views.renderProfileView({...c,online:false});
 assert.equal(anonymous,'Entre na conta');assert.doesNotMatch(local,/data-action='security'|data-action='delete-account'/);
 assert.doesNotMatch(local,/avisos.*fechado/i);
});
test('profile achievements come from validated server results and escape supplied titles',()=>{
 const html=views.renderProfileView({...c,achievements:[{id:'first-win',title:'<b>Primeira vitória</b>',description:'Um resultado validado pela equipe.',earnedAt:'2026-10-01'}]});
 assert.match(html,/Conquistas/);assert.match(html,/&lt;b&gt;Primeira vitória&lt;\/b&gt;/);assert.match(html,/DATA 2026-10-01/);assert.match(html,/achievement-icon/);
 assert.doesNotMatch(html,/comprar|pacotes|raridade|<b>Primeira vitória/);
 const local=views.renderProfileView({...c,online:false,achievements:[{id:'first-win',title:'SERVER ONLY',earnedAt:'2026-10-01'}]});assert.doesNotMatch(local,/SERVER ONLY/);
});

test('wallet shows server credit recovery after confirmation without exposing bank metadata',()=>{
 const html=views.renderWalletView({...c,wallet:{...wallet,deposits:[{id:'recovered',status:'approved',paymentMode:'pix_manual',method:'pix',amount:100,createdAt:'2026-10-01',recovery:{outcome:'credit',date:'2026-10-03',bankReference:'BANK-PRIVATE',actorId:'REVIEWER-PRIVATE'}}]}});
 assert.match(html,/Saldo adicionado/);assert.match(html,/Recuperação.*saldo adicionado|Saldo recuperado/i);assert.match(html,/DATA 2026-10-03/);
 assert.doesNotMatch(html,/BANK-PRIVATE|REVIEWER-PRIVATE/);
});

test('wallet distinguishes recorded refund recovery from credited balance',()=>{
 for(const status of ['cancelled','rejected']){
 const html=views.renderWalletView({...c,wallet:{...wallet,deposits:[{id:'refund',status,paymentMode:'pix_manual',method:'pix',amount:100,createdAt:'2026-10-01',recovery:{outcome:'refund_recorded',date:'2026-10-03',bankReference:'BANK-PRIVATE'}}]}});
 assert.match(html,status==='cancelled'?/Cancelado/:/Recusado/);assert.match(html,/Devolução registrada/);assert.match(html,/saldo não foi adicionado|Nenhum saldo adicionado/i);assert.match(html,/DATA 2026-10-03/);
 assert.doesNotMatch(html,/Saldo recuperado|BANK-PRIVATE/);
 }
});

test('wallet links reservations and ledger only to real participant-owned rooms',()=>{
 const own={id:'room-a',publicMatchId:'FG-REAL',hostId:'h',guestId:'g',stake:100,status:'active',fundedBy:['h','g']};
 const foreign={...own,id:'foreign-room',publicMatchId:'FG-FOREIGN',hostId:'other',guestId:'else'};
 const html=views.renderWalletView({...c,duels:[own,foreign],wallet:{...wallet,reserved:100,transactions:[{date:'2026-10-01',label:'Reserva',amount:-100,duelId:own.id,publicMatchId:own.publicMatchId,source:'duel_reserve'},{date:'2026-10-01',label:'Não disponível',amount:-100,duelId:foreign.id,publicMatchId:foreign.publicMatchId},{date:'2026-10-01',label:'Registro antigo',amount:20,duelId:'missing-room',publicMatchId:'FG-MISSING'}]}});
 assert.match(html,/data-action='room' data-id='room-a'/);
 assert.match(html,/Partida em andamento/);
 assert.match(html,/liberados depois da validação|reservados até o resultado/i);
 assert.doesNotMatch(html,/data-id='foreign-room'|data-id='missing-room'/);
 assert.match(html,/FG-FOREIGN/);assert.match(html,/FG-MISSING/);
});

test('wallet reservation shortcuts require an actually reserved owned room and keep server totals',()=>{
 const html=views.renderWalletView({...c,duels:[{id:'free',hostId:'h',guestId:'g',stake:0,status:'active'},{id:'awaiting',hostId:'h',guestId:'g',stake:200,status:'awaiting_funds',fundedBy:['g']}],wallet:{...wallet,reserved:875}});
 assert.match(html,/Reservados em partidas<\/span><strong>875<\/strong>/);
 assert.doesNotMatch(html,/data-action='room'/);
 const empty=views.renderWalletView({...c,wallet:{...wallet,reserved:50}});
 assert.doesNotMatch(empty,/data-action='room'/);
});

test('multiple wallet reservations open the personal arena and never recalculate the aggregate',()=>{
 const rooms=[{id:'a',hostId:'h',guestId:'g',stake:100,status:'preparing',fundedBy:['h','g']},{id:'b',hostId:'g',guestId:'h',stake:250,status:'review',fundedBy:['h','g']}];
 const html=views.renderWalletView({...c,duels:rooms,wallet:{...wallet,reserved:875}});
 assert.match(html,/data-action='my-reservations'>Ver minhas salas com reserva/);
 assert.match(html,/Reservados em partidas<\/span><strong>875<\/strong>/);
 assert.doesNotMatch(html,/data-action='room'/);
});

test('wallet links older ledger public references only when a matching owned room is loaded',()=>{
 const rooms=[{id:'a',publicMatchId:'FG-REAL',hostId:'h',guestId:'g',stake:100,status:'settled'}];
 const html=views.renderWalletView({...c,duels:rooms,wallet:{...wallet,transactions:[{label:'Prêmio',amount:182,publicMatchId:'FG-REAL'},{label:'Referência divergente',amount:50,duelId:'a',publicMatchId:'FG-OTHER'}]}});
 assert.equal([...html.matchAll(/data-action='room' data-id='a'/g)].length,1);
 assert.match(html,/FG-OTHER/);
});

test('history offers a new-match action only for completed participant games with a real rival ID',()=>{
 const games=[{id:'done',hostId:'h',guestId:'g',guest:{id:'g',nickname:'Guest',publicPlayerId:'FBA-12345678'},status:'settled',createdAt:'2026-10-01',mode:'1v1'}, {id:'review',hostId:'h',guestId:'g',guest:{id:'g',publicPlayerId:'FBA-12345678'},status:'review',createdAt:'2026-10-01'}, {id:'unknown',hostId:'h',guestId:'g',guest:{id:'g'},status:'settled',createdAt:'2026-10-01'}, {id:'foreign',hostId:'other',guestId:'g',guest:{id:'g',publicPlayerId:'FBA-12345678'},status:'settled',createdAt:'2026-10-01'}];
 const html=views.renderHistoryView({...c,duels:games,opponent:d=>d.guest,matchCode:d=>d.id,playerScore:()=> '1 × 0',resultText:()=> 'Finalizada',duelUnit:()=> 'Coin',tones:{},btn:(action,id,label)=>`<button data-action='${action}' data-id='${id}'>${label}</button>`});
 assert.match(html,/data-action='rematch' data-id='done'>Jogar novamente/);
 assert.doesNotMatch(html,/data-action='rematch' data-id='(?:review|unknown|foreign)'/);
});

test('empty ranking presents personal stats first and one create action',()=>{
 const empty=(_icon,title,description,actions='')=>`<section>${title} ${description}${actions}</section>`;
 const html=views.renderRankingView({...c,empty,entries:[],personal:{rank:null,rating:1000,points:0,played:0,wins:0}});
 assert.equal([...html.matchAll(/data-action='create'/g)].length,1);
 assert.ok(html.indexOf('Sua posição')<html.indexOf('A primeira vitória'));
});

test('profile avoids duplicate identity facts, exposes copy actions only for declared game IDs and groups advanced controls',()=>{
 const html=views.renderProfileView({...c,country:'Brasil',club:{name:'Internacional'},user:{...c.user,gameAccount:{eaId:'EA<&>',psnId:'ConsoleUser',xboxId:'XboxUser',gameEdition:'FC26'}}});
 for(const key of ['eaId','psnId','xboxId'])assert.match(html,new RegExp(`data-action='copy-game-id' data-id='${key}'`));
 assert.match(html,/EA&lt;&amp;&gt;/);
 assert.equal([...html.matchAll(/FG-HOST/g)].length,1);
 assert.doesNotMatch(html,/<dt>Apelido<\/dt>|<dt>Time do coração<\/dt>|<dt>ID Fifa GO<\/dt>/);
 assert.match(html,/<details class='profile-advanced account-surface'[\s\S]*<summary>Conta, segurança e privacidade<\/summary>/);
 assert.match(html,/profile-notifications/);
 const blank=views.renderProfileView(c);assert.doesNotMatch(blank,/data-action='copy-game-id'/);
});
