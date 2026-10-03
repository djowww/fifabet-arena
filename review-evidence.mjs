// Private result photos only. Callers enforce participant/reviewer authorization.
const riskLabels={
 high_stake:'Valor da partida exige revisão',match_risk_review:'Risco da partida exige revisão',
 awaiting_confirmation:'Aguardando confirmação do rival',open_problem:'Problema ou contestação em aberto',
 match_timeout:'Prazo da partida encerrado',confirmation_expired:'Prazo de confirmação encerrado',
 independent_evidence_required:'Fotos independentes necessárias',duplicate_evidence:'Foto repetida',
 visual_check_unavailable:'Comparação visual indisponível',visual_similarity:'Fotos semelhantes',
 recognition_review_required:'Leitura do placar exige revisão',not_final_screen:'Tela final não identificada',
 recognition_not_clear:'Leitura do placar inconclusiva',recognition_unavailable:'Leitura indisponível',
 score_mismatch:'Placar lido diverge do relato',invalid_orientation:'Ordem dos jogadores não identificada'
};
const riskLabel=reason=>riskLabels[reason]||'Revisão adicional necessária';
const validScore=value=>Number.isInteger(value)&&value>=0&&value<=99;

export function renderReviewEvidence({duel,result=duel?.result,evidence=duel?.evidence,esc,url=id=>`/api/v1/evidence/${encodeURIComponent(id)}`,when=value=>value}={}){
 if(!result)return '';
 const metadata=id=>Array.isArray(evidence)?evidence.find(item=>item.id===id):evidence?.[id];
 const player=id=>id===duel.hostId?duel.host:id===duel.guestId?duel.guest:null;
 const photo=(id,expectedAuthorId,side,role,date)=>{
  if(!id)return `<article class='review-evidence-photo'><h3>${role}</h3><p class='account-note'>${role==='Foto de confirmação'?'Aguardando foto de confirmação.':'Foto indisponível.'}</p></article>`;
  const item=metadata(id),author=player(item?.authorId??expectedAuthorId),reading=item?.recognition;
  // Ignore URLs stored in evidence. Zoom keeps the same authenticated endpoint.
  const candidate=url(id),expected=`/api/v1/evidence/${encodeURIComponent(id)}`;
  const privateUrl=typeof candidate==='string'&&candidate===expected&&!['.','..'].includes(id)?candidate:null;
  const left=side==='host'?duel.host:side==='guest'?duel.guest:null;
  const risks=[];
  if(item?.authorId&&item.authorId!==expectedAuthorId)risks.push('Autor diferente do relato');
  if(item?.duplicateEvidence)risks.push(riskLabels.duplicate_evidence);
  if(item?.visualCheck?.similarEvidence)risks.push(riskLabels.visual_similarity);
  if(item?.visualCheck&&item.visualCheck.status!=='checked')risks.push(riskLabels.visual_check_unavailable);
  else if(item?.visualCheck?.requiresReview&&!item.visualCheck.similarEvidence)risks.push(riskLabel(item.visualCheck.reason));
  if(reading?.finalScreen===false)risks.push(riskLabels.not_final_screen);
  else if(reading?.requiresReview)risks.push(riskLabel(reading.reason||'recognition_review_required'));
  const readingLabel=!reading||reading.status==='unavailable'?'Leitura indisponível':reading.status==='suggested'&&!reading.requiresReview&&reading.finalScreen===true?'Leitura disponível':'Leitura exige revisão';
  const readScores=validScore(reading?.scores?.left)&&validScore(reading?.scores?.right)?`<p>Esquerda: ${reading.scores.left} · direita: ${reading.scores.right}</p>`:'';
  const confidence=Number.isFinite(reading?.confidence)&&reading.confidence>=0&&reading.confidence<=100?`<p>Confiança da leitura: ${esc(reading.confidence)}%</p>`:'';
  return `<article class='review-evidence-photo'><h3>${role}</h3><p class='review-evidence-author'>Autor: ${esc(author?.nickname||'Não identificado')}${author?.publicPlayerId?` <span>· ${esc(author.publicPlayerId)}</span>`:''}</p>${item?.createdAt||date?`<p class='review-evidence-date'>${esc(when(item?.createdAt||date))}</p>`:''}${privateUrl?`<a class='review-evidence-zoom' href='${esc(privateUrl)}' target='_blank' rel='noopener noreferrer' aria-label='Ampliar ${esc(role.toLocaleLowerCase('pt-BR'))}, abre em nova aba'><img src='${esc(privateUrl)}' alt='${esc(role)} de ${esc(author?.nickname||'autor não identificado')}' loading='lazy' decoding='async'><span>Ampliar foto <small>(nova aba)</small></span></a>`:`<p class='account-note'>Foto indisponível.</p>`}<div class='review-evidence-reading'><p>À esquerda: ${esc(left?.nickname||'Ordem não informada')}</p><p><strong>${readingLabel}</strong></p>${readScores}${confidence}</div>${risks.length?`<ul class='review-evidence-risks'>${[...new Set(risks)].map(label=>`<li>${esc(label)}</li>`).join('')}</ul>`:''}</article>`;
 };
 const reasons=[duel.manualReviewReason,result.manualReviewReason,result.riskReason].filter(Boolean);
 if(duel.matchRisk)reasons.push('match_risk_review');
 const riskNotes=reasons.length?`<ul class='review-evidence-risks'>${[...new Set(reasons.map(riskLabel))].map(label=>`<li>${esc(label)}</li>`).join('')}</ul>`:'';
 const duplicate=result.evidenceId&&result.evidenceId===result.confirmationEvidenceId?`<p class='review-evidence-warning'>As duas fotos usam a mesma evidência. Fotos independentes são necessárias.</p>`:'';
 return `<section class='review-evidence' aria-label='Fotos privadas do resultado'><h2>Confira as duas fotos</h2><p class='account-note'>A leitura compara números e exige conferir a tela final e os jogadores. Ela não comprova a autenticidade da foto.</p>${riskNotes}${duplicate}<div class='review-evidence-grid'>${photo(result.evidenceId,result.reporterId,result.scoreSide,'Foto do relato',result.submittedAt)}${photo(result.confirmationEvidenceId,result.confirmedBy,result.confirmationScoreSide,'Foto de confirmação',result.confirmedAt)}</div></section>`;
}
