# Banco privado da arena

`backend/database.mjs` utiliza o SQLite nativo de **Node.js 24 ou superior**, sem pacote externo. O arquivo `arena.sqlite` fica em `FIFABET_DATA_DIR`, fora da árvore publicada do projeto. As imagens continuam nas pastas privadas `evidence/` e `wallet-evidence/`; o banco contém seus metadados e permissões.

## Contrato de integração

```js
import {openArenaDatabase} from './database.mjs';

const storage=await openArenaDatabase(dataDir);
let state=storage.load();
// O escritor prepara um draft; GET usa projeções sem clonar o estado global.
storage.save(draft);
state=draft; // Somente após a gravação concluir.
storage.close();
```

Após a abertura assíncrona, `load`, `save` e `close` são síncronos. O retorno inclui `path` e `schemaVersion:1`. Os exports `DATABASE_FILENAME`, `SCHEMA_VERSION` e `normalizeNickname` permitem ao servidor e à ferramenta de contas usar o mesmo contrato.

O estado mantém `version:1` e os mapas `users`, `duels`, `sessions`, `deposits`, `evidence`, `walletEvidence` e `authIdentities`. Transações continuam acessíveis em `user.transactions`, com sua ordem preservada. Campos adicionais permanecem em JSON privado; invariantes de saldo, reservas, depósitos aprovados e liquidações são validadas antes da gravação.

As tabelas explícitas são `users`, `duels`, `sessions`, `deposits`, `transactions`, `evidence`, `wallet_evidence`, `auth_identities` e `metadata`. Chaves estrangeiras vinculam partidas, sessões, transações, depósitos, identidades e evidências às respectivas contas. O esquema utiliza `STRICT`, validação de JSON, WAL, `synchronous=FULL` e espera de bloqueio de 5 segundos.

- `users.id` é a chave interna; `publicPlayerId` é único. O apelido normalizado por NFKC, remoção de espaços nas extremidades e conversão para minúsculas em português é único. Hash e salt de senha ficam em colunas privadas; contas externas podem omiti-los.
- `duels.publicMatchId` usa `FG-` e **10 dígitos hexadecimais maiúsculos**, por exemplo `FG-1A2B3C4D5E`, com restrição de unicidade. A geração cabe ao servidor. O adaptador aceita código ausente somente durante a importação de partidas legadas; a inicialização do servidor atribui e persiste códigos para essas partidas antes de atender requisições. IDs internos e tokens de convite antigos são preservados. O token secreto do convite tem sua própria restrição de unicidade e permanece privado.
- Transações são únicas por `(userId, reference)`, preservando a proteção contra crédito duplicado. Depósitos com chave de idempotência são únicos por `(userId, idempotencyKey)`.
- `authIdentities` é um mapa com chave `${provider}:${subject}` e registro `{provider, subject, userId, ...}`. Provedores aceitos: `google` e `apple`. `(provider, subject)` é único; e-mail não é usado pela camada de banco para vincular contas.

Uma gravação aplica mudanças incrementais dentro de uma única transação `BEGIN IMMEDIATE`: insere registros novos, atualiza os alterados e remove somente os ausentes do draft. Registros iguais não são regravados; não há exclusão e reinserção de todas as tabelas. IDs de transação duplicados são rejeitados antes de materializar as linhas. Se a validação, uma chave estrangeira ou uma restrição de unicidade falhar, a transação inteira é revertida. A fila e o bloqueio de instância continuam necessários: o adaptador preserva um único escritor em memória, sem sincronização entre múltiplos servidores. A validação e a comparação ainda percorrem o estado; a escrita incremental reduz alterações no disco, sem prometer custo constante.

### Reconciliação da carteira

`walletReliabilityVersion:1` registra a migração única de `walletOpeningBalance`: saldo atual menos a soma do extrato, sem modificar o saldo. A abertura de uma carteira existente fica imutável; toda gravação exige saldo inteiro seguro, não negativo e igual à abertura mais os lançamentos. Contas novas começam com abertura e saldo zero. Depósitos aprovados exigem crédito com referência `deposit:<id>` e valor correspondente. Ajustes administrativos preservam autor, motivo e saldos anterior/posterior.

A migração de demonstração descrita abaixo move o extrato antigo integralmente. Depósitos demonstrativos já aprovados recebem `legacyDepositLedger:'demo'` e são reconciliados com `demoTransactions`; esse marcador só é criado pela migração validada ou pela atualização de um banco histórico. Não autoriza novas aprovações nem pagamentos reais. Aprovações Pix antigas podem manter `legacyBankApproval:true`, atribuído exclusivamente na migração; aprovações Pix novas exigem referência bancária única, valor em centavos igual ao pedido e data válida. Esses controles não ativam pagamentos.

