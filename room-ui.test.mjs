import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {confirmationClock,safeRoomCards,notificationKey,notificationLabel} from './room-ui.mjs';
import {preparePhoto,validatePhotoSource,photoDimensions,MAX_SOURCE_BYTES,MAX_UPLOAD_BYTES} from './image-preparation.mjs';

test('confirmation clock follows the server deadline, stops at zero and never infers a winner',()=>{
  const now=Date.parse('2026-10-01T12:00:00.000Z');
  assert.deepEqual(confirmationClock('2026-10-01T12:05:00.000Z',now),{seconds:300,expired:false,label:'5:00'});
  assert.equal(confirmationClock('2026-10-01T12:05:00.000Z',now+240001).label,'1:00');
  assert.deepEqual(confirmationClock('2026-10-01T12:05:00.000Z',now+300001),{seconds:0,expired:true,label:'0:00'});
  assert.equal(confirmationClock('invalid',now),null);
});

test('public room cards reject invalid and expired server records without creating sample rooms',()=>{
  const now=Date.parse('2026-10-01T12:00:00Z'),room={publicMatchId:'FG-1234567890',host:{nickname:'Cado'},stake:50,expiresAt:'2026-10-01T13:00:00Z'};
  assert.deepEqual(safeRoomCards(undefined,now),[]);
  assert.deepEqual(safeRoomCards([room,{...room,stake:-1},{...room,stake:2.5},{...room,publicMatchId:'private-id'},{...room,expiresAt:'2026-10-01T11:00:00Z'}],now),[room]);
});

test('waiting notifications have predictable labels and unique event keys',()=>{
  assert.equal(notificationKey({id:'notice-a',createdAt:'time-a'}),'notice-a:time-a');
  assert.match(notificationLabel({type:'waiting'}),/está esperando/);
  assert.match(notificationLabel({type:'result_confirmation'}),/Envie sua foto/);
  assert.equal(notificationLabel({type:'<script>'}),'Sua partida foi atualizada.');
});

test('mobile source photos above 8 MB are accepted up to 30 MB before conversion',()=>{
  assert.doesNotThrow(()=>validatePhotoSource({name:'photo.jpg',type:'image/jpeg',size:20*1024*1024}));
  assert.doesNotThrow(()=>validatePhotoSource({name:'photo.heic',type:'image/heic',size:MAX_SOURCE_BYTES}));
  assert.doesNotThrow(()=>validatePhotoSource({name:'photo.heic',type:'',size:1000}));
  assert.throws(()=>validatePhotoSource({name:'photo.jpg',type:'image/jpeg',size:MAX_SOURCE_BYTES+1}),/30 MB/);
  assert.throws(()=>validatePhotoSource({name:'photo.svg',type:'image/svg+xml',size:1000}),/JPG/);
  assert.throws(()=>validatePhotoSource({name:'photo.jpg',type:'image/jpeg',size:0}),/Tire ou escolha/);
  assert.equal(MAX_UPLOAD_BYTES,5*1024*1024);
});

test('all common phone dimensions fit the server pixel budget without distorting the score',()=>{
  for(const [width,height] of [[4032,3024],[3024,4032],[6000,4000],[4000,6000],[1280,720],[8000,6000],[1179,2556]]){
    const resized=photoDimensions(width,height);
    assert.ok(resized.width*resized.height<=2000000,`${width} × ${height}`);
    assert.ok(Math.max(resized.width,resized.height)<=2200);
    assert.ok(Math.abs(resized.width/resized.height-width/height)<.005);
  }
  assert.deepEqual(photoDimensions(1280,720),{width:1280,height:720});
  assert.throws(()=>photoDimensions(0,10));
});

test('a large mobile photo is decoded once, resized within budget and closed after conversion',async t=>{
  const globals={document:globalThis.document,createImageBitmap:globalThis.createImageBitmap,FileReader:globalThis.FileReader};
  t.after(()=>{for(const [key,value]of Object.entries(globals))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
  let closed=0,decoded=0,drawn=0;
  globalThis.createImageBitmap=async()=>{decoded++;return {width:4032,height:3024,close(){closed++;}};};
  const canvas={width:0,height:0,getContext(){return {fillRect(){},drawImage(){drawn++;}};},toBlob(callback,type){callback(new Blob(['encoded-photo'],{type}));}};
  globalThis.document={createElement:()=>canvas};
  globalThis.FileReader=class{readAsDataURL(){this.result='data:image/jpeg;base64,ZW5jb2RlZA==';this.onload();}};
  const photo=await preparePhoto({type:'image/jpeg',name:'phone.jpg',size:20*1024*1024});
  assert.equal(decoded,1);assert.equal(drawn,1);assert.equal(closed,1);
  assert.ok(canvas.width*canvas.height<=2000000);
  assert.ok(photo.blob.size<=MAX_UPLOAD_BYTES);assert.equal(photo.blob.type,'image/jpeg');
  assert.equal(photo.name,'placar.jpg');assert.match(photo.dataUrl,/^data:image\/jpeg/);
});

test('conversion closes the decoded image even when the canvas is unavailable',async t=>{
  const globals={document:globalThis.document,createImageBitmap:globalThis.createImageBitmap};
  t.after(()=>{for(const [key,value]of Object.entries(globals))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
  let closed=0;
  globalThis.createImageBitmap=async()=>({width:4000,height:3000,close(){closed++;}});
  globalThis.document={createElement:()=>({getContext:()=>null})};
  await assert.rejects(()=>preparePhoto({type:'image/jpeg',name:'phone.jpg',size:1000}),/neste navegador/);
  assert.equal(closed,1);
});

test('result confirmation needs a separate photo and sends explicit console orientation',()=>{
  const source=fs.readFileSync(new URL('./play.js',import.meta.url),'utf8');
  assert.match(source,/data-form='\$\{kind\}'/);
  assert.match(source,/confirm-result/);
  assert.match(source,/name='scoreSide' required/);
  assert.match(source,/API\.confirmResult\(id,\{\.\.\.payload,evidenceId,reportId:form\.dataset\.report\}\)/);
  assert.match(source,/confirming\?'Enviar minha foto e confirmar'/);
  assert.match(source,/ninguém vence por falta de resposta/);
  assert.match(source,/document\.hidden/);
  assert.match(source,/\},8000\)/);
});
