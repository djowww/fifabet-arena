import {spawn} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const WORKER=fileURLToPath(new URL('./visual-fingerprint-worker.mjs',import.meta.url));
export function createVisualInspector({timeoutMs=5000,maxPending=4}={}){
 const children=new Map();let closed=false,shutdown;
 async function inspect(input){
  if(closed||children.size>=maxPending)return {status:'unavailable'};
  let body;try{if(typeof input==='string'){if((await stat(input)).size>8*1024*1024)return {status:'unavailable'};body=await readFile(input);}else body=Buffer.from(input);if(!body.length||body.length>8*1024*1024)return {status:'unavailable'};}catch{return {status:'unavailable'};}
  if(closed||children.size>=maxPending)return {status:'unavailable'};
  return new Promise(resolve=>{
   const child=spawn(process.execPath,['--max-old-space-size=128',WORKER],{stdio:['pipe','pipe','ignore'],windowsHide:true});let terminated;const termination=new Promise(resolve=>{terminated=resolve;});children.set(child,termination);let output='',done=false;
   const finish=value=>{if(done)return;done=true;clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null)child.kill();resolve(value);};
   const timer=setTimeout(()=>finish({status:'unavailable'}),Math.min(5000,Math.max(1,timeoutMs)));
   child.on('error',()=>finish({status:'unavailable'}));child.stdin.on('error',()=>{});
   child.stdout.on('data',chunk=>{output+=chunk;if(output.length>256)finish({status:'unavailable'});});
   child.on('close',()=>{children.delete(child);terminated();try{const result=JSON.parse(output);finish(result.status==='checked'&&/^[a-f0-9]{16}$/.test(result.hash)?{status:'checked',hash:result.hash}:{status:'unavailable'});}catch{finish({status:'unavailable'});}});
   child.stdin.end(body);
  });
 }
 function close(){if(shutdown)return shutdown;closed=true;const terminations=[...children.values()];for(const child of children.keys())child.kill();shutdown=Promise.all(terminations).then(()=>{});return shutdown;}
 return {inspect,close};
}

export function visualDistance(first,second){
 if(!/^[a-f0-9]{16}$/i.test(first)||!/^[a-f0-9]{16}$/i.test(second))return null;
 let bits=BigInt(`0x${first}`)^BigInt(`0x${second}`),distance=0;while(bits){distance++;bits&=bits-1n;}return distance;
}
