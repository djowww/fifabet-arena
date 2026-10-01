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
export const completeAccountSignup=data=>request('/auth/onboarding',{method:'POST',data});
export const loginAccount=data=>request('/auth/login',{method:'POST',data});
export const socialLoginUrl=provider=>{if(!['google','apple'].includes(provider))throw Error('Provedor de login inválido.');return `${prefix}/auth/oauth/${provider}/start`;};
export const logoutAccount=async()=>{const result=await request('/auth/logout',{method:'POST',data:{}});csrfToken=null;return result;};
export const getArena=()=>request('/me');
export const getRooms=()=>request('/rooms');
export const getLeaderboard=()=>request('/leaderboard');
export const getWallet=()=>request('/wallet');
export const getAdminOverview=()=>request('/admin/overview');
export const getAdminUsers=search=>request(`/admin/users?search=${encodeURIComponent(search||'')}`);
export const getAdminAudit=()=>request('/admin/audit');
export const addAdminCredits=data=>request('/admin/credits',{method:'POST',data});
export const createDeposit=data=>request('/wallet/deposits',{method:'POST',data});
export const simulateDeposit=(id,data)=>request(`/wallet/deposits/${encodeURIComponent(id)}/simulate`,{method:'POST',data});
export const cancelDeposit=(id,version)=>request(`/wallet/deposits/${encodeURIComponent(id)}/cancel`,{method:'POST',data:{version}});
export const uploadDepositProof=(file,id,version)=>request(`/wallet/deposits/${encodeURIComponent(id)}/proof?version=${encodeURIComponent(version)}`,{method:'POST',body:file,contentType:file.type});
export const listDepositReviews=()=>request('/wallet/reviews');
export const reviewDeposit=(id,data)=>request(`/wallet/reviews/${encodeURIComponent(id)}`,{method:'POST',data});
export const depositEvidenceUrl=id=>`${prefix}/wallet/evidence/${encodeURIComponent(id)}`;
export const updateAccount=data=>request('/me',{method:'PATCH',data});
export const findPlayer=id=>request(`/players/${encodeURIComponent(String(id).trim().toUpperCase())}`);
export const createDuel=data=>request('/duels',{method:'POST',data});
export const getInvite=token=>request(`/invites/${encodeURIComponent(token)}`);
export const acceptInvite=token=>request(`/invites/${encodeURIComponent(token)}/accept`,{method:'POST',data:{}});
export const getInviteCode=code=>request(`/invites/code/${encodeURIComponent(String(code).trim().toUpperCase())}`);
export const acceptInviteCode=code=>request(`/invites/code/${encodeURIComponent(String(code).trim().toUpperCase())}/accept`,{method:'POST',data:{}});
export const acceptDuel=id=>request(`/duels/${encodeURIComponent(id)}/accept`,{method:'POST',data:{}});
export const fundDuel=(id,stake)=>request(`/duels/${encodeURIComponent(id)}/fund`,{method:'POST',data:{stake}});
export const reportDuelIssue=(id,reason)=>request(`/duels/${encodeURIComponent(id)}/issue`,{method:'POST',data:{reason}});
export const nudgeDuel=id=>request(`/duels/${encodeURIComponent(id)}/nudge`,{method:'POST',data:{}});
export const cancelDuel=id=>request(`/duels/${encodeURIComponent(id)}/cancel`,{method:'POST',data:{}});
export const withdrawCancellation=id=>request(`/duels/${encodeURIComponent(id)}/cancel-withdraw`,{method:'POST',data:{}});
export const uploadEvidence=(file,duelId)=>request(`/evidence?duelId=${encodeURIComponent(duelId)}`,{method:'POST',body:file,contentType:file.type});
export const recognizeResult=(id,evidenceId)=>request(`/duels/${encodeURIComponent(id)}/recognize`,{method:'POST',data:{evidenceId}});
export const submitResult=(id,data)=>request(`/duels/${encodeURIComponent(id)}/result`,{method:'POST',data});
export const confirmResult=(id,data)=>request(`/duels/${encodeURIComponent(id)}/confirm`,{method:'POST',data:typeof data==='string'?{reportId:data}:data});
export const disputeResult=(id,data)=>request(`/duels/${encodeURIComponent(id)}/dispute`,{method:'POST',data});
export const listReviews=()=>request('/reviews');
export const reviewDuel=(id,data)=>request(`/reviews/${encodeURIComponent(id)}`,{method:'POST',data});
export const reviewIssue=(id,issueId,data)=>request(`/reviews/${encodeURIComponent(id)}/issues/${encodeURIComponent(issueId)}`,{method:'POST',data});
export const evidenceUrl=id=>`${prefix}/evidence/${encodeURIComponent(id)}`;
