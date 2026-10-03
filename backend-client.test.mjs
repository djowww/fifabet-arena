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

// Real delayed HTTP responses exercise cancellation before headers and during body parsing.
async function delayedTransport(t, {headersDelay=0, bodyDelay=0}={}) {
 const {createServer}=await import('node:http');
 let count=0,attempts=0;const sockets=new Set(),timers=new Set();
 const later=(fn,delay)=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},delay);timers.add(timer);};
 const server=createServer((_req,res)=>{count++;later(()=>{res.writeHead(200,{'Content-Type':'application/json'});res.write('{');later(()=>res.end('"items":[]}'),bodyDelay);},headersDelay);});
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const nativeFetch=globalThis.fetch;
 t.mock.method(globalThis,'fetch',(url,options)=>{attempts++;return nativeFetch(`http://127.0.0.1:${server.address().port}${url}`,options);});
 t.after(async()=>{for(const timer of timers)clearTimeout(timer);for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
 return {count:()=>count,attempts:()=>attempts};
}

test('history deadline interrupts a real response before headers and never retries',async t=>{
 const server=await delayedTransport(t,{headersDelay:250});
 await assert.rejects(api.getHistory({timeoutMs:60}),error=>error.code==='request_timeout'&&/tempo|demor/i.test(error.message));
 assert.equal(server.attempts(),1);assert.ok(server.count()<=1);
});

test('request deadline remains active until delayed JSON body is parsed',async t=>{
 await delayedTransport(t,{bodyDelay:250});
 await assert.rejects(api.getWallet({timeoutMs:60}),error=>error.code==='request_timeout');
});

test('a timed out mutation tells the user to check the result before another attempt',async t=>{
 const server=await delayedTransport(t,{headersDelay:250});
 await assert.rejects(api.createDeposit({amount:100},{timeoutMs:60}),error=>error.code==='request_timeout'&&error.ambiguous===true&&/registrada|concluída/i.test(error.message)&&/antes/i.test(error.message));
 assert.equal(server.attempts(),1);assert.ok(server.count()<=1);
});

test('caller cancellation propagates through history without becoming a timeout',async t=>{
 await delayedTransport(t,{headersDelay:200});
 const controller=new AbortController(),reason=new DOMException('A busca mudou.','AbortError');
 const pending=api.getHistory({signal:controller.signal});controller.abort(reason);
 await assert.rejects(pending,error=>error===reason);
});

test('completed response removes caller abort listener and its deadline',async t=>{
 const controller=new AbortController();let active=0;
 const add=controller.signal.addEventListener.bind(controller.signal),remove=controller.signal.removeEventListener.bind(controller.signal);
 t.mock.method(controller.signal,'addEventListener',(type,...args)=>{if(type==='abort')active++;return add(type,...args);});
 t.mock.method(controller.signal,'removeEventListener',(type,...args)=>{if(type==='abort')active--;return remove(type,...args);});
 t.mock.method(globalThis,'fetch',async()=>new Response('{"items":[]}'));
 await api.getHistory({signal:controller.signal,timeoutMs:20});
 assert.equal(active,0);
 await new Promise(resolve=>setTimeout(resolve,35));
 controller.abort();
});

test('reads, mutations and OCR have distinct bounded default deadlines',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 t.mock.method(globalThis,'fetch',(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
 for(const [call,milliseconds] of [[()=>api.getHistory(),12000],[()=>api.createDeposit({amount:100}),20000],[()=>api.recognizeResult('room','photo'),60000],[()=>api.uploadEvidence(new Blob(['photo'],{type:'image/png'}),'room'),60000]]){
  const pending=call(),rejection=assert.rejects(pending,error=>error.code==='request_timeout');
  t.mock.timers.tick(milliseconds);await rejection;
 }
});

test('failed JSON serialization does not leave a caller abort listener attached',async t=>{
 const controller=new AbortController();let listeners=0;
 const add=controller.signal.addEventListener.bind(controller.signal),remove=controller.signal.removeEventListener.bind(controller.signal);
 t.mock.method(controller.signal,'addEventListener',(type,...args)=>{if(type==='abort')listeners++;return add(type,...args);});
 t.mock.method(controller.signal,'removeEventListener',(type,...args)=>{if(type==='abort')listeners--;return remove(type,...args);});
 const data={};data.circular=data;
 await assert.rejects(api.createDeposit(data,{signal:controller.signal,timeoutMs:10}),TypeError);
 assert.equal(listeners,0);
});

test('private security and recovery clients keep CSRF, credentials and sensitive payloads in the body',async t=>{
 const requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(url.endsWith('/session')?{csrfToken:'security-csrf'}:{ok:true}));});
 await api.loadSession();
 assert.equal(typeof api.getAccountSecurity,'function');
 await api.getAccountSecurity();
 await api.createRecoveryCodes({password:'current password'});
 await api.changeAccountPassword({currentPassword:'old password',newPassword:'new password'});
 await api.revokeAccountSessions({allOthers:true});
 await api.recoverAccount({identifier:'private@example.test',recoveryCode:'PRIVATE-ONETIME',newPassword:'new password'});
 await api.requestAccountDeletion({reason:'Pedido pessoal da minha conta.'});
 assert.deepEqual(requests.slice(1).map(request=>request.url),['/api/v1/auth/security','/api/v1/auth/security/recovery-codes','/api/v1/auth/security/password','/api/v1/auth/security/revoke','/api/v1/auth/recover','/api/v1/auth/security/delete-request']);
 assert.equal(requests[1].options.method,'GET');
 for(const {url,options}of requests.slice(2)){
  assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');assert.equal(options.headers['X-CSRF-Token'],'security-csrf');assert.doesNotMatch(url,/old password|new password|PRIVATE|@/);
 }
 assert.equal(JSON.parse(requests[5].options.body).recoveryCode,'PRIVATE-ONETIME');
});
