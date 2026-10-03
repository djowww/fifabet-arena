import sharp from 'sharp';
import {setPriority,constants} from 'node:os';
try{setPriority(0,constants.priority.PRIORITY_LOW);}catch{}
sharp.cache(false);sharp.concurrency(1);
const memoryGuard=setInterval(()=>{if(process.memoryUsage.rss()>128*1024*1024)process.exit(1);},25);memoryGuard.unref();
try{
 const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>8*1024*1024)throw Error('Imagem excede limite.');chunks.push(chunk);}
 const image=sharp(Buffer.concat(chunks),{limitInputPixels:24_000_000,failOn:'warning',animated:false});
 const metadata=await image.metadata();if(!metadata.width||!metadata.height||metadata.width*metadata.height>24_000_000||metadata.width<9||metadata.height<8||(metadata.pages||1)>1)throw Error('Imagem indisponível.');
 const pixels=await image.rotate().resize(9,8,{fit:'fill',kernel:'linear'}).greyscale().raw().toBuffer();
 const min=Math.min(...pixels),max=Math.max(...pixels);if(max-min<8)throw Error('Imagem sem informação suficiente.');
 let hash=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++)hash=(hash<<1n)|(pixels[y*9+x]>pixels[y*9+x+1]?1n:0n);
 process.stdout.write(JSON.stringify({status:'checked',hash:hash.toString(16).padStart(16,'0')}));
}catch{process.stdout.write(JSON.stringify({status:'unavailable'}));}
