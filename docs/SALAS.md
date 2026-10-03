# Salas, reservas e fotos do resultado

## Fluxo conectado

1. O anfitrião escolhe sala aberta na arena ou privada por convite, define o mesmo valor para cada jogador e confirma o resumo. Uma sala com Joga aí Coin exige saldo e reserva a parte do anfitrião ao criar. Amistosas podem usar saldo ou ser gratuitas, com `stake:0`.
2. O rival pode encontrar uma sala aberta na arena ou usar código/link. Ao aceitar uma sala com Joga aí Coin, sua parte é reservada atomicamente. Saldo insuficiente impede a entrada; a sala continua disponível.
3. Novas salas usam `fundingVersion:2` e `lobbyVersion:1`: ao entrar, os jogadores ficam em preparação (`waiting_start`) e abrem uma conversa privada para se adicionar no console e combinar os detalhes. A arena destaca o custo **por jogador**; uma amistosa gratuita usa `stake:0`. Salas anteriores preservam seu fluxo e condições, sem voltar jogos em andamento para preparação.
4. Cada participante confirma início e compatibilidade. A prontidão vale dois minutos e pode ser retirada antes do início; a primeira confirmação aguarda o rival. Somente duas confirmações válidas iniciam o jogo, sem nova cobrança ou reserva. Edição do jogo, geração/plataforma, crossplay e regras de empate, pênaltis, prorrogação e desconexão ficam no resumo acordado; salas anteriores não recebem acordos inventados.
5. Pelo celular, o jogador fotografa a tela final do console ou seleciona uma imagem da galeria. A aplicação reduz a foto antes do envio privado.
6. “Ler placar da foto” executa Tesseract.js no servidor. A sugestão exige identificar quem está à esquerda; nunca associa automaticamente posição da tela ao anfitrião. O jogador pode corrigir ou informar manualmente os gols.
7. Enviar foto e placar inicia uma janela de cinco minutos. O rival deve enviar sua própria foto, indicar o lado do anfitrião/convidado e confirmar os mesmos gols. A janela é preservada após editar o placar e reiniciar o servidor. Ausência de resposta nunca atribui vitória.
8. Quando os dois confirmam dentro do prazo, as fotos são distintas, as duas leituras locais correspondem ao relato e não há risco pendente, o servidor pode concluir atomicamente e entregar o total menos 9% ao vencedor. Na política nova, entrada de 500 Coin ou mais por jogador exige revisão humana; fotos visualmente semelhantes, falha de fingerprint, baixa confiança, problemas, contestações ou prazo vencido também encaminham para revisão independente. Empate devolve as duas reservas sem taxa. Partidas já concluídas preservam sua validação.

## Prazos operacionais

| Etapa | Padrão | Ao vencer |
|---|---|---|
| Convite/sala aberta | 24 horas | Encerra e devolve reservas efetivas |
| Preparação após entrada | 10 minutos | Encerra e devolve ambas as reservas |
| Confirmação de prontidão | 2 minutos | Exige nova confirmação; pode ser retirada antes do início |
| Partida iniciada | 60 minutos | Abre atendimento/revisão; não dá vitória nem devolução automática |
| Atendimento/revisão | 24 horas | Sinaliza atraso à equipe, preservando reservas |

Esses padrões são configuráveis e guardados na sala. O prazo de atendimento é uma referência operacional, sem garantia de disponibilidade humana. A janela de confirmação do resultado continua sendo cinco minutos; ausência nunca concede vitória. Consulte as variáveis em [SERVIDOR.md](SERVIDOR.md).

## Taxa e devoluções

Novas salas guardam a cotação imutável: `economics.pot`, `feeBps:900`, `houseFee`, `winnerPayout`, `rounding:'nearest_credit'`. Os Joga aí Coin são inteiros; a taxa de 9% é arredondada ao crédito mais próximo e aparece antes da reserva. Exemplo: 100 + 100 = 200; taxa 18; prêmio 182; ganho líquido de 82 em relação à entrada própria de 100.

Empates aprovados, cancelamentos e expiração devolvem as reservas efetivamente realizadas, sem taxa. Antes do início, qualquer participante pode cancelar; após o início, os dois precisam concordar ou a equipe precisa avaliar um problema. Salas aguardando reservas expiram no prazo do convite. Partidas antigas mantêm as condições originais, sem aplicar retroativamente a taxa.

Os avisos de espera e de resultado aparecem na arena autenticada e são atualizados enquanto a página está visível. “Avisar que estou esperando” registra um aviso para o rival e permite um novo envio após um minuto. Não há push externo com o aplicativo fechado.

As reservas usam referências únicas por usuário/partida; o pagamento e a taxa são gravados atomicamente no SQLite. Repetir um envio não duplica lançamentos. A taxa vai para `houseTransactions` na área privada do banco, nunca para um perfil fictício ou uma carteira pública.

## Problemas

