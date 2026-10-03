import test from 'node:test';
import assert from 'node:assert/strict';
import * as privacy from './account-privacy.mjs';
const time=Date.parse('2026-10-03T12:00:00Z');
function fixture(){
 const target={id:'owner',publicPlayerId:'FBA-0123456789',nickname:'Original',balance:0,demoBalance:0,walletOpeningBalance:0,transactions:[{id:'tx1',amount:100,reference:'admin:g'},{id:'tx2',amount:-100,reference:'reserve:d'}],demoTransactions:[{id:'demo-history',amount:1}],passwordHash:'secret-hash',passwordSalt:'secret-salt',recoveryCodes:['secret-code'],recoveryCodesCreatedAt:'2026-10-02T00:00:00Z',clubId:'club',gameAccount:{eaId:'private-account'},friends:['admin'],email:'private@example.test',countryCode:'BR',termsAcceptance:{version:'current',acceptedAt:'2026-10-01T00:00:00Z'},deletionRequest:{requestedAt:'2026-10-03T00:00:00Z',status:'pending_review',reason:'Quero remover meu cadastro.'}};
 const actor={id:'admin',friends:['owner','other']};
 const state={users:{owner:target,admin:actor,other:{id:'other',friends:['owner']}},sessions:{ownerSession:{userId:'owner'},adminSession:{userId:'admin'}},authIdentities:{googleOwner:{userId:'owner',email:'owner@example.test'},googleAdmin:{userId:'admin',email:'admin@example.test'}},duels:{closed:{id:'closed',hostId:'owner',guestId:'other',status:'completed'}},deposits:{closed:{userId:'owner',status:'approved',priceCents:1000}},evidence:{photo:{id:'photo',authorId:'owner'}},walletEvidence:{proof:{id:'proof',authorId:'owner'}},houseTransactions:{fee:{amount:18}}};
 return {state,target,actor};
}
function review(data,input={decision:'anonymize',reason:'Solicitação conferida pela equipe.'}){assert.equal(typeof privacy.reviewAccountDeletion,'function');return privacy.reviewAccountDeletion(data.state,data.target,data.actor,input,time);}
const match=(id,winner='host',approvedAt='2026-10-01T00:00:00Z')=>({id,hostId:'owner',guestId:'other',status:'completed',winner,winnerId:winner==='host'?'owner':winner==='guest'?'other':null,result:{id:'r'+id},review:{resultId:'r'+id,approvedAt}});

test('achievements are earned from current approved results with their actual approval dates',()=>{
 assert.equal(typeof privacy.achievementsFor,'function');
 const {state}=fixture();state.duels={draw:match('draw','draw','2026-10-01T00:00:00Z'),firstWin:match('firstWin','host','2026-10-02T00:00:00Z')};
 const result=privacy.achievementsFor(state,'owner');
 assert.deepEqual(result.map(({id,earnedAt})=>({id,earnedAt})),[{id:'first_validated_match',earnedAt:'2026-10-01T00:00:00Z'},{id:'first_win',earnedAt:'2026-10-02T00:00:00Z'}]);
 assert.equal(result.every(item=>typeof item.title==='string'&&item.title.length>0&&typeof item.description==='string'),true);
 assert.deepEqual(privacy.achievementsFor(state,'missing'),[]);
});

test('five-win achievement counts real validated wins even beyond the ranking pair cap and ignores stale approvals',()=>{
 assert.equal(typeof privacy.achievementsFor,'function');
 const {state}=fixture();state.duels={};
 for(let i=1;i<=5;i++)state.duels['win'+i]=match('win'+i,'host',`2026-10-02T0${i}:00:00Z`);
 Object.assign(state.duels,{stale:{...match('stale','host','2026-09-01'),review:{resultId:'old',approvedAt:'2026-09-01'}},pending:{...match('pending'),status:'pending_review'},inconsistent:{...match('inconsistent','host','2026-09-01'),winnerId:'other'},badDate:match('badDate','host','invalid')});
 assert.deepEqual(privacy.achievementsFor(state,'owner').map(({id,earnedAt})=>({id,earnedAt})),[{id:'first_validated_match',earnedAt:'2026-10-02T01:00:00Z'},{id:'first_win',earnedAt:'2026-10-02T01:00:00Z'},{id:'five_wins',earnedAt:'2026-10-02T05:00:00Z'}]);
});

