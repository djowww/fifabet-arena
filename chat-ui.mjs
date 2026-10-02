const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const nearChatBottom = node => !node || node.scrollHeight-node.scrollTop-node.clientHeight < 72;
// Private conversation state intentionally lives only in memory.
export function createChatState(){
 let owner=null,room=null,generation=0;const rooms=new Map();
 const current=()=>rooms.get(room);
 return {
  select(nextOwner,nextRoom){
   if(owner!==nextOwner){rooms.clear();owner=nextOwner;generation++;}
   if(room!==nextRoom){room=nextRoom;generation++;}
   if(owner&&room&&!rooms.has(room))rooms.set(room,{messages:[],lastSequence:0,closed:false,draft:'',loaded:false,error:'',sending:false,operation:null,unread:0});
   return current();
  },
  clear(){rooms.clear();owner=null;room=null;generation++;},
  forget(){rooms.delete(room);room=null;generation++;},
  current,
  ticket(){return {owner,room,generation};},
  valid(ticket){return !!ticket&&ticket.owner===owner&&ticket.room===room&&ticket.generation===generation;},
  draft(value){const state=current();if(value!==undefined&&state)state.draft=value;return state?.draft||'';},
  receive(ticket,envelope){
   if(!this.valid(ticket)||!current())return false;
   const state=current(),messages=new Map(state.messages.map(m=>[m.id,m]));
   for(const message of envelope.messages||[])if(typeof message.id==='string'&&Number.isSafeInteger(message.sequence))messages.set(message.id,message);
   state.messages=[...messages.values()].sort((a,b)=>a.sequence-b.sequence).slice(-200);
   // A POST contains only the sent message. Advance through contiguous messages
   // so a rival message sent before this POST is still fetched by the next GET.
   const sequences=new Set(state.messages.map(message=>message.sequence));
   while(sequences.has(state.lastSequence+1))state.lastSequence++;
   state.closed=state.closed||!!envelope.closed;state.loaded=true;state.error='';return true;
  }
 };
}
export function renderChatMessages(messages,owner){
 return messages.length?messages.map(m=>`<li class='chat-message ${m.authorId===owner?'chat-own':''}' data-message-id='${escape(m.id)}'><div class='chat-message-meta'><strong>${escape(m.authorNickname)}</strong><time datetime='${escape(m.createdAt)}'>${escape(new Date(m.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))}</time></div><p>${escape(m.text)}</p></li>`).join(''):`<li class='chat-empty'>Combine os detalhes da partida com seu rival.</li>`;
}
