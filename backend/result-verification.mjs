// These checks compare numbers only. A matching score does not prove that a
// photograph is authentic, belongs to this match, or shows its final result.
export const MIN_SCORE_CONFIDENCE=80;
export const MAX_SCORE=30;
export const MAX_OCR_TEXT_LENGTH=12_000;

const scorePair=()=>/(?<![\p{L}\p{N}.,])([0-9]{1,2})\s*[-–—×x]\s*([0-9]{1,2})(?![\p{L}\p{N}.,])/giu;
const statistics=/\b(?:shots?|shoots?|chutes?|finaliza[cç][oõ]es|posse(?:ssion)?|passes?|passing|accuracy|precis[aã]o|corners?|escanteios|fouls?|faltas|tackles?|desarmes|offsides?|impedimentos|saves?|defesas|expected\s+goals|gols?\s+esperados|xg|penalt(?:y|ies|is)|p[eê]naltis|shootout|estat[ií]sticas?|statistics|stats)\b/iu;
const normalizeLine=value=>value.replace(/\s+/g,' ').trim();
const finalMarker=/(?<![\p{L}\p{N}])(?:PARTIDA\s+ENCERRADA|FIM\s+(?:DE\s+JOGO|DA\s+PARTIDA)|FULL(?:\s+|-)TIME|FINAL\s+SCORE|RESULTADO\s+FINAL|MATCH\s+ENDED)(?![\p{L}\p{N}])/iu;

// The game's live overlay is not a finished result. Short club initials such as
// "FT" are deliberately insufficient; only explicit final-result labels count.
export function isFinalScoreScreen(text){
  if(typeof text!=='string'||text.length>MAX_OCR_TEXT_LENGTH)return false;
  const normalized=text.normalize('NFKC');
  if(!finalMarker.test(normalized))return false;
  if(/\b(?:NEXT\s*FIXTURE|PARTIDA\s+EM\s+ANDAMENTO|MATCH\s+IN\s+PROGRESS|HALF(?:\s+|-)TIME|INTERVALO|NOT\s+FULL(?:\s+|-)TIME)\b/iu.test(normalized))return false;
  for(const clock of normalized.matchAll(/(?<![0-9])([0-9]{1,3}):([0-5][0-9])(?![0-9])/gu)){
    if(![90,120].includes(Number(clock[1]))||Number(clock[2])!==0)return false;
  }
  return true;
}

// A single score occurrence is required. Repeated pairs (even identical ones),
// unrelated numbers, dates, clocks and stat labels are ambiguous for release.
// Return the source line only inside the OCR process; never persist its text.
export function inspectScoreText(text){
  if(typeof text!=='string'||text.length>MAX_OCR_TEXT_LENGTH)return null;
  let candidate=null,previous='';
  for(const line of text.split(/\r?\n/)){
    const previousWasStatistic=statistics.test(previous);
    if(line.trim())previous=line;
    if(/[%/:$€£]|R\$/u.test(line)||statistics.test(line)||previousWasStatistic)continue;
    const matches=[...line.matchAll(scorePair())];
    if(!matches.length)continue;
    if(matches.length!==1||candidate)return null;
    const match=matches[0],left=Number(match[1]),right=Number(match[2]);
    const rest=line.slice(0,match.index)+line.slice(match.index+match[0].length);
    if(left>MAX_SCORE||right>MAX_SCORE||/\d|[-–—×]/u.test(rest))return null;
    candidate={scores:{left,right},line:normalizeLine(line)};
  }
  return candidate;
}

export function comparePhotoScore({recognition,homeScore,awayScore,scoreSide}={}){
  const result=(verdict,reason,confidence=null,recognizedScores)=>({verdict,requiresReview:verdict!=='matched',reason,confidence,...(recognizedScores?{recognizedScores}: {})});
  if(!recognition||recognition.status==='unavailable')return result('unavailable','recognition_unavailable');
  if(recognition.provider!=='local-ocr')return result('unavailable','provider_unavailable');
  if(recognition.finalScreen!==true)return result('unreadable','not_final_screen');
  const confidence=recognition.confidence;
  if(recognition.status!=='suggested'||!Number.isFinite(confidence)||confidence<MIN_SCORE_CONFIDENCE||confidence>100||recognition.requiresReview!==false)return result('unreadable','recognition_not_clear',Number.isFinite(confidence)&&confidence>=0&&confidence<=100?confidence:null);
  const validScore=value=>Number.isInteger(value)&&value>=0&&value<=MAX_SCORE;
  if(!validScore(homeScore)||!validScore(awayScore))return result('unreadable','invalid_report',confidence);
  if(!['host','guest'].includes(scoreSide))return result('unreadable','invalid_orientation',confidence);
  const left=recognition.scores?.left,right=recognition.scores?.right;
  if(!validScore(left)||!validScore(right))return result('unreadable','invalid_recognized_score',confidence);
  const recognizedScores=scoreSide==='host'?{homeScore:left,awayScore:right}:{homeScore:right,awayScore:left};
  return recognizedScores.homeScore===homeScore&&recognizedScores.awayScore===awayScore?result('matched','score_matches',confidence,recognizedScores):result('mismatch','score_mismatch',confidence,recognizedScores);
}
