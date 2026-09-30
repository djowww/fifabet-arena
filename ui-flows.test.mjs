import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as model from './model.mjs';
import {renderFootballTrophies,FOOTBALL_TROPHY_DESIGNS} from './football-trophies.mjs';
import {renderRivalrySection} from './rivalry-section.mjs';
const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
function harness(){
 const nodes={},listeners={},windowListeners={},timers=new Map();let timerId=0;
 function node(id){return nodes[id]??={id,innerHTML:'',textContent:'',value:'',hidden:false,open:false,isConnected:true,dataset:{},attributes:{},classList:{add(){},remove(){},toggle(){}},focus(){document.activeElement=this;},setAttribute(name,value){this.attributes[name]=String(value);},matches(){return false;},querySelector(){return null;},addEventListener(name,fn){this[name]=fn;},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100};}};}
 const document={getElementById:node,activeElement:null,body:node('body'),querySelectorAll(){return [];},createElement(tag){return tag==='canvas'?{width:0,height:0,getContext(){return {drawImage(){}};},toDataURL(){return 'data:image/jpeg;base64,dGVzdA==';}}:{ };},addEventListener(name,fn){listeners[name]=fn;}};
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
 const localStorage=storage(),sessionStorage=storage(),location={hash:'#arena'};
 const window={addEventListener:(n,f)=>windowListeners[n]=f,scrollTo(){}};
 const ctx={...model,renderFootballTrophies,renderRivalrySection,document,window,location,localStorage,sessionStorage,crypto,console,createImageBitmap:async()=>({width:1280,height:720,close(){}}),URL:{createObjectURL:()=> 'blob:demo-evidence'},requestAnimationFrame:f=>f(),setTimeout:(f,ms)=>{const id=++timerId;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),FormData:class{constructor(f){this.values=f.values;}get(k){return this.values[k];}}};
 vm.createContext(ctx);
 vm.runInContext(source.replace(/^import .*?;\r?\n/gm,'')+`\nglobalThis.api={getState:()=>state,getUI:()=>ui,commit,render,go,showAuth,readSlip,renderWallet,renderFriends,renderTrophies,renderBets,slipHTML,showMatch};`,ctx);
 const click=(action,data={})=>listeners.click({target:{closest(selector){if(selector==='.skip-link')return null;return {dataset:{action,...data},disabled:false};}}});
 const submit=(kind,nickname,fields={})=>listeners.submit({preventDefault(){},submitter:{disabled:false},target:{closest(){return {dataset:{form:kind,id:fields.id,profileId:fields.profileId},values:{nickname,...fields},reportValidity:()=>true};}}});
 const tick=ms=>{for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.f();}};
 return {api:ctx.api,nodes,click,submit,tick,document,location,localStorage,sessionStorage,listeners,windowListeners};
}
test('create/profile buttons render every route without runtime errors',()=>{
 const h=harness();assert.match(h.nodes.screen.innerHTML,/Desafie um amigo no EA SPORTS FC/);h.click('auth',{mode:'create'});assert.ok(h.nodes.modal.open);h.submit('create','Ricardo');assert.equal(model.current(h.api.getState()).nickname,'Ricardo');assert.match(h.nodes.headerActions.innerHTML,/1.000/);
 for(const view of model.VIEWS){h.api.getUI().view=view;h.api.render();assert.ok(h.nodes.screen.innerHTML.length>1000);}
 h.click('profile');h.submit('profile','RicoFC');assert.equal(model.current(h.api.getState()).nickname,'RicoFC');assert.equal(h.nodes.modal.open,false);
});
test('club picker searches without accents and previews selection without saving until confirmation',async()=>{
 const h=harness();h.submit('create','Ricardo');
 h.api.commit('profile',{nickname:'Ricardo',clubId:'internacional'});h.api.render();
 const before=JSON.stringify(h.api.getState());h.click('profile');
 const search=value=>{const input=h.document.getElementById('clubSearch');input.value=value;h.listeners.input({target:input});};
 search('sao paulo');
 assert.match(h.nodes.clubResults.innerHTML,/data-id='sao-paulo'/);assert.doesNotMatch(h.nodes.clubResults.innerHTML,/data-id='internacional'/);
 search('bArCa');assert.match(h.nodes.clubResults.innerHTML,/data-id='barcelona'/);
 search('clube inexistente');assert.doesNotMatch(h.nodes.clubResults.innerHTML,/role='option'/);
 search('gremio');h.click('selectClub',{id:'gremio'});
 assert.equal(h.api.getUI().profileClubId,'gremio');assert.equal(h.nodes.profileClubId.value,'gremio');
 assert.ok(h.nodes.teamPreview.innerHTML.includes(model.clubById('gremio').crest));
 assert.equal(JSON.stringify(h.api.getState()),before);assert.equal(h.nodes.clubPickerPanel.hidden,true);
 const preview=h.nodes.teamPreview.innerHTML;h.click('selectClub',{id:'unknown'});
 assert.equal(h.api.getUI().profileClubId,'gremio');assert.equal(h.nodes.teamPreview.innerHTML,preview);
 h.click('closeDialog');assert.equal(JSON.stringify(h.api.getState()),before);
 h.click('profile');assert.equal(h.api.getUI().profileClubId,'internacional');assert.equal(h.api.getUI().profileClubChanged,false);
 h.click('selectClub',{id:'sao-paulo'});
 await h.submit('profile','Ricardo',{clubId:h.nodes.profileClubId.value});
 assert.equal(model.current(h.api.getState()).clubId,'sao-paulo');assert.equal(model.current(h.api.getState()).teamName,'São Paulo');
 assert.equal(h.nodes.modal.open,false);assert.ok(h.nodes.screen.innerHTML.includes(model.clubById('sao-paulo').crest));
 h.click('profile');h.click('selectClub',{id:''});
 assert.equal(model.current(h.api.getState()).clubId,'sao-paulo');
 await h.submit('profile','Ricardo',{clubId:h.nodes.profileClubId.value});
 assert.equal(model.current(h.api.getState()).clubId,null);assert.equal(model.current(h.api.getState()).teamName,'');
});

