import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePhotoScore,inspectScoreText,isFinalScoreScreen,MAX_OCR_TEXT_LENGTH} from './result-verification.mjs';
import {parseScoreText,summarizeRecognition} from './result-recognition.mjs';

const reading=(scores={left:3,right:1},extra={})=>({status:'suggested',provider:'local-ocr',confidence:94,requiresReview:false,finalScreen:true,scores,...extra});
const compare=(extra={})=>comparePhotoScore({recognition:reading(),homeScore:3,awayScore:1,scoreSide:'host',...extra});

test('a clear score matches only with explicit host/guest orientation',()=>{
  assert.equal(compare().verdict,'matched');
  assert.equal(compare().requiresReview,false);
  const reversed=compare({recognition:reading({left:1,right:3}),scoreSide:'guest'});
  assert.equal(reversed.verdict,'matched');
  assert.deepEqual(reversed.recognizedScores,{homeScore:3,awayScore:1});
  assert.equal(compare({recognition:reading({left:1,right:3})}).verdict,'mismatch');
  assert.equal(compare({scoreSide:undefined}).verdict,'unreadable');
  assert.equal(compare({scoreSide:'anything'}).requiresReview,true);
});

test('reported score mismatches and disagreement require review',()=>{
  for(const scores of [{left:3,right:2},{left:2,right:1},{left:1,right:3}]){
    const checked=compare({recognition:reading(scores)});
    assert.equal(checked.verdict,'mismatch');assert.equal(checked.requiresReview,true);
  }
  assert.equal(compare({recognition:reading({left:0,right:0}),homeScore:0,awayScore:0}).verdict,'matched');
});

test('confidence, older suggestions and unsupported readings fail closed',()=>{
  assert.equal(compare({recognition:reading(undefined,{confidence:80})}).verdict,'matched');
  for(const confidence of [79.99,45,0,101,NaN,Infinity,'99'])assert.equal(compare({recognition:reading(undefined,{confidence})}).verdict,'unreadable');
  for(const requiresReview of [true,undefined,null])assert.equal(compare({recognition:reading(undefined,{requiresReview})}).verdict,'unreadable');
  assert.equal(compare({recognition:reading(undefined,{status:'unreadable'})}).verdict,'unreadable');
  assert.equal(compare({recognition:{status:'unavailable',scores:null}}).verdict,'unavailable');
  assert.equal(compare({recognition:null}).verdict,'unavailable');
  assert.equal(compare({recognition:reading(undefined,{provider:'external'})}).verdict,'unavailable');
});

test('numbers must be bounded integers from both report and image',()=>{
  for(const value of [-1,31,1.2,'3',undefined,null,NaN,Infinity]){
    assert.equal(compare({homeScore:value}).verdict,'unreadable');
    assert.equal(compare({awayScore:value}).verdict,'unreadable');
    assert.equal(compare({recognition:reading({left:value,right:1})}).verdict,'unreadable');
    assert.equal(compare({recognition:reading({left:3,right:value})}).verdict,'unreadable');
  }
});

test('single bounded score extraction ignores clocks and labelled statistics',()=>{
  assert.deepEqual(inspectScoreText('FINAL\nReal Madrid 3 - 1 PSG\n90:00\nShots 13 - 10')?.scores,{left:3,right:1});
  for(const text of ['3 × 1','3x1','Placar 3 — 1','PSG 0 – 0 REAL'])assert.ok(inspectScoreText(text));
  for(const text of ['12:34','90:00','03-10-2026','20/10/2026','50% - 50%','Chutes 3 - 1','Shots\n3 - 1','Posse de bola 3 - 1','xG 3 - 1','Precisão 3 - 1','Pênaltis 3 - 1','Expected goals 3 - 1','31 - 1','1.3 - 1','3 - 1.3','3 - 1 90','3 - 1 - 0','123 - 1','Final 3 - 1 2026'])assert.equal(inspectScoreText(text),null,text);
});

test('duplicate, conflicting or excessively long OCR text is ambiguous',()=>{
  for(const text of ['3 - 1\n2 - 0','3 - 1\n3 - 1','3 - 1 e 2 - 0','3 - 1\n31 - 0'])assert.equal(inspectScoreText(text),null,text);
  assert.equal(inspectScoreText('3 - 1\n'+' '.repeat(MAX_OCR_TEXT_LENGTH)),null);
  assert.equal(inspectScoreText(null),null);
});

