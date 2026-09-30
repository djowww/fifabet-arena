import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,current,change,restore,duelsForProfile,duelReservedPoints,duelOpponent,findProfileByPlayerId,reviewDuelResult} from './model.mjs';

const photo='data:image/jpeg;base64,cGxhY2Fy';
const counterPhoto='data:image/png;base64,Y29udGVzdGFjYW8=';
const reviewer={demo:true,reviewerId:'demo-reviewer'};
function profiles(){
  let s=change(emptyState(),'create',{nickname:'Jogador A'});const a=s.activeProfileId;
  s=change(s,'create',{nickname:'Jogador B'});const b=s.activeProfileId;
  s=change(s,'create',{nickname:'Jogador C'});const c=s.activeProfileId;
  return {s:change(s,'login',{id:a}),a,b,c};
}
function invite(s,b,stake=100,operationId='invitation-1'){
  return change(s,'createDuel',{opponentId:b,stake,mode:'1v1',operationId,rules:'Se empatar, devolver os pontos.'});
}
function active(s,a,b,stake=100){
  s=invite(change(s,'login',{id:a}),b,stake);const id=duelsForProfile(s,a)[0].id;
  s=change(change(s,'login',{id:b}),'acceptDuel',{id});return {s,id};
}
function submit(s,id,homeScore=3,awayScore=1){
  return change(s,'submitDuelResult',{id,homeScore,awayScore,evidenceDataUrl:photo,evidenceName:'resultado.jpg'});
}
const total=s=>Object.values(s.profiles).reduce((sum,p)=>sum+p.balance+duelReservedPoints(s,p.id),0);

test('actual local profiles receive unique stable public IDs, including legacy migration',()=>{
  const {s,a,b}=profiles();
  for(const p of Object.values(s.profiles))assert.match(p.publicPlayerId,/^FBA-[A-F0-9]{8}$/);
  assert.notEqual(s.profiles[a].publicPlayerId,s.profiles[b].publicPlayerId);
  assert.equal(findProfileByPlayerId(s,` ${s.profiles[b].publicPlayerId.toLowerCase()} `)?.id,b);
  assert.equal(findProfileByPlayerId(s,'bia'),null);assert.equal(findProfileByPlayerId(s,'constructor'),null);
  const before=JSON.stringify(s),saved=restore(before);
  assert.equal(saved.profiles[a].publicPlayerId,s.profiles[a].publicPlayerId);
  assert.equal(JSON.stringify(s),before);
  const legacy=JSON.parse(before);legacy.version=6;for(const p of Object.values(legacy.profiles))delete p.publicPlayerId;
  const first=restore(legacy),second=restore(legacy);
  assert.equal(first.profiles[a].publicPlayerId,second.profiles[a].publicPlayerId);
  assert.equal(first.version,7);assert.deepEqual(first.duels,{});
  legacy.profiles[b].publicPlayerId=first.profiles[a].publicPlayerId;
  const recovered=restore(legacy);assert.notEqual(recovered.profiles[a].publicPlayerId,recovered.profiles[b].publicPlayerId);
});

test('invitation reserves sender points and only the actual invitee can accept, without fabricated people',()=>{
  let {s,a,b,c}=profiles();
  for(const opponentId of [a,'bia','unknown','constructor'])assert.throws(()=>invite(s,opponentId),/outro perfil/i);
  const original=JSON.stringify(s);
  for(const stake of ['',9,10.5,1001,Infinity,-1])assert.throws(()=>invite(s,b,stake));
  assert.equal(JSON.stringify(s),original);
  s=invite(s,b);const d=duelsForProfile(s)[0],id=d.id;
  assert.equal(d.status,'invited');assert.equal(s.profiles[a].balance,900);assert.equal(s.profiles[b].balance,1000);
  assert.equal(duelReservedPoints(s,a),100);assert.equal(duelReservedPoints(s,b),0);
  assert.equal(duelOpponent(s,d,a).id,b);assert.equal(duelOpponent(s,d,c),null);
  assert.equal(total(s),3000);
  const once=JSON.stringify(s);s=invite(s,b);assert.equal(JSON.stringify(s),once);
  assert.throws(()=>invite(s,b,100,'different-invitation'),/pendente/);
  assert.throws(()=>change(s,'acceptDuel',{id}),/convidado/);
  assert.throws(()=>change(change(s,'login',{id:c}),'acceptDuel',{id}),/não encontrado/);
  s=change(change(s,'login',{id:b}),'acceptDuel',{id});
  assert.equal(s.duels[id].status,'active');assert.equal(s.profiles[b].balance,900);assert.equal(duelReservedPoints(s,b),100);
  assert.equal(total(s),3000);
  const accepted=JSON.stringify(s);s=change(s,'acceptDuel',{id});assert.equal(JSON.stringify(s),accepted);
});

