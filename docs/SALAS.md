# Salas, reservas e fotos do resultado

## Fluxo conectado

1. O anfitrião escolhe sala aberta na arena ou privada por convite, define o mesmo valor para cada jogador e confirma o resumo. Uma sala com Joga aí Coin exige saldo e reserva a parte do anfitrião ao criar. Amistosas podem usar saldo ou ser gratuitas, com `stake:0`.
2. O rival pode encontrar uma sala aberta na arena ou usar código/link. Ao aceitar uma sala com Joga aí Coin, sua parte é reservada atomicamente. Saldo insuficiente impede a entrada; a sala continua disponível.
3. Novas salas usam `fundingVersion:2`: com os dois participantes e as duas reservas, o jogo pode começar. Salas antigas `fundingVersion:1` preservam a reserva individual no estado `awaiting_funds`, sem mudar os termos anteriores.
4. A sala mostra “Partida em andamento...”, “Reportar um problema” e “Partida encerrada”. Uma amistosa inicia após o aceite e não exige reservas.
5. Pelo celular, o jogador fotografa a tela final do console ou seleciona uma imagem da galeria. A aplicação reduz a foto antes do envio privado.
6. “Ler placar da foto” executa Tesseract.js no servidor. A sugestão exige identificar quem está à esquerda; nunca associa automaticamente posição da tela ao anfitrião. O jogador pode corrigir ou informar manualmente os gols.
7. Enviar foto e placar inicia uma janela de cinco minutos. O rival deve enviar sua própria foto, indicar o lado do anfitrião/convidado e confirmar os mesmos gols. A janela é preservada após editar o placar e reiniciar o servidor. Ausência de resposta nunca atribui vitória.
8. Quando os dois confirmam dentro do prazo, as fotos são distintas, as duas leituras locais correspondem ao relato com confiança suficiente e não há problemas/contestações, o servidor conclui atomicamente e entrega o total menos 9% ao vencedor. Divergências, duplicidades, baixa confiança ou prazo vencido exigem revisão independente. Empate devolve as duas reservas sem taxa.

## Taxa e devoluções

Novas salas guardam a cotação imutável: `economics.pot`, `feeBps:900`, `houseFee`, `winnerPayout`, `rounding:'nearest_credit'`. Os Joga aí Coin são unidades inteiras; a taxa de 9% é arredondada ao crédito mais próximo e esse valor aparece antes da reserva. Exemplo: 100 + 100 = 200; taxa 18; prêmio 182.

Empates aprovados, cancelamentos e expiração devolvem as reservas efetivamente realizadas, sem taxa. Antes do início, qualquer participante pode cancelar; após o início, os dois precisam concordar ou a equipe precisa avaliar um problema. Salas aguardando reservas expiram no prazo do convite. Partidas antigas mantêm as condições originais, sem aplicar retroativamente a taxa.

Os avisos de espera e de resultado aparecem na arena autenticada e são atualizados enquanto a página está visível. “Avisar que estou esperando” registra um aviso para o rival e permite um novo envio após um minuto. Não há push externo com o aplicativo fechado.

As reservas usam referências únicas por usuário/partida; o pagamento e a taxa são gravados atomicamente no SQLite. Repetir um envio não duplica lançamentos. A taxa vai para `houseTransactions` na área privada do banco, nunca para um perfil fictício ou uma carteira pública.

## Problemas

Um relato pode ser enviado durante a partida sem existir um placar ou foto. Fica visível aos participantes e à equipe, sem concluir o jogo nem movimentar Joga aí Coin. A equipe pode encerrar o relato com justificativa ou cancelar e devolver as reservas. O revisor não pode participar da sala; uma revisão com placar desatualizado é rejeitada.

## API adicionada

| Ação | Endpoint | Corpo |
|---|---|---|
| Reservar a própria parte | `POST /api/v1/duels/:id/fund` | `{stake}` igual ao valor combinado |
| Avisar o rival | `POST /api/v1/duels/:id/nudge` | `{}`; membro da sala, limitado a um aviso por minuto |
| Encontrar salas abertas | `GET /api/v1/rooms` | Conta autenticada; lista limitada, sem IDs internos, tokens, evidências, regras privadas ou saldo |
| Confirmar com foto própria | `POST /api/v1/duels/:id/confirm` | `{reportId,evidenceId,homeScore,awayScore,scoreSide}`; `scoreSide:host` ou `guest` indica quem aparece à esquerda |
| Reportar problema | `POST /api/v1/duels/:id/issue` | `{reason}` |
| Sugerir placar | `POST /api/v1/duels/:id/recognize` | `{evidenceId}` de foto própria da sala |
| Avaliar problema | `POST /api/v1/reviews/:id/issues/:issueId` | `{decision:'dismiss'|'cancel',reason,reportId}`; nulo sem resultado |