Um relato pode ser enviado durante jogo, confirmação e revisão, mesmo sem placar ou foto. Fica visível aos participantes e à equipe, sem concluir o jogo nem movimentar Coin. A equipe pode encerrar o relato com justificativa e reavaliar a elegibilidade ou cancelar e devolver as reservas. Prazo de jogo vencido continua exigindo revisão humana. O revisor não pode participar da sala; uma revisão com placar desatualizado é rejeitada.

## API adicionada

| Ação | Endpoint | Corpo |
|---|---|---|
| Reservar a própria parte | `POST /api/v1/duels/:id/fund` | `{stake}` igual ao valor combinado |
| Avisar o rival | `POST /api/v1/duels/:id/nudge` | `{}`; membro da sala, limitado a um aviso por minuto |
| Encontrar salas abertas | `GET /api/v1/rooms` | Conta autenticada; lista limitada, sem IDs internos, tokens, evidências, regras privadas ou saldo |
| Confirmar o início | `POST /api/v1/duels/:id/start` | `{}`; registra prontidão do participante; inicia somente com os dois prontos |
| Retirar prontidão | `POST /api/v1/duels/:id/unready` | `{}`; antes do início |
| Consultar histórico paginado | `GET /api/v1/history?limit=20&cursor=...` | Conta autenticada; `{items,nextCursor}`, até 50 por página |
| Ler a conversa | `GET /api/v1/duels/:id/chat?after=0` | Somente participantes após a entrada; cursor sequencial, conversa privada |
| Enviar mensagem | `POST /api/v1/duels/:id/chat` | `{operationId,text}`; operação idempotente por autor, texto simples de 1 a 1.000 caracteres |
| Confirmar com foto própria | `POST /api/v1/duels/:id/confirm` | `{reportId,evidenceId,homeScore,awayScore,scoreSide}`; `scoreSide:host` ou `guest` indica quem aparece à esquerda |
| Reportar problema | `POST /api/v1/duels/:id/issue` | `{reason}` |
| Sugerir placar | `POST /api/v1/duels/:id/recognize` | `{evidenceId}` de foto própria da sala |
| Avaliar problema | `POST /api/v1/reviews/:id/issues/:issueId` | `{decision:'dismiss'|'cancel',reason,reportId}`; nulo sem resultado |

Todos exigem sessão; mudanças também exigem origem e CSRF. Fotos continuam privadas. A prévia pública do convite contém os termos financeiros, sem IDs dos participantes, nomes privados, saldo ou evidências.

## Preparação e conversa privada

A conversa pertence apenas aos dois jogadores que efetivamente entraram na sala. Um destinatário que ainda não aceitou, outros jogadores e administradores/revisores não podem acessar as mensagens. As projeções gerais da arena, convites, notificações e painel de revisão não incluem o conteúdo da conversa. Mensagens e autoria são validadas no servidor, com proteção de origem, CSRF e limites de frequência e tamanho.

Até 200 mensagens ficam persistidas por sala no banco do aplicativo. Após encerramento, os participantes podem consultar o histórico da conversa, mas não enviar novas mensagens. Rascunhos ficam apenas na memória da página, sem armazenar mensagens no navegador. A conversa e a prontidão atualizam enquanto a página está aberta; não há push com o aplicativo fechado. Uma mensagem não altera o modo, valor ou regras já confirmados no resumo da sala.

Na preparação, qualquer participante pode cancelar e devolver as duas reservas. Seu prazo próprio começa no aceite; expirar encerra a preparação sem vitória. Antes da confirmação dos dois, fotos/placar e distribuição ficam bloqueados. Depois do início, valem os controles bilaterais de resultado/cancelamento e atendimento independente.

## Leitura local e limites

O mecanismo e o modelo ficam no servidor; nenhuma foto é enviada a terceiros. O processamento aceita imagens até 2 megapixels, usa um único processo de baixa prioridade, prazo de 15 segundos e limite por endereço. Executa fora da fila de gravação do banco, para não bloquear login e carteira. O texto bruto reconhecido não é devolvido nem persistido: apenas sugestão limitada de placar e estado.

A leitura exige um único par de gols com separador e contexto sem estatísticas, relógios, datas ou outros valores ambíguos. A confiança global e a confiança dos números precisam atingir 80 antes de considerar liquidação automática. Os números são comparados com os gols informados e com a orientação da foto. Fotos com o mesmo SHA-256 reutilizadas em partidas ou entre jogadores bloqueiam liquidação automática; essa verificação não detecta toda edição, corte ou recompressão. Imagens desfocadas, reflexos, placares sem separador ou múltiplos pares podem não ser lidos; existe preenchimento manual. A leitura não comprova uma partida real nem detecta montagens. Não existe integração de histórico do EA SPORTS FC nesta entrega.

