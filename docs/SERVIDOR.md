# Contas, desafios e carteira de teste

O servidor `backend/server.mjs` transforma os desafios de pontos fictícios em dados compartilhados: cada pessoa entra com apelido ou ID e senha, os dois lados usam o mesmo desafio, a foto fica privada e o saldo é controlado pelo servidor. A carteira oferece pedidos de créditos demonstrativos por cartão, Pix e transferência. Nenhuma dessas ações cobra dinheiro, movimenta uma conta bancária ou consulta um gateway. O servidor também entrega os arquivos da interface pela mesma origem. Saques e consulta a partidas da EA não estão integrados.

A interface e esta API estão publicadas e conferidas com HTTPS em `betfifa.com.br`, pelo VPS e pelo proxy da zona exclusiva do domínio na Cloudflare. Os nameservers foram salvos no registro da Hostinger; consultas DNS, uma requisição externa à API com validação TLS e a interface no navegador confirmaram a rota pública. O serviço Fifa GO tem usuário, runtime, código e dados próprios, preservando os serviços, arquivos, bancos, domínios e regras de firewall do Tibia. O GitHub Pages mantém uma publicação estática que não executa a API; retornar essa versão ao domínio exige reapontar os registros DNS.

## Domínio e HTTPS

A zona própria de `betfifa.com.br` foi criada no plano Free da Cloudflare e está ativa. O registro A de `@` aponta para o VPS com proxy habilitado, e o modo SSL/TLS está em **Full (strict)**. Os nameservers `meilani.ns.cloudflare.com` e `salvador.ns.cloudflare.com` foram salvos na Hostinger somente para esse domínio. Consultas ao resolvedor público e ao nameserver da Cloudflare confirmaram o destino pelo proxy. O CNAME de `www` permanece como `djowww.github.io`, em modo somente DNS, usando o redirecionamento do domínio personalizado do Pages.

Alguns resolvedores locais ainda podem manter o destino anterior do GitHub Pages em cache. Uma resposta 404 da API ou a demonstração local pela rota antiga durante essa propagação não indica que o serviço do VPS tenha parado. Aguardar a atualização desses caches; não trocar os nameservers de volta nem alterar a zona antiga da Hostinger, que ficou somente leitura após a mudança, para contornar essa situação.

O firewall existente do VPS permite HTTP/HTTPS pelas redes da Cloudflare e permanece preservado. Acessar diretamente o IP público do VPS de outra rede pode ser bloqueado por essa regra; isso não autoriza abrir portas para toda a internet.

O novo host Nginx `betfifa.com.br` atende HTTP/HTTPS, redireciona HTTP para HTTPS e encaminha a aplicação à porta local `127.0.0.1:4174`. Essa porta não precisa de acesso público. O certificado fica em `/etc/letsencrypt/live/betfifa.com.br/`; o diretório dos desafios ACME é `/var/lib/fifago-acme`, separado dos dados privados. A disponibilidade pública deve ser confirmada pelo domínio com DNS e HTTPS, além da conferência local do host Nginx.

O certificado próprio foi inicialmente emitido por DNS-01 e agora usa renovação automática por webroot em `/var/lib/fifago-acme`. O `certbot.timer` já existente permanece ativo. A simulação de renovação (`dry-run`) e a renovação real do certificado específico de `betfifa.com.br` foram concluídas com sucesso. O hook novo `fifago-reload` confere `RENEWED_LINEAGE` para atuar somente nesse certificado e valida a configuração do Nginx antes de recarregá-lo. Os hooks, certificados e configurações de renovação anteriores permanecem separados; não devem ser alterados para manter o Fifa GO.

Não editar os registros DNS dos domínios do Tibia para publicar ou atualizar o Fifa GO. O arquivo `CNAME` no repositório preserva a configuração do domínio no GitHub Pages para contingência; ele não aponta o DNS de volta nem instala a API.

