import test from 'node:test';
import assert from 'node:assert/strict';
import * as views from './account-views.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const c={user:{id:'h',nickname:'Host',publicPlayerId:'FG-HOST'},online:true,esc,fmt:String,when:value=>`DATA ${value}`,brl:String,avatar:()=>'',btn:()=>'',intro:()=>'',empty:(_icon,title,description)=>`${title} ${description}`,guest:()=> 'Entre na conta',legacyDemoView:()=>''};
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
