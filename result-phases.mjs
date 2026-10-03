export function resultPhasesFields(duel,{esc}){
 return [['extraTime','Houve prorrogação','Placar final, incluindo os gols do tempo regulamentar'],['penalties','Houve disputa de pênaltis','Somente os gols da disputa de pênaltis']].filter(([key])=>duel.matchRules?.[key]).map(([key,label,hint])=>{
  const score=duel.result?.[key],enabled=!!score;
  return `<fieldset class='result-phase'><legend>${label}</legend><label class='result-phase-toggle'><input type='checkbox' name='use${key==='extraTime'?'ExtraTime':'Penalties'}' value='yes' data-phase-toggle='${key}' ${enabled?'checked':''}>${label}</label><p class='meta'>${hint}. ${key==='penalties'?'A equipe sempre confere o desempate antes de liberar o prêmio.':''}</p><div class='form-grid' data-phase-fields='${key}' ${enabled?'':'hidden'}>${['Home','Away'].map((side,i)=>`<label for='${key}${side}'>${esc(i?duel.guest?.nickname||'Convidado':duel.host?.nickname||'Anfitrião')}<input class='form-input' id='${key}${side}' name='${key}${side}' type='number' inputmode='numeric' min='0' max='99' step='1' value='${score?.[i?'awayScore':'homeScore']??''}' ${enabled?'required':'disabled'}></label>`).join('')}</div></fieldset>`;
 }).join('');
}
export function collectResultPhases(data){
 const result={};
 for(const [key,toggle]of [['extraTime','useExtraTime'],['penalties','usePenalties']])if(data.get(toggle)){
  const raw=[data.get(key+'Home'),data.get(key+'Away')],values=raw.map(Number);
  if(raw.some(v=>v===null||String(v).trim()==='')||values.some(v=>!Number.isSafeInteger(v)||v<0||v>99))throw Error('Informe os dois placares do desempate, de 0 a 99.');
  result[key]={homeScore:values[0],awayScore:values[1]};
 }
 return result;
}
export function resultScoreText(result,{reverse=false}={}){
 if(!result)return '—';const pair=p=>`${reverse?p.awayScore:p.homeScore} × ${reverse?p.homeScore:p.awayScore}`;
 return pair(result.extraTime||result)+(result.penalties?` · pênaltis ${pair(result.penalties)}`:'');
}

// OCR sees the final main score. It cannot reconstruct regulation from an extra-time photo.
export function recognitionScoreFields({scores,scoreSide,matchRules={},extraTimeSelected=false}={}){
 if(!['host','guest'].includes(scoreSide)||![scores?.left,scores?.right].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=99))return null;
 if(matchRules.extraTime&&!extraTimeSelected)return null;
 const prefix=matchRules.extraTime&&extraTimeSelected?'extraTime':'';
 const home=scoreSide==='host'?scores.left:scores.right,away=scoreSide==='host'?scores.right:scores.left;
 return prefix?{extraTimeHome:home,extraTimeAway:away}:{homeScore:home,awayScore:away};
}