test('rejection and unaccepted cancellation refund exactly once, while insufficient acceptance remains atomic',()=>{
  for(const action of ['rejectDuel','cancelDuel']){
    let {s,a,b}=profiles();s=invite(s,b);const id=duelsForProfile(s)[0].id;
    if(action==='rejectDuel')s=change(s,'login',{id:b});
    s=change(s,action,{id});assert.equal(s.profiles[a].balance,1000);assert.equal(duelReservedPoints(s,a),0);
    assert.equal(s.duels[id].status,action==='rejectDuel'?'rejected':'cancelled');
    const after=JSON.stringify(s);s=change(s,action,{id});assert.equal(JSON.stringify(s),after);
    assert.equal(s.profiles[a].transactions.filter(t=>t.ref===`duel:${id}:refund`).length,1);
  }
  let {s,a,b}=profiles();
  s=change(change(s,'login',{id:b}),'purchaseSticker',{id:'cristiano-ronaldo'});
  s=invite(change(s,'login',{id:a}),b,500);const id=duelsForProfile(s)[0].id;
  s=change(s,'login',{id:b});const before=JSON.stringify(s);
  assert.throws(()=>change(s,'acceptDuel',{id}),/insuficiente/);assert.equal(JSON.stringify(s),before);
  assert.equal(s.profiles[a].balance,500);assert.equal(s.duels[id].status,'invited');
});

test('photo and peer agreement alone never distribute points; ordinary profiles cannot simulate a team review',()=>{
  let {s,a,b}=profiles();let id;({s,id}=active(s,a,b));
  assert.throws(()=>change(s,'submitDuelResult',{id,homeScore:3,awayScore:1}),/foto válida/);
  for(const score of ['',undefined,-1,100,0.5,true,[],{},'0x04'])assert.throws(()=>change(s,'submitDuelResult',{id,homeScore:score,awayScore:1,evidenceDataUrl:photo}),/placar/);
  s=submit(s,id);const report=s.duels[id].report;
  assert.equal(report.submittedBy,b);assert.equal(report.winnerId,a);assert.equal(s.duels[id].status,'review');
  assert.throws(()=>change(s,'confirmDuelResult',{id,reportId:report.id}),/outro perfil/);
  s=change(s,'login',{id:a});
  assert.throws(()=>change(s,'confirmDuelResult',{id,reportId:'stale'}),/resultado mudou/);
  s=change(s,'confirmDuelResult',{id,reportId:report.id});
  assert.equal(s.duels[id].peerConfirmed,true);assert.equal(s.duels[id].status,'review');
  assert.equal(s.profiles[a].balance,900);assert.equal(s.profiles[b].balance,900);assert.equal(duelReservedPoints(s,a),100);
  const after=JSON.stringify(s);s=change(s,'confirmDuelResult',{id,reportId:report.id});assert.equal(JSON.stringify(s),after);
  assert.throws(()=>change(s,'reviewDuelResult',{id,reportId:report.id,winnerId:a,reason:'Foto confere'}),/desconhecida/);
  assert.throws(()=>reviewDuelResult(s,{id,reportId:report.id,winnerId:a,reason:'Foto confere'}),/contexto explícito/);
  assert.throws(()=>reviewDuelResult(s,{id,reportId:report.id,winnerId:a,reason:'Foto confere'},{demo:true,reviewerId:a}),/contexto explícito/);
  const saved=restore(JSON.stringify(s));assert.equal(saved.duels[id].peerConfirmed,true);assert.equal(saved.duels[id].report.evidenceDataUrl,photo);
  assert.equal(saved.profiles[a].balance,900);assert.equal(duelReservedPoints(saved,a),100);
});

test('explicit developer review simulation preserves total points and settles once for wins and draws',()=>{
  for(const draw of [false,true]){
    let {s,a,b}=profiles();let id;({s,id}=active(s,a,b,250));
    s=submit(s,id,draw?2:4,2);const reportId=s.duels[id].report.id,winnerId=draw?null:a;
    s=change(change(s,'login',{id:a}),'confirmDuelResult',{id,reportId});
    s=reviewDuelResult(s,{id,reportId,winnerId,reason:'Simulação da avaliação da foto.'},reviewer);
    assert.equal(s.duels[id].status,'settled');assert.equal(s.duels[id].moderation.source,'local-demo');
    assert.equal(duelReservedPoints(s,a),0);assert.equal(duelReservedPoints(s,b),0);
    assert.equal(s.profiles[a].balance,draw?1000:1250);assert.equal(s.profiles[b].balance,draw?1000:750);assert.equal(total(s),3000);
    s=restore(JSON.stringify(s));const once=JSON.stringify(s);
    s=reviewDuelResult(s,{id,reportId,winnerId,reason:'Segunda tentativa não duplica.'},reviewer);assert.equal(JSON.stringify(s),once);
    assert.throws(()=>reviewDuelResult(s,{id,reportId,winnerId:draw?a:b,reason:'Alteração do resultado.'},reviewer),/outro resultado/);
    if(!draw)assert.equal(s.profiles[a].transactions.filter(t=>t.ref===`duel:${id}:payout`).length,1);
  }
});