test('profile edits preserve a legacy custom club until selection and reject stale profile saves',async()=>{
 const h=harness();h.submit('create','JogadorA');const first=h.api.getState().activeProfileId;
 h.api.commit('profile',{nickname:'JogadorA',teamName:'Minha Turma FC'});
 h.click('profile');await h.submit('profile','JogadorA',{clubId:''});
 assert.equal(model.current(h.api.getState()).teamName,'Minha Turma FC');assert.equal(model.current(h.api.getState()).clubId,null);
 h.submit('create','JogadorB');const second=h.api.getState().activeProfileId;
 h.click('login',{id:first});h.click('profile');h.click('selectClub',{id:'internacional'});
 const external=JSON.parse(h.localStorage.getItem(model.STORAGE_KEY));external.activeProfileId=second;
 const raw=JSON.stringify(external);h.localStorage.setItem(model.STORAGE_KEY,raw);
 await h.submit('profile','NomeTrocado',{profileId:first,clubId:h.nodes.profileClubId.value});
 assert.match(h.nodes.dialogError.textContent,/O perfil mudou/);assert.equal(h.localStorage.getItem(model.STORAGE_KEY),raw);
 assert.equal(h.api.getState().profiles[first].nickname,'JogadorA');assert.equal(h.api.getState().profiles[first].teamName,'Minha Turma FC');
 assert.equal(h.api.getState().profiles[second].nickname,'JogadorB');assert.equal(h.api.getState().profiles[second].clubId,null);
 h.windowListeners.storage({key:model.STORAGE_KEY});assert.equal(h.api.getState().activeProfileId,second);assert.equal(h.nodes.modal.open,false);
});

