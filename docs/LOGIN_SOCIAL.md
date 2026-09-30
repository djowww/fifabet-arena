# Login com Google e Apple

O módulo `backend/oauth.mjs` implementa a troca de código e a validação de identidade no servidor. Não contém credenciais nem cria projetos ou contas nos provedores. Sem configuração privada completa e origem HTTPS, o provedor fica indisponível; a interface deve manter sua opção desabilitada. Não existe aprovação ou identidade simulada.

## Configuração privada

Configurar no servidor, fora do repositório, por exemplo em `/etc/fifago/fifago.env`:

```text
FIFABET_PUBLIC_ORIGIN=https://betfifa.com.br
FIFABET_GOOGLE_CLIENT_ID=ID-do-cliente-web.apps.googleusercontent.com
FIFABET_GOOGLE_CLIENT_SECRET=segredo-do-cliente-web
FIFABET_APPLE_CLIENT_ID=Services-ID-do-site
FIFABET_APPLE_TEAM_ID=TEAM-ID-de-10-caracteres
FIFABET_APPLE_KEY_ID=KEY-ID-de-10-caracteres
FIFABET_APPLE_PRIVATE_KEY_FILE=/etc/fifago/apple-sign-in.p8
```

Esses valores são exemplos, não credenciais válidas. Nunca solicitar segredos pelo chat, colocar `.p8` no GitHub ou incluir client secrets no JavaScript do navegador. A chave Apple deve ser legível pelo usuário do serviço, com permissões privadas, estar fora da árvore do código inclusive após resolver links simbólicos, e ser EC P-256. O módulo verifica a localização e o tipo da chave antes de disponibilizar Apple. Reiniciar somente o serviço Fifa GO depois de configurar seus valores privados.