test('disputes preserve both photos, require a new proposal and reject stale confirmations',()=>{
  let {s,a,b}=profiles();let id;({s,id}=active(s,a,b));s=submit(s,id);
  const original=s.duels[id].report.id;s=change(s,'login',{id:a});
  assert.throws(()=>change(s,'disputeDuelResult',{id,reportId:original,reason:'Placar diferente'}),/foto válida/);
  s=change(s,'disputeDuelResult',{id,reportId:original,reason:'A foto mostra outro placar.',evidenceDataUrl:counterPhoto,evidenceName:'contestacao.png'});
  assert.equal(s.duels[id].status,'disputed');assert.equal(s.duels[id].report.evidenceDataUrl,photo);
  assert.equal(s.duels[id].disputes[0].evidenceDataUrl,counterPhoto);assert.equal(total(s),3000);
  assert.throws(()=>change(s,'confirmDuelResult',{id,reportId:original}),/aguardando/);
  s=submit(s,id,1,3);const fresh=s.duels[id].report.id;assert.notEqual(fresh,original);
  assert.equal(s.duels[id].reports.length,2);assert.equal(s.duels[id].peerConfirmed,false);
  s=change(s,'login',{id:b});assert.throws(()=>change(s,'confirmDuelResult',{id,reportId:original}),/resultado mudou/);
  s=change(s,'confirmDuelResult',{id,reportId:fresh});
  const saved=restore(JSON.stringify(s));assert.equal(saved.duels[id].reports[0].evidenceDataUrl,photo);
  assert.equal(saved.duels[id].disputes[0].evidenceDataUrl,counterPhoto);assert.equal(saved.duels[id].status,'review');
  assert.equal(saved.profiles[a].balance,900);assert.equal(saved.profiles[b].balance,900);
});

test('active and disputed duels require both participants to cancel and refund escrow exactly once',()=>{
  let {s,a,b,c}=profiles();let id;({s,id}=active(s,a,b,500));
  assert.throws(()=>change(s,'cancelDuel',{id}),/criou/);
  s=change(s,'login',{id:a});assert.throws(()=>change(s,'cancelDuel',{id}),/concordância/);
  s=change(s,'requestDuelCancel',{id});
  assert.throws(()=>change(s,'confirmDuelCancel',{id}),/outro perfil/);
  assert.throws(()=>submit(s,id),/pedido de cancelamento/);
  assert.throws(()=>change(change(s,'login',{id:c}),'confirmDuelCancel',{id}),/não encontrado/);
  s=change(change(s,'login',{id:b}),'withdrawDuelCancel',{id});assert.equal(s.duels[id].cancelRequestedBy,null);
  s=submit(s,id);const reportId=s.duels[id].report.id;
  s=change(change(s,'login',{id:a}),'disputeDuelResult',{id,reportId,reason:'Não concordo com este placar.',evidenceDataUrl:counterPhoto});
  s=change(s,'requestDuelCancel',{id});s=change(change(s,'login',{id:b}),'confirmDuelCancel',{id});
  assert.equal(s.duels[id].status,'cancelled');assert.equal(s.profiles[a].balance,1000);assert.equal(s.profiles[b].balance,1000);
  assert.equal(s.duels[id].report.evidenceDataUrl,photo);assert.equal(total(s),3000);
  s=restore(JSON.stringify(s));const after=JSON.stringify(s);s=change(s,'confirmDuelCancel',{id});assert.equal(JSON.stringify(s),after);
});

test('restore retains active reservations and rejects stale paid records that could distribute points twice',()=>{
  let {s,a,b}=profiles();let id;({s,id}=active(s,a,b));
  const activeSaved=restore(JSON.stringify(s));assert.equal(activeSaved.duels[id].status,'active');assert.equal(duelReservedPoints(activeSaved,a),100);
  s=submit(s,id);const reportId=s.duels[id].report.id;s=change(change(s,'login',{id:a}),'confirmDuelResult',{id,reportId});
  s=reviewDuelResult(s,{id,reportId,winnerId:a,reason:'Foto conferida em simulação.'},reviewer);
  const corrupted=JSON.parse(JSON.stringify(s));corrupted.duels[id].status='review';corrupted.duels[id].reservedBy=[a,b];
  assert.equal(restore(corrupted).duels[id],undefined);
  assert.throws(()=>reviewDuelResult(corrupted,{id,reportId,winnerId:a,reason:'Tentativa de pagar duas vezes.'},reviewer),/já foram/);
  const other=JSON.parse(JSON.stringify(activeSaved));other.duels[id].creatorId='constructor';assert.deepEqual(restore(other).duels,{});
});
