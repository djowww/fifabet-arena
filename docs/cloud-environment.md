# Desenvolvimento em ambiente de nuvem

Use o checkout existente: cada tarefa de nuvem já é isolada; não crie um
worktree salvo se solicitado. Requisitos: **Node.js 24** (SQLite nativo) e
**pnpm 10.32.0**, a versão usada na [CI](../.github/workflows/tests.yml).
Os caminhos abaixo correspondem ao ambiente validado; ajuste-os se outra
tarefa usar um workspace diferente, mantendo os dados fora do checkout.

## Instalação e verificações

Instale o pnpm fora do repositório e preserve manifests e lockfiles:

```bash
node --version # deve indicar v24.x
mkdir -p /workspace/cloud-onboarding/fifabet-tools
npm install --prefix /workspace/cloud-onboarding/fifabet-tools \
  --cache /workspace/cloud-onboarding/npm-cache \
  --ignore-scripts --no-audit --no-fund --save-exact pnpm@10.32.0
export PATH="/workspace/cloud-onboarding/fifabet-tools/node_modules/.bin:$PATH"
cd /workspace/fifabet-arena
pnpm --version # 10.32.0
pnpm install --frozen-lockfile \
  --store-dir /workspace/cloud-onboarding/fifabet-pnpm-store
pnpm test
pnpm audit --prod --audit-level=high
```

Repita a ativação do `PATH` em cada shell que precisar do pnpm. Não existem
scripts de build ou typecheck; a aplicação é servida diretamente pelo Node.

## Inicialização e prontidão

Processos não devem ser considerados persistentes entre tarefas. Antes de
iniciar, verifique se já existe um servidor usando esta porta e pasta de dados.
Em um terminal de longa duração, execute:

```bash
cd /workspace/fifabet-arena
mkdir -p /workspace/cloud-onboarding/fifabet-data
FIFABET_HOST=127.0.0.1 \
FIFABET_PORT=5174 \
FIFABET_DATA_DIR=/workspace/cloud-onboarding/fifabet-data \
FIFABET_PAYMENT_MODE=unconfigured \
node backend/server.mjs
```

Em outro terminal, confira a resposta da API e a página inicial:

```bash
node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:5174';
const response = await fetch(`${base}/api/v1/status`);
assert.equal(response.status, 200);
const status = await response.json();
assert.equal(status.available, true);
assert.equal(status.storage, 'sqlite');
assert.equal(status.recognition.available, true);
assert.equal(status.paymentMode, 'unconfigured');
assert.equal(status.paymentsAvailable, false);
const page = await fetch(`${base}/`);
assert.equal(page.status, 200);
assert.match(await page.text(), /<!doctype html>/i);
console.log('API, SQLite, OCR e página inicial disponíveis.');
JS
```

Use o endereço de loopback somente para validação local. `arena.sqlite`, seus
arquivos WAL/SHM, evidências e backups ficam na pasta de dados e não devem ser
versionados. Encerre a instância com Ctrl+C ou SIGTERM após confirmar o processo.
Se houver `instance.lock`, confira o PID registrado, o comando, o diretório de
execução e a pasta de dados efetivamente usada; confirme que o servidor parou
e que nenhum outro processo usa esses dados antes de remover somente o lock
obsoleto. Um PID reutilizado não deve receber sinais. Não apague o banco para
contornar falhas de inicialização.

## Evidências e limites

No commit `278ddca4b23f69416a7bdb5a466004d9fdbf09d9`, a instalação congelada
passou duas vezes, **404 testes passaram** e a auditoria de produção não encontrou
vulnerabilidades conhecidas. Também passaram **20 requisições HTTP funcionais**,
abrangendo contas, salas amistosas, chat, upload, Sharp e OCR local. Esses
resultados são o baseline do onboarding; execute os comandos novamente na nova
tarefa para confirmar seu estado.

O desenvolvimento local validado não exigiu novos segredos ou domínios.
Pagamentos permanecem `unconfigured`. OAuth Google/Apple e Pix são opcionais,
dependem de configuração própria e não foram testados neste onboarding.
Consulte [SERVIDOR.md](SERVIDOR.md) para detalhes do servidor e armazenamento.