Google exige cliente OAuth de aplicação web, tela de consentimento e callback autorizado exato `https://betfifa.com.br/api/v1/auth/oauth/google/callback`. Os escopos solicitados são `openid email profile`; não há acesso a jogos, compras, contatos ou histórico da EA. A preparação das credenciais e da tela de consentimento segue o [OpenID Connect do Google](https://developers.google.com/identity/openid-connect/openid-connect).

Apple exige a configuração própria de Sign in with Apple, Services ID, domínio, Return URL `https://betfifa.com.br/api/v1/auth/oauth/apple/callback` e chave privada associada. O módulo assina o client secret ES256 com duração de cinco minutos e usa o Services ID como `client_id`. A preparação depende da [configuração oficial da Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple); não é executada pela aplicação.

## Contrato com o servidor

```js
const oauth = await createOAuthService({publicOrigin, env: process.env});
const providers = oauth.status();
// {google:{available,enabled,label,reason}, apple:{available,enabled,label,reason}}

const begin = await oauth.start('google');
// {authorizationUrl, setCookie}
// Aplicar Set-Cookie e redirecionar o navegador para authorizationUrl.

const result = await oauth.finish('google', {
  params: new URLSearchParams(callbackQuery),
  cookieHeader: request.headers.cookie
});
// {identity:{provider,subject,email,emailVerified,displayName}, setCookie}
```

Rotas de início previstas: `GET /api/v1/auth/oauth/google/start` e `GET /api/v1/auth/oauth/apple/start`. Google volta por GET/query; Apple volta por POST com `application/x-www-form-urlencoded`. A integração deve limitar o corpo do callback, usar `URLSearchParams` preservando parâmetros duplicados para sua rejeição, aplicar os limites de requisições existentes e devolver `Cache-Control: no-store`. Não aceitar URL externa de retorno enviada pelo navegador.

O callback Apple é uma entrada deliberada de outro domínio: validar state e cookie temporário no módulo, sem exigir o Origin/CSRF das mutações comuns da carteira. Essa exceção deve ficar restrita à rota exata do callback e ao método POST. Ela não autoriza criar exceções nos demais endpoints.

O módulo retorna o valor de `Set-Cookie`, sem escrever cabeçalhos HTTP nem criar sessão ou conta. O servidor deve persistir a identidade e a sessão antes de instalar o cookie de sessão habitual. Aplicar também a exclusão do cookie temporário retornada em `result.setCookie`; quando houver dois cookies, usar uma lista no cabeçalho. Em erro, `OAuthError` fornece `status`, `code`, mensagem segura e, no callback, `setCookie` para excluir o cookie temporário.

Códigos próprios de erro: `oauth_unavailable`, `oauth_expired`, `oauth_invalid_state`, `oauth_cancelled`, `oauth_rejected`, `oauth_invalid_response`, `oauth_provider_unavailable`. O servidor pode redirecionar a uma URL fixa da arena com apenas esse código permitido. Não colocar códigos de autorização, tokens, state, e-mail ou mensagens do provedor na URL de retorno, nos logs, nos links ou no extrato público.

O log de acesso do proxy também precisa preservar essa regra: a query do callback Google contém código e state. Desabilitar o log de acesso somente nas rotas callback OAuth desse host ou usar um formato que omita query e corpo. Não alterar os logs dos demais sites para configurar esse fluxo.

## Identidade e privacidade

Identificar a conta por **provedor + subject (`sub`)**, nunca por e-mail. Uma identidade já registrada entra somente na conta que pertence a essa chave. A integração em `backend/server.mjs` cria no primeiro login uma conta própria com saldo zero e apelido `Jogador_` seguido de oito caracteres hexadecimais aleatórios, verificando colisões de apelido. Não publica o nome completo recebido de Google ou Apple. O módulo apenas entrega a identidade validada: persistência e sessão são responsabilidade do servidor, que grava os dados antes de enviar o cookie da conta. Não unir automaticamente contas de senha, Google ou Apple por e-mail coincidente. O Google recomenda o identificador `sub` para reconhecer a conta, pois e-mail pode mudar. [Identidade no Google](https://developers.google.com/identity/openid-connect/openid-connect).

`email` pode ser nulo; `emailVerified` é somente metadado da identidade e não autoriza vinculação. Apple pode devolver e-mail privado por relay. `displayName` é opcional e não deve virar um nome público automaticamente. O nome recebido no campo Apple `user` é dado de exibição sanitizado, não a prova de identidade; a prova vem dos tokens assinados. Os detalhes de dados recebidos estão no [fluxo web da Apple](https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server.?changes=_6%2C_6).

## Proteções do fluxo

- State, nonce e vínculo com navegador aleatórios de 32 bytes; state de uso único, prazo de dez minutos e limite de 500 fluxos pendentes por processo. Eles ficam somente em memória; reiniciar o serviço exige iniciar novamente os logins pendentes.
- Cookie temporário `HttpOnly; Secure`, com caminho restrito ao OAuth e exclusão no callback. Google usa `SameSite=Lax`; Apple usa `SameSite=None` para permitir o callback `form_post` entre domínios. O cookie habitual da conta não precisa de alteração.
- Google usa PKCE S256; o verifier é armazenado somente no servidor e enviado na troca de código.
- Discovery e JWKS são obtidos somente dos endereços HTTPS oficiais fixos. Endpoints descobertos precisam corresponder à lista permitida; redirects são recusados. Há timeout, limite de resposta, cache limitado e no máximo 16 chaves por provedor.
- ID tokens aceitam somente RS256, chave RSA de 2.048 a 8.192 bits com `kid` correspondente, assinatura válida, emissor previsto, audiência do cliente, expiração, horário de emissão e nonce esperado. Tokens Apple do callback e da troca no servidor precisam concordar no subject; `c_hash` vincula o token inicial ao código.
- Segredos, tokens de acesso, refresh tokens e ID tokens não são retornados pela API para o navegador nem persistidos pelo módulo.

As descobertas oficiais anunciam RS256 e seus endereços de autorização, token e JWKS: [Google Discovery](https://accounts.google.com/.well-known/openid-configuration), [Apple Discovery](https://appleid.apple.com/.well-known/openid-configuration). Seleção de chave e troca do código seguem [chaves públicas Apple](https://developer.apple.com/documentation/signinwithapplerestapi/fetch-apple%27s-public-key-for-verifying-token-signature) e [validação do código Apple](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens?changes=l_1).

## Pendências de operação

Disponibilizar o login requer credenciais reais configuradas pelos responsáveis em cada provedor e uma conferência de ponta a ponta depois dessa configuração. Presença das variáveis habilita o início do fluxo, mas não comprova aprovação da tela de consentimento, domínio ou cliente no provedor. Nenhum login real foi concluído pela implementação do módulo.

O estado transitório em memória corresponde à instância única atual do backend. Para múltiplas instâncias, usar armazenamento compartilhado que consuma state atomicamente. Monitoramento, recuperação de conta, vinculação explícita após autenticar as duas contas e exclusão de conta são fluxos separados.

Antes de lançar com Apple nas lojas, implementar tratamento de revogação/exclusão e notificações do provedor. O módulo inicial descarta refresh/access tokens e não automatiza revogação ou consulta diária à Apple. A [orientação oficial para exclusão e revogação](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple) descreve as necessidades desse ciclo; não apresentar esta etapa como uma integração completa para lançamento comercial.