Referências: [domínio personalizado no GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) e [registros DNS da Hostinger](https://www.hostinger.com/support/1583249-how-to-manage-dns-records-at-hostinger/).

## Executar no computador

Requisito: Node.js 18 ou superior. Não é necessário instalar pacotes.

```powershell
node backend/server.mjs
```

Abra `http://127.0.0.1:4174`. Crie duas contas pela interface, cada uma com senha de pelo menos 10 caracteres. Use outro navegador ou uma janela anônima para a segunda pessoa. O cadastro dá 1.000 pontos fictícios apenas uma vez. Para entrar em outro dispositivo ou navegador, use o mesmo apelido/ID e senha. O protótipo não tem recuperação de senha por e-mail.

Cada conta tem um ID público permanente como `FBA-A012BC34DE`; trocar o apelido não troca esse ID. O histórico exibido contém os desafios que realmente foram registrados no servidor, não uma lista de partidas inventadas. Não é o histórico da conta EA.

O ranking compartilhado considera exclusivamente desafios encerrados com decisão da equipe sobre o relatório atual. Convites, partidas em andamento, placares aguardando revisão e disputas não contam. Somente jogadores com ao menos uma partida assim aparecem; cada partida registra vitória e derrota, ou empate para ambos. A classificação contém no máximo 100 jogadores e ordena vitórias em ordem decrescente, depois empates em ordem decrescente e, para desempate, apelido em ordem alfabética portuguesa. Pontos disponíveis não entram no critério e não são expostos pelo ranking.

Por padrão, os dados privados ficam em `%USERPROFILE%\.fifabet-arena` no Windows, ou `~/.fifabet-arena` em outros sistemas. `state.json` contém os registros; `evidence/` contém fotos das partidas; `wallet-evidence/` contém comprovantes demonstrativos. Os registros de carteira e de partidas ficam separados. A configuração `FIFABET_DATA_DIR` pode apontar para outra pasta privada, mas o servidor recusa uma pasta dentro da árvore publicada do projeto. Esses arquivos nunca devem ser enviados ao GitHub.

## Carteira de créditos demonstrativos

O ambiente de teste foi escolhido para esta etapa. `GET /status` e `GET /wallet` identificam `paymentMode:'demo'`, `realMoney:false` e `noRealMoney:true`. O modo é uma simulação interna FifaBet; não é um sandbox oficial de Mercado Pago, PokerStars ou outro provedor. `FIFABET_PAYMENT_MODE` aceita somente `demo`. Uma configuração diferente impede iniciar o servidor, pois nenhum gateway real foi integrado.

Os pacotes disponíveis são 100, 250, 500 e 1.000 créditos. Cartão permite simular de uma a seis parcelas; Pix e transferência usam uma parcela. Os valores são créditos fictícios do mesmo saldo utilizado nos desafios. Criar um pedido não altera esse saldo nem prova um pagamento.

1. Crie o pedido informando pacote, método e `idempotencyKey` única de 16 a 100 letras, números, hífens ou `_`. Repetir a mesma operação com os mesmos dados retorna o pedido existente; mudar os dados mantendo a chave retorna conflito. A chave é individual por conta.
2. Cartão e Pix permanecem pendentes até a pessoa clicar na ação explícita de simular aprovação ou rejeição. A API exige `mode:'demo'`, a versão atual e o resultado desejado. A aprovação grava uma decisão demonstrativa e uma transação `[DEMO]`; a rejeição não libera créditos.
3. Transferência exige uma imagem de comprovante fictício, enviada somente pelo proprietário. O pedido passa para `review`; uma conta diferente da equipe confere e aprova ou rejeita. O proprietário, mesmo sendo revisor, não pode julgar o próprio pedido. O botão de simulação de cartão/Pix não aprova transferências.
4. Apenas aprovação demonstrativa registrada libera o pacote no saldo. Repetições não duplicam o crédito. Pedidos rejeitados ou cancelados não liberam créditos; cancelamento é possível enquanto estiverem pendentes ou aguardando revisão.

Cada pedido possui `version`. Enviar uma nova foto incrementa a versão e invalida decisões preparadas sobre a foto anterior. Aprovar, rejeitar ou cancelar exige a versão atual. Até três imagens são preservadas por pedido; o arquivo original não tem seu nome salvo. Os comprovantes seguem os mesmos limites de tipo, tamanho e acesso privado das fotos de partidas, mas não podem ser usados como evidência de uma partida.

Não envie números de cartão, CVV, chave Pix real, dados bancários ou comprovantes financeiros reais. Os formulários da API aceitam somente campos previstos para a simulação e rejeitam campos adicionais. Os testes usam imagens sintéticas. A carteira de outra conta e seus comprovantes não ficam disponíveis para jogadores; a equipe autorizada tem acesso aos comprovantes para avaliação.

Estados de pedido: `pending`, `review`, `approved`, `rejected`, `cancelled`. Decisões registram autor, motivo, data, `kind:'simulation'` ou `kind:'team_review'` e `provider:'fifabet-demo'`. As reservas da carteira correspondem aos desafios em andamento; pedidos de créditos ainda não aprovados não aumentam saldo disponível ou reservado. Pedidos persistem após reiniciar o servidor. Arquivos JSON anteriores à carteira ganham os registros vazios de depósitos/comprovantes sem alterar contas ou desafios existentes.

## Revisão de resultados

1. O criador define o modo, a plataforma, as regras e os pontos de cada jogador. Seus pontos ficam reservados; o convite expira em sete dias e devolve a reserva se ninguém aceitar.
2. O amigo aceita pelo seu ID de jogador ou pelo link. O servidor reserva a mesma quantidade na conta dele. Um convite destinado a um ID específico não pode ser aceito por outra conta.
3. Um participante envia uma foto e informa o placar, sempre na ordem anfitrião × convidado. O adversário pode concordar ou sinalizar divergência com sua própria foto.
4. A confirmação do adversário registra concordância, mas não distribui pontos. Uma conta da equipe autorizada confere as fotos e decide vitória do anfitrião, do convidado ou empate. Um participante, mesmo que faça parte da equipe, não pode julgar o próprio desafio.
5. Vitória entrega as duas reservas ao vencedor; empate devolve uma reserva a cada jogador. O servidor impede distribuição duplicada. O encerramento aparece no histórico de ambos.

As versões anteriores de placares e as divergências são preservadas. Alterar um placar invalida a confirmação anterior. Confirmar, sinalizar ou revisar uma versão antiga retorna erro para a interface recarregar o resultado atual. Após o aceite, um cancelamento exige concordância dos dois jogadores. O solicitante pode retirar o pedido e o rival pode recusá-lo: ambas as ações mantêm o desafio em andamento e os pontos reservados. Registrar um resultado limpa o pedido de cancelamento; a partir daí, a revisão deve resolver o desafio.

Para habilitar uma conta da equipe:

1. Crie uma conta separada para o revisor pelo site.
2. Pare o servidor com `Ctrl+C`.
3. Liste apenas os identificadores das contas, sem senhas ou sessões:

```powershell
node backend/accounts.mjs
```

4. Copie `reviewerUserId` da conta correta. Ele é o UUID interno, diferente do ID público `FBA-...`. Configure e reinicie:

```powershell
$env:FIFABET_REVIEWER_IDS='UUID-da-conta-da-equipe'
node backend/server.mjs
```

Vários revisores podem ser configurados separados por vírgula. O cadastro público não concede acesso à equipe. A interface só mostra revisão quando o servidor indica `user.isReviewer`.

## Usar dois dispositivos na mesma rede

O padrão `127.0.0.1` atende somente ao computador local. Para um teste na rede local, descubra o IP do computador que executará o servidor e configure a origem exata. Exemplo, se o IP for `192.168.1.20`:

```powershell
$env:FIFABET_HOST='0.0.0.0'
$env:FIFABET_PUBLIC_ORIGIN='http://192.168.1.20:4174'
node backend/server.mjs
```

Abra `http://192.168.1.20:4174` nos dois dispositivos. O firewall do computador pode exigir liberação da porta para a rede privada. Use apenas contas de teste nessa rede: HTTP não criptografa o tráfego. Não configure encaminhamento dessa porta no roteador como solução de publicação.

## Publicação no VPS

O servidor está instalado com Node.js 24.21.0 portátil próprio, sem alterar o runtime global do VPS. A interface e a API usam a mesma origem porque as sessões usam cookies `HttpOnly` e o cliente não aceita uma URL de API arbitrária. `FIFABET_PUBLIC_ORIGIN=https://betfifa.com.br` define a origem HTTPS exata e habilita o cookie `Secure`.

Estrutura da instalação:

- Usuário e grupo exclusivos: `fifago`.
- Serviço: `fifago.service`; somente esse serviço deve ser parado ou reiniciado durante manutenção da aplicação.
- Código ativo: `/opt/fifago/current`, apontando para uma versão instalada.
- Runtime: `/opt/fifago/runtime/bin/node`.
- Pasta de trabalho do serviço: `/opt/fifago/current`; comando de início: `/opt/fifago/runtime/bin/node backend/server.mjs`.
- Configuração privada: `/etc/fifago/fifago.env`.
- Dados e imagens privados: `/var/lib/fifago`, fora do código publicado.
- Host Nginx próprio: `betfifa.com.br`; modelo em `deploy/nginx-fifago.conf`.

Variáveis do serviço:

```text
FIFABET_HOST=127.0.0.1
FIFABET_PORT=4174
FIFABET_PUBLIC_ORIGIN=https://betfifa.com.br
FIFABET_TRUST_PROXY_LOOPBACK=1
FIFABET_DATA_DIR=/var/lib/fifago
FIFABET_PAYMENT_MODE=demo
```

O Nginx sobrescreve o cabeçalho com `proxy_set_header X-Real-IP $remote_addr;`. A opção de confiança fica desligada por padrão no código. Quando habilitada (também por `options.trustProxyLoopback === true`), os limites de requisições usam `X-Real-IP` somente se a conexão vier de `127.0.0.1`, `::1` ou `::ffff:127.0.0.1` e o valor for um único IP válido. Cabeçalhos inválidos, arrays e conexões externas usam o endereço do socket. Autenticação, CSRF e limites permanecem iguais.

A configuração existente de IP real do Nginx usa `CF-Connecting-IP` e `real_ip_recursive on` para reconhecer visitantes pelo proxy da Cloudflare antes de encaminhar `$remote_addr` à aplicação. Ela foi preservada. Em outra instalação, configurar somente as faixas confiáveis da Cloudflare: sem reconhecimento do IP real, os limites ficam compartilhados pelos visitantes da mesma saída do proxy. Não confiar em cabeçalhos enviados diretamente pelo cliente nem em toda a internet.

O healthcheck `GET /api/v1/status` é somente leitura: retorna os mesmos metadados de disponibilidade, versão, ambiente de teste e configuração da revisão, sem entrar na fila de operações, expirar convites/sessões nem gravar dados. Continua sujeito ao limite geral de requisições e aos cabeçalhos de resposta da aplicação.

### Limites e revisão

O serviço usa `CPUQuota=20%`, `MemoryHigh=384M`, `MemoryMax=512M`, `TasksMax=32`, `IOWeight=10` e `Nice=10`. Código e runtime são somente leitura para o processo; a escrita fica limitada à pasta privada de dados. A unidade configura redução de privilégios, pasta temporária privada e limite de frequência dos logs. Esses limites reduzem o consumo da aplicação; CPU, disco e rede do VPS continuam compartilhados e precisam de acompanhamento.

**Ainda não há revisor configurado na instalação.** Cadastro público não concede esse papel. Até configurar uma conta independente da equipe em `FIFABET_REVIEWER_IDS`, resultados e comprovantes de transferência permanecem em análise, sem liberação dos créditos correspondentes. Cartão e Pix continuam simulados; nenhuma operação recebe dinheiro real. Para habilitar a equipe no VPS, obter o UUID interno da conta com `backend/accounts.mjs` usando a pasta `/var/lib/fifago`, atualizar o arquivo privado de ambiente e reiniciar somente `fifago.service`.

### Atualizações e dados

**O deploy é manual.** Um commit ou push no GitHub atualiza o repositório e eventualmente a publicação estática, mas não substitui a versão instalada no VPS. Instalar uma nova versão em pasta própria, preservar `/var/lib/fifago` e o arquivo de ambiente, trocar a versão ativa e reiniciar somente `fifago.service`. Conferir `/api/v1/status` e a página HTTPS após cada publicação. Não instalar pacotes globais, substituir a configuração principal do Nginx ou reiniciar serviços do Tibia para atualizar a aplicação.

A conferência pública de `https://betfifa.com.br/api/v1/status` retornou `mode:'shared-prototype'`, `paymentMode:'demo'` e `realMoney:false`, com validação TLS. Em `https://betfifa.com.br/#arena`, o navegador exibiu a versão conectada e o login de conta do servidor com senha. Repetir essas duas conferências após atualizações; um teste local do host Nginx não substitui a rota pública. Uma interface em modo local quando a API estiver indisponível não recupera automaticamente os dados das contas do VPS.

Na publicação, as configurações anteriores do Nginx, a unidade do Tibia e as regras UFW foram conferidas sem alterações; o processo do Tibia permaneceu em execução. Essa conferência se refere à implantação realizada, e deve ser repetida quando houver manutenção da infraestrutura compartilhada.

Este protótipo grava JSON atomicamente e serializa as operações. Ele só pode ter uma instância por pasta de dados: `instance.lock` impede processos concorrentes. Se houver encerramento inesperado, confirme que o processo parou antes de remover o lock. Para múltiplas instâncias, escala maior ou lançamento comercial, migre para um banco com transações, backup automatizado, monitoramento, política de retenção de imagens e recuperação de conta. Não anuncie este armazenamento como infraestrutura final.

Faça backup da pasta de dados completa com apenas `fifago.service` parado para manter JSON e fotos consistentes; depois inicie esse mesmo serviço. As imagens não são removidas automaticamente neste protótipo. Nunca publique backups, logs com credenciais ou arquivos de dados como arquivos estáticos. Perfis da demonstração no navegador não migram automaticamente para contas dessa instalação.

### Retorno ao GitHub Pages

Para devolver somente o site Fifa GO à hospedagem estática:

1. Preservar os dados privados do VPS e a versão instalada. Não copiar contas, sessões ou fotos para o GitHub.
2. Na zona **betfifa.com.br** da Cloudflare, restaurar os quatro registros A de `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` e `185.199.111.153`, em modo somente DNS, removendo o destino anterior desse mesmo registro. Manter os nameservers dessa zona na Cloudflare. Conferir também registros AAAA de `@` para não manter uma rota concorrente para o VPS.
3. Se o endereço `www` for usado no GitHub Pages, definir seu CNAME como `djowww.github.io`, sem o nome do repositório, também em modo somente DNS, e conferir o domínio personalizado e HTTPS nas configurações do Pages.
4. Aguardar a propagação e conferir a página. No Pages, a API não existe: a interface deve identificar a demonstração local. Contas e partidas compartilhadas do VPS ficam preservadas, mas indisponíveis nessa hospedagem estática.
5. Se quiser interromper o consumo da aplicação no VPS após a mudança, executar apenas `sudo systemctl stop fifago.service`. Não parar Nginx nem qualquer serviço do Tibia. A configuração do novo host pode permanecer instalada enquanto o DNS aponta para o Pages.

O retorno por DNS não desfaz dados da API nem altera a zona, os nameservers, o firewall ou os serviços do Tibia. Para reativar a versão conectada, conferir o serviço e o certificado próprios antes de apontar novamente apenas esse domínio ao VPS pelo proxy da Cloudflare.

## Proteções funcionais incluídas

- Senhas derivadas com `scrypt`, sal individual, sessão de 14 dias armazenada por hash e cookie `HttpOnly`/`SameSite=Lax`; logout revoga a sessão.
- Mutações exigem a origem configurada e, para contas autenticadas, token CSRF. Não há CORS aberto.
- Saldo e reservas calculados no servidor. Recargas demonstrativas exigem decisão registrada; enviar `balance` ou `isReviewer` pelo perfil não muda esses campos.
- Fotos limitadas a PNG/JPG/WebP, até 5 MiB e 24 megapixels, acessíveis somente aos participantes e revisores. Nome original do arquivo não é salvo ou exposto.
- Limites de tentativas de login, requisições e uploads; 12 fotos por participante/desafio, 20 versões de placar, 10 divergências, 20 convites pendentes e 50 desafios ativos por criador; 10 recargas pendentes/aguardando revisão e três comprovantes por recarga. Esses limites são da aplicação; não são uma promessa de proteção contra DDoS.
- Armazenamento total de fotos limitado a 200 MiB por padrão. Pode ser configurado por `FIFABET_MAX_EVIDENCE_BYTES`, em bytes, junto a uma política de retenção.
- Arquivos de backend, documentos, `.env`, dados e testes não são servidos pelo HTTP estático do backend.

## Contrato da API

Todas as rotas ficam em `/api/v1`; respostas são JSON, exceto o conteúdo de fotos. Erros retornam `{error,code}`. A interface usa `backend-client.mjs` para gerenciar cookies/CSRF e não grava tokens de sessão no armazenamento local.

| Operação | Rota | Dados ou resultado |
|---|---|---|
| Detectar servidor | `GET /status` | Disponibilidade, versão, pontos fictícios e revisor configurado |
| Sessão atual | `GET /session` | `{user,csrfToken}` ou valores nulos |
| Criar conta | `POST /auth/register` | `{nickname,password}` |
| Entrar | `POST /auth/login` | `{identifier,password}`; identificador é apelido ou ID público |
| Sair | `POST /auth/logout` | Revoga a sessão |
| Arena da conta | `GET /me` | `{user,duels,history,stats,csrfToken}` |
| Ranking compartilhado | `GET /leaderboard` | Requer conta; `{entries:[{player,played,wins,draws,losses}]}`, até 100 entradas apenas de partidas revisadas |
| Perfil | `PATCH /me` | `{nickname,clubId}` |
| Carteira de teste | `GET /wallet` | `{balance,reserved,transactions,deposits,catalog,methods,paymentMode,realMoney,noRealMoney}` da própria conta |
| Criar pedido demonstrativo | `POST /wallet/deposits` | `{amount,method:'card'|'pix'|'transfer',installments?,idempotencyKey}`; cria `pending`, não libera créditos |
| Simular aprovação/rejeição | `POST /wallet/deposits/:id/simulate` | Proprietário, cartão/Pix: `{mode:'demo',outcome:'approved'|'rejected',version}` |
| Cancelar pedido | `POST /wallet/deposits/:id/cancel` | Proprietário: `{version}`; somente pedidos pendentes/em revisão |
| Enviar comprovante fictício | `POST /wallet/deposits/:id/proof?version=N` | Proprietário, transferência: corpo binário PNG/JPG/WebP |
| Ver comprovante | `GET /wallet/evidence/:id` | Somente proprietário ou conta autorizada da equipe |
| Fila de comprovantes | `GET /wallet/reviews` | Equipe: `{deposits,paymentMode,realMoney}`, sem os próprios pedidos |
| Decidir sobre comprovante | `POST /wallet/reviews/:id` | Equipe terceira: `{decision:'approve'|'reject',reason,version}` |
| Buscar jogador | `GET /players/:publicPlayerId` | Perfil público mínimo, requer conta |
| Criar desafio | `POST /duels` | `{stake,mode,platform,opponentPlayerId?,rules?,operationId?,expectedHostId?}`; chave UUID permite repetir o mesmo envio sem nova reserva; anfitrião esperado vincula confirmação à conta |
| Abrir convite | `GET /invites/:token` | Requer conta e convite pendente autorizado; `{invite:{host:{nickname},stake,mode,platform,rules,status,expiresAt}}` |
| Aceitar link | `POST /invites/:token/accept` | Reserva do convidado e desafio em andamento |
| Aceitar pelo ID | `POST /duels/:id/accept` | Somente o destinatário predefinido |
| Cancelar | `POST /duels/:id/cancel` | Cancelamento antes do aceite ou pedido de concordância dupla |
| Retirar ou recusar cancelamento | `POST /duels/:id/cancel-withdraw` | Somente participante, desafio em andamento com pedido pendente; não devolve pontos |
| Enviar foto | `POST /evidence?duelId=:id` | Corpo binário, tipo de imagem no `Content-Type` |
| Ver foto | `GET /evidence/:id` | Somente participante ou revisor |
| Registrar placar | `POST /duels/:id/result` | `{homeScore,awayScore,evidenceId}` |
| Concordar | `POST /duels/:id/confirm` | `{reportId}`; apenas o adversário do relator |
| Sinalizar divergência | `POST /duels/:id/dispute` | `{reason,evidenceId,reportId}` |
| Fila da equipe | `GET /reviews` | Desafios aguardando revisão ou em disputa |
| Decidir e distribuir | `POST /reviews/:id` | `{winner:'host'|'guest'|'draw',reason,reportId}` |

Modos: `1v1`, `Ultimate Team`, `Clubes`. Plataformas: `playstation`, `xbox`, `pc`, `switch`. Pontos inteiros: de 10 a 5.000 por participante, sujeitos ao saldo disponível. Placar inteiro: de 0 a 99. `homeScore` é sempre o anfitrião; `awayScore`, o convidado.

Estados de desafio: `invited`, `in_progress`, `pending_review`, `disputed`, `completed`, `cancelled`, `expired`. O perfil mantém `id` interno e `publicPlayerId` estável; o desafio inclui `host`, `guest`, `recipient`, `result`, `reports` e `disputes`. O token de convite só aparece para o criador enquanto o convite estiver pendente. Conta da equipe recebe `isReviewer:true` do servidor.

### Privacidade e validação dos convites

Links de convite transportam somente um token aleatório de 32 bytes em base64url (43 caracteres); não embutem perfis, saldo, placar ou fotos. A consulta do token exige sessão. Convites destinados a uma conta só podem ser consultados pelo criador ou destinatário. Convites abertos podem ser consultados e aceitos por uma conta autenticada que possua o token, enquanto estiverem pendentes.

O resumo para aceitar contém somente o apelido do criador e os termos do desafio: pontos por pessoa, modo, plataforma, regras, estado e prazo. Não contém UUID do desafio ou das contas, ID público FBA, conta de jogo, e-mail, saldo, dados da carteira, resultado ou evidências. Após o aceite, cancelamento ou expiração, o token retorna um erro sem resumo: participantes acompanham a partida na própria arena, conforme suas permissões. O aceite bem-sucedido retorna o desafio privado aos participantes.

Erros de consulta/aceite de convites usam o mesmo formato `{error,code}`:

| HTTP | `code` | Situação |
|---|---|---|
| 401 | `unauthorized` | É necessário entrar na conta antes de consultar ou aceitar |
| 400 | `invite_invalid` | Token com formato inválido |
| 404 | `invite_not_found` | Token válido no formato, mas inexistente |
| 403 | `invite_wrong_recipient` | Convite destinado a outra conta; o estado e o resumo ficam privados |
| 410 | `invite_expired` | Prazo encerrado; reserva do criador devolvida uma única vez |
| 410 | `invite_cancelled` | Convite cancelado ou recusado |
| 409 | `invite_already_accepted` | Convite consumido; sem retorno de resultado ou evidências pelo token |
| 409 | `invite_own` | Tentativa de aceitar o próprio convite |

A proteção também se aplica ao aceite por ID: uma partida cancelada/expirada retorna respectivamente `invite_cancelled`/`invite_expired`, e um novo aceite retorna `invite_already_accepted`. O destinatário incorreto recebe `invite_wrong_recipient` antes de qualquer estado do convite ser mostrado.

### Reenvio seguro de criação

O formulário pode enviar `operationId` UUID estável no `POST /duels`. Essa chave é individual por criador e persiste junto ao desafio. Duas requisições com a mesma chave e os mesmos termos retornam o mesmo desafio e, enquanto pendente, o mesmo token; a reserva ocorre uma única vez. Repetir após o aceite ou encerramento recupera o registro correspondente sem criar outra partida nem devolver um token ativo. Reutilizar a chave com modo, plataforma, adversário, pontos ou regras diferentes retorna `409 operation_conflict`. Formato inválido retorna `400 invalid_operation_id`. A interface deve gerar outra chave quando editar os termos e preservar a chave em um reenvio após falha de rede. Clientes anteriores sem a chave continuam suportados. Somente o criador autenticado recebe `duel.operationId`, inclusive na própria arena, para reconhecer uma criação já concluída após uma falha de rede antes de validar novamente o saldo. O convidado e os resumos de convite não recebem essa chave. Campos de armazenamento e assinaturas internas de comparação não são incluídos nas respostas.

O campo opcional `expectedHostId` contém o ID interno da conta que conferiu o resumo. O servidor compara esse valor com a conta autenticada antes de criar ou recuperar a operação. Se uma troca de sessão ocorrer entre a confirmação e o envio, retorna `409 account_changed` sem criar desafio nem reservar pontos da nova conta. Esse ID pertence somente à requisição autenticada, não faz parte do link nem do resumo de convite. Clientes anteriores que omitem o campo permanecem suportados.

## Verificação executada

```powershell
node --test backend/server.test.mjs
```

Os testes fazem requisições HTTP a servidores temporários e verificam autenticação, origem/CSRF, reservas concorrentes sem saldo negativo, criação com reenvio idempotente, resumos de convite com campos mínimos, erros de formato/estado, expiração com devolução única, aceite restrito, fotos privadas, confirmação sem liberação, revisão por terceiro, distribuição única, disputa e versão antiga de resultado, cancelamento conjunto, histórico, ranking, reinício com dados persistentes e bloqueio de arquivos privados. A carteira verifica criação idempotente, ausência de crédito automático, aprovação única explícita, rejeição/cancelamento sem crédito, recusa de dados bancários/cartão, comprovante privado, revisão por terceiro e bloqueio de versões antigas. Os dados temporários ficam fora do projeto e são removidos ao final.
