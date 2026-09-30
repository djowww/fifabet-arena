import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,current,change,restore,validStake,payout,VIEWS,STICKERS} from './model.mjs';
const create=(name='Ricardo')=>change(emptyState(),'create',{nickname:name});
const bet=(s,opts={})=>change(s,'bet',{matchId:'m1',side:'home',stake:100,operationId:'b1',...opts});

test('EA ID is a local unverified reference, isolated by profile and removable',()=>{
 let s=create();const first=s.activeProfileId;
 assert.equal(current(s).gameAccount,null);
 s=change(s,'saveGameAccount',{eaId:' DjowFC_10 ',platform:'playstation'});
 assert.equal(current(s).gameAccount.eaId,'DjowFC_10');assert.equal(current(s).gameAccount.status,'unverified');
 s=change(s,'create',{nickname:'OutroJogador'});assert.equal(current(s).gameAccount,null);
 s=change(s,'login',{id:first});assert.equal(current(s).gameAccount.platform,'playstation');
 s=change(s,'saveGameAccount',{eaId:'DjowNovo',platform:'pc'});assert.equal(current(s).gameAccount.platform,'pc');
 const saved=restore(JSON.stringify(s));assert.deepEqual(current(saved).gameAccount,current(s).gameAccount);
 s=change(s,'unlinkGameAccount');assert.equal(current(s).gameAccount,null);assert.equal(current(s).balance,1000);
});
test('EA ID validation and migration never grant a verified state or preserve tokens',()=>{
 let s=create();
 for(const eaId of ['', 'abc','abcdefghijklmnopq','mail@example.com','two ids','<script>','a\u0000bc'])assert.throws(()=>change(s,'saveGameAccount',{eaId,platform:'pc'}),/EA ID/);
 assert.throws(()=>change(s,'saveGameAccount',{eaId:'ValidID',platform:'unknown'}),/plataforma/i);
 current(s).gameAccount={eaId:'ValidID',platform:'xbox',status:'verified',accessToken:'fake-token',matches:[{winner:'you'}]};
 const saved=restore(s);assert.equal(current(saved).gameAccount.status,'unverified');assert.equal(current(saved).gameAccount.accessToken,undefined);assert.equal(current(saved).gameAccount.matches,undefined);
 delete current(s).gameAccount;s.version=4;assert.equal(current(restore(s)).gameAccount,null);
 current(s).gameAccount={eaId:'Invalid ID',platform:'pc'};assert.equal(current(restore(s)).gameAccount,null);
});
test('logout and login preserve account data; second profile stays isolated',()=>{
 let s=create();const a=s.activeProfileId;s=bet(s);s=change(s,'accept',{id:'bia'});s=change(s,'logout');assert.equal(current(s),null);
 s=change(s,'create',{nickname:'Jogador B'});const b=s.activeProfileId;assert.equal(current(s).balance,1000);assert.equal(current(s).bets.length,0);assert.equal(current(s).friends.length,0);
 s=change(s,'login',{id:a});assert.equal(current(s).balance,900);assert.equal(current(s).bets.length,1);assert.deepEqual(current(s).friends,['bia']);
 assert.equal(s.profiles[b].balance,1000);assert.equal(current(s).transactions.filter(t=>t.ref==='welcome').length,1);
 assert.throws(()=>change(s,'create',{nickname:' ricardo '}),/já existe/);
 assert.throws(()=>change(s,'login',{id:'constructor'}),/não encontrado/);
});
test('integer stakes validated; rejected changes leave state untouched',()=>{
 let s=create();const before=JSON.stringify(s);for(const stake of ['',9,10.5,1001,NaN,Infinity,-50])assert.throws(()=>bet(s,{stake}));assert.equal(JSON.stringify(s),before);
 assert.equal(validStake(10,10),'');assert.equal(payout(101,1.72),174);
 s=bet(s,{stake:101});assert.equal(current(s).balance,899);assert.equal(current(s).bets[0].potential,174);
});
test('demo credit only accepts packages/methods and is idempotent',()=>{
 let s=create();s=change(s,'deposit',{amount:2500,method:'pix',paymentId:'pay1'});assert.equal(current(s).balance,3500);
 const after=JSON.stringify(s);s=change(s,'deposit',{amount:2500,method:'pix',paymentId:'pay1'});assert.equal(JSON.stringify(s),after);
 assert.throws(()=>change(s,'deposit',{amount:-1000,method:'pix',paymentId:'pay2'}));
 assert.throws(()=>change(s,'deposit',{amount:1000,method:'real',paymentId:'pay2'}));
 s=change(s,'deposit',{amount:500,method:'card',paymentId:'pay2'});assert.equal(current(s).balance,4000);assert.equal(current(s).transactions.filter(t=>t.kind==='deposit').length,2);
});
test('bet operation and settlement are atomic and idempotent across profiles',()=>{
 let s=create();const a=s.activeProfileId;s=bet(s);s=bet(s);assert.equal(current(s).balance,900);assert.equal(current(s).bets.length,1);
 s=change(s,'create',{nickname:'BiaTeste'});const b=s.activeProfileId;s=bet(s,{side:'away',operationId:'b2'});
 s=change(s,'settle',{matchId:'m1',winner:'home'});assert.equal(s.profiles[a].balance,1072);assert.equal(s.profiles[a].bets[0].status,'won');assert.equal(s.profiles[b].balance,900);assert.equal(s.profiles[b].bets[0].status,'lost');
 const after=JSON.stringify(s);s=change(s,'settle',{matchId:'m1',winner:'home'});assert.equal(JSON.stringify(s),after);
 assert.throws(()=>change(s,'settle',{matchId:'m1',winner:'away'}),/resultado definido/);
 assert.throws(()=>bet(s,{operationId:'b3'}),/encerrado/);assert.equal(s.profiles[a].transactions.filter(t=>t.kind==='payout').length,1);
 assert.ok(s.profiles[a].achievements.winner);assert.equal(s.profiles[b].achievements.winner,undefined);
});
test('friends, invites, challenges and trophies update consistently',()=>{
 let s=create();s=change(s,'decline',{id:'bia'});assert.equal(current(s).requests.length,0);
 s=change(s,'invite',{id:'leo'});assert.throws(()=>change(s,'invite',{id:'leo'}));
 s=change(s,'simulateAccept',{id:'leo'});assert.deepEqual(current(s).friends,['leo']);assert.equal(current(s).requests.length,0);assert.ok(current(s).achievements.friend);
 s=change(s,'challenge',{id:'leo'});assert.equal(current(s).challenges.length,1);assert.equal(current(s).balance,1000);assert.throws(()=>change(s,'challenge',{id:'leo'}));
 s=change(s,'removeFriend',{id:'leo'});assert.equal(current(s).friends.length,0);assert.equal(current(s).challenges.length,0);
 s=change(s,'favorite',{id:'m4'});s=change(s,'reminder',{id:'m4'});assert.ok(current(s).achievements.favorite);
 for(const view of VIEWS)s=change(s,'visit',{view});assert.ok(current(s).achievements.explorer);
 s=change(s,'readActivity');assert.equal(current(s).unread,0);
});
test('challenge results and fraud reports require image evidence and stay unawarded pending review',()=>{
 let s=create();s=change(s,'accept',{id:'bia'});s=change(s,'challenge',{id:'bia',stake:100,mode:'1v1'});const id=current(s).challenges[0].id;
 s=change(s,'acceptChallenge',{id});assert.throws(()=>change(s,'resolveChallenge',{id,winner:'you'}),/sem foto e revisão/);
 assert.throws(()=>change(s,'submitChallengeResult',{id,winner:'you'}),/foto válida/);
 assert.throws(()=>change(s,'removeFriend',{id:'bia'}),/desafio/i);
 assert.throws(()=>change(s,'cancelChallenge',{id}),/convite/i);
 const evidence='data:image/jpeg;base64,dGVzdA==';s=change(s,'submitChallengeResult',{id,winner:'you',evidenceDataUrl:evidence,evidenceName:'placar.jpg'});
 assert.equal(current(s).challenges[0].status,'review');assert.ok(!current(s).challenges[0].winner);assert.equal(current(s).challenges[0].reportedWinner,'you');assert.equal(current(s).balance,1000);
 assert.throws(()=>change(s,'challenge',{id:'bia',stake:50}),/pendente/);
 assert.throws(()=>change(s,'reportFraud',{id,winner:'friend',reason:'placar diferente'}),/foto válida/);
 const fraudEvidence='data:image/jpeg;base64,ZnJhdWQ=';
 s=change(s,'reportFraud',{id,winner:'friend',reason:'Placar não bateu',evidenceDataUrl:fraudEvidence,evidenceName:'tela-final.jpg'});
 assert.equal(current(s).challenges[0].status,'disputed');assert.equal(current(s).challenges[0].reportedWinner,'friend');assert.equal(current(s).challenges[0].fraudReason,'Placar não bateu');assert.equal(current(s).balance,1000);
 assert.throws(()=>change(s,'submitChallengeResult',{id,winner:'you',evidenceDataUrl:evidence}),/desafio confirmado/);
 assert.throws(()=>change(s,'removeFriend',{id:'bia'}),/desafio/i);
 assert.throws(()=>change(s,'cancelChallenge',{id}),/convite/i);
 const saved=restore(JSON.stringify(s));assert.equal(current(saved).challenges[0].status,'disputed');assert.equal(current(saved).challenges[0].evidenceDataUrl,fraudEvidence);
 assert.equal(current(saved).challenges[0].originalReport.evidenceDataUrl,evidence);assert.equal(current(saved).challenges[0].originalReport.reportedWinner,'you');assert.equal(current(saved).challenges[0].originalReport.evidenceName,'placar.jpg');
});
test('old unverified challenge winners are reopened for photo review',()=>{
 let s=create();s=change(s,'accept',{id:'bia'});s=change(s,'challenge',{id:'bia'});const profile=current(s),id=profile.challenges[0].id;
 profile.challenges[0]={...profile.challenges[0],status:'completed',winner:'you',completedAt:new Date().toISOString()};s.version=3;
 const migrated=restore(JSON.stringify(s));assert.equal(current(migrated).challenges[0].status,'accepted');assert.equal(current(migrated).challenges[0].winner,'');assert.equal(current(migrated).challenges[0].id,id);
});
test('persisted state rehydrates safely, preserving key account values',()=>{
 let s=create();s=bet(s);s=change(s,'favorite',{id:'m2'});const out=restore(JSON.stringify(s));assert.equal(out.activeProfileId,s.activeProfileId);assert.equal(current(out).balance,900);assert.equal(current(out).bets.length,1);assert.equal(current(out).transactions.length,2);assert.deepEqual(current(out).favorites,['m2']);
 assert.deepEqual(restore('{broken'),emptyState());
 const malformed={version:2,profiles:{invalid:{id:'__proto__',nickname:'Nope'},normal:{id:'good',nickname:'Demo',balance:Infinity,bets:[{stake:100,odd:Infinity}],friends:['unlisted'],activity:[null],requests:[null]}},activeProfileId:'constructor'};
 const repaired=restore(malformed);assert.equal(current(repaired),null);assert.equal(repaired.profiles.good.balance,0);assert.equal(repaired.profiles.good.bets.length,0);assert.deepEqual(repaired.profiles.good.friends,[]);
});
test('profile themes and sticker purchases persist safely and spend demo points once',()=>{
 let s=create();
 s=change(s,'profile',{nickname:'Ricardo',color:'mint',teamName:'Meu Clube',teamFlag:'blue'});
 assert.equal(current(s).teamName,'Meu Clube');assert.equal(current(s).teamFlag,'blue');
 const first=STICKERS.find(item=>item.id==='nilo-raio'),second=STICKERS.find(item=>item.id==='breno-vale');
 s=change(s,'purchaseSticker',{id:first.id});assert.equal(current(s).balance,650);assert.deepEqual(current(s).ownedStickers,[first.id]);assert.equal(current(s).avatarSticker,first.id);
 s=change(s,'purchaseSticker',{id:second.id});assert.equal(current(s).balance,150);assert.equal(current(s).transactions.filter(t=>t.kind==='shop').length,2);
 assert.throws(()=>change(s,'purchaseSticker',{id:first.id}),/já tem/);
 assert.throws(()=>change(s,'purchaseSticker',{id:'unknown'}),/não encontrada/);
 assert.throws(()=>change(s,'purchaseSticker',{id:'tito-rocha'}),/insuficiente/);
 s=change(s,'avatarSticker',{id:second.id});assert.equal(current(s).avatarSticker,second.id);
 s=change(s,'avatarSticker',{id:null});assert.equal(current(s).avatarSticker,null);
 assert.throws(()=>change(s,'avatarSticker',{id:'tito-rocha'}),/Compre/);
 const saved=restore(JSON.stringify(s));assert.equal(current(saved).balance,150);assert.deepEqual(current(saved).ownedStickers,[first.id,second.id]);assert.equal(current(saved).avatarSticker,null);assert.equal(current(saved).teamName,'Meu Clube');assert.equal(current(saved).teamFlag,'blue');
});
test('caricature catalog has display tiers and signature references without invented ratings',()=>{
 const catalog=STICKERS.filter(item=>!item.retired);
 assert.deepEqual(catalog.map(({id,tier,price})=>({id,tier,price})),[
  {id:'cristiano-ronaldo',tier:'gold',price:700},
  {id:'bruno-fernandes',tier:'silver',price:450},
  {id:'senne-lammens',tier:'bronze',price:250}
 ]);
 for(const sticker of catalog){
  assert.equal(sticker.kind,'player-caricature');assert.equal(sticker.rating,undefined);
  assert.equal(sticker.art,`assets/avatars/${sticker.id}.png`);
  assert.match(sticker.signatureAsset,/^assets\/signatures\/[a-z-]+\.svg$/);
  assert.match(sticker.signatureSource,/^https:\/\//);assert.match(sticker.signatureReference,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  assert.equal(sticker.club,sticker.nationality);assert.ok(sticker.recognition);
 }
 assert.equal(STICKERS.filter(item=>item.kind==='fictional-demo'&&item.retired).length,4);
});
test('new avatar purchase charges its demo price once and rejected purchases are atomic',()=>{
 let s=create();s=change(s,'purchaseSticker',{id:'cristiano-ronaldo'});
 assert.equal(current(s).balance,300);assert.equal(current(s).avatarSticker,'cristiano-ronaldo');
 assert.deepEqual(current(s).ownedStickers,['cristiano-ronaldo']);
 const before=JSON.stringify(s);
 assert.throws(()=>change(s,'purchaseSticker',{id:'cristiano-ronaldo'}),/já tem/);
 assert.throws(()=>change(s,'purchaseSticker',{id:'bruno-fernandes'}),/insuficiente/);
 assert.equal(JSON.stringify(s),before);
 const purchases=current(s).transactions.filter(t=>t.kind==='shop');
 assert.equal(purchases.length,1);assert.equal(purchases[0].ref,'sticker:cristiano-ronaldo');assert.equal(purchases[0].amount,-700);
 s=change(s,'purchaseSticker',{id:'senne-lammens'});assert.equal(current(s).balance,50);
 assert.equal(current(s).avatarSticker,'cristiano-ronaldo');
 s=change(s,'avatarSticker',{id:'senne-lammens'});assert.equal(current(s).avatarSticker,'senne-lammens');
});
test('new and retired avatars restore and remain isolated and equippable across profiles',()=>{
 let s=create();const first=s.activeProfileId;
 s=change(s,'purchaseSticker',{id:'bruno-fernandes'});
 s=change(s,'purchaseSticker',{id:'nilo-raio'});
 s=change(s,'avatarSticker',{id:'nilo-raio'});
 s=change(s,'create',{nickname:'Colecionador'});const second=s.activeProfileId;
 assert.deepEqual(current(s).ownedStickers,[]);assert.equal(current(s).avatarSticker,null);
 assert.throws(()=>change(s,'avatarSticker',{id:'bruno-fernandes'}),/Compre/);
 assert.throws(()=>change(s,'avatarSticker',{id:'nilo-raio'}),/Compre/);
 s=change(s,'purchaseSticker',{id:'cristiano-ronaldo'});
 s=restore(JSON.stringify(s));
 assert.equal(s.activeProfileId,second);assert.equal(current(s).avatarSticker,'cristiano-ronaldo');assert.equal(current(s).balance,300);
 s=change(s,'login',{id:first});
 assert.equal(current(s).balance,200);assert.deepEqual(current(s).ownedStickers,['bruno-fernandes','nilo-raio']);assert.equal(current(s).avatarSticker,'nilo-raio');
 s=change(s,'avatarSticker',{id:'bruno-fernandes'});s=restore(JSON.stringify(s));assert.equal(current(s).avatarSticker,'bruno-fernandes');
 s=change(s,'avatarSticker',{id:'nilo-raio'});assert.equal(current(s).avatarSticker,'nilo-raio');
 assert.deepEqual(s.profiles[second].ownedStickers,['cristiano-ronaldo']);assert.equal(s.profiles[second].avatarSticker,'cristiano-ronaldo');
});
test('legacy migration preserves balance and history, orphan history is unassigned',()=>{
 const old=JSON.stringify({nickname:'OldPlayer',balance:720});const bets=JSON.stringify([{id:10,home:'NandoFC',away:'LucasD10',selection:'LucasD10',event:'Copa',stake:100,odds:2.2}]);
 let s=restore(null,old,bets);assert.equal(current(s).balance,720);assert.equal(current(s).bets[0].matchId,'m1');assert.equal(current(s).bets[0].side,'away');assert.equal(current(s).bets[0].potential,220);
 s=change(s,'settle',{matchId:'m1',winner:'away'});assert.equal(current(s).balance,940);
 for(const bad of [null,'null','{broken']){const archive=restore(null,bad,bets);assert.equal(current(archive),null);assert.equal(archive.legacyArchive.length,1);const later=change(archive,'create',{nickname:'New'});assert.equal(current(later).bets.length,0);assert.equal(later.legacyArchive.length,1);}
});