## Migração do JSON anterior

Na primeira abertura de um banco ainda não inicializado, o adaptador procura `state.json` na mesma pasta privada. Valida o estado, preserva o arquivo original e cria uma cópia exclusiva `state.json.pre-sqlite-<data>-<UUID>.bak` antes de importar. Importação e marca de migração são gravadas juntas. Contas, senhas, IDs, sessões, saldos e transações existentes são preservados; **nenhum bônus é apagado e nenhum crédito demonstrativo é convertido em dinheiro real** pelo banco.

Após a inicialização, o SQLite é a fonte de dados. O JSON antigo não é importado novamente, mesmo que seja alterado. Um JSON inválido, conflito de apelidos normalizados ou referência órfã impede a migração e exige correção explícita; não há exclusão silenciosa de registros. Um banco incompatível ou danificado também não aciona retorno automático ao JSON.

### Separação dos créditos da demonstração antiga

Após carregar o SQLite, o servidor aplica uma migração de carteira única identificada por `walletLedgerVersion:1` e `walletLedgerMigratedAt`. O saldo anterior é preservado em `user.demoBalance` e o extrato anterior em `user.demoTransactions`, com os mesmos IDs, referências, valores e ordem. A carteira principal passa a `balance:0` e `transactions:[]`. A inicialização grava esse estado atomicamente, com as marcas de migração em metadados privados; reiniciar não repete a transferência nem apaga créditos novos.

Os registros anteriores continuam privados no JSON de cada usuário. A tabela `transactions` contém o extrato da carteira principal; o extrato demonstrativo arquivado continua em `demoTransactions`. As partidas anteriores recebem `creditMode:'legacy_demo'`. Aceite, cancelamento, expiração e distribuição de um resultado dessas partidas movimentam exclusivamente o saldo demonstrativo separado. Contas, apelidos, hash/salt de senha, identidades externas, sessões, amizades, evidências e histórico das partidas permanecem preservados.

Na produção, `FIFABET_PAYMENT_MODE=unconfigured` mantém compras e recargas indisponíveis. Novas contas começam com saldo principal zero, sem bônus financeiro ou recarga simulada. Partidas gratuitas usam `creditMode:'friendly'` e `stake:0`; salas com saldo principal já disponível usam `coins` e exigem reserva ao criar/entrar. Essa configuração não recebe pagamentos nem converte a demonstração antiga. `demo` continua restrito ao desenvolvimento local; seus créditos não representam dinheiro.

## Projeções, páginas e evidências

GET consulta projeções da conta/sala sem clonar o banco global. `cursorPage(items,{cursor,limit})` retorna `{items,nextCursor}`, preservando a ordem recente primeiro. O cursor opaco usa o último ID imutável; cursor inválido ou cujo registro deixou de existir retorna erro, sem saltar silenciosamente o histórico. O padrão é 20 itens e o máximo é 50. Carteira, depósitos e histórico oferecem páginas, com códigos públicos das partidas nos lançamentos; APIs antigas continuam compatíveis.

Fotos de salas/depósitos inteiramente encerrados há 30 dias podem ser movidas para `archive/evidence/` e `archive/wallet-evidence/`, dentro da mesma pasta privada. Disputas e relatos abertos são preservados no armazenamento ativo. Não há exclusão automática. A leitura verifica autorização antes de consultar arquivo ativo ou arquivado; caminhos alternativos preservam acesso mesmo se o movimento do arquivo acontecer e a gravação dos metadados falhar.

`FIFABET_MAX_EVIDENCE_BYTES` limita o armazenamento ativo a 200 MiB por padrão; o arquivo privado continua contabilizado no total apresentado à administração. `FIFABET_ARCHIVE_AFTER_MS` configura o prazo de arquivamento, padrão de 30 dias. Backup deve incluir ambas as áreas e os metadados do SQLite.

## Operação e privacidade

`node backend/accounts.mjs` consulta um SQLite existente em modo somente leitura e lista somente apelido, ID público e ID interno necessário para configurar a equipe. Não cria um banco. Quando ainda não existe SQLite, lê o JSON legado sem migrá-lo. A ferramenta não imprime hashes, salts, sessões, saldos ou identidades externas.

Mantenha a pasta privada acessível apenas ao usuário do serviço. O adaptador solicita permissões `0700` para a pasta e `0600` para o banco e backups em sistemas que suportam essas permissões. Não envie `arena.sqlite`, arquivos `-wal`/`-shm`, JSON, imagens ou backups ao GitHub. Para copiar a pasta completa de forma consistente, pare o servidor e feche o banco; preserve também quaisquer arquivos WAL existentes. Configure retenção, armazenamento separado e restauração de backups antes de operar pagamentos reais.

Referência técnica: [SQLite nativo do Node.js 24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).
