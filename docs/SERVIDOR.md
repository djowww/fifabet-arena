# Contas, desafios, banco e carteira

O servidor `backend/server.mjs` mantém contas e partidas compartilhadas em SQLite privado: cada pessoa entra com apelido ou ID e senha, os dois lados usam o mesmo desafio e a foto fica privada. O login Google/Apple possui fluxo próprio no servidor e depende das credenciais externas de cada provedor. O Google está sendo preparado em um projeto isolado, ainda sem credencial instalada no servidor; Apple fica desativado. O padrão da carteira continua `unconfigured`, que desativa compras e permite amistosas sem créditos. Há um modo opcional de Pix manual, descrito abaixo, que só funciona após configuração explícita e aprovação humana pelo extrato bancário. Saques e consulta a partidas da EA não estão integrados.

A arquitetura de publicação usa HTTPS em `betfifa.com.br`, pelo VPS e pelo proxy da zona exclusiva do domínio na Cloudflare, com registro na Hostinger. O serviço Fifa GO tem usuário, runtime, código e dados próprios; serviços, arquivos, bancos, domínios e regras de firewall do Tibia devem permanecer preservados. A versão SQLite/login social exige implantação e conferência da API e da interface após instalar o código: esta documentação não confirma que a nova versão já está entregue pelo domínio. O GitHub Pages mantém uma publicação estática que não executa a API; retornar essa versão ao domínio exige reapontar os registros DNS.

## Domínio e HTTPS

A zona própria de `betfifa.com.br` foi criada no plano Free da Cloudflare e está ativa. O registro A de `@` aponta para o VPS com proxy habilitado, e o modo SSL/TLS está em **Full (strict)**. Os nameservers `meilani.ns.cloudflare.com` e `salvador.ns.cloudflare.com` foram salvos na Hostinger somente para esse domínio. Consultas ao resolvedor público e ao nameserver da Cloudflare confirmaram o destino pelo proxy. O CNAME de `www` permanece como `djowww.github.io`, em modo somente DNS, usando o redirecionamento do domínio personalizado do Pages.

Alguns resolvedores locais ainda podem manter o destino anterior do GitHub Pages em cache. Uma resposta 404 da API durante essa propagação não confirma que o serviço do VPS tenha parado. No domínio de produção `betfifa.com.br`/`www.betfifa.com.br`, a versão nova mostra indisponibilidade e bloqueia os fluxos de cadastro/carteira locais quando não conecta à API; não simula contas ou saldo como alternativa. Aguardar a atualização desses caches; não trocar os nameservers de volta nem alterar a zona antiga da Hostinger, que ficou somente leitura após a mudança, para contornar essa situação.

O firewall existente do VPS permite HTTP/HTTPS pelas redes da Cloudflare e permanece preservado. Acessar diretamente o IP público do VPS de outra rede pode ser bloqueado por essa regra; isso não autoriza abrir portas para toda a internet.

O novo host Nginx `betfifa.com.br` atende HTTP/HTTPS, redireciona HTTP para HTTPS e encaminha a aplicação à porta local `127.0.0.1:4174`. Essa porta não precisa de acesso público. O certificado fica em `/etc/letsencrypt/live/betfifa.com.br/`; o diretório dos desafios ACME é `/var/lib/fifago-acme`, separado dos dados privados. A disponibilidade pública deve ser confirmada pelo domínio com DNS e HTTPS, além da conferência local do host Nginx.

O certificado próprio foi inicialmente emitido por DNS-01 e agora usa renovação automática por webroot em `/var/lib/fifago-acme`. O `certbot.timer` já existente permanece ativo. A simulação de renovação (`dry-run`) e a renovação real do certificado específico de `betfifa.com.br` foram concluídas com sucesso. O hook novo `fifago-reload` confere `RENEWED_LINEAGE` para atuar somente nesse certificado e valida a configuração do Nginx antes de recarregá-lo. Os hooks, certificados e configurações de renovação anteriores permanecem separados; não devem ser alterados para manter o Fifa GO.

Não editar os registros DNS dos domínios do Tibia para publicar ou atualizar o Fifa GO. O arquivo `CNAME` no repositório preserva a configuração do domínio no GitHub Pages para contingência; ele não aponta o DNS de volta nem instala a API.

