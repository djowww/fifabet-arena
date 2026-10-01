# Salas, reservas e fotos do resultado

## Fluxo conectado

1. O anfitrião cria uma sala e define o mesmo valor para cada jogador. Criar o convite não debita a carteira.
2. O amigo aceita o convite pelo código ou link. Aceitar também não debita a carteira.
3. Em uma sala com créditos, cada participante confirma a reserva da sua parte. Somente a própria conta pode reservá-la. O estado `awaiting_funds` termina quando os dois confirmam.
4. A sala mostra “Partida em andamento...”, “Reportar um problema” e “Partida encerrada”. Uma amistosa inicia após o aceite e não exige reservas.
5. Pelo celular, o jogador fotografa a tela final do console ou seleciona uma imagem da galeria. A aplicação reduz a foto antes do envio privado.
6. “Ler placar da foto” executa Tesseract.js no servidor. A sugestão exige identificar quem está à esquerda; nunca associa automaticamente posição da tela ao anfitrião. O jogador pode corrigir ou informar manualmente os gols.
7. Enviar foto e placar abre a revisão da equipe. Confirmar pelo adversário ou ler uma imagem não libera créditos. Uma conta autorizada, que não participou do jogo, decide o resultado.
8. Após a revisão, o vencedor recebe o total menos a taxa da casa. A carteira e o histórico registram a operação.

## Taxa e devoluções

Novas salas guardam a cotação imutável: `economics.pot`, `feeBps:900`, `houseFee`, `winnerPayout`, `rounding:'nearest_credit'`. Os créditos são unidades inteiras; a taxa de 9% é arredondada ao crédito mais próximo e esse valor aparece antes da reserva. Exemplo: 100 + 100 = 200; taxa 18; prêmio 182.

Empates aprovados, cancelamentos e expiração devolvem as reservas efetivamente realizadas, sem taxa. Antes do início, qualquer participante pode cancelar; após o início, os dois precisam concordar ou a equipe precisa avaliar um problema. Salas aguardando reservas expiram no prazo do convite. Partidas antigas mantêm as condições originais, sem aplicar retroativamente a taxa.

As reservas usam referências únicas por usuário/partida; o pagamento e a taxa são gravados atomicamente no SQLite. Repetir um envio não duplica lançamentos. A taxa vai para `houseTransactions` na área privada do banco, nunca para um perfil fictício ou uma carteira pública.

## Problemas

Um relato pode ser enviado durante a partida sem existir um placar ou foto. Fica visível aos participantes e à equipe, sem concluir o jogo nem movimentar créditos. A equipe pode encerrar o relato com justificativa ou cancelar e devolver as reservas. O revisor não pode participar da sala; uma revisão com placar desatualizado é rejeitada.

## API adicionada

| Ação | Endpoint | Corpo |
|---|---|---|
| Reservar a própria parte | `POST /api/v1/duels/:id/fund` | `{stake}` igual ao valor combinado |
| Reportar problema | `POST /api/v1/duels/:id/issue` | `{reason}` |
| Sugerir placar | `POST /api/v1/duels/:id/recognize` | `{evidenceId}` de foto própria da sala |
| Avaliar problema | `POST /api/v1/reviews/:id/issues/:issueId` | `{decision:'dismiss'|'cancel',reason,reportId}`; nulo sem resultado |

Todos exigem sessão, origem e CSRF. Fotos continuam privadas. A prévia pública do convite contém os termos financeiros, sem IDs dos participantes, nomes privados, saldo ou evidências.

## Leitura local e limites

O mecanismo e o modelo ficam no servidor; nenhuma foto é enviada a terceiros. O processamento aceita imagens até 2 megapixels, usa um único processo de baixa prioridade, prazo de 15 segundos e limite por endereço. Executa fora da fila de gravação do banco, para não bloquear login e carteira. O texto bruto reconhecido não é devolvido nem persistido: apenas sugestão limitada de placar e estado.

A leitura exige um par de gols reconhecido com separador e confiança mínima. Imagens desfocadas, reflexos, placares sem separador ou múltiplos pares podem não ser lidos; existe preenchimento manual. A leitura não comprova uma partida real nem detecta montagens. Não existe integração de histórico do EA SPORTS FC nesta entrega.

Instalação de dependências: `pnpm install --frozen-lockfile --ignore-scripts`. O modelo versionado vem de `tesseract-ocr/tessdata_fast`, com licença e hash em `backend/ocr/NOTICE.md`. `FIFABET_OCR_ENABLED=0` desativa a leitura, preservando envio manual e revisão.

## Produção e demonstração

O modo de pagamentos existente foi preservado. `unconfigured` continua permitindo apenas amistosas (`stake:0`); não habilita compra nem cobrança real. Salas com reserva exigem um modo de carteira configurado e saldo existente. A demonstração estática no GitHub conserva o fluxo local anterior; reservas individuais e leitura no servidor pertencem à versão conectada.

## Revisão desta entrega

A sala usa o modo Operate do Impeccable: identifica os participantes, mostra reservas e estado, e destaca a próxima ação. Expande a identidade existente; não substitui o tema global.

- Paleta: tokens existentes de fundo escuro, texto claro e verde para ações/estados importantes.
- Tipografia: família sans existente; título 32 px no desktop, 27 px no celular, informações secundárias relevantes de pelo menos 14 px.
- Composição: duas colunas acima de 820 px, participantes e ação à esquerda, resumo financeiro à direita; uma coluna no celular.
- Controles: ação de encerramento com altura mínima de 56–58 px; relatos discretos com alvo mínimo de 44 px; câmera e galeria com 48 px.
- Estados: espera de reservas, saldo insuficiente, leitura, sugestão, falha de leitura, revisão, contestação e encerramento. Atualização da sala a cada oito segundos, somente visível e fora de formulários modais, com descarte de respostas antigas.

Skills aplicáveis: redesign-existing-projects (fluxo e hierarquia), Impeccable Operate/harden/audit (estados, revisão técnica), mobile-native (campos, toque, câmera/galeria) e emil-design-eng (feedback e contenção de movimento). Skills de documentos, Swift, instalação e geração de imagens não se aplicam a esta alteração.

Os arquivos existentes de teste não foram adicionados nem executados nesta solicitação. A revisão considera sintaxe, contratos, autorização, persistência e apresentação. Câmera, teclado e galeria precisam de conferência em aparelhos físicos antes do lançamento mobile; emulação desktop não os substitui.
