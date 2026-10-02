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
  return [notification?.id, notification?.createdAt].filter(Boolean).join(':');
}

export function notificationLabel(notification) {
  return ({waiting: 'Seu rival está esperando você na sala.', result_confirmation: 'Seu rival enviou o placar. Envie sua foto para confirmar.', joined: 'Seu rival entrou. Abram a sala e confirmem o início da partida.'})[notification?.type] || 'Sua partida foi atualizada.';
}

export function preparationState(room, owner){
 const ready = Array.isArray(room.readyBy) ? room.readyBy : [];
 return {ownReady:ready.includes(owner),rivalReady:ready.includes(room.hostId===owner?room.guestId:room.hostId)};
}
