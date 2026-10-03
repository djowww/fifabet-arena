import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountTools} from './account-tools.mjs';

const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll("'",'&#39;');
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(overrides={}){
 const state={user:{id:'owner-a'},epoch:1,modal:1};
 const calls={modal:[],toast:[],afterRecovery:[],close:0,refresh:0,api:[]};
 const api=new Proxy(overrides.api||{},{get(target,name){return target[name]||async function(payload){calls.api.push({name,payload});return {};};}});
 const c={api,profile:()=>state.user,epoch:()=>state.epoch,modalRevision:()=>state.modal,esc,
  modal:(...args)=>{calls.modal.push(args);state.modal++;},closeModal:()=>{calls.close++;state.modal++;},
  toast:message=>calls.toast.push(message),refresh:async()=>{calls.refresh++;},
  afterRecovery:async user=>{calls.afterRecovery.push(user);},googleAvailable:()=>false,
  notices:{toggle:async()=>{},status:()=>({enabled:true})},render:()=>{},copy:async()=>{},...overrides,api};
 return {state,calls,tools:createAccountTools(c)};
}
const form=owner=>({dataset:{owner}});
const data=values=>new Map(Object.entries(values));
const security=(count=0)=>({hasPassword:true,sessions:[],recoveryCodesRemaining:count});
const invalidations={owner:s=>{s.user={id:'owner-b'};},epoch:s=>{s.epoch++;},modal:s=>{s.modal++;},logout:s=>{s.user=null;},roundtrip:s=>{s.user={id:'owner-b'};s.epoch++;s.user={id:'owner-a'};s.epoch++;}};

