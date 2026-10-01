// Private administrative UI. The server independently authorizes every request.
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const date = value => new Date(value).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
const number = value => new Intl.NumberFormat('pt-BR').format(Number(value || 0));
export const adminIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v4m8 2v4m-6 2v4"/></svg>`;

export function createAdminPanel({api, getUser, render, syncAccount, avatar, storage}) {
  if (storage === undefined) { try { storage = globalThis.sessionStorage; } catch { storage = null; } }
  let owner = null, requestRevision = 0, overview = null, users = [], total = 0, entries = [];
  let search = '', selected = null, amount = '', reason = '', pending = null, error = '', success = '', focusId = null;
  const operationKey = actorId => `fifago.admin.pending.${actorId}`;
  function restorePending(user) {
    try {
      const record = JSON.parse(storage?.getItem(operationKey(user.id)) || 'null');
      const operation = record?.operation;
      if (!operation || record.actorId !== user.id || !Number.isSafeInteger(operation.amount) || operation.amount < 1 || operation.amount > 100000 || typeof operation.reason !== 'string' || operation.reason.length < 10 || operation.reason.length > 1000 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operation.idempotencyKey) || typeof record.target?.publicPlayerId !== 'string' || typeof record.target.id !== 'string' || operation.userId !== record.target.id) return;
      pending = {userId: operation.userId, amount: operation.amount, reason: operation.reason, idempotencyKey: operation.idempotencyKey, uncertain: true}; selected = record.target;
      amount = String(operation.amount); reason = operation.reason;
      error = 'Uma adição anterior ficou sem confirmação. Consulte a mesma operação antes de adicionar mais saldo em Joga aí Coin.';
    } catch { /* Malformed or unavailable session storage cannot grant access. */ }
  }
  function rememberPending(user) {
    try {
      if (!storage) throw Error('Session storage unavailable');
      const {uncertain, ...operation} = pending;
      storage.setItem(operationKey(user.id), JSON.stringify({actorId: user.id, operation, target: {id: selected.id, publicPlayerId: selected.publicPlayerId, nickname: selected.nickname}}));
    } catch {
      throw Object.assign(Error('Não foi possível guardar a confirmação neste navegador. Habilite o armazenamento da sessão e tente novamente.'), {status: 400, code: 'storage_unavailable'});
    }
  }
  function clearPending(user) { try { storage?.removeItem(operationKey(user.id)); } catch { /* A completed server operation remains auditable. */ } }

  function reset() {
    owner = null; requestRevision++; overview = null; users = []; total = 0; entries = [];
    search = ''; selected = null; amount = ''; reason = ''; pending = null; error = ''; success = ''; focusId = null;
  }
  function requireAdmin() {
    const user = getUser();
    if (!user?.isAdmin) { reset(); throw Error('Entre com uma conta administradora para continuar.'); }
    if (owner !== user.id) { reset(); owner = user.id; restorePending(user); }
    return user;
  }
  function empty(message) { return `<p class="admin-empty">${message}</p>`; }
  function message() {
    return `${error ? `<p class="admin-message admin-error" role="alert">${escape(error)}</p>` : ''}${success ? `<p class="admin-message admin-success" role="status">${escape(success)}</p>` : ''}`;
  }
  function players() {
    return `<section class="admin-directory" aria-labelledby="adminPlayersTitle">
      <div class="admin-section-heading"><div><h2 id="adminPlayersTitle">Jogadores</h2><p>Encontre a conta pelo apelido ou ID Fifa GO.</p></div><span class="admin-count">${number(total)} ${total === 1 ? 'conta' : 'contas'}</span></div>
      <form data-form="admin-search" class="admin-search"><label class="form-label" for="adminSearch">Buscar jogador</label><div><input class="form-input" id="adminSearch" name="search" type="search" maxlength="80" value="${escape(search)}" placeholder="Apelido ou ID Fifa GO" autocomplete="off"><button class="btn secondary" type="submit">Buscar</button></div></form>
      <div class="admin-player-list">${users.length ? users.map(user => `<button class="admin-player ${selected?.id === user.id ? 'selected' : ''}" data-action="admin-select" data-id="${escape(user.id)}" aria-pressed="${selected?.id === user.id}" aria-label="Gerenciar Joga aí Coin de ${escape(user.nickname)}">
        ${avatar(user, 'small')}<span class="admin-player-name"><strong>${escape(user.nickname)}</strong><small>${escape(user.publicPlayerId)}</small></span><span class="admin-player-balance"><strong>${number(user.balance)}</strong><small>disponíveis</small></span><span class="admin-row-arrow" aria-hidden="true">→</span>
      </button>`).join('') : empty(search ? 'Nenhuma conta encontrada. Confira o apelido ou o ID e busque novamente.' : 'Os jogadores aparecerão aqui após criarem suas contas.')}</div>
      ${users.length < total ? `<p class="admin-list-note">Mostrando ${users.length} de ${number(total)} contas. Use a busca para encontrar uma conta específica.</p>` : ''}
    </section>`;
  }
  function creditEditor() {
    if (!selected) return `<aside class="admin-credit-editor" aria-labelledby="adminCreditTitle"><h2 id="adminCreditTitle">Adicionar Joga aí Coin</h2><p class="admin-empty">Selecione um jogador para conferir o saldo e preparar a adição.</p><p class="admin-credit-note">Toda alteração registra o administrador, o motivo e o saldo antes e depois.</p></aside>`;
    const identity = `<div class="admin-selected-player">${avatar(selected)}<div><strong>${escape(selected.nickname)}</strong><small>${escape(selected.publicPlayerId)}</small></div></div>`;
    const balances = `<dl class="admin-balances"><div><dt>Disponíveis</dt><dd>${number(selected.balance)}</dd></div><div><dt>Reservados</dt><dd>${number(selected.reserved)}</dd></div></dl>`;
    const emails = selected.verifiedEmails?.length ? `<details class="admin-contact"><summary>E-mail verificado da conta</summary>${selected.verifiedEmails.map(email => `<p>${escape(email)}</p>`).join('')}</details>` : '';
    if (pending) return `<aside class="admin-credit-editor" aria-labelledby="adminCreditTitle"><h2 id="adminCreditTitle" tabindex="-1">Confirme a adição</h2>${identity}
      <dl class="admin-confirm-summary"><div><dt>Saldo disponível atual</dt><dd>${number(selected.balance)}</dd></div><div><dt>Joga aí Coin a adicionar</dt><dd class="admin-positive">+${number(pending.amount)}</dd></div><div><dt>Saldo previsto</dt><dd>${number(selected.balance + pending.amount)}</dd></div></dl>
      <p class="admin-list-note">O saldo final será calculado pelo servidor no momento da confirmação.</p><div class="admin-confirm-reason"><strong>Motivo registrado</strong><p>${escape(pending.reason)}</p></div>${message()}
      <form data-form="admin-credit-confirm"><button class="btn primary wide" type="submit">${pending.uncertain ? 'Consultar e confirmar operação' : 'Confirmar adição de Joga aí Coin'}</button></form>
      ${!pending.uncertain ? '<button class="text-button admin-edit-back" data-action="admin-credit-back">Voltar e editar</button>' : ''}<p class="admin-credit-note">Ajuste administrativo. Esta ação não confirma um Pix nem registra uma compra.</p></aside>`;
    return `<aside class="admin-credit-editor" aria-labelledby="adminCreditTitle"><h2 id="adminCreditTitle" tabindex="-1">Adicionar Joga aí Coin</h2>${identity}${balances}${emails}${message()}
      <form data-form="admin-credit" class="admin-credit-form"><label class="form-label" for="adminAmount">Quantidade de Joga aí Coin</label><input class="form-input" id="adminAmount" name="amount" type="number" inputmode="numeric" min="1" max="100000" step="1" value="${escape(amount)}" placeholder="Ex.: 100" required>
        <label class="form-label" for="adminReason">Motivo da adição</label><textarea class="form-input" id="adminReason" name="reason" minlength="10" maxlength="1000" rows="3" placeholder="Explique por que o saldo será adicionado." required>${escape(reason)}</textarea><p class="admin-field-help">Informe ao menos 10 caracteres. O motivo fica no histórico administrativo.</p><button class="btn primary wide" type="submit">Revisar adição de Joga aí Coin</button>
      </form><p class="admin-credit-note">Ajuste administrativo. Esta ação não confirma um Pix nem registra uma compra.</p></aside>`;
  }
  function audit() {
    return `<section class="admin-activity" aria-labelledby="adminActivityTitle"><div class="admin-section-heading"><div><h2 id="adminActivityTitle">Atividade administrativa</h2><p>Últimas adições de Joga aí Coin e os responsáveis por cada operação.</p></div></div>
      ${entries.length ? `<ol class="admin-audit-list">${entries.map(entry => `<li><div class="admin-audit-main"><strong>+${number(entry.amount)} Joga aí Coin para ${escape(entry.target.nickname)}</strong><time datetime="${escape(entry.createdAt)}">${date(entry.createdAt)}</time></div><p>${escape(entry.reason)}</p><div class="admin-audit-meta"><span>Por ${escape(entry.actor.nickname)} · ${escape(entry.target.publicPlayerId)}</span><span>Saldo ${number(entry.balanceBefore)} → ${number(entry.balanceAfter)}</span></div></li>`).join('')}</ol>` : empty('As adições de Joga aí Coin aparecerão aqui com o motivo e o administrador responsável.')}</section>`;
  }
  async function view() {
    if (!getUser()?.isAdmin) { reset(); return `<section class="admin-access-denied"><h1>Painel restrito à administração.</h1><p>Entre com uma conta autorizada para acessar os controles.</p><a class="btn secondary" href="#arena">Voltar para a arena</a></section>`; }
    const user = requireAdmin(), revision = ++requestRevision;
    const [summary, directory, auditData] = await Promise.all([api.getAdminOverview(), api.getAdminUsers(search), api.getAdminAudit()]);
    if (getUser()?.id !== user.id || !getUser()?.isAdmin || requestRevision !== revision) throw Error('A conta mudou. Abra o painel novamente.');
    overview = summary; users = directory.users; total = directory.total; entries = auditData.entries;
    if (selected) {
      const target = users.find(item => item.id === selected.id) || (await api.getAdminUsers(selected.publicPlayerId)).users.find(item => item.id === selected.id);
      if (getUser()?.id !== user.id || !getUser()?.isAdmin || requestRevision !== revision) throw Error('A conta mudou. Abra o painel novamente.');
      if (!target) throw Error('Não foi possível consultar o jogador da operação pendente. Atualize o painel antes de continuar.');
      selected = target;
    }
    const stats = overview.stats;
    return `<div class="admin-page"><header class="admin-heading"><div><h1>Bem-vindo, administrador.</h1><p>Gerencie os jogadores e acompanhe o que precisa de atenção na arena.</p></div><button class="btn secondary" data-action="admin-refresh">Atualizar painel</button></header>
      <dl class="admin-overview"><div><dt>Jogadores cadastrados</dt><dd>${number(stats.users)}</dd></div><div><dt>Partidas em andamento</dt><dd>${number(stats.activeMatches)}</dd></div><div><dt>Resultados para revisar</dt><dd>${number(stats.pendingResults)}</dd></div><div><dt>Recargas para revisar</dt><dd>${number(stats.pendingDeposits)}</dd></div></dl>
      <div class="admin-review-bar"><div><strong>Resultados e problemas</strong><p>Confira os placares, as fotos e os relatos das salas.${stats.pendingIssues ? ` ${number(stats.pendingIssues)} ${stats.pendingIssues===1?'sala com problema aberto':'salas com problemas abertos'}.` : ''}</p></div><a class="btn secondary" href="#revisao">Abrir revisão${stats.pendingResults ? ` (${number(stats.pendingResults)})` : ''}</a></div>
      <div class="admin-workspace">${players()}${creditEditor()}</div>${audit()}
      <section class="admin-service-status" aria-label="Estado dos serviços"><div><span class="admin-status-dot" aria-hidden="true"></span><strong>Arena conectada</strong></div><span>Google: ${overview.authProviders?.google?.available ? 'disponível' : 'em configuração'}</span><span>Pagamentos: ${overview.paymentsAvailable ? 'configurados' : 'em configuração'}</span><a class="text-button" href="#arena">Ir para a arena →</a></section></div>`;
  }
  function loading() {
    return `<section class="admin-loading" aria-busy="true" aria-label="Carregando painel administrativo"><p role="status">Carregando os controles da arena…</p><div aria-hidden="true" class="admin-loading-lines"><span></span><span></span><span></span></div></section>`;
  }
  async function handleAction(action, id) {
    const user = requireAdmin();
    if (action === 'admin-refresh') { render(); return; }
    if (action === 'admin-select') {
      if (pending?.uncertain) { error = 'Confirme a operação pendente antes de trocar de jogador.'; render(); return; }
      const target = users.find(user => user.id === id);
      if (!target) throw Error('Jogador não encontrado. Atualize o painel.');
      clearPending(user);
      selected = target; amount = ''; reason = ''; pending = null; error = ''; success = ''; focusId = 'adminAmount'; render(); return;
    }
    if (action === 'admin-credit-back') {
      if (pending?.uncertain) throw Error('Confirme a operação pendente antes de editar.');
      clearPending(user);
      pending = null; error = ''; focusId = 'adminAmount'; render();
    }
  }
  async function handleForm(form, data) {
    const user = requireAdmin(), kind = form.dataset.form;
    error = ''; success = '';
    if (kind === 'admin-search') { search = String(data.get('search') || '').trim().slice(0, 80); render(); return; }
    try {
      if (!selected) throw Error('Selecione o jogador antes de adicionar Joga aí Coin.');
      if (kind === 'admin-credit') {
        amount = String(data.get('amount') || ''); reason = String(data.get('reason') || '').trim();
        const quantity = Number(amount);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) throw Error('Informe uma quantidade inteira entre 1 e 100.000 Joga aí Coin.');
        if (reason.length < 10 || reason.length > 1000) throw Error('Explique o motivo em 10 a 1.000 caracteres.');
        pending = {userId: selected.id, amount: quantity, reason, idempotencyKey: crypto.randomUUID()};
        focusId = 'adminCreditTitle'; render(); return;
      }
      if (kind === 'admin-credit-confirm') {
        if (!pending || pending.userId !== selected.id) throw Error('Revise a adição antes de confirmar.');
        const submit = form.querySelector('[type="submit"]');
        if (submit) { submit.textContent = 'Confirmando…'; submit.setAttribute('aria-busy', 'true'); }
        const {uncertain, ...payload} = pending;
        rememberPending(user);
        const result = await api.addAdminCredits(payload);
        if (getUser()?.id !== user.id || !getUser()?.isAdmin) { reset(); return; }
        selected = {...selected, ...result.user};
        success = `${number(payload.amount)} em Joga aí Coin adicionados ao saldo de ${selected.nickname}. Saldo disponível: ${number(selected.balance)} Joga aí Coin.`;
        clearPending(user); pending = null; amount = ''; reason = '';
        await syncAccount().catch(() => {});
        focusId = 'adminCreditTitle'; render();
      }
    } catch (problem) {
      if (getUser()?.id !== user.id) { reset(); return; }
      if (kind === 'admin-credit-confirm' && pending && (!problem.status || problem.status >= 500 || problem.code === 'invalid_response' || (problem.status >= 200 && problem.status < 300))) {
        pending.uncertain = true;
        error = 'Não foi possível confirmar a resposta. Tente novamente: a mesma operação será aplicada uma única vez.';
      } else {
        if (kind === 'admin-credit-confirm' && pending && !pending.uncertain) clearPending(user);
        error = problem.message;
      }
      focusId = 'adminCreditTitle'; render();
    }
  }
  function afterRender() {
    if (!focusId) return;
    const target = document.getElementById(focusId); focusId = null;
    target?.focus({preventScroll: true});
    target?.scrollIntoView({block: 'nearest'});
  }
  function handleInput(field) {
    if (getUser()?.id !== owner || !getUser()?.isAdmin) return;
    if (field.id === 'adminAmount') amount = field.value;
    if (field.id === 'adminReason') reason = field.value;
    if (field.id === 'adminSearch') search = field.value;
  }
  return {view, loading, handleAction, handleForm, handleInput, afterRender, reset};
}
