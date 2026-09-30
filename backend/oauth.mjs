import {randomBytes,createHash,timingSafeEqual,createPublicKey,createPrivateKey,verify,sign} from 'node:crypto';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const FLOW_MS=10*60*1000;
const CACHE_MS=60*60*1000;
const MAX_PENDING=500;
const MAX_DOCUMENT=128*1024;
const COOKIE_PATH='/api/v1/auth/oauth';
const PROVIDERS=Object.freeze({
  google:{label:'Google',discovery:'https://accounts.google.com/.well-known/openid-configuration',issuer:'https://accounts.google.com',issuers:['https://accounts.google.com','accounts.google.com'],authorization:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',jwks:'https://www.googleapis.com/oauth2/v3/certs',sameSite:'Lax'},
  apple:{label:'Apple',discovery:'https://appleid.apple.com/.well-known/openid-configuration',issuer:'https://appleid.apple.com',issuers:['https://appleid.apple.com'],authorization:'https://appleid.apple.com/auth/authorize',token:'https://appleid.apple.com/auth/token',jwks:'https://appleid.apple.com/auth/keys',sameSite:'None'}
});
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const random=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest();
const seconds=time=>Math.floor(time/1000);
const constantEqual=(a,b)=>{
  if(typeof a!=='string'||typeof b!=='string')return false;
  const one=Buffer.from(a),two=Buffer.from(b);
  return one.length===two.length&&timingSafeEqual(one,two);
};

export class OAuthError extends Error{
  constructor(status,code,message,setCookie){super(message);this.name='OAuthError';this.status=status;this.code=code;if(setCookie)this.setCookie=setCookie;}
}
const invalid=(message='A resposta do login não pôde ser validada.')=>new OAuthError(400,'oauth_invalid_response',message);
function providerDefinition(provider){
  if(!Object.hasOwn(PROVIDERS,provider))throw new OAuthError(400,'oauth_unavailable','Provedor de login indisponível.');
  return PROVIDERS[provider];
}
function originValue(value){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.hostname==='localhost'||isIP(url.hostname.replace(/^\[|\]$/g,'')))return '';
    return url.origin;
  }catch{return '';}
}
function envString(env,name,max=4096){const value=env[name];return typeof value==='string'&&value.length<=max?value.trim():'';}
function cookieName(provider){return `__Secure-fifago_oauth_${provider}`;}
function browserCookie(provider,header){
  if(typeof header!=='string'||header.length>16*1024)return '';
  const prefix=`${cookieName(provider)}=`;
  const values=header.split(';').map(value=>value.trim()).filter(value=>value.startsWith(prefix));
  return values.length===1?values[0].slice(prefix.length):'';
}
function cookieHeader(provider,value,maxAge){
  return `${cookieName(provider)}=${value}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=${providerDefinition(provider).sameSite}; Max-Age=${maxAge}`;
}
function parameter(params,name,max){
  let value;
  if(params instanceof URLSearchParams){
    const values=params.getAll(name);if(values.length>1)throw invalid();value=values[0];
  }else if(plain(params)&&Object.hasOwn(params,name))value=params[name];
  if(value===undefined)return '';
  if(typeof value!=='string'||value.length>max)throw invalid();
  return value;
}
function jwtParts(token){
  if(typeof token!=='string'||token.length>32*1024)throw invalid();
  const parts=token.split('.');
  if(parts.length!==3||parts.some(part=>!part||!/^[A-Za-z0-9_-]+$/.test(part)))throw invalid();
  try{
    const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    if(!plain(header)||!plain(claims)||header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length<1||header.kid.length>128||header.crit!==undefined||header.b64!==undefined)throw invalid();
    return {header,claims,input:Buffer.from(`${parts[0]}.${parts[1]}`,'ascii'),signature:Buffer.from(parts[2],'base64url')};
  }catch(error){if(error instanceof OAuthError)throw error;throw invalid();}
}
function claimsValid(claims,provider,clientId,flow,time){
  const definition=providerDefinition(provider),current=seconds(time);
  const audiences=typeof claims.aud==='string'?[claims.aud]:claims.aud;
  if(!definition.issuers.includes(claims.iss)||!Array.isArray(audiences)||!audiences.length||audiences.length>10||audiences.some(value=>typeof value!=='string')||!audiences.includes(clientId))throw invalid();
  if((audiences.length>1&&claims.azp!==clientId)||(claims.azp!==undefined&&claims.azp!==clientId))throw invalid();
  if(!Number.isSafeInteger(claims.exp)||claims.exp<=current||!Number.isSafeInteger(claims.iat)||claims.iat>current+60||claims.iat<seconds(flow.createdAt)-60||claims.exp<=claims.iat)throw invalid();
  if(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>current+60))throw invalid();
  if(!constantEqual(claims.nonce,flow.nonce)||typeof claims.sub!=='string'||!/^[\x21-\x7e]{1,255}$/.test(claims.sub))throw invalid();
}
function displayName(value){
  return typeof value==='string'?value.normalize('NFKC').replace(/[^\p{L}\p{N} _.'-]/gu,'').replace(/\s+/g,' ').trim().slice(0,80):'';
}
function appleName(user){
  if(!user)return '';
  try{
    const parsed=JSON.parse(user);
    if(!plain(parsed)||!plain(parsed.name))return '';
    return displayName([parsed.name.firstName,parsed.name.lastName].filter(value=>typeof value==='string').join(' '));
  }catch{return '';}
}
function identityFor(provider,claims,name){
  const email=typeof claims.email==='string'&&claims.email.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(claims.email)?claims.email:null;
  return {provider,subject:claims.sub,email,emailVerified:Boolean(email&&(claims.email_verified===true||claims.email_verified==='true')),displayName:displayName(name||claims.name||'')};
}

/** Server-only OAuth. Returns no provider tokens and never persists secrets. */
export async function createOAuthService(options={}){
  const env=options.env||process.env;
  const publicOrigin=originValue(options.publicOrigin||env.FIFABET_PUBLIC_ORIGIN||'');
  const request=options.fetch||globalThis.fetch;
  const now=options.now||Date.now;
  const config={
    google:{clientId:envString(env,'FIFABET_GOOGLE_CLIENT_ID',300),clientSecret:envString(env,'FIFABET_GOOGLE_CLIENT_SECRET')},
    apple:{clientId:envString(env,'FIFABET_APPLE_CLIENT_ID',300),teamId:envString(env,'FIFABET_APPLE_TEAM_ID',20),keyId:envString(env,'FIFABET_APPLE_KEY_ID',20),privateKeyFile:envString(env,'FIFABET_APPLE_PRIVATE_KEY_FILE'),privateKey:null}
  };
  const googleConfigured=/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(config.google.clientId)&&Boolean(config.google.clientSecret)&&!/[\r\n\x00]/.test(config.google.clientSecret);
  let appleConfigured=/^[A-Za-z0-9.-]{1,300}$/.test(config.apple.clientId)&&/^[A-Z0-9]{10}$/.test(config.apple.teamId)&&/^[A-Z0-9]{10}$/.test(config.apple.keyId)&&isAbsolute(config.apple.privateKeyFile);
  if(appleConfigured){
    try{
      const path=await realpath(config.apple.privateKeyFile),rootPath=await realpath(ROOT),inside=relative(rootPath,path);
      if(inside===''||(!inside.startsWith(`..${sep}`)&&inside!=='..'&&!isAbsolute(inside)))throw Error('private_key_location');
      const info=await stat(path);if(!info.isFile()||info.size>16*1024)throw Error('private_key_file');
      const pem=await readFile(path,'utf8');
      config.apple.privateKey=createPrivateKey(pem);
      if(config.apple.privateKey.asymmetricKeyType!=='ec'||config.apple.privateKey.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('private_key_curve');
    }catch{appleConfigured=false;config.apple.privateKey=null;}
  }
  const available={google:Boolean(publicOrigin&&googleConfigured),apple:Boolean(publicOrigin&&appleConfigured)};
  const pending=new Map(),metadataCache=new Map(),keysCache=new Map(),loads=new Map();
  function status(){
    return Object.fromEntries(Object.entries(PROVIDERS).map(([provider,{label}])=>[provider,{available:available[provider],enabled:available[provider],label,reason:available[provider]?'':!publicOrigin?'Login social requer uma origem HTTPS configurada.':'Login indisponível: configuração do provedor pendente.'}]));
  }
  function ensureAvailable(provider){
    providerDefinition(provider);
    if(!available[provider])throw new OAuthError(503,'oauth_unavailable','Este login ainda não foi configurado.');
  }
  function prune(){for(const [state,flow]of pending)if(flow.expiresAt<=now())pending.delete(state);}
  async function document(url,init={},limit=MAX_DOCUMENT){
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
    let response;
    try{
      response=await request(url,{...init,redirect:'error',signal:abort.signal,headers:{Accept:'application/json',...(init.headers||{})}});
      if(!response.ok)throw new OAuthError(response.status===400?400:502,response.status===400?'oauth_rejected':'oauth_provider_unavailable','O provedor não concluiu o login. Tente novamente.');
      if(!String(response.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))throw invalid();
      const size=Number(response.headers.get('content-length'));
      if(Number.isFinite(size)&&size>limit)throw invalid();
      const reader=response.body?.getReader();if(!reader)throw invalid();
      let total=0;const chunks=[];
      try{
        for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw invalid();}chunks.push(Buffer.from(value));}
      }finally{reader.releaseLock();}
      const result=JSON.parse(Buffer.concat(chunks,total).toString('utf8'));
      if(!plain(result))throw invalid();
      return result;
    }catch(error){
      if(error instanceof OAuthError)throw error;
      throw new OAuthError(502,'oauth_provider_unavailable','O provedor está indisponível. Tente novamente mais tarde.');
    }finally{clearTimeout(timeout);}
  }
  async function sharedLoad(key,load){
    if(loads.has(key))return loads.get(key);
    const promise=load();loads.set(key,promise);
    try{return await promise;}finally{loads.delete(key);}
  }
  async function metadata(provider){
    const cached=metadataCache.get(provider);if(cached&&cached.expiresAt>now())return cached.value;
    return sharedLoad(`metadata:${provider}`,async()=>{
      const definition=providerDefinition(provider),data=await document(definition.discovery,{},32*1024);
      // Discovery is used, but it may never redirect token/key requests to arbitrary hosts.
      if(data.issuer!==definition.issuer||data.authorization_endpoint!==definition.authorization||data.token_endpoint!==definition.token||data.jwks_uri!==definition.jwks||!Array.isArray(data.id_token_signing_alg_values_supported)||!data.id_token_signing_alg_values_supported.includes('RS256'))throw invalid();
      metadataCache.set(provider,{value:data,expiresAt:now()+CACHE_MS});return data;
    });
  }
  async function keys(provider,refresh=false){
    const cached=keysCache.get(provider);
    if(cached&&cached.expiresAt>now()&&(!refresh||now()-cached.loadedAt<30_000))return cached.keys;
    return sharedLoad(`keys:${provider}`,async()=>{
      const meta=await metadata(provider),data=await document(meta.jwks_uri);
      if(!Array.isArray(data.keys)||!data.keys.length||data.keys.length>16)throw invalid();
      const result=new Map();
      for(const jwk of data.keys){
        if(!plain(jwk)||jwk.kty!=='RSA'||(jwk.alg!==undefined&&jwk.alg!=='RS256')||(jwk.use!==undefined&&jwk.use!=='sig')||typeof jwk.kid!=='string'||jwk.kid.length<1||jwk.kid.length>128||typeof jwk.n!=='string'||jwk.n.length>1400||typeof jwk.e!=='string'||jwk.e.length>12||jwk.d!==undefined||result.has(jwk.kid))continue;
        try{const key=createPublicKey({key:jwk,format:'jwk'});if(key.asymmetricKeyType==='rsa'&&key.asymmetricKeyDetails?.modulusLength>=2048&&key.asymmetricKeyDetails.modulusLength<=8192)result.set(jwk.kid,key);}catch{/* Invalid keys never become trusted. */}
      }
      if(!result.size)throw invalid();
      keysCache.set(provider,{keys:result,loadedAt:now(),expiresAt:now()+CACHE_MS});return result;
    });
  }
  async function verifiedToken(provider,token,flow){
    const parsed=jwtParts(token);
    let key=(await keys(provider)).get(parsed.header.kid);
    if(!key)key=(await keys(provider,true)).get(parsed.header.kid);
    if(!key||!verify('RSA-SHA256',parsed.input,key,parsed.signature))throw invalid();
    claimsValid(parsed.claims,provider,config[provider].clientId,flow,now());
    return parsed.claims;
  }
  function appleSecret(){
    const client=config.apple,current=seconds(now());
    const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const input=`${encode({alg:'ES256',kid:client.keyId,typ:'JWT'})}.${encode({iss:client.teamId,iat:current,exp:current+300,aud:PROVIDERS.apple.issuer,sub:client.clientId})}`;
    const signature=sign('sha256',Buffer.from(input),{key:client.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
    return `${input}.${signature}`;
  }
  async function start(provider){
    ensureAvailable(provider);
    const meta=await metadata(provider);prune();
    if(pending.size>=MAX_PENDING)throw new OAuthError(429,'oauth_provider_unavailable','Há muitos logins em andamento. Aguarde e tente novamente.');
    const state=random(),nonce=random(),binding=random(),createdAt=now(),verifier=provider==='google'?random():'';
    const redirectUri=`${publicOrigin}${COOKIE_PATH}/${provider}/callback`;
    const url=new URL(meta.authorization_endpoint);
    const fields={client_id:config[provider].clientId,redirect_uri:redirectUri,response_type:provider==='apple'?'code id_token':'code',scope:provider==='apple'?'name email':'openid email profile',state,nonce};
    if(provider==='google'){fields.code_challenge=hash(verifier).toString('base64url');fields.code_challenge_method='S256';fields.prompt='select_account';}
    else fields.response_mode='form_post';
    for(const [key,value]of Object.entries(fields))url.searchParams.set(key,value);
    pending.set(state,{provider,nonce,binding:hash(binding).toString('base64url'),verifier,redirectUri,createdAt,expiresAt:createdAt+FLOW_MS});
    return {authorizationUrl:url.toString(),setCookie:cookieHeader(provider,binding,FLOW_MS/1000)};
  }
  async function finish(provider,{params,cookieHeader:requestCookie}={}){
    const clearCookie=cookieHeader(provider,'',0);
    try{
      ensureAvailable(provider);prune();
      const state=parameter(params,'state',100),flow=pending.get(state);
      if(!/^[A-Za-z0-9_-]{43}$/.test(state))throw new OAuthError(400,'oauth_invalid_state','Não foi possível confirmar este login. Inicie novamente.');
      if(!flow||flow.provider!==provider)throw new OAuthError(400,'oauth_expired','Este login expirou ou já foi utilizado. Inicie novamente.');
      const binding=browserCookie(provider,requestCookie);
      if(!/^[A-Za-z0-9_-]{43}$/.test(binding)||!constantEqual(hash(binding).toString('base64url'),flow.binding))throw new OAuthError(400,'oauth_invalid_state','Abra o login novamente neste navegador.');
      // Consume before any provider call: concurrent callbacks cannot reuse the state.
      pending.delete(state);
      if(parameter(params,'error',100))throw new OAuthError(400,'oauth_cancelled','O login foi cancelado. Você pode tentar novamente.');
      const code=parameter(params,'code',4096);if(!code||/[\r\n\x00]/.test(code))throw invalid();
      let initialClaims;
      if(provider==='apple'){
        initialClaims=await verifiedToken(provider,parameter(params,'id_token',32*1024),flow);
        const expectedHash=hash(code).subarray(0,16).toString('base64url');
        if(!constantEqual(initialClaims.c_hash,expectedHash))throw invalid();
      }
      const meta=await metadata(provider);
      const body=new URLSearchParams({client_id:config[provider].clientId,client_secret:provider==='apple'?appleSecret():config.google.clientSecret,code,grant_type:'authorization_code',redirect_uri:flow.redirectUri});
      if(provider==='google')body.set('code_verifier',flow.verifier);
      const tokenResponse=await document(meta.token_endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},64*1024);
      const claims=await verifiedToken(provider,tokenResponse.id_token,flow);
      if(initialClaims&&initialClaims.sub!==claims.sub)throw invalid();
      const name=provider==='apple'?appleName(parameter(params,'user',4096)):claims.name;
      return {identity:identityFor(provider,claims,name),setCookie:clearCookie};
    }catch(error){
      if(error instanceof OAuthError){error.setCookie=clearCookie;throw error;}
      throw new OAuthError(502,'oauth_provider_unavailable','Não foi possível concluir o login. Tente novamente.',clearCookie);
    }
  }
  return {status,start,finish};
}
