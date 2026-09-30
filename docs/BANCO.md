# Banco privado da arena

`backend/database.mjs` utiliza o SQLite nativo de **Node.js 24 ou superior**, sem pacote externo. O arquivo `arena.sqlite` fica em `FIFABET_DATA_DIR`, fora da árvore publicada do projeto. As imagens continuam nas pastas privadas `evidence/` e `wallet-evidence/`; o banco contém seus metadados e permissões.

## Contrato de integração

```js
import {openArenaDatabase} from './database.mjs';

const storage=await openArenaDatabase(dataDir);
let state=storage.load();
// A fila do servidor prepara um draft com structuredClone(state).
storage.save(draft);
state=draft; // Somente após a gravação concluir.
storage.close();
```

Após a abertura assíncrona, `load`, `save` e `close` são síncronos. O retorno inclui `path` e `schemaVersion:1`. Os exports `DATABASE_FILENAME`, `SCHEMA_VERSION` e `normalizeNickname` permitem ao servidor e à ferramenta de contas usar o mesmo contrato.

O estado mantém `version:1` e os mapas `users`, `duels`, `sessions`, `deposits`, `evidence`, `walletEvidence` e `authIdentities`. Transações continuam acessíveis em `user.transactions`, com sua ordem preservada. Campos adicionais no estado e nos registros são preservados em JSON privado; a camada de armazenamento não atribui significados financeiros a eles.

As tabelas explícitas são `users`, `duels`, `sessions`, `deposits`, `transactions`, `evidence`, `wallet_evidence`, `auth_identities` e `metadata`. Chaves estrangeiras vinculam partidas, sessões, transações, depósitos, identidades e evidências às respectivas contas. O esquema utiliza `STRICT`, validação de JSON, WAL, `synchronous=FULL` e espera de bloqueio de 5 segundos.

- `users.id` é a chave interna; `publicPlayerId` é único. O apelido normalizado por NFKC, remoção de espaços nas extremidades e conversão para minúsculas em português é único. Hash e salt de senha ficam em colunas privadas; contas externas podem omiti-los.
- `duels.publicMatchId` usa `FG-` e **10 dígitos hexadecimais maiúsculos**, por exemplo `FG-1A2B3C4D5E`, com restrição de unicidade. A geração cabe ao servidor. O adaptador aceita código ausente somente durante a importação de partidas legadas; a inicialização do servidor atribui e persiste códigos para essas partidas antes de atender requisições. IDs internos e tokens de convite antigos são preservados. O token secreto do convite tem sua própria restrição de unicidade e permanece privado.
- Transações são únicas por `(userId, reference)`, preservando a proteção contra crédito duplicado. Depósitos com chave de idempotência são únicos por `(userId, idempotencyKey)`.
- `authIdentities` é um mapa com chave `${provider}:${subject}` e registro `{provider, subject, userId, ...}`. Provedores aceitos: `google` e `apple`. `(provider, subject)` é único; e-mail não é usado pela camada de banco para vincular contas.

Uma gravação substitui o estado dentro de uma única transação `BEGIN IMMEDIATE`. Se a validação, uma chave estrangeira ou uma restrição de unicidade falhar, a transação inteira é revertida. A fila e o bloqueio de instância do servidor continuam necessários: este adaptador preserva o modelo de um único escritor em memória, não implementa sincronização entre múltiplos servidores.

## Migração do JSON anterior

Na primeira abertura de um banco ainda não inicializado, o adaptador procura `state.json` na mesma pasta privada. Valida o estado, preserva o arquivo original e cria uma cópia exclusiva `state.json.pre-sqlite-<data>-<UUID>.bak` antes de importar. Importação e marca de migração são gravadas juntas. Contas, senhas, IDs, sessões, saldos e transações existentes são preservados; **nenhum bônus é apagado e nenhum crédito demonstrativo é convertido em dinheiro real** pelo banco.

Após a inicialização, o SQLite é a fonte de dados. O JSON antigo não é importado novamente, mesmo que seja alterado. Um JSON inválido, conflito de apelidos normalizados ou referência órfã impede a migração e exige correção explícita; não há exclusão silenciosa de registros. Um banco incompatível ou danificado também não aciona retorno automático ao JSON.

### Separação dos créditos da demonstração antiga

Após carregar o SQLite, o servidor aplica uma migração de carteira única identificada por `walletLedgerVersion:1` e `walletLedgerMigratedAt`. O saldo anterior é preservado em `user.demoBalance` e o extrato anterior em `user.demoTransactions`, com os mesmos IDs, referências, valores e ordem. A carteira principal passa a `balance:0` e `transactions:[]`. A inicialização grava esse estado atomicamente, com as marcas de migração em metadados privados; reiniciar não repete a transferência nem apaga créditos novos.

Os registros anteriores continuam privados no JSON de cada usuário. A tabela `transactions` contém o extrato da carteira principal; o extrato demonstrativo arquivado continua em `demoTransactions`. As partidas anteriores recebem `creditMode:'legacy_demo'`. Aceite, cancelamento, expiração e distribuição de um resultado dessas partidas movimentam exclusivamente o saldo demonstrativo separado. Contas, apelidos, hash/salt de senha, identidades externas, sessões, amizades, evidências e histórico das partidas permanecem preservados.

Na produção, `FIFABET_PAYMENT_MODE=unconfigured` mantém compras e recargas indisponíveis até conectar o provedor comercial. Novas contas começam com saldo principal zero, sem bônus financeiro ou recarga simulada. Novas partidas usam `creditMode:'friendly'` e `stake:0`, permitindo jogar com amigos e registrar resultados enquanto a integração de pagamento está pendente. O ambiente não recebe dinheiro real nessa configuração. A opção `demo` continua restrita ao desenvolvimento local; seus créditos não representam dinheiro.

## Operação e privacidade

`node backend/accounts.mjs` consulta um SQLite existente em modo somente leitura e lista somente apelido, ID público e ID interno necessário para configurar a equipe. Não cria um banco. Quando ainda não existe SQLite, lê o JSON legado sem migrá-lo. A ferramenta não imprime hashes, salts, sessões, saldos ou identidades externas.

Mantenha a pasta privada acessível apenas ao usuário do serviço. O adaptador solicita permissões `0700` para a pasta e `0600` para o banco e backups em sistemas que suportam essas permissões. Não envie `arena.sqlite`, arquivos `-wal`/`-shm`, JSON, imagens ou backups ao GitHub. Para copiar a pasta completa de forma consistente, pare o servidor e feche o banco; preserve também quaisquer arquivos WAL existentes. Configure retenção, armazenamento separado e restauração de backups antes de operar pagamentos reais.

Referência técnica: [SQLite nativo do Node.js 24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).