test('football trophies retain achievement identities, earned timestamps and explorer progress without mutations',()=>{
 const h=harness();h.submit('create','Colecionador');h.api.commit('accept',{id:'bia'});
 const p=model.current(h.api.getState());
 p.achievements={welcome:'2026-09-01T12:00:00.000Z',friend:'2026-09-02T12:00:00.000Z'};
 p.visited=['arena','friends','store','friends','unrecognized'];
 const before=JSON.stringify(p),dates=[];
 const html=renderFootballTrophies({profile:p,date:value=>{dates.push(value);return `DATE:${value}`;}});
 assert.deepEqual(FOOTBALL_TROPHY_DESIGNS.map(item=>item.id).sort(),model.TROPHIES.map(item=>item.id).sort());
 assert.deepEqual(dates.sort(),Object.values(p.achievements).sort());assert.equal(JSON.stringify(p),before);
 const cards=[...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([card])=>card);
 assert.equal(cards.length,model.TROPHIES.length);
 for(const trophy of model.TROPHIES){
  const card=cards.find(item=>item.includes(`aria-labelledby='footballTrophy-${trophy.id}'`));assert.ok(card);
  const earned=p.achievements[trophy.id];
  assert.match(card,earned?/\bis-earned\b/:/\bis-locked\b/);
  if(earned){assert.ok(card.includes(`DATE:${earned}`));assert.match(card,/<progress max='1' value='1'/);}
  else if(trophy.id==='explorer')assert.ok(card.includes(`<progress max='1' value='${3/7}'`));
  else assert.match(card,/<progress max='1' value='0'/);
 }
 h.api.getUI().view='trophies';h.api.render();assert.equal(JSON.stringify(p),before);
 assert.equal([...h.nodes.screen.innerHTML.matchAll(/aria-labelledby='footballTrophy-/g)].length,model.TROPHIES.length);
 const complete={...p,achievements:Object.fromEntries(model.TROPHIES.map((item,index)=>[item.id,`2026-09-0${index+1}T12:00:00.000Z`])),visited:[...model.VIEWS]};
 const completeBefore=JSON.stringify(complete),full=renderFootballTrophies({profile:complete});
 assert.equal([...full.matchAll(/class='football-trophy is-earned /g)].length,model.TROPHIES.length);
 assert.doesNotMatch(full,/class='football-trophy is-locked /);assert.equal(JSON.stringify(complete),completeBefore);
});

test('route aliases used by challenge and trophy buttons reach their views',()=>{
 const h=harness();h.api.go('amigos');assert.equal(h.location.hash,'amigos');h.location.hash='#arena';h.api.go('conquistas');assert.equal(h.location.hash,'trofeus');h.location.hash='#arena';h.api.go('ranking');assert.equal(h.location.hash,'ranking');
});
test('EA ID dialog saves, displays and removes an unverified account without claiming sync',async()=>{
 const h=harness();h.submit('create','Ricardo');h.click('gameAccount');
 assert.match(h.nodes.modalContent.innerHTML,/CONEXÃO OFICIAL INDISPONÍVEL/);
 await h.submit('gameAccount','',{eaId:'DjowFC',platform:'pc'});
 assert.equal(model.current(h.api.getState()).gameAccount.eaId,'DjowFC');
 assert.match(h.nodes.modalContent.innerHTML,/ID NÃO VERIFICADO/);assert.match(h.nodes.modalContent.innerHTML,/Últimas partidas da arena/);
 assert.match(h.nodes.screen.innerHTML,/EA ID cadastrado/);
 h.click('unlinkGameAccount');assert.equal(model.current(h.api.getState()).gameAccount,null);
 assert.match(h.nodes.modalContent.innerHTML,/CONEXÃO OFICIAL INDISPONÍVEL/);
 h.click('closeDialog');h.click('credits');assert.match(h.nodes.modalContent.innerHTML,/Jacek Stanislawek/);assert.match(h.nodes.modalContent.innerHTML,/CC BY-SA 4.0/);
});
const storeCardNames=html=>[...html.matchAll(/<article class='card (?:collectible-card[^']*|sticker-card)'>([\s\S]*?)<\/article>/g)].map(([,card])=>card.match(/<h2>([^<]+)<\/h2>/)?.[1]);

test('shop initially shows three current cards; tier and owned filters preserve only owned legacy items',()=>{
 const h=harness();h.api.getUI().view='store';h.api.render();
 assert.deepEqual(storeCardNames(h.nodes.screen.innerHTML),['Cristiano Ronaldo','Bruno Fernandes','Senne Lammens']);
 assert.doesNotMatch(h.nodes.screen.innerHTML,/Nilo Raio|Maya Luz|Tito Rocha|Breno Vale/);
 for(const [value,name] of [['gold','Cristiano Ronaldo'],['silver','Bruno Fernandes'],['bronze','Senne Lammens']]){
  h.click('storeFilter',{value});assert.deepEqual(storeCardNames(h.nodes.screen.innerHTML),[name]);
  assert.ok(h.nodes.screen.innerHTML.includes(`data-value='${value}' aria-pressed='true'`));
 }
 h.click('storeFilter',{value:'owned'});assert.deepEqual(storeCardNames(h.nodes.screen.innerHTML),[]);
 assert.match(h.nodes.screen.innerHTML,/Sua coleção começa em campo/);
 h.submit('create','Colecionador');
 h.api.commit('purchaseSticker',{id:'senne-lammens'});
 h.api.commit('purchaseSticker',{id:'nilo-raio'});h.api.render();
 assert.deepEqual(storeCardNames(h.nodes.screen.innerHTML),['Senne Lammens','Nilo Raio']);
 assert.match(h.nodes.screen.innerHTML,/Sua coleção original/);
 assert.match(h.nodes.screen.innerHTML,/data-action='equipSticker' data-id='nilo-raio'/);
 for(const item of model.STICKERS.filter(item=>item.retired))assert.ok(!h.nodes.screen.innerHTML.includes(`data-action='buySticker' data-id='${item.id}'`));
 h.click('storeFilter',{value:'gold'});assert.deepEqual(storeCardNames(h.nodes.screen.innerHTML),['Cristiano Ronaldo']);
 h.click('storeFilter',{value:'all'});assert.deepEqual(storeCardNames(h.nodes.screen.innerHTML),['Cristiano Ronaldo','Bruno Fernandes','Senne Lammens','Nilo Raio']);
 assert.doesNotMatch(h.nodes.screen.innerHTML,/Maya Luz|Tito Rocha|Breno Vale/);
});

test('caricature details expose original signature sources and explicitly disclaim athlete certification',()=>{
 const h=harness();
 for(const item of model.STICKERS.filter(item=>item.kind==='player-caricature')){
  h.click('stickerDetails',{id:item.id});const html=h.nodes.modalContent.innerHTML;
  assert.ok(h.nodes.modal.open);assert.ok(html.includes(`src='${item.art}'`));assert.ok(html.includes(`src='${item.signatureAsset}'`));
  assert.ok(html.includes(`href='${item.signatureSource}'`));assert.ok(html.includes(`href='${item.signatureReference}'`));
  assert.match(html,/Reprodução da assinatura atribuída a/);
  assert.match(html,/Categoria editorial de reconhecimento/);
  assert.match(html,/sem certificação do atleta ou autógrafo personalizado/);
  assert.doesNotMatch(html,/autógrafo oficial|autenticidade garantida|certificado de autenticidade/i);
  if(item.id==='senne-lammens'){
   assert.match(html,/acesso direto ao post não pôde ser confirmado/);
   assert.match(html,/Bryan Berlin \/ WikiPortraits/);assert.match(html,/CC BY-SA 4\.0/);
  }
  h.click('closeDialog');
 }
});

test('new avatar confirmation charges once and equipping a purchased caricature renders its image',()=>{
 const h=harness();h.submit('create','Ricardo');h.api.getUI().view='store';h.api.render();
 const profileId=h.api.getState().activeProfileId;
 h.click('buySticker',{id:'cristiano-ronaldo'});
 assert.equal(h.api.getUI().pendingSticker.id,'cristiano-ronaldo');assert.equal(h.api.getUI().pendingSticker.profileId,profileId);
 assert.equal(model.current(h.api.getState()).balance,1000);assert.match(h.nodes.modalContent.innerHTML,/Confirmar · 700 pts/);
 h.click('confirmStickerPurchase');h.click('confirmStickerPurchase');
 let p=model.current(h.api.getState());assert.equal(p.balance,300);assert.equal(p.avatarSticker,'cristiano-ronaldo');
 assert.deepEqual(p.ownedStickers,['cristiano-ronaldo']);assert.equal(p.transactions.filter(t=>t.kind==='shop').length,1);
 assert.equal(h.api.getUI().pendingSticker,null);assert.equal(h.nodes.modal.open,false);
 assert.match(h.nodes.headerActions.innerHTML,/<img src='assets\/avatars\/cristiano-ronaldo\.png'/);
 h.click('buySticker',{id:'senne-lammens'});h.click('confirmStickerPurchase');
 assert.equal(model.current(h.api.getState()).balance,50);assert.equal(model.current(h.api.getState()).avatarSticker,'cristiano-ronaldo');
 h.click('equipSticker',{id:'senne-lammens'});p=model.current(h.api.getState());assert.equal(p.avatarSticker,'senne-lammens');assert.equal(p.balance,50);
 assert.match(h.nodes.headerActions.innerHTML,/<img src='assets\/avatars\/senne-lammens\.png'/);
 h.click('profile');assert.match(h.nodes.modalContent.innerHTML,/<img src='assets\/avatars\/senne-lammens\.png'/);
 h.click('closeDialog');h.click('defaultAvatar');assert.equal(model.current(h.api.getState()).avatarSticker,null);
 assert.doesNotMatch(h.nodes.headerActions.innerHTML,/assets\/avatars\//);
});

test('stale shop confirmation cannot charge a profile selected in another tab',()=>{
 const h=harness();h.submit('create','JogadorA');const first=h.api.getState().activeProfileId;
 h.submit('create','JogadorB');const second=h.api.getState().activeProfileId;
 h.click('login',{id:first});h.click('buySticker',{id:'cristiano-ronaldo'});
 assert.equal(h.api.getUI().pendingSticker.profileId,first);
 const external=JSON.parse(h.localStorage.getItem(model.STORAGE_KEY));external.activeProfileId=second;
 const externalRaw=JSON.stringify(external);h.localStorage.setItem(model.STORAGE_KEY,externalRaw);
 // Confirm before the other tab's storage event arrives: commit must read the latest profile.
 h.click('confirmStickerPurchase');
 assert.match(h.nodes.dialogError.textContent,/O perfil mudou/);
 assert.equal(h.localStorage.getItem(model.STORAGE_KEY),externalRaw);
 for(const id of [first,second]){
  assert.equal(h.api.getState().profiles[id].balance,1000);assert.deepEqual(h.api.getState().profiles[id].ownedStickers,[]);
  assert.equal(external.profiles[id].transactions.filter(t=>t.kind==='shop').length,0);
 }
 h.windowListeners.storage({key:model.STORAGE_KEY});
 assert.equal(h.api.getState().activeProfileId,second);assert.equal(h.api.getUI().pendingSticker,null);assert.equal(h.nodes.modal.open,false);
 h.click('confirmStickerPurchase');assert.equal(model.current(h.api.getState()).balance,1000);
 assert.equal(h.localStorage.getItem(model.STORAGE_KEY),externalRaw);
});

test('legacy bet history still records results in the account',()=>{
 const h=harness();h.submit('create','Ricardo');h.click('pick',{id:'m1',side:'away'});h.click('reviewBet');assert.match(h.nodes.modalContent.innerHTML,/220 pts/);h.click('confirmBet');assert.equal(model.current(h.api.getState()).balance,900);assert.equal(model.current(h.api.getState()).bets.length,1);assert.equal(h.api.getUI().pick,null);
 h.click('settle',{id:'m1'});h.click('settleResult',{id:'m1',side:'away'});assert.equal(model.current(h.api.getState()).balance,1120);assert.equal(model.current(h.api.getState()).bets[0].status,'won');h.api.getUI().view='bets';h.api.render();assert.match(h.nodes.screen.innerHTML,/LucasD10/);assert.match(h.nodes.screen.innerHTML,/Vencedor/);
});
test('payment rejection, retry, approval and close/cancel affect balance correctly',()=>{
 const h=harness();h.submit('create','Ricardo');h.click('deposit',{method:'card'});h.click('package',{value:'2500'});h.click('paymentReview');assert.match(h.nodes.modalContent.innerHTML,/4242/);h.click('paymentDecline');assert.equal(model.current(h.api.getState()).balance,1000);assert.match(h.nodes.modalContent.innerHTML,/recusado/);h.click('paymentRetry');h.click('paymentApprove');h.tick(650);assert.equal(model.current(h.api.getState()).balance,3500);assert.match(h.nodes.modalContent.innerHTML,/Pontos na carteira/);h.click('paymentApprove');h.tick(650);assert.equal(model.current(h.api.getState()).balance,3500);
 h.click('closeDialog');h.click('deposit');h.click('paymentReview');h.click('paymentApprove');h.click('closeDialog');h.tick(650);assert.equal(model.current(h.api.getState()).balance,3500);
});
test('slips stay isolated across profile switches and guest selection carries into login',()=>{
 const h=harness();h.click('pick',{id:'m2',side:'home'});h.click('reviewBet');h.submit('create','JogadorA');h.tick(0);assert.match(h.nodes.modalContent.innerHTML,/Confira seu palpite/);const a=h.api.getState().activeProfileId;h.click('closeDialog');h.click('amount',{value:'250'});
 h.click('logoutConfirm');assert.equal(h.api.getUI().pick,null);h.submit('create','JogadorB');const b=h.api.getState().activeProfileId;assert.equal(h.api.getUI().pick,null);h.click('pick',{id:'m4',side:'away'});h.click('amount',{value:'50'});
 h.click('login',{id:a});assert.equal(h.api.getUI().pick.matchId,'m2');assert.equal(h.api.getUI().stake,'250');h.click('login',{id:b});assert.equal(h.api.getUI().pick.matchId,'m4');assert.equal(h.api.getUI().stake,'50');
 assert.equal(h.api.readSlip(a).pick.matchId,'m2');assert.equal(h.api.readSlip(b).pick.matchId,'m4');
});
test('invalid fractional input cannot masquerade as insufficient funds; skip link keeps route',()=>{
 const h=harness();h.submit('create','Ricardo');h.click('pick',{id:'m1',side:'home'});h.api.getUI().stake='1000.5';const html=h.api.slipHTML();assert.match(html,/Use apenas pontos inteiros/);assert.match(html,/data-review disabled/);assert.doesNotMatch(html,/Adicionar saldo/);
 h.api.getUI().view='wallet';h.location.hash='#carteira';let prevented=false;h.listeners.click({preventDefault(){prevented=true;},target:{closest(selector){return selector==='.skip-link'?{}:null;}}});assert.equal(prevented,true);assert.equal(h.location.hash,'#carteira');assert.equal(h.document.activeElement.id,'screen');
});
test('challenge results require photo evidence and fraud reports block ranking points',async()=>{
 const h=harness();h.submit('create','Ricardo');h.click('accept',{id:'bia'});assert.ok(model.current(h.api.getState()).friends.includes('bia'));h.click('invite',{id:'leo'});h.click('simulateAccept',{id:'leo'});assert.ok(model.current(h.api.getState()).friends.includes('leo'));
 h.click('challenge',{id:'leo'});h.submit('challenge','',{id:'leo',mode:'Ultimate Team',stake:'250'});let p=model.current(h.api.getState()),challenge=p.challenges[0];assert.equal(p.challenges.length,1);assert.equal(challenge.mode,'Ultimate Team');assert.equal(challenge.stake,250);assert.equal(challenge.status,'sent');assert.equal(p.balance,1000);
 h.click('acceptChallenge',{id:challenge.id});assert.equal(model.current(h.api.getState()).challenges[0].status,'accepted');h.click('challengeResult',{id:challenge.id});assert.match(h.nodes.modalContent.innerHTML,/type='file'/);assert.match(h.nodes.modalContent.innerHTML,/Salvar placar e deixar em análise/);
 const image={type:'image/png',size:50000,name:'placar.png'};await h.submit('challengeResult','',{id:challenge.id,winner:'you',evidence:image});p=model.current(h.api.getState());assert.equal(p.challenges[0].status,'review');assert.equal(p.challenges[0].winner,'');assert.equal(p.challenges[0].reportedWinner,'you');assert.equal(p.balance,1000);
 h.api.getUI().view='ranking';h.api.render();assert.match(h.nodes.screen.innerHTML,/Ricardo/);h.click('challengeEvidence',{id:challenge.id});assert.match(h.nodes.modalContent.innerHTML,/data:image\/jpeg/);h.click('closeDialog');
 h.click('reportFraud',{id:challenge.id});assert.match(h.nodes.modalContent.innerHTML,/Sinalizar suspeita de fraude/);await h.submit('fraudReport','',{id:challenge.id,winner:'friend',reason:'Placar não confere',evidence:image});p=model.current(h.api.getState());assert.equal(p.challenges[0].status,'disputed');assert.equal(p.challenges[0].fraudReason,'Placar não confere');assert.equal(p.balance,1000);
 h.click('challenge',{id:'bia'});h.submit('challenge','',{id:'bia',mode:'1v1',stake:'100'});p=model.current(h.api.getState());challenge=p.challenges.find(c=>c.personId==='bia'&&c.status==='sent');h.click('cancelChallenge',{id:challenge.id});assert.equal(model.current(h.api.getState()).challenges.some(c=>c.id===challenge.id),false);h.click('removeFriend',{id:'leo'});h.click('removeFriendConfirm',{id:'leo'});assert.equal(model.current(h.api.getState()).friends.includes('leo'),true);assert.match(h.nodes.dialogError.textContent,/desafio/i);
 h.click('closeDialog');h.click('challengeEvidence',{id:model.current(h.api.getState()).challenges.find(c=>c.personId==='leo').id});assert.match(h.nodes.modalContent.innerHTML,/Envio original/);assert.match(h.nodes.modalContent.innerHTML,/Evidência da denúncia/);
 h.api.getUI().view='arena';h.api.render();assert.match(h.nodes.screen.innerHTML,/Fraude sinalizada/);h.api.getUI().view='bets';h.api.render();assert.match(h.nodes.screen.innerHTML,/Fraude sinalizada/);
});