Todos exigem sessão, origem e CSRF. Fotos continuam privadas. A prévia pública do convite contém os termos financeiros, sem IDs dos participantes, nomes privados, saldo ou evidências.

## Leitura local e limites

O mecanismo e o modelo ficam no servidor; nenhuma foto é enviada a terceiros. O processamento aceita imagens até 2 megapixels, usa um único processo de baixa prioridade, prazo de 15 segundos e limite por endereço. Executa fora da fila de gravação do banco, para não bloquear login e carteira. O texto bruto reconhecido não é devolvido nem persistido: apenas sugestão limitada de placar e estado.

A leitura exige um único par de gols com separador e contexto sem estatísticas, relógios, datas ou outros valores ambíguos. A confiança global e a confiança dos números precisam atingir 80 antes de considerar liquidação automática. Os números são comparados com os gols informados e com a orientação da foto. Fotos com o mesmo SHA-256 reutilizadas em partidas ou entre jogadores bloqueiam liquidação automática; essa verificação não detecta toda edição, corte ou recompressão. Imagens desfocadas, reflexos, placares sem separador ou múltiplos pares podem não ser lidos; existe preenchimento manual. A leitura não comprova uma partida real nem detecta montagens. Não existe integração de histórico do EA SPORTS FC nesta entrega.

Instalação de dependências: `pnpm install --frozen-lockfile --ignore-scripts`. O modelo versionado vem de `tesseract-ocr/tessdata_fast`, com licença e hash em `backend/ocr/NOTICE.md`. `FIFABET_OCR_ENABLED=0` desativa a leitura, preservando envio manual e revisão.

## Produção e demonstração

O modo de pagamentos existente foi preservado. `unconfigured` não habilita compra nem cobrança real; partidas gratuitas continuam com `stake:0`. O modo de sala `coins` permite reservar somente saldo principal já existente, inclusive ajustes administrativos auditados, sem criar saldo. Não converte o saldo antigo de demonstração nem ativa Pix. A demonstração estática no GitHub conserva o fluxo local anterior; reservas individuais e leitura no servidor pertencem à versão conectada.

## Revisão desta entrega

A sala usa o modo Operate do Impeccable: identifica os participantes, mostra reservas e estado, e destaca a próxima ação. Expande a identidade existente; não substitui o tema global.

- Paleta: tokens existentes de fundo escuro, texto claro e verde para ações/estados importantes.
- Tipografia: família sans existente; título 32 px no desktop, 27 px no celular, informações secundárias relevantes de pelo menos 14 px.
- Composição: duas colunas acima de 820 px, participantes e ação à esquerda, resumo financeiro à direita; uma coluna no celular.
- Controles: ação de encerramento com altura mínima de 56–58 px; relatos discretos com alvo mínimo de 44 px; câmera e galeria com 48 px.
- Estados: espera de reservas, saldo insuficiente, leitura, sugestão, falha de leitura, revisão, contestação e encerramento. Atualização da sala a cada oito segundos, somente visível e fora de formulários modais, com descarte de respostas antigas.

Skills aplicáveis: redesign-existing-projects (fluxo e hierarquia), Impeccable Operate/harden/audit (estados, revisão técnica), mobile-native (campos, toque, câmera/galeria) e emil-design-eng (feedback e contenção de movimento). Skills de documentos, Swift, instalação e geração de imagens não se aplicam a esta alteração.

Testes de regras, API e interface acompanham reservas, acesso à lista pública, avisos, janela de confirmação, comparação dos gols, privacidade e liquidação idempotente. Casos de teste usam dados e imagens locais fictícios. Câmera, teclado e galeria precisam de conferência em aparelhos físicos antes do lançamento mobile; emulação desktop não os substitui.

### Fotos grandes no celular

A seleção aceita fontes de até 30 MB. Antes do envio, o navegador corrige a orientação quando suportado, limita a resolução a 2 megapixels e converte para JPEG de até 5 MB, retirando metadados. O limite anterior de 8 MB no arquivo original foi removido. HEIC/HEIF dependem da decodificação nativa do navegador; quando indisponível, a interface orienta usar a câmera ou exportar JPG. O servidor mantém os limites privados de 5 MB e 24 megapixels por upload validado. Arquivos sem formato de imagem válido continuam rejeitados.
