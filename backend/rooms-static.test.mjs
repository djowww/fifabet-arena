import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createArenaServer} from './server.mjs';

test('published app module graph includes room and photo helpers without exposing server checks',async t=>{
 const dataDir=await mkdtemp(join(tmpdir(),'fifago-room-assets-'));
 const arena=await createArenaServer({dataDir,env:{FIFABET_OCR_ENABLED:'0'}});
 await new Promise(resolve=>arena.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await arena.close();await rm(dataDir,{recursive:true,force:true});});
 const origin=`http://127.0.0.1:${arena.server.address().port}`;
 const pending=['/play.js'],seen=new Set();
 while(pending.length){
  const path=pending.shift();if(seen.has(path))continue;seen.add(path);
  const response=await fetch(origin+path);assert.equal(response.status,200,`Public module ${path} must be served`);
  assert.match(response.headers.get('content-type'),/javascript/);
  const source=await response.text();
  for(const match of source.matchAll(/^import\s.+?\sfrom\s['"]([^'"]+)['"];?$/gm)){
   const dependency=new URL(match[1],origin+path);assert.equal(dependency.origin,origin);
   pending.push(dependency.pathname+dependency.search);
  }
 }
 assert.ok([...seen].some(path=>path.startsWith('/room-ui.mjs')));
 assert.ok([...seen].some(path=>path.startsWith('/chat-ui.mjs')));
 assert.ok([...seen].some(path=>path.startsWith('/image-preparation.mjs')));
 for(const privatePath of ['/backend/result-verification.mjs','/backend/rooms.test.mjs','/room-ui.test.mjs','/.env']){
  const response=await fetch(origin+privatePath);assert.equal(response.status,404);await response.arrayBuffer();
 }
 const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(index,/data-app="play\.js\?v=37"/);
 for(const module of ['account-tools','account-security-ui','app-notifications','review-evidence','review-tools','result-phases'])assert.ok([...seen].some(path=>path.startsWith('/'+module+'.mjs')),module+' must be served');
 for(const css of ['audit-upgrade.css','review-tools.css'])assert.equal((await fetch(origin+'/'+css)).status,200);
 assert.equal((await fetch(origin+'/backend/test-fixtures.mjs')).status,404);
});