test('score-line confidence and truncation gate eligibility without leaking raw text',()=>{
  const base={text:'PARTIDA ENCERRADA\nReal Madrid 3 - 1 PSG',confidence:94,scoreConfidence:92,truncated:false};
  const clear=summarizeRecognition(base);
  assert.equal(clear.requiresReview,false);assert.equal(clear.confidence,92);
  assert.equal(clear.text,undefined);assert.equal(clear.scoreConfidence,undefined);
  for(const extra of [{scoreConfidence:79.99},{confidence:79.99},{scoreConfidence:null},{scoreConfidence:undefined},{scoreConfidence:101},{truncated:true},{truncated:undefined},{text:'3 - 1\n3 - 1'},{text:'Chutes 3 - 1'}])assert.equal(summarizeRecognition({...base,...extra}).requiresReview,true,JSON.stringify(extra));
  assert.equal(summarizeRecognition({...base,scoreConfidence:79.99}).confidence,79);
});

test('legacy 45-percent suggestions remain readable but cannot release credits',()=>{
  assert.deepEqual(parseScoreText('3 - 1',45),{left:3,right:1});
  assert.equal(parseScoreText('3 - 1',44),null);
  const suggestion=summarizeRecognition({text:'3 - 1',confidence:45,scoreConfidence:45,truncated:false});
  assert.equal(suggestion.status,'suggested');assert.equal(suggestion.requiresReview,true);
  assert.equal(compare({recognition:suggestion}).verdict,'unreadable');
});

test('a live console overlay or bare score cannot qualify as a final screen',()=>{
  // Text derived from the user's live-console photo: no image is stored in Git.
  const sample="rm O20 mun,\n\n‘59:59\n";
  assert.equal(isFinalScoreScreen(sample),false);
  for(const text of ['FUL 0 × 0 MUN\n59:59\nAugust 30 Next Fixture','3 - 1','FT\n3 - 1','FT UNITED 3 - 1 PSG','PARTIDA ENCERRADA\n3 - 1\n59:59','FINAL SCORE\n3 - 1\nNext Fixture','FULL TIME\n3 - 1\n45:00','HALF TIME\n3 - 1','NOT FULL TIME\n3 - 1'])assert.equal(isFinalScoreScreen(text),false,text);
  const live=summarizeRecognition({text:'FUL 0 × 0 MUN\n59:59',confidence:94,scoreConfidence:94,truncated:false});
  assert.equal(live.status,'suggested');assert.equal(live.finalScreen,false);assert.equal(live.requiresReview,true);assert.equal(live.reason,'not_final_screen');
  for(const finalScreen of [false,undefined,null,'true']){
    const checked=compare({recognition:reading(undefined,{finalScreen})});assert.equal(checked.verdict,'unreadable');assert.equal(checked.reason,'not_final_screen');
  }
});

test('explicit final labels qualify while score extraction still rejects stats and ambiguity',()=>{
  for(const marker of ['PARTIDA ENCERRADA','FIM DE JOGO','FIM DA PARTIDA','FULL TIME','FULL-TIME','FINAL SCORE','RESULTADO FINAL','MATCH ENDED'])assert.equal(isFinalScoreScreen(`${marker}\nREAL 3 - 1 PSG`),true,marker);
  const final=summarizeRecognition({text:'FIM DE JOGO\nREAL 3 - 1 PSG\n90:00\nShots 13 - 10\nPosse 53% - 47%',confidence:94,scoreConfidence:92,truncated:false});
  assert.equal(final.finalScreen,true);assert.equal(final.requiresReview,false);assert.equal(final.reason,'score_suggested');
  assert.equal(compare({recognition:final}).verdict,'matched');
  const ambiguous=summarizeRecognition({text:'FINAL SCORE\n3 - 1\n2 - 0',confidence:94,scoreConfidence:92,truncated:false});
  assert.equal(ambiguous.finalScreen,true);assert.equal(ambiguous.requiresReview,true);assert.equal(ambiguous.reason,'recognition_not_clear');
});
