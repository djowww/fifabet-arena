import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const workerPath=fileURLToPath(new URL('./result-recognition-worker.mjs',import.meta.url));
const modelPath=fileURLToPath(new URL('./ocr/eng.traineddata',import.meta.url));

// A score is a suggestion only: OCR cannot establish the authenticity of a match.
export function parseScoreText(text,confidence){
  if(typeof text!=='string'||!Number.isFinite(confidence)||confidence<45)return null;
  const pairs=new Map();
  for(const line of text.slice(0,12_000).split(/\r?\n/)){
    // Never interpret a clock (12:34), dates, percentages or isolated statistics.
    if(/[%/:]/.test(line))continue;
    for(const match of line.matchAll(/(?<![\d.,])\b(\d{1,2})\s*[-–—×x]\s*(\d{1,2})\b(?![\d.,])/gi)){
      const left=Number(match[1]),right=Number(match[2]);
      if(left>30||right>30)continue;
      pairs.set(`${left}:${right}`,{left,right});
    }
  }
  return pairs.size===1?[...pairs.values()][0]:null;
}

export async function createResultRecognizer({enabled=true,timeoutMs=15_000}={}){
  let available=enabled;
  if(available)try{await access(modelPath);await import('tesseract.js');}catch{available=false;}
  let active=null;
  return {
    status:()=>({available,provider:available?'local-ocr':null,requiresReview:true}),
    async recognize(path){
      if(!available)return {status:'unavailable',scores:null,requiresReview:true};
      if(active){const error=new Error('A leitura de outra foto está em andamento. Tente novamente em instantes.');error.status=429;error.code='recognition_busy';throw error;}
      return new Promise(resolve=>{
        // Only the server's private, validated evidence path reaches this process.
        // Keep one low-priority process and a hard timeout; never block the DB queue.
        const args=['--max-old-space-size=192',workerPath,path];
        const child=process.platform==='linux'?spawn('nice',['-n','10',process.execPath,...args],{stdio:['ignore','pipe','ignore'],shell:false}):spawn(process.execPath,args,{stdio:['ignore','pipe','ignore'],shell:false,windowsHide:true});
        active=child;let output='',done=false;
        const finish=result=>{if(done)return;done=true;clearTimeout(timer);if(child.exitCode===null)child.kill('SIGKILL');resolve(result);};
        const timer=setTimeout(()=>finish({status:'unavailable',scores:null,requiresReview:true}),timeoutMs);
        child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>16_384)finish({status:'unreadable',scores:null,requiresReview:true});});
        child.on('error',()=>finish({status:'unavailable',scores:null,requiresReview:true}));
        child.on('close',()=>{
          if(active===child)active=null;
          let result;try{result=JSON.parse(output);}catch{finish({status:'unavailable',scores:null,requiresReview:true});return;}
          const scores=parseScoreText(result.text,result.confidence);
          finish({status:scores?'suggested':'unreadable',scores,confidence:Math.round(Number(result.confidence)||0),provider:'local-ocr',requiresReview:true});
        });
      });
    },
    close(){active?.kill('SIGKILL');active=null;}
  };
}