test('unknown actions/forms are ignored and private actions require a profile',async()=>{
 const f=fixture();assert.equal(await f.tools.handleAction('unknown'),false);assert.equal(await f.tools.handleForm('unknown'),false);
 f.state.user=null;await assert.rejects(f.tools.handleAction('security'),/Entre na sua conta/);assert.deepEqual(f.calls.api,[]);
 assert.equal(await f.tools.handleAction('recover-account'),true);assert.match(f.calls.modal[0][2],/data-form='recover-account'/);
});
for(const [boundary,invalidate] of Object.entries(invalidations)){
 test(`security response cannot render across ${boundary} boundary`,async()=>{
  const pending=deferred(),f=fixture({api:{getAccountSecurity:()=>pending.promise}});
  const operation=f.tools.handleAction('security');invalidate(f.state);pending.resolve(security());
  assert.equal(await operation,true);assert.deepEqual(f.calls.modal,[]);
 });
 test(`private recovery codes cannot render across ${boundary} boundary`,async()=>{
  const pending=deferred(),f=fixture({api:{createRecoveryCodes:()=>pending.promise}});
  const operation=f.tools.handleForm('recovery-codes',form('owner-a'),data({password:'current password'}));
  invalidate(f.state);pending.resolve({codes:['PRIVATE-CODE']});
  assert.equal(await operation,true);assert.deepEqual(f.calls.modal,[]);assert.deepEqual(f.calls.toast,[]);
 });
 test(`recovery callback runs only in its current ${boundary} context`,async()=>{
  const pending=deferred(),f=fixture({api:{recoverAccount:()=>pending.promise}});
  const operation=f.tools.handleForm('recover-account',{},data({identifier:' nickname ',recoveryCode:' CODE ',newPassword:'new password'}));
  invalidate(f.state);pending.resolve({user:{id:'recovered'}});await operation;assert.deepEqual(f.calls.afterRecovery,[]);
 });
}
test('current codes render escaped only after the API succeeds',async()=>{
 let payload;const f=fixture({api:{createRecoveryCodes:async value=>{payload=value;return {codes:['<private>']};}}});
 assert.equal(await f.tools.handleForm('recovery-codes',form('owner-a'),data({password:'password'})),true);
 assert.deepEqual(payload,{password:'password'});assert.equal(f.calls.modal.length,1);assert.match(f.calls.modal[0][2],/&lt;private>/);assert.doesNotMatch(f.calls.modal[0][2],/<private>/);
});
for(const kind of ['recovery-codes','change-password','delete-account-request']){
 test(`${kind} refuses another owner's form before sending any request`,async()=>{
  const f=fixture();await assert.rejects(f.tools.handleForm(kind,form('owner-b'),data({})),/A conta mudou/);assert.deepEqual(f.calls.api,[]);
 });
}
test('password change reloads security from the new server response',async()=>{
 const changed=deferred(),loaded=deferred(),requests=[];
 const f=fixture({api:{changeAccountPassword:payload=>{requests.push(['password',payload]);return changed.promise;},getAccountSecurity:()=>{requests.push(['security']);return loaded.promise;}}});
 const operation=f.tools.handleForm('change-password',form('owner-a'),data({currentPassword:'old password',newPassword:'new password'}));
 assert.equal(requests.length,1);assert.deepEqual(f.calls.modal,[]);
 changed.resolve({});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(requests.map(r=>r[0]),['password','security']);
 loaded.resolve(security(7));await operation;assert.match(f.calls.modal[0][2],/7 códigos disponíveis/);assert.equal(f.calls.toast.length,1);
});
test('password security refresh cannot render after another account takes ownership',async()=>{
 const loaded=deferred(),f=fixture({api:{changeAccountPassword:async()=>{},getAccountSecurity:()=>loaded.promise}});
 const operation=f.tools.handleForm('change-password',form('owner-a'),data({currentPassword:'old password',newPassword:'new password'}));
 await new Promise(resolve=>setImmediate(resolve));f.state.user={id:'owner-b'};loaded.resolve(security(9));await operation;assert.deepEqual(f.calls.modal,[]);
});
test('current recovery trims identifier/code and invokes the recovery callback once',async()=>{
 let payload;const user={id:'recovered'},f=fixture({api:{recoverAccount:async value=>{payload=value;return {user};}}});f.state.user=null;
 await f.tools.handleForm('recover-account',{},data({identifier:' nickname ',recoveryCode:' CODE ',newPassword:' password '}));
 assert.deepEqual(payload,{identifier:'nickname',recoveryCode:'CODE',newPassword:' password '});assert.deepEqual(f.calls.afterRecovery,[user]);
});
test('deletion request response ignores a changed owner',async()=>{
 const pending=deferred(),f=fixture({api:{requestAccountDeletion:()=>pending.promise}});
 const operation=f.tools.handleForm('delete-account-request',form('owner-a'),data({reason:'Please delete my account'}));
 f.state.user={id:'owner-b'};pending.resolve({});await operation;assert.equal(f.calls.close,0);assert.equal(f.calls.refresh,0);assert.deepEqual(f.calls.toast,[]);
});
test('deletion completion does not toast in another account after its refresh',async()=>{
 const refreshed=deferred(),f=fixture({refresh:()=>refreshed.promise});
 const operation=f.tools.handleForm('delete-account-request',form('owner-a'),data({reason:'Please delete my account'}));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.close,1);f.state.user={id:'owner-b'};f.state.epoch++;refreshed.resolve();await operation;
 assert.deepEqual(f.calls.toast,[]);
});
test('current deletion closes and refreshes before confirming the recorded request',async()=>{
 const order=[],f=fixture({refresh:async()=>{order.push('refresh');},toast:()=>{order.push('toast');}});
 await f.tools.handleForm('delete-account-request',form('owner-a'),data({reason:'Please delete my account'}));
 assert.equal(f.calls.close,1);assert.deepEqual(order,['refresh','toast']);assert.deepEqual(f.calls.api,[{name:'requestAccountDeletion',payload:{reason:'Please delete my account'}}]);
});
test('failed code request exposes no codes and propagates its API error',async()=>{
 const error=Error('server unavailable'),f=fixture({api:{createRecoveryCodes:async()=>{throw error;}}});
 await assert.rejects(f.tools.handleForm('recovery-codes',form('owner-a'),data({password:'password'})),error);assert.deepEqual(f.calls.modal,[]);
});
