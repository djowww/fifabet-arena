import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReviewEvidence} from './review-evidence.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const duel={hostId:'h',guestId:'g',host:{nickname:'<Host>',publicPlayerId:'FG-HOST'},guest:{nickname:'Guest',publicPlayerId:'FG-GUEST'},result:{reporterId:'h',confirmedBy:'g',evidenceId:'first/photo',confirmationEvidenceId:'second-photo',scoreSide:'host',confirmationScoreSide:'guest',homeScore:3,awayScore:1}};
const evidence=[{id:'first/photo',authorId:'h',createdAt:'2026-10-01',recognition:{provider:'local-ocr',status:'suggested',scores:{left:3,right:1},confidence:95,finalScreen:true,requiresReview:false},visualCheck:{status:'checked'}},{id:'second-photo',authorId:'g',createdAt:'2026-10-02',recognition:{provider:'local-ocr',status:'suggested',scores:{left:1,right:3},confidence:91,finalScreen:true,requiresReview:false},visualCheck:{status:'checked'}}];
const context={duel,evidence,esc,url:id=>`/api/v1/evidence/${encodeURIComponent(id)}`,when:value=>`DATA ${value}`};

test('independent evidence renders both private photo URLs with authors, role and keyboard zoom links',()=>{
 const html=renderReviewEvidence(context);
 assert.match(html,/Foto do relato/);assert.match(html,/Foto de confirmação/);assert.match(html,/&lt;Host&gt;/);assert.match(html,/FG-HOST/);assert.match(html,/FG-GUEST/);
 assert.match(html,/href='\/api\/v1\/evidence\/first%2Fphoto'/);assert.match(html,/href='\/api\/v1\/evidence\/second-photo'/);
 assert.match(html,/target='_blank' rel='noopener noreferrer'/);assert.match(html,/Ampliar foto/);assert.match(html,/DATA 2026-10-02/);
 assert.doesNotMatch(html,/convite|invite|<Host>/);
});
test('each photo explains its own score orientation and OCR numbers',()=>{
 const html=renderReviewEvidence(context);
 assert.match(html,/À esquerda: &lt;Host&gt;/);assert.match(html,/À esquerda: Guest/);
 assert.match(html,/Esquerda: 3 · direita: 1/);assert.match(html,/Esquerda: 1 · direita: 3/);
 assert.equal((html.match(/Leitura disponível/g)||[]).length,2);
});
test('missing confirmation is an honest waiting state and never reuses the primary image',()=>{
 const html=renderReviewEvidence({...context,duel:{...duel,result:{...duel.result,confirmationEvidenceId:null,confirmedBy:null}}});
 assert.match(html,/Aguardando foto de confirmação/);assert.equal((html.match(/<img /g)||[]).length,1);assert.doesNotMatch(html,/second-photo/);
});
test('review risks and inconclusive recognition use Portuguese labels instead of raw codes',()=>{
 const html=renderReviewEvidence({...context,duel:{...duel,manualReviewReason:'high_stake'},evidence:[{...evidence[0],duplicateEvidence:true,visualCheck:{status:'checked',similarEvidence:true},recognition:{status:'unreadable',finalScreen:false,reason:'not_final_screen'}},evidence[1]]});
 for(const label of ['Valor da partida exige revisão','Foto repetida','Fotos semelhantes','Tela final não identificada'])assert.match(html,new RegExp(label));
 assert.doesNotMatch(html,/high_stake|not_final_screen|similarEvidence/);
});
test('missing recognition and metadata never claim a verified or clear photograph',()=>{
 const html=renderReviewEvidence({...context,evidence:[]});assert.match(html,/Leitura indisponível/);assert.match(html,/Autor: &lt;Host&gt;/);
 assert.doesNotMatch(html,/Leitura disponível|Foto autenticada|confiança: 0/);
});
test('author is taken from evidence metadata even when it differs from the reporter',()=>{
 const html=renderReviewEvidence({...context,evidence:[{...evidence[0],authorId:'g'},evidence[1]]});
 assert.match(html,/Autor: Guest/);assert.match(html,/Autor diferente do relato/);
});
test('evidence metadata URLs and unexpected URL callbacks cannot create public or executable links',()=>{
 const html=renderReviewEvidence({...context,url:()=> 'javascript:alert(1)',evidence:evidence.map(item=>({...item,url:'https://example.test/shared-photo'}))});
 assert.doesNotMatch(html,/javascript:|example.test|<a /);assert.match(html,/Foto indisponível/);
});
test('no result produces no private evidence section',()=>assert.equal(renderReviewEvidence({...context,duel:{...duel,result:null}}),''));