test('anonymization disables authentication and profile identity while retaining financial and private evidence records',()=>{
 const data=fixture(),retained=structuredClone({duels:data.state.duels,deposits:data.state.deposits,evidence:data.state.evidence,walletEvidence:data.state.walletEvidence,houseTransactions:data.state.houseTransactions,transactions:data.target.transactions,demoTransactions:data.target.demoTransactions,terms:data.target.termsAcceptance,country:data.target.countryCode});
 const request=review(data);
 assert.equal(data.target.disabledAt,'2026-10-03T12:00:00.000Z');assert.equal(data.target.nickname,'Removido_0123456789');assert.equal(data.target.clubId,null);assert.equal(data.target.gameAccount,null);assert.deepEqual(data.target.friends,[]);
 for(const field of ['passwordHash','passwordSalt','recoveryCodes','recoveryCodesCreatedAt','email'])assert.equal(Object.hasOwn(data.target,field),false);
 assert.deepEqual(data.actor.friends,['other']);assert.deepEqual(data.state.users.other.friends,[]);
 assert.deepEqual(data.state.sessions,{adminSession:{userId:'admin'}});assert.deepEqual(data.state.authIdentities,{googleAdmin:{userId:'admin',email:'admin@example.test'}});
 assert.deepEqual({duels:data.state.duels,deposits:data.state.deposits,evidence:data.state.evidence,walletEvidence:data.state.walletEvidence,houseTransactions:data.state.houseTransactions,transactions:data.target.transactions,demoTransactions:data.target.demoTransactions,terms:data.target.termsAcceptance,country:data.target.countryCode},retained);
 assert.deepEqual(request,{requestedAt:'2026-10-03T00:00:00Z',status:'anonymized',reason:'Quero remover meu cadastro.',decision:{outcome:'anonymize',actorId:'admin',reason:'Solicitação conferida pela equipe.',date:'2026-10-03T12:00:00.000Z'}});
});

test('positive balances and active memberships, invitations or deposit orders block anonymization atomically',()=>{
 for(const mutate of [
  data=>data.target.balance=1,data=>data.target.demoBalance=1,
  ...['invited','awaiting_funds','waiting_start','in_progress','pending_review','disputed'].map(status=>data=>data.state.duels.open={id:'open',hostId:'owner',status}),
  data=>data.state.duels.open={id:'open',hostId:'other',guestId:'owner',status:'in_progress'},
  data=>data.state.duels.open={id:'open',hostId:'other',recipientId:'owner',status:'invited'},
  ...['pending','review'].map(status=>data=>data.state.deposits.open={userId:'owner',status})
 ]){const data=fixture();mutate(data);const before=structuredClone(data.state);assert.throws(()=>review(data),error=>error.status===409&&error.code==='account_deletion_pending_financial');assert.deepEqual(data.state,before);}
});

test('rejecting an account deletion preserves access and the original private request reason',()=>{
 const data=fixture();data.target.balance=100;const before=structuredClone(data.state);
 const request=review(data,{decision:'reject',reason:'Há uma obrigação pendente a conferir.'});
 assert.equal(request.status,'rejected');assert.equal(request.reason,'Quero remover meu cadastro.');assert.equal(request.decision.outcome,'reject');
 const originalRequest=before.users.owner.deletionRequest;before.users.owner.deletionRequest=data.target.deletionRequest;assert.deepEqual(data.state,before);assert.equal(originalRequest.status,'pending_review');
});

test('deletion review requires a pending request, independent existing actor and a documented decision',()=>{
 for(const [mutate,input,code]of [
  [data=>data.actor=data.target,{decision:'anonymize',reason:'Solicitação conferida pela equipe.'},'independent_admin_required'],
  [data=>data.actor={id:'outsider'},{decision:'anonymize',reason:'Solicitação conferida pela equipe.'},'independent_admin_required'],
  [data=>delete data.target.deletionRequest,{decision:'anonymize',reason:'Solicitação conferida pela equipe.'},'account_deletion_not_pending'],
  [data=>data.target.deletionRequest.status='rejected',{decision:'anonymize',reason:'Solicitação conferida pela equipe.'},'account_deletion_not_pending'],
  [()=>{}, {decision:'delete',reason:'Solicitação conferida pela equipe.'},'invalid_account_deletion_decision'],
  [()=>{}, {decision:'anonymize',reason:'short'},'invalid_account_deletion_reason']
 ]){const data=fixture();mutate(data);const before=structuredClone(data.state);assert.throws(()=>review(data,input),error=>error.code===code);assert.deepEqual(data.state,before);}
});

test('a preclaimed anonymization nickname gets a unique fallback without changing public or financial IDs',()=>{
 const data=fixture();data.actor.nickname='ｒｅｍｏｖｉｄｏ_0123456789';const publicId=data.target.publicPlayerId,originalId=data.target.id;
 review(data);
 assert.match(data.target.nickname,/^Removido_[A-F0-9]{10}$/);
 assert.notEqual(data.target.nickname.toLowerCase(),'removido_0123456789');assert.equal(data.target.nickname.length<=20,true);
 assert.equal(data.actor.nickname,'ｒｅｍｏｖｉｄｏ_0123456789');assert.equal(data.target.id,originalId);assert.equal(data.target.publicPlayerId,publicId);assert.equal(data.target.transactions[0].reference,'admin:g');
});
