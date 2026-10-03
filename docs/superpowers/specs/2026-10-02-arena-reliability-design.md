# Confiabilidade da Arena — escopo aprovado

O usuário solicitou aplicar todas as recomendações da auditoria: atualização das telas, prazos, evidências, premiação, carteira, perfil, Arena, ranking e desempenho. Reaproveitar os fluxos existentes e manter pagamentos desativados enquanto não configurados. Publicação segue o fluxo já autorizado de GitHub e betfifa.com.br, preservando todos os outros serviços.

## Partidas e regras

- Sala nova aberta expira em 24 horas; preparação após aceite expira em 10 minutos e devolve as duas reservas uma única vez. A prontidão vale 2 minutos e pode ser retirada antes do início.
- Partida iniciada tem prazo operacional de 60 minutos; vencimento abre atendimento/revisão, sem vitória nem devolução automática. Revisão informa prazo de atendimento de 24 horas e sinaliza atraso à equipe. Estes prazos são padrões configuráveis, não uma garantia de disponibilidade humana.
- Ambas as contas precisam confirmar início e compatibilidade. Edição do jogo (campo opcional de até 40 caracteres), geração/plataforma, crossplay e regras estruturadas de empate, pênaltis, prorrogação e desconexão ficam no resumo imutável. Legados não ganham acordos inventados.
- Problemas podem ser relatados durante jogo, confirmação e revisão. Avisos refletem a etapa atual. Encerrar problema define próximo passo e reavalia elegibilidade; tempo expirado continua revisão humana.

## Evidências e economia

- Leitura OCR permanece sugestão, sem alegar autenticação do jogo. Fingerprint visual no servidor identifica fotos semelhantes e encaminha para revisão; falha de análise nunca libera prêmio automaticamente nas salas com política nova.
- Entradas de 500 Coin ou mais por jogador exigem revisão humana; limite é configurável e guardado na sala. Partidas já concluídas não mudam de validação.
- Fotos de disputas abertas nunca são arquivadas. Fotos de partidas e depósitos encerrados há 30 dias podem ser movidas para arquivo privado, continuam acessíveis às contas autorizadas e não são apagadas automaticamente. Limite operacional considera arquivos ativos; capacidade total e avisos ficam na administração.
- Taxa de 9%, arredondamento atual, empate sem taxa e referências idempotentes preservados. Exibir ganho líquido junto do prêmio.
- Pix manual aprovado precisa de referência bancária única, valor confirmado e data; a aprovação humana e proibição de autoaprovação continuam. Não ativar pagamentos nem lançar transações reais durante testes.
- Saldo deve reconciliar saldo de abertura + extrato; migração registra abertura uma única vez sem modificar o saldo. Depósito aprovado precisa do lançamento correspondente e referências bancárias não podem repetir.

## Perfil, busca, ranking e listas

- IDs EA/PSN/Xbox declarados opcionais (até 64 caracteres), sem integração automática; edição e geração ajudam a encontrar rival compatível.
- Arena filtra plataforma, modo e faixa de entrada/saldo. Ranking fornece posição pessoal, rating de habilidade e pontuação; no máximo três confrontos por par por dia contam para classificação, os demais permanecem no histórico e têm premiação normal.
- Extrato, depósitos e histórico têm paginação por cursor, identificadores públicos da partida e detalhe de reserva/devolução/prêmio/taxa. Saldo e dados privados não saem em salas públicas.
- Atualizações pendentes são aplicadas após fechar modal/sair de campo. Carteira acompanha mudanças remotas sem perder formulários nem foco. Não implementar notificações fora do navegador sem infraestrutura de entrega; avisos existentes permanecem reais.

## Desempenho e compatibilidade

- SQLite mantém transação, unicidade, rollback e instância única; substituir apagar/reinserir tudo por mudanças incrementais.
- Leituras usam projeções da conta/sala; GET não clona o banco global. Expiração periódica separada, com caminho de expiração rápida para ações críticas.
- Recebimento de corpos, processamento de imagem e cálculo de senha fora da seção crítica; sessão, CSRF, permissões, versão e saldo revalidados ao efetivar.
- APIs antigas continuam compatíveis. Interface usa consultas resumidas/paginadas novas; Node 24+, sem framework novo, português brasileiro, foco e toque acessíveis.

## Verificação

Testes locais para corrida/idempotência de saldo, referência Pix repetida, reconciliação, prazos, prontidão retirada, alto valor/reuso de fotos, autorização de arquivo, sincronização com modal/carteira, paginação e ranking repetido. Verificação visual desktop/celular e checagem dos arquivos/API entregues pelo domínio. Nenhuma movimentação financeira ou partida de teste na produção.
