const POLICY={baseRating:1000,kFactor:24,ratingScale:400,winPoints:3,drawPoints:1,maxPairResultsPerUtcDay:3};
const compareIds=(a,b)=>a<b?-1:a>b?1:0;
const publicPlayer=user=>({publicPlayerId:user.publicPlayerId,nickname:user.nickname,clubId:user.clubId??null});

/** Compute the public ranking from approved current results, without touching prizes or history. */
export function rankingFor(state,userId,{limit=100}={}){
  if(!Number.isSafeInteger(limit)||limit<0||limit>1000)throw Error('Limite do ranking inválido.');
  const ranked=new Map(),pairs=new Map(),recent=[];
  for(const user of Object.values(state.users||{}))if(!user.onboardingRequired)ranked.set(user.id,{id:user.id,player:publicPlayer(user),rating:POLICY.baseRating,points:0,played:0,wins:0,draws:0,losses:0});
  const matches=Object.values(state.duels||{}).filter(duel=>duel.status==='completed'&&duel.hostId!==duel.guestId&&ranked.has(duel.hostId)&&ranked.has(duel.guestId)&&duel.result?.id&&duel.review?.resultId===duel.result.id&&Number.isFinite(Date.parse(duel.review.approvedAt))&&['host','guest','draw'].includes(duel.winner)&&duel.winnerId===(duel.winner==='draw'?null:duel.winner==='host'?duel.hostId:duel.guestId));
  matches.sort((a,b)=>Date.parse(a.review.approvedAt)-Date.parse(b.review.approvedAt)||compareIds(a.id,b.id));
  for(const duel of matches){
    const pair=JSON.stringify([[duel.hostId,duel.guestId].sort(compareIds),new Date(duel.review.approvedAt).toISOString().slice(0,10)]),count=pairs.get(pair)||0;
    if(count>=POLICY.maxPairResultsPerUtcDay)continue;
    pairs.set(pair,count+1);
    const host=ranked.get(duel.hostId),guest=ranked.get(duel.guestId),score=duel.winner==='draw'?0.5:duel.winner==='host'?1:0;
    const expected=1/(1+10**((guest.rating-host.rating)/POLICY.ratingScale)),change=POLICY.kFactor*(score-expected);
    const before=duel.hostId===userId?host.rating:duel.guestId===userId?guest.rating:null;
    host.rating+=change;guest.rating-=change;
    if(before!==null){
      const ownScore=duel.hostId===userId?score:1-score,rating=Math.round(duel.hostId===userId?host.rating:guest.rating);
      recent.unshift({publicMatchId:duel.publicMatchId||null,approvedAt:duel.review.approvedAt,rating,change:rating-Math.round(before),outcome:ownScore===1?'win':ownScore===0.5?'draw':'loss'});
      if(recent.length>20)recent.pop();
    }
    for(const [entry,outcome]of [[host,score],[guest,1-score]]){
      entry.played++;
      if(outcome===1){entry.wins++;entry.points+=POLICY.winPoints;}
      else if(outcome===0.5){entry.draws++;entry.points+=POLICY.drawPoints;}
      else entry.losses++;
    }
  }
  const entries=[...ranked.values()].filter(entry=>entry.played>0).sort((a,b)=>b.rating-a.rating||b.points-a.points||b.wins-a.wins||compareIds(a.id,b.id)).map(({id,...entry},index)=>({id,...entry,rating:Math.round(entry.rating),rank:index+1,position:index+1}));
  const account=ranked.get(userId),personal=entries.find(entry=>entry.id===userId)||(account?{...account,rank:null,position:null}:null);
  const project=({id,...entry})=>entry;
  return {entries:entries.slice(0,limit).map(project),personal:personal?{...project(personal),unranked:personal.played===0,recent}:null,policy:{...POLICY}};
}
