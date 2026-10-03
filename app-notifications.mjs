const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const preferenceKey=owner=>`fifago:browser-notifications:v1:${owner}`;
const validOwner=owner=>typeof owner==='string'&&UUID.test(owner)?owner.toLowerCase():null;

/** Optional page-open notifications. feed() never asks for browser permission. */
export function createAppNotifications(options={}){
  const BrowserNotification=Object.hasOwn(options,'Notification')?options.Notification:globalThis.Notification;
  let storage;
  try{storage=Object.hasOwn(options,'storage')?options.storage:globalThis.localStorage;}catch{}
  const hidden=options.hidden||(()=>globalThis.document?.hidden===true);
  const onOpen=options.onOpen||(id=>{if(globalThis.location)globalThis.location.hash=`#partida/${id}`;});
  const preferences=new Map(),seen=new Set();let activeOwner=null,generation=0,primed=false,pending=null;
  function reset(){activeOwner=null;generation++;primed=false;seen.clear();preferences.clear();pending=null;}
  function activate(owner){
    if(owner!==activeOwner){activeOwner=owner;generation++;primed=false;seen.clear();pending=null;}
  }
  function preference(owner){
    if(!owner)return false;
    if(!preferences.has(owner)){let enabled=false;try{enabled=storage?.getItem(preferenceKey(owner))==='1';}catch{}preferences.set(owner,enabled);}
    return preferences.get(owner)===true;
  }
  function storePreference(owner,enabled){preferences.set(owner,enabled);try{storage?.setItem(preferenceKey(owner),enabled?'1':'0');}catch{}}
  function readStatus(owner){
    const supported=typeof BrowserNotification==='function'&&typeof BrowserNotification.requestPermission==='function';
    let permission='default';try{if(['default','granted','denied'].includes(BrowserNotification?.permission))permission=BrowserNotification.permission;}catch{}
    return {supported,enabled:!!owner&&supported&&permission==='granted'&&preference(owner),permission};
  }
  function status(input){const owner=validOwner(input);activate(owner);return readStatus(owner);}
  async function toggle(input){
    const owner=validOwner(input);activate(owner);const current=readStatus(owner);
    if(!owner||!current.supported)return current;
    if(current.enabled){storePreference(owner,false);return readStatus(owner);}
    if(current.permission==='denied'){storePreference(owner,false);return readStatus(owner);}
    if(current.permission==='granted'){storePreference(owner,true);return readStatus(owner);}
    if(pending)return pending;
    const started=generation;
    const operation=(async()=>{
      let permission;try{permission=await BrowserNotification.requestPermission();}catch{}
      if(activeOwner===owner&&generation===started)storePreference(owner,permission==='granted');
      return readStatus(owner);
    })();
    pending=operation;
    try{return await operation;}finally{if(pending===operation)pending=null;}
  }
  function remember(id){seen.add(id);while(seen.size>200)seen.delete(seen.values().next().value);}
  function feed(input,notifications){
    const owner=validOwner(input);activate(owner);if(!owner)return;
    const baseline=!primed;primed=true;
    for(const event of (Array.isArray(notifications)?notifications:[]).slice(0,1000)){
      if(typeof event?.id!=='string'||!event.id||event.id.length>256||typeof event.duelId!=='string'||!UUID.test(event.duelId)||seen.has(event.id))continue;
      remember(event.id);if(baseline||!readStatus(owner).enabled)continue;
      let background=false;try{background=hidden()===true;}catch{}if(!background)continue;
      const started=generation,roomId=event.duelId;
      try{
        const notice=new BrowserNotification('Fifa GO',{body:'Há uma atualização na sua partida. Abra a arena para conferir.',tag:'fifago-match-update'});
        notice.onclick=()=>{
          try{notice.close();}catch{}
          if(activeOwner!==owner||generation!==started||!readStatus(owner).enabled)return;
          try{globalThis.focus?.();onOpen(roomId);}catch{}
        };
      }catch{}
    }
  }
  return {status,toggle,feed,reset};
}
