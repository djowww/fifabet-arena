// Pure presentation rules; balances, deadlines and notifications remain server-owned.
export function confirmationClock(deadline, now = Date.now()) {
  const end = Date.parse(deadline || '');
  if (!Number.isFinite(end)) return null;
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return {seconds, expired: seconds === 0, label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`};
}

export function safeRoomCards(rooms, now = Date.now()) {
  return (Array.isArray(rooms) ? rooms : []).filter(room =>
    /^FG-[A-F0-9]{10}$/.test(room?.publicMatchId || '') &&
    typeof room.host?.nickname === 'string' &&
    Number.isSafeInteger(room.stake) && room.stake >= 0 &&
    Number.isFinite(Date.parse(room.expiresAt)) && Date.parse(room.expiresAt) > now
  );
}

export function notificationKey(notification) {
  return [notification?.id, notification?.createdAt, typeof notification?.message==='string'?notification.message.slice(0,500):null].filter(Boolean).join(':');
}

export function notificationLabel(notification) {
  if(typeof notification?.message==='string'&&notification.message.trim())return notification.message.slice(0,500);
  return ({waiting: 'Seu rival está esperando você na sala.', result_confirmation: 'Seu rival enviou o placar. Envie sua foto para confirmar.', joined: 'Seu rival entrou. Abram a sala e confirmem o início da partida.'})[notification?.type] || 'Sua partida foi atualizada.';
}

export function createRenderGate(){
 let dirty=false;
 return {mark(changed){dirty ||= !!changed;},flush(safe){if(!safe||!dirty)return false;dirty=false;return true;},clear(){dirty=false;}};
}
export function filterRooms(rooms,filters={},balance=0){
 return rooms.filter(r=>(!filters.platform||r.platform===filters.platform)&&(!filters.mode||r.mode===filters.mode)&&(!filters.affordable||r.stake<=balance)&&(filters.maxStake===''||filters.maxStake===undefined||r.stake<=Number(filters.maxStake)));
}
export function mergeRecords(previous=[],incoming=[]){const map=new Map(previous.map(x=>[x.id,x]));for(const item of incoming)map.set(item.id,item);return [...map.values()];}

export function preparationState(room, owner, now=Date.now()){
 const ready = (Array.isArray(room.readyBy) ? room.readyBy : []).filter(id=>!room.readyAtBy?.[id]||Date.parse(room.readyAtBy[id])+(room.lifecyclePolicy?.readyMs||120000)>now);
 return {ownReady:ready.includes(owner),rivalReady:ready.includes(room.hostId===owner?room.guestId:room.hostId)};
}
