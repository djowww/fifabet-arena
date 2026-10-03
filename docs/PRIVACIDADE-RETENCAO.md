# Privacidade e retenção operacional

Comportamento do código revisto em 3 de outubro de 2026. Este documento descreve a aplicação; não estabelece prazo legal de conservação nem confirma a implantação de uma versão. Pagamentos permanecem em `unconfigured`; compra de Joga aí Coin e confirmação de novos pagamentos ficam indisponíveis nesse modo.

## Fotos de partidas e comprovantes

`backend/evidence-storage.mjs` mantém arquivos em `evidence/` e `wallet-evidence/`, dentro de `FIFABET_DATA_DIR`, fora da árvore publicada. A consulta exige autorização e pode ler arquivos ativos ou arquivados.

O prazo padrão de arquivo é **30 dias após o encerramento do registro**, configurável por `FIFABET_ARCHIVE_AFTER_MS`. Fotos de partidas são elegíveis quando a sala está `completed`, `cancelled` ou `expired`, sem relato com `status:'open'`. Comprovantes são elegíveis quando o pedido está `approved`, `rejected` ou `cancelled`. O marco de tempo usa `closedAt`, ou a data da decisão, ou `updatedAt`, nessa ordem. Registros sem data válida permanecem ativos; salas em disputa ou revisão não são elegíveis.

O servidor consulta a manutenção a cada cinco segundos e tenta arquivar, no máximo, uma vez por hora enquanto estiver ativo. Assim, 30 dias é o limite de elegibilidade, não uma promessa de execução naquele instante. O arquivo é movido para `archive/evidence/` ou `archive/wallet-evidence/`; o metadado recebe `archivedAt`. Caminhos alternativos permitem ler uma imagem movida mesmo se a gravação do metadado falhar.

Arquivar conserva as fotos. **Não há destruição automática de evidências vinculadas**. A cota `FIFABET_MAX_EVIDENCE_BYTES`, padrão de **200 MiB**, inclui fotos ativas e arquivadas. Novos envios consideram a cota, os bytes reservados para envios simultâneos e uma margem padrão de **64 MiB** livre no sistema de arquivos. Arquivar não libera cota; capacidade insuficiente bloqueia o envio e exige atendimento operacional.

Uma limpeza separada trata arquivos sem registro: somente arquivos ativos com nome UUID, sem referência nos mapas de fotos, fora de envios em andamento e modificados há mais de **24 horas**. Referências e arquivo são conferidos novamente antes da remoção. Essa limpeza não percorre `archive/` e não estabelece prazo de exclusão para fotos vinculadas aos usuários.

## Sessões e recuperação

`backend/server.mjs` cria sessões com acesso por **14 dias desde a criação**, em cookie `HttpOnly` e `SameSite=Lax`, com `Secure` quando o servidor usa HTTPS. O servidor recusa a sessão vencida. A limpeza do registro ocorre na inicialização e nas operações que executam a expiração; não há promessa de remoção física de cada linha no segundo exato do vencimento.

Cada conta mantém no máximo **oito sessões**; uma nova sessão no limite remove a mais antiga. O perfil lista acessos sem expor o cookie ou token CSRF, permite encerrar sessões específicas ou todas as demais, e usa **Sair** para encerrar o acesso atual. Troca e recuperação de senha revogam as sessões anteriores; uma troca autenticada abre uma sessão nova para o próprio usuário.

Contas com senha geram **oito códigos de recuperação** mediante senha atual correta e sessão criada há, no máximo, **15 minutos**. O servidor guarda hashes SHA-256, não os códigos originais. Cada código é consumido uma vez; gerar outro conjunto substitui o anterior. O código não define validade por dias: ele deixa de funcionar por consumo, substituição do conjunto ou anonimização da conta. Não há envio de senha ou código por e-mail. Contas sem senha que usam Google seguem a recuperação do provedor.

## Revisão de remoção e anonimização

O perfil conectado registra o pedido em `deletionRequest`, com motivo, data e `status:'pending_review'`. Isso não remove a conta imediatamente. Um administrador autorizado, diferente do titular, pode rejeitar ou aprovar a anonimização com motivo de revisão. A decisão exige uma sessão recente e conserva o motivo original da solicitação no registro privado.

A anonimização fica bloqueada enquanto houver:

- saldo principal ou demonstrativo maior que zero;
- sala aberta em que a conta é anfitriã, participante ou destinatária, inclusive convites, preparação, jogo e revisão/disputa;
- pedido de recarga `pending` ou `review` pertencente à conta.

Quando aprovada, a aplicação registra `disabledAt`, substitui o apelido por um pseudônimo único, remove hash/salt de senha, códigos de recuperação, e-mail eventualmente presente no perfil e identidades de login externo. Também limpa clube, conta de jogo declarada e amizades, remove referências de amizade em outras contas e revoga todas as sessões do titular. A autenticação e a busca de jogadores recusam a conta desativada.

São preservados a linha e os IDs da conta, país, aceite e data de criação, extratos principal e demonstrativo, operações administrativas, recargas e decisões, transações da casa, partidas, conversas, relatos, revisões e fotos privadas. Identificações anteriores podem continuar em mensagens históricas, motivos, lançamentos ou imagens. O controle de acesso existente continua valendo para esses registros; anonimizar o perfil não apaga o histórico protegido.

A auditoria da solicitação mantém a razão do titular e acrescenta resultado, ID do administrador, motivo e data da decisão. Uma rejeição preserva acesso e dados da conta. O fluxo não executa devolução bancária nem quita saldos, disputas ou obrigações. Resolver essas pendências é pré-condição para uma revisão de anonimização bem-sucedida.

## Backups e limites

Backups devem incluir SQLite, arquivos WAL/SHM existentes, fotos ativas e arquivo privado. Para copiar a pasta completa de modo consistente, parar o serviço e fechar o banco; manter as cópias fora do GitHub e da pasta publicada, com acesso restrito. O código não administra uma rotação de backups nem modifica cópias já existentes após anonimização.

O prazo de 30 dias organiza armazenamento ativo e arquivo; **não é prazo de eliminação**. O código não define prazo definitivo de destruição de registros de contas, partidas, recargas ou backups. A operação precisa definir retenção e eliminação dessas cópias, com avaliação das obrigações aplicáveis, antes de ativar pagamentos. Nenhuma rotina de remoção de registros protegidos deve ser inferida a partir deste documento.

Referências: [banco e arquivos privados](BANCO.md), [servidor](SERVIDOR.md), [administração](ADMINISTRACAO.md) e [texto público de privacidade](../legal.html#privacidade).
