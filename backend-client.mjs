// This API is available only when the app is served by backend/server.mjs.
// GitHub Pages deliberately stays an honest local demonstration.
let csrfToken=null;
const prefix='/api/v1';
export class ArenaApiError extends Error{
  constructor(message,status,code){super(message);this.name='ArenaApiError';this.status=status;this.code=code;}
}
async function request(path,{method='GET',data,body,contentType,signal}={}){
  const headers={Accept:'application/json'};
  if(data!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(data);}
  if(contentType)headers['Content-Type']=contentType;
  if(method!=='GET'&&csrfToken)headers['X-CSRF-Token']=csrfToken;
  let response;
  try{response=await fetch(`${prefix}${path}`,{method,headers,body,credentials:'same-origin',signal});}
  catch(error){if(error.name==='AbortError')throw error;throw new ArenaApiError('Não foi possível acessar o servidor. Confira sua conexão.',0,'network_error');}
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new ArenaApiError(payload?.error||'O servidor não conseguiu concluir o pedido.',response.status,payload?.code||'request_failed');
  if(!payload)throw new ArenaApiError('Resposta inválida do servidor.',response.status,'invalid_response');
  if(Object.hasOwn(payload,'csrfToken'))csrfToken=payload.csrfToken;
  return payload;
}
export async function detectBackend(){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
  try{const status=await request('/status',{signal:controller.signal});return status.available&&status.apiVersion===1?status:null;}
  catch{return null;}
  finally{clearTimeout(timeout);}
}
export const loadSession=()=>request('/session');
export const registerAccount=data=>request('/auth/register',{method:'POST',data});
export const loginAccount=data=>request('/auth/login',{method:'POST',data});
export const logoutAccount=async()=>{const result=await request('/auth/logout',{method:'POST',data:{}});csrfToken=null;return result;};
export const getArena=()=>request('/me');
export const getLeaderboard=()=>request('/leaderboard');
export const updateAccount=data=>request('/me',{method:'PATCH',data});
export const findPlayer=id=>request(`/players/${encodeURIComponent(String(id).trim().toUpperCase())}`);
export const createDuel=data=>request('/duels',{method:'POST',data});
export const getInvite=token=>request(`/invites/${encodeURIComponent(token)}`);
export const acceptInvite=token=>request(`/invites/${encodeURIComponent(token)}/accept`,{method:'POST',data:{}});
export const acceptDuel=id=>request(`/duels/${encodeURIComponent(id)}/accept`,{method:'POST',data:{}});
export const cancelDuel=id=>request(`/duels/${encodeURIComponent(id)}/cancel`,{method:'POST',data:{}});
export const withdrawCancellation=id=>request(`/duels/${encodeURIComponent(id)}/cancel-withdraw`,{method:'POST',data:{}});
export const uploadEvidence=(file,duelId)=>request(`/evidence?duelId=${encodeURIComponent(duelId)}`,{method:'POST',body:file,contentType:file.type});
export const submitResult=(id,data)=>request(`/duels/${encodeURIComponent(id)}/result`,{method:'POST',data});
export const confirmResult=(id,reportId)=>request(`/duels/${encodeURIComponent(id)}/confirm`,{method:'POST',data:{reportId}});
export const disputeResult=(id,data)=>request(`/duels/${encodeURIComponent(id)}/dispute`,{method:'POST',data});
export const listReviews=()=>request('/reviews');
export const reviewDuel=(id,data)=>request(`/reviews/${encodeURIComponent(id)}`,{method:'POST',data});
export const evidenceUrl=id=>`${prefix}/evidence/${encodeURIComponent(id)}`;
