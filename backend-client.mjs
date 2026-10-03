// This API is available only when the app is served by backend/server.mjs.
// GitHub Pages deliberately stays an honest local demonstration.
let csrfToken=null;
const prefix='/api/v1';
export class ArenaApiError extends Error{
  constructor(message,status,code){super(message);this.name='ArenaApiError';this.status=status;this.code=code;}
}
async function request(path,{method='GET',data,body,contentType,signal,timeoutMs=method==='GET'?12000:20000}={}){
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new TypeError('Prazo de requisição inválido.');
  if(signal?.aborted)throw signal.reason??new DOMException('Pedido cancelado.','AbortError');
  const headers={Accept:'application/json'};
  if(data!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(data);}
  if(contentType)headers['Content-Type']=contentType;
  if(method!=='GET'&&csrfToken)headers['X-CSRF-Token']=csrfToken;
  const controller=new AbortController(),mutation=method!=='GET';
  const timeoutError=new ArenaApiError(mutation?'O servidor demorou a responder. A operação pode ter sido registrada. Atualize a página e confira o resultado antes de tentar novamente.':'O servidor demorou a responder. Confira sua conexão e tente carregar novamente.',0,'request_timeout');
  timeoutError.ambiguous=mutation;
  let timer,abortListener;
  const cancelled=new Promise((_resolve,reject)=>{
    abortListener=()=>{const reason=signal.reason??new DOMException('Pedido cancelado.','AbortError');controller.abort(reason);reject(reason);};
    if(signal?.aborted)abortListener();
    else signal?.addEventListener('abort',abortListener,{once:true});
    timer=setTimeout(()=>{controller.abort(timeoutError);reject(timeoutError);},timeoutMs);
  });
  try{
    const response=await Promise.race([fetch(`${prefix}${path}`,{method,headers,body,credentials:'same-origin',signal:controller.signal}),cancelled]);
    const payload=await Promise.race([response.json().catch(()=>null),cancelled]);
    if(controller.signal.aborted)throw controller.signal.reason;
    if(!response.ok)throw new ArenaApiError(payload?.error||'O servidor não conseguiu concluir o pedido.',response.status,payload?.code||'request_failed');
    if(!payload)throw new ArenaApiError('Resposta inválida do servidor.',response.status,'invalid_response');
    if(Object.hasOwn(payload,'csrfToken'))csrfToken=payload.csrfToken;
    return payload;
  }catch(error){
    if(controller.signal.aborted)throw controller.signal.reason;
    if(error instanceof ArenaApiError)throw error;
    const failure=new ArenaApiError(mutation?'Não foi possível confirmar a resposta do servidor. A operação pode ter sido registrada. Confira o resultado antes de tentar novamente.':'Não foi possível acessar o servidor. Confira sua conexão.',0,'network_error');
    failure.ambiguous=mutation;throw failure;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abortListener);}
}
export async function detectBackend(){
  try{const status=await request('/status',{timeoutMs:5000});return status.available&&status.apiVersion===1?status:null;}
  catch{return null;}
}
export const loadSession=(options={})=>request('/session',options);
export const registerAccount=data=>request('/auth/register',{method:'POST',data});
export const completeAccountSignup=data=>request('/auth/onboarding',{method:'POST',data});
export const loginAccount=data=>request('/auth/login',{method:'POST',data});
export const getAccountSecurity=(options={})=>request('/auth/security',options);
export const createRecoveryCodes=(data,options={})=>request('/auth/security/recovery-codes',{...options,method:'POST',data});
export const changeAccountPassword=(data,options={})=>request('/auth/security/password',{...options,method:'POST',data});
export const revokeAccountSessions=(data,options={})=>request('/auth/security/revoke',{...options,method:'POST',data});
export const recoverAccount=(data,options={})=>request('/auth/recover',{...options,method:'POST',data});
export const requestAccountDeletion=(data,options={})=>request('/auth/security/delete-request',{...options,method:'POST',data});
export const socialLoginUrl=provider=>{if(!['google','apple'].includes(provider))throw Error('Provedor de login inválido.');return `${prefix}/auth/oauth/${provider}/start`;};
export const logoutAccount=async()=>{const result=await request('/auth/logout',{method:'POST',data:{}});csrfToken=null;return result;};
const pageQuery=options=>{const query=new URLSearchParams();for(const key of ['cursor','depositCursor','limit','search','status'])if(options?.[key]!==undefined&&options[key]!==null)query.set(key,String(options[key]));return query.size?'?'+query.toString():'';};
export const getArena=(options={})=>request('/me'+(options.compact?'?compact=1':''),options);
export const getRooms=()=>request('/rooms');
export const getLeaderboard=()=>request('/leaderboard');
export const getWallet=(options={})=>request('/wallet'+pageQuery(options),options);
export const getHistory=(options={})=>request('/history'+pageQuery(options),options);
export const getDuel=id=>request(`/duels/${encodeURIComponent(id)}`);
export const getAdminOverview=()=>request('/admin/overview');
export const getAdminUsers=search=>request(`/admin/users?search=${encodeURIComponent(search||'')}`);
export const getAdminAudit=()=>request('/admin/audit');
export const addAdminCredits=data=>request('/admin/credits',{method:'POST',data});
export const createDeposit=(data,options={})=>request('/wallet/deposits',{...options,method:'POST',data});
export const simulateDeposit=(id,data)=>request(`/wallet/deposits/${encodeURIComponent(id)}/simulate`,{method:'POST',data});
export const cancelDeposit=(id,version)=>request(`/wallet/deposits/${encodeURIComponent(id)}/cancel`,{method:'POST',data:{version}});
export const uploadDepositProof=(file,id,version,options={})=>request(`/wallet/deposits/${encodeURIComponent(id)}/proof?version=${encodeURIComponent(version)}`,{timeoutMs:60000,...options,method:'POST',body:file,contentType:file.type});
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
export const startDuel=id=>request(`/duels/${encodeURIComponent(id)}/start`,{method:'POST',data:{}});
export const unreadyDuel=id=>request(`/duels/${encodeURIComponent(id)}/unready`,{method:'POST',data:{}});
export const getDuelChat=(id,after=0)=>request(`/duels/${encodeURIComponent(id)}/chat?after=${encodeURIComponent(after)}`);
export const sendDuelChat=(id,data)=>request(`/duels/${encodeURIComponent(id)}/chat`,{method:'POST',data});
export const fundDuel=(id,stake)=>request(`/duels/${encodeURIComponent(id)}/fund`,{method:'POST',data:{stake}});
export const reportDuelIssue=(id,reason)=>request(`/duels/${encodeURIComponent(id)}/issue`,{method:'POST',data:{reason}});
export const nudgeDuel=id=>request(`/duels/${encodeURIComponent(id)}/nudge`,{method:'POST',data:{}});
export const cancelDuel=id=>request(`/duels/${encodeURIComponent(id)}/cancel`,{method:'POST',data:{}});
export const withdrawCancellation=id=>request(`/duels/${encodeURIComponent(id)}/cancel-withdraw`,{method:'POST',data:{}});
export const uploadEvidence=(file,duelId,options={})=>request(`/evidence?duelId=${encodeURIComponent(duelId)}`,{timeoutMs:60000,...options,method:'POST',body:file,contentType:file.type});
export const recognizeResult=(id,evidenceId,options={})=>request(`/duels/${encodeURIComponent(id)}/recognize`,{timeoutMs:60000,...options,method:'POST',data:{evidenceId}});
export const submitResult=(id,data)=>request(`/duels/${encodeURIComponent(id)}/result`,{method:'POST',data});
export const confirmResult=(id,data)=>request(`/duels/${encodeURIComponent(id)}/confirm`,{method:'POST',data:typeof data==='string'?{reportId:data}:data});
export const disputeResult=(id,data)=>request(`/duels/${encodeURIComponent(id)}/dispute`,{method:'POST',data});
export const listReviews=()=>request('/reviews');
export const reviewDuel=(id,data)=>request(`/reviews/${encodeURIComponent(id)}`,{method:'POST',data});
export const reviewIssue=(id,issueId,data)=>request(`/reviews/${encodeURIComponent(id)}/issues/${encodeURIComponent(issueId)}`,{method:'POST',data});
export const resolveAbandonment=(id,data)=>request(`/reviews/${encodeURIComponent(id)}/abandon`,{method:'POST',data});
export const evidenceUrl=id=>`${prefix}/evidence/${encodeURIComponent(id)}`;

export const listDepositRecoveries=()=>request('/wallet/recoveries');
export const recoverDeposit=(id,data)=>request('/wallet/recoveries/'+encodeURIComponent(id),{method:'POST',data});
export const getDeletionRequests=()=>request('/admin/deletion-requests');
export const reviewDeletionRequest=(id,data)=>request('/admin/deletion-requests/'+encodeURIComponent(id),{method:'POST',data});
