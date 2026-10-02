import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './backend-client.mjs';

test('room preparation and chat use authenticated transport, safe paths and CSRF',async t=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('/session')?{csrfToken:'local-csrf'}:{messages:[],lastSequence:0,closed:false}),{headers:{'Content-Type':'application/json'}});};
 t.after(()=>{globalThis.fetch=original;});
 assert.equal(typeof api.startDuel,'function');
 assert.equal(typeof api.getDuelChat,'function');
 assert.equal(typeof api.sendDuelChat,'function');
 await api.loadSession();
 await api.startDuel('room/a');
 await api.getDuelChat('room/a',7);
 await api.sendDuelChat('room/a',{operationId:'local-operation',text:'Meu ID no console é RivalQA.'});
 const [start,chat,send]=calls.slice(1);
 assert.equal(start.url,'/api/v1/duels/room%2Fa/start');
 assert.equal(start.options.method,'POST');
 assert.equal(start.options.headers['X-CSRF-Token'],'local-csrf');
 assert.equal(start.options.body,'{}');
 assert.equal(chat.url,'/api/v1/duels/room%2Fa/chat?after=7');
 assert.equal(chat.options.method,'GET');
 assert.equal(chat.options.credentials,'same-origin');
 assert.equal(send.url,'/api/v1/duels/room%2Fa/chat');
 assert.equal(send.options.headers['X-CSRF-Token'],'local-csrf');
 assert.deepEqual(JSON.parse(send.options.body),{operationId:'local-operation',text:'Meu ID no console é RivalQA.'});
});