O fingerprint visual usa `sharp@0.35.5` e dHash de 64 bits, em processo separado de baixa prioridade, até 24 megapixels, prazo de cinco segundos e guardas de memória de 128 MiB. Identifica semelhança visual e complementa o SHA-256; não autentica o jogo, não comprova autoria nem detecta toda montagem. Análise indisponível nunca libera prêmio automaticamente em salas com política nova. Nenhum texto bruto de OCR é guardado por esse recurso.

Instalação reproduzível: `npm ci --ignore-scripts` com `package-lock.json`, ou `pnpm install --frozen-lockfile --ignore-scripts` com o lock correspondente. Verificar o carregamento nativo do Sharp antes de ativar o release; consulte [SERVIDOR.md](SERVIDOR.md). O modelo OCR versionado vem de `tesseract-ocr/tessdata_fast`, com licença e hash em `backend/ocr/NOTICE.md`. `FIFABET_OCR_ENABLED=0` desativa a leitura, preservando envio manual e revisão.

Fotos de partidas/depósitos encerrados há 30 dias podem ir ao arquivo privado e continuam acessíveis às contas autorizadas. Disputas e problemas abertos permanecem ativos. Não há exclusão automática; o limite padrão de 200 MiB considera arquivos ativos e a administração mostra a capacidade total.

## Perfil, Arena e ranking

IDs EA/PSN/Xbox declarados são opcionais, até 64 caracteres, sem consulta automática ao provedor. Edição do jogo (até 40 caracteres), geração e crossplay ajudam a conferir compatibilidade. A Arena filtra plataforma, modo e faixa de entrada/saldo, sem publicar o saldo das contas. Extrato, depósitos e histórico têm paginação por cursor e referências públicas das partidas.

O ranking usa apenas resultados atuais validados: rating Elo, pontuação e posição pessoal. Vitória vale três pontos e empate um; no máximo três confrontos do mesmo par por dia UTC contam para classificação. Os demais continuam no histórico e recebem a premiação normal. A classificação não inventa partidas nem altera o caixa.

Atualizações recebidas durante um modal ou edição ficam pendentes e são aplicadas ao fechar o modal ou sair do campo. A carteira acompanha alterações remotas sem perder formulários/foco. Avisos existentes continuam no navegador; não há entrega externa com a aplicação fechada.

## Produção e demonstração

O modo de pagamentos existente foi preservado. `unconfigured` não habilita compra nem cobrança real; partidas gratuitas continuam com `stake:0`. O modo de sala `coins` permite reservar somente saldo principal já existente, inclusive ajustes administrativos auditados, sem criar saldo. Não converte o saldo antigo de demonstração nem ativa Pix. A demonstração estática no GitHub conserva o fluxo local anterior; reservas individuais e leitura no servidor pertencem à versão conectada.

## Revisão desta entrega

A sala usa o modo Operate do Impeccable: identifica os participantes, mostra reservas e estado, e destaca a próxima ação. Expande a identidade existente; não substitui o tema global.

- Paleta: tokens existentes de fundo escuro, texto claro e verde para ações/estados importantes.
- Tipografia: família sans existente; título 32 px no desktop, 27 px no celular, informações secundárias relevantes de pelo menos 14 px.
- Composição: duas colunas acima de 820 px, participantes e ação à esquerda, resumo financeiro à direita; uma coluna no celular.
- Controles: ação de encerramento com altura mínima de 56–58 px; relatos discretos com alvo mínimo de 44 px; câmera e galeria com 48 px.
- Estados: preparação/prontidão, espera de reservas, saldo insuficiente, leitura, revisão, contestação e encerramento. Atualização a cada oito segundos enquanto visível, com descarte de respostas antigas e aplicação pendente ao terminar modal/edição.

Skills aplicáveis: redesign-existing-projects (fluxo e hierarquia), Impeccable Operate/harden/audit (estados, revisão técnica), mobile-native (campos, toque, câmera/galeria) e emil-design-eng (feedback e contenção de movimento). Skills de documentos, Swift, instalação e geração de imagens não se aplicam a esta alteração.

Testes de regras, API e interface acompanham reservas, acesso à lista pública, avisos, janela de confirmação, comparação dos gols, privacidade e liquidação idempotente. Casos de teste usam dados e imagens locais fictícios. Câmera, teclado e galeria precisam de conferência em aparelhos físicos antes do lançamento mobile; emulação desktop não os substitui.

### Fotos grandes no celular

A seleção aceita fontes de até 30 MB. Antes do envio, o navegador corrige a orientação quando suportado, limita a resolução a 2 megapixels e converte para JPEG de até 5 MB, retirando metadados. O limite anterior de 8 MB no arquivo original foi removido. HEIC/HEIF dependem da decodificação nativa do navegador; quando indisponível, a interface orienta usar a câmera ou exportar JPG. O servidor mantém os limites privados de 5 MB e 24 megapixels por upload validado. Arquivos sem formato de imagem válido continuam rejeitados.
