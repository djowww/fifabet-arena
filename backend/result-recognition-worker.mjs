import {createWorker,PSM} from 'tesseract.js';
import {fileURLToPath} from 'node:url';

const worker=await createWorker('eng',1,{
  langPath:fileURLToPath(new URL('./ocr/',import.meta.url)),
  gzip:false,cacheMethod:'none',logger:()=>{},errorHandler:()=>{}
});
try{
  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
  const {data}=await worker.recognize(process.argv[2],{}, {text:true});
  process.stdout.write(JSON.stringify({text:data.text.slice(0,12_000),confidence:data.confidence}));
}finally{await worker.terminate();}
