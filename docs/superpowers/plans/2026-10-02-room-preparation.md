# Preparação e chat das salas — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Exibir salas públicas com o custo por jogador, abrir uma conversa privada após a entrada e iniciar o jogo somente com a confirmação dos dois participantes.

**Architecture:** Reutilizar as salas, reservas, sessões, SQLite e consulta periódica existentes. Salas novas usam `lobbyVersion:1`, `readyBy:[]` e o estado `waiting_start`, apresentado como preparação. O chat é um recurso privado separado; nenhuma mensagem aparece em arena, convites, notificações ou painel administrativo.

**Tech Stack:** JavaScript sem framework, Node.js 24, SQLite, testes nativos Node.

**Spec:** Pedido do usuário nesta conversa em 2026-10-02 e os contratos abaixo.

## Global Constraints

- Não mudar a economia: reserva na criação/entrada, nenhuma nova cobrança ao iniciar, comissão existente de 9%.
- Não regredir salas anteriores; salas já iniciadas continuam em andamento.
- Preservar fotos, análise do placar, confirmação e distribuição atuais.
- Não alterar infraestrutura, segredos, pagamentos ou serviços de Tibia.
- Testar contas e saldos apenas em ambiente local; publicar com a autoria Git de Djow já autorizada.

## Contrato

- `POST /api/v1/duels/:id/start {}`: participante após entrada; registra prontidão uma única vez. Com ambos prontos e reservas completas, inicia atomicamente e fixa `startedAt`.
- `GET /api/v1/duels/:id/chat?after=0`: somente participantes após entrada; retorna `{messages,lastSequence,closed}`. Mensagens públicas do recurso têm `{id,sequence,authorId,authorNickname,text,createdAt}`.
- `POST .../chat {operationId,text}`: texto simples de 1–1000 caracteres, até 200 mensagens/sala; operação idempotente por autor. Retorna o mesmo envelope do GET, com a mensagem enviada; repetição com texto diferente retorna 409.
- Chat permite escrita em preparação, em andamento e durante análise/disputa; fica somente para leitura após fechamento. Validar sessão, origem, CSRF, limites e controles de texto. Nunca persistir chat no navegador.
- Na preparação, cancelamento por qualquer participante devolve ambas as reservas uma vez. Depois do início, preservar cancelamento bilateral. Expiração também encerra preparação e devolve reservas.
- UI normaliza `waiting_start` para `preparing`. Preparação mostra os dois estados e botão “Iniciar partida”; o primeiro participante pronto aguarda o rival. O chat continua acessível na partida em andamento.

## Review Focus

- Concorrência: duas entradas/inícios/cancelamentos sem perdas nem duplicação de reserva.
- Privacidade: destinatário sem entrada, administrador e estranho não leem conversa; arena e revisões não carregam mensagens.
- Continuidade: atualização e mudança de conta/rota não vazam mensagens nem apagam rascunho durante digitação.
- Legado: salas v1/v2 anteriores e análise de resultados permanecem válidas.
- Mobile: valor, estados, chat e ações legíveis e sem transbordamento horizontal.

### Task 1: Backend e testes

**Files:** `backend/server.mjs`, `backend/database.mjs`, `backend/duel-economy.mjs`, testes backend; extrair um módulo de chat se útil.

- [x] Escrever testes para entrada em preparação, início unilateral/bilateral/idempotente, resultado bloqueado, cancelamento/expiração, chat privado com limites e persistência.
- [x] Rodar e observar falhas específicas antes da implementação.
- [x] Implementar o contrato, preservando salas antigas e removendo mensagens de todas as projeções gerais.
- [x] Rodar testes backend e comunicar evidências RED/GREEN.

### Task 2: Interface e testes

**Files:** `play.js`, `room-ui.mjs`, `lobby.css`, testes da interface; módulo privado de chat se útil.

- [x] Escrever testes de prontidão, mensagens escapadas, rascunho, respostas obsoletas e integração com a sala.
- [x] Rodar testes e observar falhas específicas.
- [x] Destacar salas públicas, valor por jogador e preparação com chat. Atualizar durante digitação sem perder foco/rascunho e sem armazenar conversa localmente.
- [x] Rodar testes frontend e comunicar evidências RED/GREEN.

### Task 3: Integração, revisão e publicação

**Files:** `backend-client.mjs`, `index.html`, `docs/SALAS.md`, versões de importação.

- [x] Adicionar `startDuel(id)`, `getDuelChat(id,after=0)` e `sendDuelChat(id,data)` com o transporte seguro existente.
- [x] Atualizar documentação e versões dos arquivos; executar toda a suíte.
- [x] Revisão independente de código/privacidade, Impeccable e teste local desktop/mobile com dois jogadores.
- [ ] Publicar GitHub e release isolada do Fifa GO, confirmar assets e saúde pública e apresentar resultado.

## Evidências antes da integração

- 217 testes passaram, sem falhas, em 2026-10-02.
- Revisão independente: problemas de cursor, envio assíncrono e atualização corrigidos; sem defeitos pendentes no escopo.
- Duas contas locais: sala pública de 100 Coin, chat privado, início unilateral em espera e início bilateral em andamento; carteira com 200 disponíveis e 100 reservados, sem segunda reserva.
- Mobile: sem overflow horizontal e controles visíveis com pelo menos 44 px.
- A base remota avançou para 93002b3 (CI e limpeza de uploads); incorporá-la antes da publicação.
