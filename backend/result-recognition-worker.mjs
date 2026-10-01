import {createWorker,PSM} from 'tesseract.js';
import {fileURLToPath} from 'node:url';
import {inspectScoreText,MAX_OCR_TEXT_LENGTH} from './result-verification.mjs';

const worker=await createWorker('eng',1,{
  langPath:fileURLToPath(new URL('./ocr/',import.meta.url)),
  gzip:false,cacheMethod:'none',logger:()=>{},errorHandler:()=>{}
});
try{
  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
  const {data}=await worker.recognize(process.argv[2],{}, {text:true,blocks:true});
  const text=typeof data.text==='string'?data.text:'',candidate=inspectScoreText(text);
  const lines=(data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
  const matchingLines=candidate?lines.filter(line=>typeof line.text==='string'&&line.text.replace(/\s+/g,' ').trim()===candidate.line):[];
  let scoreConfidence=null;
  if(matchingLines.length===1){
    const line=matchingLines[0],numericWords=(line.words||[]).filter(word=>/[0-9]/.test(word.text||''));
    const values=[line.confidence,...numericWords.map(word=>word.confidence)];
    if(numericWords.length&&values.every(value=>Number.isFinite(value)&&value>=0&&value<=100))scoreConfidence=Math.min(...values);
  }
  process.stdout.write(JSON.stringify({text:text.slice(0,MAX_OCR_TEXT_LENGTH),confidence:data.confidence,scoreConfidence,truncated:text.length>MAX_OCR_TEXT_LENGTH}));
}finally{await worker.terminate();}