Referências: [domínio personalizado no GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) e [registros DNS da Hostinger](https://www.hostinger.com/support/1583249-how-to-manage-dns-records-at-hostinger/).

## Executar no computador

Requisito: **Node.js 24 ou superior**, com `node:sqlite` nativo. Não é necessário instalar pacotes.

```powershell
node backend/server.mjs
```

Abra `http://127.0.0.1:4174`. Crie duas contas pela interface, cada uma com senha de pelo menos 10 caracteres. Use outro navegador ou uma janela anônima para a segunda pessoa. Novas contas começam com saldo zero, sem bônus financeiro. Para entrar em outro dispositivo ou navegador, use o mesmo apelido/ID e senha. O protótipo não tem recuperação de senha por e-mail. Login social exige domínio HTTPS e configuração dos provedores; sem as credenciais, fica indisponível e não simula autenticação.

Cada conta tem um ID público permanente como `FBA-A012BC34DE`; trocar o apelido não troca esse ID. Partidas têm código próprio `FG-` seguido de 10 dígitos hexadecimais maiúsculos, como `FG-1A2B3C4D5E`. O histórico contém os desafios registrados no servidor, não uma lista inventada nem o histórico da conta EA.

O ranking compartilhado considera exclusivamente desafios encerrados com decisão da equipe sobre o relatório atual. Convites, partidas em andamento, placares aguardando revisão e disputas não contam. Somente jogadores com ao menos uma partida assim aparecem; cada partida registra vitória e derrota, ou empate para ambos. A classificação contém no máximo 100 jogadores e ordena vitórias em ordem decrescente, depois empates em ordem decrescente e, para desempate, apelido em ordem alfabética portuguesa. Pontos disponíveis não entram no critério e não são expostos pelo ranking.

Por padrão, os dados privados ficam em `%USERPROFILE%\.fifabet-arena` no Windows, ou `~/.fifabet-arena` em outros sistemas. `arena.sqlite` contém os registros; `evidence/` contém fotos das partidas; `wallet-evidence/` contém comprovantes demonstrativos anteriores. O JSON legado é importado uma única vez, com original e backup preservados. A configuração `FIFABET_DATA_DIR` pode apontar para outra pasta privada, mas o servidor recusa uma pasta dentro da árvore publicada do projeto. Banco, arquivos WAL/SHM, imagens e backups nunca devem ser enviados ao GitHub. Consulte [contrato e migração do banco](BANCO.md).

## Login Google e Apple

O fluxo está implementado no servidor, com identidade persistida por `(provider, subject)` no SQLite e sessão própria em cookie `HttpOnly`. O projeto **Fifa GO** e um cliente OAuth Web Google foram criados em modo externo de teste, com o callback exato abaixo. O acesso permanece indisponível no site enquanto as credenciais privadas não forem instaladas no servidor e os testadores não forem cadastrados. Apple fica desativado. Para ativar Google, configure `FIFABET_PUBLIC_ORIGIN` com a origem HTTPS exata e as duas credenciais privadas:

- Google: `FIFABET_GOOGLE_CLIENT_ID` e `FIFABET_GOOGLE_CLIENT_SECRET`; a URL de retorno autorizada é `https://betfifa.com.br/api/v1/auth/oauth/google/callback`. Até o app sair do modo de teste, somente contas adicionadas como testadoras podem entrar.
- Apple: `FIFABET_APPLE_CLIENT_ID` (Services ID), `FIFABET_APPLE_TEAM_ID`, `FIFABET_APPLE_KEY_ID` e `FIFABET_APPLE_PRIVATE_KEY_FILE`; cadastrar o domínio e a URL de retorno `https://betfifa.com.br/api/v1/auth/oauth/apple/callback` no provedor. O arquivo da chave `.p8` deve usar caminho absoluto, privado e fora do repositório.

Essas credenciais e os cadastros externos permanecem pendentes de configuração. `GET /status` indica quais provedores estão disponíveis; sem configuração válida, o login social fica indisponível e nenhuma conta falsa é criada. O início redireciona ao provedor; a resposta é verificada no servidor antes de gravar uma conta/sessão, incluindo assinatura, emissor, destinatário, prazo, nonce e vínculo com o navegador. Tokens do provedor não são enviados à interface nem persistidos.

Contas externas novas recebem apelido genérico e ID próprio, sem publicar automaticamente nome completo ou e-mail. O e-mail verificado fica privado e não vincula uma conta existente automaticamente; o identificador estável é o subject do provedor. Uma conta Google/Apple sem senha deve entrar pelo mesmo provedor. Fluxos de login ainda não concluídos duram até 10 minutos e ficam em memória; após reiniciar, iniciar novamente o login.

## Carteira e pagamentos

O padrão é `FIFABET_PAYMENT_MODE=unconfigured`. `GET /status` e `GET /wallet` informam `paymentMode:'unconfigured'`, `paymentsAvailable:false`, `realMoney:false` e `noRealMoney:true`; catálogo e métodos de recarga retornam vazios. Criar ou aprovar recargas retorna `503 payments_unavailable`. Nenhum gateway ou cobrança automática foi integrado. Para usar Pix manual, o operador precisa ativar explicitamente `pix_manual`, informar uma chave e preços privados e configurar uma conta de equipe independente para revisão; até lá, a produção continua sem cobranças.

Na migração inicial do servidor, `balance`/`transactions` anteriores ficam preservados em `demoBalance`/`demoTransactions`; a carteira principal começa zerada. `walletLedgerVersion:1` impede repetir a migração. Partidas anteriores recebem `creditMode:'legacy_demo'` e movimentam exclusivamente essa carteira fictícia. As reservas antigas são expostas separadamente, sem conversão para dinheiro real. Novas partidas usam `creditMode:'friendly'`, com `stake:0`.

### Pix manual e análise humana

O modo `FIFABET_PAYMENT_MODE=pix_manual` habilita exclusivamente Pix manual. O aplicativo cria um pedido autenticado, mostra a chave Pix apenas ao comprador e exibe o valor exato definido no servidor. Preços em centavos são configurados no formato `créditos:centavos`, por exemplo `100:1000,250:2500,500:5000,1000:10000` para os pacotes definidos. A chave não deve aparecer no repositório, em mensagens, em endpoints públicos ou na tela de outros jogadores.

Variáveis privadas do serviço:

```text
FIFABET_PAYMENT_MODE=pix_manual
FIFABET_PIX_KEY=<chave Pix de e-mail>
FIFABET_PIX_PACKAGES=100:1000,250:2500,500:5000,1000:10000
FIFABET_REVIEWER_IDS=<UUID interno de uma conta independente da equipe>
```

A ativação exige HTTPS, uma chave de e-mail válida, os quatro pacotes e pelo menos um revisor. Pix manual não é gateway: não confirma transferências automaticamente, não cobra cartão e não possui chargeback integrado. O comprador pode anexar uma imagem privada como apoio; a equipe precisa localizar a transferência no próprio extrato bancário e só então aprovar. O comprador não pode aprovar o próprio pedido. A chave aparece somente nos detalhes do pedido pendente do próprio comprador. Créditos comprados não podem ser sacados; configure limites e regras do produto antes de permitir que partidas usem saldo comprado. Manter `unconfigured` até concluir essa revisão operacional.

Os preços iniciais escolhidos são 100 créditos por R$ 10, 250 por R$ 25, 500 por R$ 50 e 1.000 por R$ 100. Os créditos são saldo interno não sacável. Esta configuração não substitui verificação jurídica, fiscal ou bancária do modelo de negócio.

### Simulação restrita ao desenvolvimento local

O modo `FIFABET_PAYMENT_MODE=demo` preserva os fluxos demonstrativos abaixo somente no desenvolvimento local; uma origem pública configurada recusa esse modo. É uma simulação interna do Fifa GO, sem sandbox oficial de Mercado Pago, PokerStars ou outro provedor. As rotas de demonstração não representam a disponibilidade de pagamentos reais.

Os pacotes disponíveis são 100, 250, 500 e 1.000 créditos. Cartão permite simular de uma a seis parcelas; Pix e transferência usam uma parcela. Os valores são créditos fictícios do mesmo saldo utilizado nos desafios. Criar um pedido não altera esse saldo nem prova um pagamento.

1. Crie o pedido informando pacote, método e `idempotencyKey` única de 16 a 100 letras, números, hífens ou `_`. Repetir a mesma operação com os mesmos dados retorna o pedido existente; mudar os dados mantendo a chave retorna conflito. A chave é individual por conta.
2. Cartão e Pix permanecem pendentes até a pessoa clicar na ação explícita de simular aprovação ou rejeição. A API exige `mode:'demo'`, a versão atual e o resultado desejado. A aprovação grava uma decisão demonstrativa e uma transação `[DEMO]`; a rejeição não libera créditos.
3. Transferência exige uma imagem de comprovante fictício, enviada somente pelo proprietário. O pedido passa para `review`; uma conta diferente da equipe confere e aprova ou rejeita. O proprietário, mesmo sendo revisor, não pode julgar o próprio pedido. O botão de simulação de cartão/Pix não aprova transferências.
4. Apenas aprovação demonstrativa registrada libera o pacote no saldo. Repetições não duplicam o crédito. Pedidos rejeitados ou cancelados não liberam créditos; cancelamento é possível enquanto estiverem pendentes ou aguardando revisão.

Cada pedido possui `version`. Enviar uma nova foto incrementa a versão e invalida decisões preparadas sobre a foto anterior. Aprovar, rejeitar ou cancelar exige a versão atual. Até três imagens são preservadas por pedido; o arquivo original não tem seu nome salvo. Os comprovantes seguem os mesmos limites de tipo, tamanho e acesso privado das fotos de partidas, mas não podem ser usados como evidência de uma partida.

Na simulação, não envie números de cartão, CVV, chave Pix real, dados bancários ou comprovantes financeiros reais. Os formulários da API aceitam somente campos previstos para a simulação e rejeitam campos adicionais. A carteira de outra conta e seus comprovantes não ficam disponíveis para jogadores; a equipe autorizada tem acesso aos comprovantes para avaliação.

Estados de pedido: `pending`, `review`, `approved`, `rejected`, `cancelled`. Decisões demonstrativas registram autor, motivo, data, `kind:'simulation'` ou `kind:'team_review'` e `provider:'fifabet-demo'`. Pedidos ainda não aprovados não aumentam saldo disponível ou reservado. Pedidos e comprovantes anteriores persistem no banco; o ambiente `unconfigured` permite cancelar pedidos pendentes, mas bloqueia simulação, envio e aprovação de recarga. Registros de carteiras e partidas continuam separados.

## Revisão de resultados

1. O criador define o modo, a plataforma e as regras. Enquanto pagamentos estão pendentes, a nova partida é amistosa sem créditos; o convite expira em sete dias. Reservas de demonstrações antigas continuam no ledger separado.
2. O amigo aceita pelo código público da partida, por convite destinado ao seu ID ou pelo link. Aceitar exige conta e autorização. Um convite destinado a um ID específico não pode ser aceito por outra conta.
3. Um participante envia uma foto e informa o placar, sempre na ordem anfitrião × convidado. O adversário pode concordar ou sinalizar divergência com sua própria foto.
4. A confirmação do adversário registra concordância, mas não distribui pontos. Uma conta da equipe autorizada confere as fotos e decide vitória do anfitrião, do convidado ou empate. Um participante, mesmo que faça parte da equipe, não pode julgar o próprio desafio.
5. A decisão conclui a amistosa e aparece no histórico de ambos. Nas partidas demonstrativas antigas, vitória entrega as duas reservas ao vencedor e empate devolve uma reserva a cada jogador, sempre na carteira `legacy_demo`. O servidor impede distribuição duplicada.

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

A estrutura utiliza runtime portátil próprio em `/opt/fifago/runtime/bin/node`, sem alterar o runtime global do VPS. A versão nova exige Node.js 24 ou superior; conferir o runtime antes de iniciar a migração. A interface e a API usam a mesma origem porque as sessões usam cookies `HttpOnly` e o cliente não aceita uma URL de API arbitrária. `FIFABET_PUBLIC_ORIGIN=https://betfifa.com.br` define a origem HTTPS exata e habilita o cookie `Secure`.

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
FIFABET_PAYMENT_MODE=unconfigured
```

O Nginx sobrescreve o cabeçalho com `proxy_set_header X-Real-IP $remote_addr;`. A opção de confiança fica desligada por padrão no código. Quando habilitada (também por `options.trustProxyLoopback === true`), os limites de requisições usam `X-Real-IP` somente se a conexão vier de `127.0.0.1`, `::1` ou `::ffff:127.0.0.1` e o valor for um único IP válido. Cabeçalhos inválidos, arrays e conexões externas usam o endereço do socket. Autenticação, CSRF e limites permanecem iguais.

A configuração existente de IP real do Nginx usa `CF-Connecting-IP` e `real_ip_recursive on` para reconhecer visitantes pelo proxy da Cloudflare antes de encaminhar `$remote_addr` à aplicação. Ela foi preservada. Em outra instalação, configurar somente as faixas confiáveis da Cloudflare: sem reconhecimento do IP real, os limites ficam compartilhados pelos visitantes da mesma saída do proxy. Não confiar em cabeçalhos enviados diretamente pelo cliente nem em toda a internet.

O healthcheck `GET /api/v1/status` é somente leitura: retorna disponibilidade, `mode:'shared'`, `storage:'sqlite'`, versão do esquema, modo da carteira, disponibilidade de provedores de login e configuração da revisão. Não entra na fila de operações, não expira convites/sessões e não grava dados. Continua sujeito ao limite geral de requisições e aos cabeçalhos de resposta da aplicação.

### Limites e revisão

O serviço usa `CPUQuota=20%`, `MemoryHigh=384M`, `MemoryMax=512M`, `TasksMax=32`, `IOWeight=10` e `Nice=10`. Código e runtime são somente leitura para o processo; a escrita fica limitada à pasta privada de dados. A unidade configura redução de privilégios, pasta temporária privada e limite de frequência dos logs. Esses limites reduzem o consumo da aplicação; CPU, disco e rede do VPS continuam compartilhados e precisam de acompanhamento.

**A revisão exige configuração de uma conta independente da equipe.** Cadastro público não concede esse papel. Sem `FIFABET_REVIEWER_IDS`, resultados permanecem em análise; comprovação de placar não conclui automaticamente a partida. Compras e recargas ficam bloqueadas em `unconfigured`, inclusive aprovações demonstrativas de pedidos antigos. Para habilitar a equipe no VPS, obter o UUID interno da conta com `backend/accounts.mjs` usando a pasta `/var/lib/fifago`, atualizar o arquivo privado de ambiente e reiniciar somente `fifago.service`.

### Atualizações e dados

**O deploy é manual.** Um commit ou push no GitHub atualiza o repositório e eventualmente a publicação estática, mas não substitui a versão instalada no VPS. Instalar uma nova versão em pasta própria, preservar `/var/lib/fifago` e o arquivo de ambiente, trocar a versão ativa e reiniciar somente `fifago.service`. Conferir `/api/v1/status` e a página HTTPS após cada publicação. Não instalar pacotes globais, substituir a configuração principal do Nginx ou reiniciar serviços do Tibia para atualizar a aplicação.

Após instalar a versão nova, conferir `https://betfifa.com.br/api/v1/status` com validação TLS: espera-se `mode:'shared'`, `storage:'sqlite'`, `schemaVersion:1`, `paymentMode:'unconfigured'` e `paymentsAvailable:false`. Conferir também a página `#arena`, login por senha, código de partida e rótulos de pagamentos pendentes. Provedores sociais só devem aparecer disponíveis depois da configuração externa. Esta descrição não substitui a conferência da publicação; uma resposta da versão anterior não confirma a migração. Se a API ficar indisponível no domínio de produção, a interface deve bloquear cadastro/carteira e oferecer nova tentativa, sem mudar para demonstração local ou substituir dados das contas.

Na publicação, as configurações anteriores do Nginx, a unidade do Tibia e as regras UFW foram conferidas sem alterações; o processo do Tibia permaneceu em execução. Essa conferência se refere à implantação realizada, e deve ser repetida quando houver manutenção da infraestrutura compartilhada.

O SQLite grava transações atômicas, com chaves estrangeiras e restrições de unicidade, enquanto o servidor serializa o estado em memória. Ele só pode ter uma instância escritora por pasta de dados: `instance.lock` impede processos concorrentes. Se houver encerramento inesperado, confirme que o processo parou antes de remover o lock. A migração inicial preserva JSON, contas, sessões e evidências; a carteira antiga fica separada como demonstração. Para múltiplas instâncias e escala maior, a estratégia de escrita precisa evoluir. Backup automatizado, monitoramento, retenção de imagens e recuperação de conta ainda exigem configuração operacional.

Faça backup da pasta de dados completa com apenas `fifago.service` parado e o banco fechado, preservando SQLite, eventuais arquivos WAL/SHM, fotos e JSON/backup anteriores; depois inicie esse mesmo serviço. As imagens não são removidas automaticamente neste protótipo. Nunca publique backups, logs com credenciais ou arquivos de dados como arquivos estáticos. Perfis da demonstração no navegador não migram automaticamente para contas dessa instalação.

### Retorno ao GitHub Pages sem API

Para devolver somente os arquivos do Fifa GO à hospedagem estática, sem contas compartilhadas: a versão nova bloqueia a demonstração local no domínio de produção, portanto essa alternativa apresenta indisponibilidade enquanto não houver API. Para uma demonstração separada, usar localhost ou um host github.io que não redirecione ao domínio de produção.

1. Preservar os dados privados do VPS e a versão instalada. Não copiar contas, sessões ou fotos para o GitHub.
2. Na zona **betfifa.com.br** da Cloudflare, restaurar os quatro registros A de `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` e `185.199.111.153`, em modo somente DNS, removendo o destino anterior desse mesmo registro. Manter os nameservers dessa zona na Cloudflare. Conferir também registros AAAA de `@` para não manter uma rota concorrente para o VPS.
3. Se o endereço `www` for usado no GitHub Pages, definir seu CNAME como `djowww.github.io`, sem o nome do repositório, também em modo somente DNS, e conferir o domínio personalizado e HTTPS nas configurações do Pages.
4. Aguardar a propagação e conferir a página. No Pages, a API não existe: em `betfifa.com.br`/`www.betfifa.com.br`, a versão nova deve mostrar indisponibilidade e bloquear cadastro/carteira locais. Contas e partidas compartilhadas do VPS ficam preservadas, mas indisponíveis nessa hospedagem estática. O modo demonstrativo permanece separado em hosts autorizados de demonstração.
5. Se quiser interromper o consumo da aplicação no VPS após a mudança, executar apenas `sudo systemctl stop fifago.service`. Não parar Nginx nem qualquer serviço do Tibia. A configuração do novo host pode permanecer instalada enquanto o DNS aponta para o Pages.

O retorno por DNS não desfaz dados da API nem altera a zona, os nameservers, o firewall ou os serviços do Tibia. Para reativar a versão conectada, conferir o serviço e o certificado próprios antes de apontar novamente apenas esse domínio ao VPS pelo proxy da Cloudflare.

## Proteções funcionais incluídas

- Senhas derivadas com `scrypt`, sal individual, sessão de 14 dias armazenada por hash e cookie `HttpOnly`/`SameSite=Lax`; logout revoga a sessão.
- Login Google/Apple validado no servidor, com identity provider/subject única no SQLite; credenciais externas ficam fora da interface e do repositório.
- Mutações exigem a origem configurada e, para contas autenticadas, token CSRF. Não há CORS aberto.
- Saldo e reservas calculados no servidor, com carteira demonstrativa anterior separada. Compras ficam desativadas em `unconfigured`; enviar `balance` ou `isReviewer` pelo perfil não muda esses campos.
- Fotos limitadas a PNG/JPG/WebP, até 5 MiB e 24 megapixels, acessíveis somente aos participantes e revisores. Nome original do arquivo não é salvo ou exposto.
- Limites de tentativas de login, requisições e uploads; 12 fotos por participante/desafio, 20 versões de placar, 10 divergências, 20 convites pendentes e 50 desafios ativos por criador; 10 recargas pendentes/aguardando revisão e três comprovantes por recarga. Esses limites são da aplicação; não são uma promessa de proteção contra DDoS.
- Armazenamento total de fotos limitado a 200 MiB por padrão. Pode ser configurado por `FIFABET_MAX_EVIDENCE_BYTES`, em bytes, junto a uma política de retenção.
- Arquivos de backend, documentos, `.env`, dados e testes não são servidos pelo HTTP estático do backend.

## Contrato da API

Todas as rotas ficam em `/api/v1`; respostas são JSON, exceto fotos e redirecionamentos OAuth. Erros usuais retornam `{error,code}`; o retorno OAuth redireciona à arena com uma indicação pública de sucesso/erro, sem tokens. A interface usa `backend-client.mjs` para gerenciar cookies/CSRF e não grava tokens de sessão no armazenamento local.

| Operação | Rota | Dados ou resultado |
|---|---|---|
| Detectar servidor | `GET /status` | Somente leitura: disponibilidade, SQLite/esquema, modo da carteira, `paymentsAvailable`, provedores sociais e revisor configurado |
| Sessão atual | `GET /session` | `{user,csrfToken}` ou valores nulos |
| Criar conta | `POST /auth/register` | `{nickname,password}` |
| Entrar | `POST /auth/login` | `{identifier,password}`; identificador é apelido ou ID público |
| Iniciar login social | `GET /auth/oauth/google/start` ou `GET /auth/oauth/apple/start` | Redireciona ao provedor configurado; fluxo vinculado ao navegador |
| Retorno Google | `GET /auth/oauth/google/callback` | Valida a resposta externa, grava identidade/sessão e redireciona |
| Retorno Apple | `POST /auth/oauth/apple/callback` | `application/x-www-form-urlencoded`; valida resposta externa, grava identidade/sessão e redireciona |
| Sair | `POST /auth/logout` | Revoga a sessão |
| Arena da conta | `GET /me` | `{user,duels,history,stats,csrfToken}` |
| Ranking compartilhado | `GET /leaderboard` | Requer conta; `{entries:[{player,played,wins,draws,losses}]}`, até 100 entradas apenas de partidas revisadas |
| Perfil | `PATCH /me` | `{nickname,clubId}` |
| Carteira | `GET /wallet` | Própria conta: `balance,reserved,transactions`, `legacyDemoBalance,legacyDemoReserved,legacyDemoTransactions`, depósitos, catálogo/métodos e modo da carteira; catálogo vazio e `paymentsAvailable:false` em `unconfigured` |
| Criar pedido demonstrativo local | `POST /wallet/deposits` | Somente `demo`: `{amount,method:'card'|'pix'|'transfer',installments?,idempotencyKey}`; cria `pending`, não libera créditos; `unconfigured` retorna 503 |
| Simular aprovação/rejeição | `POST /wallet/deposits/:id/simulate` | Proprietário, cartão/Pix: `{mode:'demo',outcome:'approved'|'rejected',version}` |
| Cancelar pedido | `POST /wallet/deposits/:id/cancel` | Proprietário: `{version}`; somente pedidos pendentes/em revisão |
| Enviar comprovante fictício | `POST /wallet/deposits/:id/proof?version=N` | Proprietário, transferência: corpo binário PNG/JPG/WebP |
| Ver comprovante | `GET /wallet/evidence/:id` | Somente proprietário ou conta autorizada da equipe |
| Fila de comprovantes | `GET /wallet/reviews` | Equipe: `{deposits,paymentMode,realMoney}`, sem os próprios pedidos |
| Decidir sobre comprovante | `POST /wallet/reviews/:id` | Equipe terceira: `{decision:'approve'|'reject',reason,version}` |
| Buscar jogador | `GET /players/:publicPlayerId` | Perfil público mínimo, requer conta |
| Criar desafio | `POST /duels` | `{stake,mode,platform,opponentPlayerId?,rules?,operationId?,expectedHostId?}`; chave UUID permite repetir o mesmo envio sem nova reserva; anfitrião esperado vincula confirmação à conta |
| Prévia por código público | `GET /invites/code/:publicMatchId` | Sem sessão: código `FG-10HEX`, modo/plataforma, stake/creditMode, estado e prazo; sem nomes, regras em texto livre ou IDs de contas. Com sessão autorizada, inclui `host.nickname` e `rules` |
| Aceitar código público | `POST /invites/code/:publicMatchId/accept` | Exige sessão/CSRF e destinatário autorizado; retorna a partida privada |
| Abrir convite secreto | `GET /invites/:token` | Requer conta e convite pendente autorizado; `{invite:{publicMatchId,creditMode,host:{nickname},stake,mode,platform,rules,status,expiresAt}}` |
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

Modos: `1v1`, `Ultimate Team`, `Clubes`. Plataformas: `playstation`, `xbox`, `pc`, `switch`. Em `unconfigured`, novas partidas exigem `stake:0` e são amistosas. No modo demonstrativo local, stake aceita zero ou de 10 a 5.000 pontos por participante, sujeitos ao saldo. Placar inteiro: de 0 a 99. `homeScore` é sempre o anfitrião; `awayScore`, o convidado.

Estados de desafio: `invited`, `in_progress`, `pending_review`, `disputed`, `completed`, `cancelled`, `expired`. O perfil mantém `id` interno e `publicPlayerId` estável; o desafio tem `publicMatchId` permanente e `creditMode:'friendly'|'legacy_demo'|'demo'`. A visualização privada inclui `host`, `guest`, `recipient`, `result`, `reports` e `disputes`. O token secreto só aparece para o criador enquanto o convite estiver pendente. Conta da equipe recebe `isReviewer:true` do servidor.

### Privacidade e validação dos convites

Links de convite secreto transportam somente um token aleatório de 32 bytes em base64url (43 caracteres); não embutem perfis, saldo, placar ou fotos. A consulta do token exige sessão. Convites destinados a uma conta só podem ser consultados pelo criador ou destinatário. Convites abertos podem ser consultados e aceitos por uma conta autenticada que possua o token, enquanto estiverem pendentes.

O código público `FG-10HEX` permite uma prévia anônima do convite pendente: código, creditMode, stake, modo, plataforma, estado e prazo. Essa prévia não inclui regras em texto livre, nome do criador, UUID de conta/partida, ID público FBA, conta de jogo, e-mail, saldo, resultado ou evidência. A consulta autenticada autorizada e o resumo por token incluem `host.nickname` e as regras. Regras são texto compartilhado apenas com quem possui acesso autenticado ao convite. Após aceite, cancelamento ou expiração, código/token retornam erro sem resumo. Aceitar exige conta, CSRF e permissão; somente os participantes recebem a partida privada completa.

Erros de consulta/aceite de convites usam o mesmo formato `{error,code}`:

| HTTP | `code` | Situação |
|---|---|---|
| 401 | `unauthorized` | É necessário entrar para consultar token secreto ou aceitar; prévia por código público permite visitante |
| 400 | `invite_invalid` | Token secreto ou código público com formato inválido |
| 404 | `invite_not_found` | Token válido no formato, mas inexistente |
| 403 | `invite_wrong_recipient` | Convite destinado a outra conta; o estado e o resumo ficam privados |
| 410 | `invite_expired` | Prazo encerrado; reserva do criador devolvida uma única vez |
| 410 | `invite_cancelled` | Convite cancelado ou recusado |
| 409 | `invite_already_accepted` | Convite consumido; sem retorno de resultado ou evidências pelo token |
| 409 | `invite_own` | Tentativa de aceitar o próprio convite |

A proteção também se aplica ao aceite por ID/código: uma partida cancelada/expirada retorna respectivamente `invite_cancelled`/`invite_expired`, e um novo aceite retorna `invite_already_accepted`. Um destinatário autenticado incorreto não recebe o resumo privado nem pode aceitar. A prévia anônima por código contém somente os termos públicos descritos acima.

### Reenvio seguro de criação

O formulário pode enviar `operationId` UUID estável no `POST /duels`. Essa chave é individual por criador e persiste junto ao desafio. Duas requisições com a mesma chave e os mesmos termos retornam o mesmo desafio e, enquanto pendente, o mesmo token; a reserva ocorre uma única vez. Repetir após o aceite ou encerramento recupera o registro correspondente sem criar outra partida nem devolver um token ativo. Reutilizar a chave com modo, plataforma, adversário, pontos ou regras diferentes retorna `409 operation_conflict`. Formato inválido retorna `400 invalid_operation_id`. A interface deve gerar outra chave quando editar os termos e preservar a chave em um reenvio após falha de rede. Clientes anteriores sem a chave continuam suportados. Somente o criador autenticado recebe `duel.operationId`, inclusive na própria arena, para reconhecer uma criação já concluída após uma falha de rede antes de validar novamente o saldo. O convidado e os resumos de convite não recebem essa chave. Campos de armazenamento e assinaturas internas de comparação não são incluídos nas respostas.

O campo opcional `expectedHostId` contém o ID interno da conta que conferiu o resumo. O servidor compara esse valor com a conta autenticada antes de criar ou recuperar a operação. Se uma troca de sessão ocorrer entre a confirmação e o envio, retorna `409 account_changed` sem criar desafio nem reservar pontos da nova conta. Esse ID pertence somente à requisição autenticada, não faz parte do link nem do resumo de convite. Clientes anteriores que omitem o campo permanecem suportados.

## Suíte existente

```powershell
node --test backend/server.test.mjs
```

A suíte existente descreve autenticação, origem/CSRF, reservas, idempotência, fotos privadas, revisão, cancelamento, histórico e carteira demonstrativa da versão anterior. Os casos precisam acompanhar o contrato SQLite, a separação do ledger, `stake:0` em produção e o padrão `unconfigured`. Não foi executada nesta atualização. Os dados temporários de qualquer execução devem ficar fora do projeto; a documentação da suíte não confirma implantação nem configuração de provedores externos.
