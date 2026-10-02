import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationState} from './room-ui.mjs';
import {createChatState,renderChatMessages,nearChatBottom} from './chat-ui.mjs';
test('preparation tracks both participants without starting locally',()=>{
 const d={hostId:'a',guestId:'b',readyBy:['a']};
 assert.deepEqual(preparationState(d,'a'),{ownReady:true,rivalReady:false});
 assert.deepEqual(preparationState(d,'b'),{ownReady:false,rivalReady:true});
});
test('chat drafts are scoped to account and room and stale replies are rejected',()=>{
 const chat=createChatState(); chat.select('a','room1');chat.draft('hello');const ticket=chat.ticket();
 chat.select('a','room2');assert.equal(chat.draft(),'');assert.equal(chat.receive(ticket,{messages:[{id:'x',sequence:1}]}),false);
 chat.select('a','room1');assert.equal(chat.draft(),'hello');chat.select('b','room1');assert.equal(chat.draft(),'');
 assert.equal(chat.receive(ticket,{messages:[{id:'x',sequence:1}]}),false);
 chat.clear();chat.select('a','room1');assert.equal(chat.draft(),'');
});
test('chat merging deduplicates and escapes text and nicknames',()=>{
 const chat=createChatState();chat.select('a','r');const ticket=chat.ticket(),message={id:'x',sequence:1,authorId:'b',authorNickname:'<img>',text:'<script>bad</script>',createdAt:'2026-10-02T12:00:00Z'};
 chat.receive(ticket,{messages:[message],lastSequence:1,closed:false});chat.receive(ticket,{messages:[message],lastSequence:1,closed:true});
 assert.equal(chat.current().messages.length,1);assert.equal(chat.current().closed,true);
 const html=renderChatMessages(chat.current().messages,'a');assert.ok(!html.includes('<script>'));assert.match(html,/&lt;img&gt;/);
 assert.equal(nearChatBottom({scrollHeight:500,scrollTop:100,clientHeight:200}),false);
 assert.equal(nearChatBottom({scrollHeight:500,scrollTop:280,clientHeight:200}),true);
});
test('a POST message never skips an unseen rival message in the next GET cursor',()=>{
 const chat=createChatState();chat.select('a','r');const ticket=chat.ticket(),message=sequence=>({id:String(sequence),sequence,authorId:'a',authorNickname:'A',text:'hello'});
 chat.receive(ticket,{messages:[message(1)],lastSequence:1,closed:false});
 chat.receive(ticket,{messages:[message(3)],lastSequence:3,closed:false});
 assert.equal(chat.current().lastSequence,1);
 chat.receive(ticket,{messages:[message(2),message(3)],lastSequence:3,closed:false});
 assert.equal(chat.current().lastSequence,3);assert.deepEqual(chat.current().messages.map(m=>m.sequence),[1,2,3]);
 chat.receive(ticket,{messages:[],lastSequence:3,closed:true});chat.receive(ticket,{messages:[],lastSequence:1,closed:false});assert.equal(chat.current().closed,true);
});
