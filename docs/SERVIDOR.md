# Contas, desafios e carteira de teste

O servidor `backend/server.mjs` transforma os desafios de pontos fictícios em dados compartilhados: cada pessoa entra com apelido ou ID e senha, os dois lados usam o mesmo desafio, a foto fica privada e o saldo é controlado pelo servidor. A carteira oferece pedidos de créditos demonstrativos por cartão, Pix e transferência. Nenhuma dessas ações cobra dinheiro, movimenta uma conta bancária ou consulta um gateway. O servidor também entrega os arquivos da interface pela mesma origem. Saques e consulta a partidas da EA não estão integrados.

O GitHub Pages continua sendo hospedagem estática, com domínio personalizado `betfifa.com.br` administrado na Hostinger. Ele não executa este servidor e não cria contas compartilhadas: a interface detecta a API e identifica a demonstração local quando ela não está disponível. Publicar os arquivos no GitHub ou apontar o domínio não publica um banco de dados nem uma API. Nenhum serviço de hospedagem foi contratado nesta etapa e nenhuma infraestrutura de Tibia foi alterada.

## Domínio do frontend

O arquivo `CNAME` na raiz mantém `betfifa.com.br` como domínio do GitHub Pages. A zona DNS desse domínio na Hostinger utiliza quatro registros A em `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` e `185.199.111.153`. O CNAME `www` aponta para `djowww.github.io`, sem nome do repositório. Os nameservers continuam `aster.dns-parking.com` e `helios.dns-parking.com`.

Antes do apontamento, a zona continha apenas A `@` → `2.57.91.91` (TTL 50) e CNAME `www` → `betfifa.com.br` (TTL 300), usados pela página padrão da Hostinger. A publicação troca somente os destinos web desse domínio. O certificado HTTPS é administrado pelo GitHub Pages; não é necessário instalar SSL no VPS.

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

## Publicação futura

Para colocar a API online, será necessário um serviço Node.js com HTTPS, armazenamento persistente e uma origem própria. A interface e a API devem ser entregues na mesma origem porque as sessões usam cookies `HttpOnly` e o cliente não aceita uma URL de API arbitrária. Configure `FIFABET_PUBLIC_ORIGIN` com a origem HTTPS exata; o cookie recebe `Secure` nessa configuração. A aplicação pode escutar uma porta interna via `FIFABET_PORT`.

Este protótipo grava JSON atomicamente e serializa as operações. Ele só pode ter uma instância por pasta de dados: `instance.lock` impede processos concorrentes. Se houver encerramento inesperado, confirme que o processo parou antes de remover o lock. Para múltiplas instâncias, escala maior ou lançamento comercial, migre para um banco com transações, backup automatizado, monitoramento, política de retenção de imagens e recuperação de conta. Não anuncie este armazenamento como infraestrutura final.

Faça backup da pasta de dados completa com o servidor parado para manter JSON e fotos consistentes. As imagens não são removidas automaticamente neste protótipo. Nunca publique backups, logs com credenciais ou arquivos de dados como arquivos estáticos.

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
| Criar desafio | `POST /duels` | `{stake,mode,platform,opponentPlayerId?,rules?}` |
| Abrir convite | `GET /invites/:token` | Convite mínimo, requer conta |
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

## Verificação executada

```powershell
node --test backend/server.test.mjs
```

Os testes fazem requisições HTTP a servidores temporários e verificam autenticação, origem/CSRF, reservas concorrentes sem saldo negativo, aceite restrito, fotos privadas, confirmação sem liberação, revisão por terceiro, distribuição única, disputa e versão antiga de resultado, cancelamento conjunto, histórico, ranking, reinício com dados persistentes e bloqueio de arquivos privados. A carteira verifica criação idempotente, ausência de crédito automático, aprovação única explícita, rejeição/cancelamento sem crédito, recusa de dados bancários/cartão, comprovante privado, revisão por terceiro e bloqueio de versões antigas. Os dados temporários ficam fora do projeto e são removidos ao final.
