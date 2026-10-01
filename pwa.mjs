const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const productionHosts = new Set(['betfifa.com.br', 'www.betfifa.com.br']);
const allowedOrigin = (productionHosts.has(location.hostname) && location.protocol === 'https:') || (localHosts.has(location.hostname) && ['http:', 'https:'].includes(location.protocol));
const standalone = matchMedia('(display-mode: standalone)');
let installEvent = null;
let installed = standalone.matches || navigator.standalone === true;
let container = null;
let waitingWorker = null;
let reloadRequested = false;
let updateConsentTimer = null;
let installing = false;

function update() {
  if (!container?.isConnected) return;
  const strip = container.querySelector('.pwa-strip');
  const button = container.querySelector('[data-pwa-install]');
  strip.hidden = installed;
  button.disabled = installing;
  const label = installEvent ? 'Instalar app' : 'Instalar no celular';
  if (button.textContent !== label) button.textContent = label;
  if (installEvent) {
    button.removeAttribute('aria-expanded');
    button.removeAttribute('aria-controls');
  } else {
    button.setAttribute('aria-expanded', String(!container.querySelector('.pwa-help').hidden));
    button.setAttribute('aria-controls', 'pwaInstallInstructions');
  }
  if (installed) container.querySelector('.pwa-help').hidden = true;
  container.querySelector('.pwa-update').hidden = !waitingWorker;
  container.querySelector('[data-pwa-update]').disabled = reloadRequested;
  container.hidden = installed && !waitingWorker;
}

function status(message) {
  if (container?.isConnected) container.querySelector('.pwa-status').textContent = message;
}

function mount() {
  const next = document.getElementById('installApp');
  if (!next || next === container) return;
  container = next;
  container.innerHTML = `<div class="pwa-strip">
    <img class="pwa-mark" src="/assets/pwa/icons-192.png" alt="" width="36" height="36" loading="lazy">
    <div class="pwa-copy"><strong>Fifa GO · beta público</strong><p>Instale grátis e teste partidas entre amigos.</p></div>
    <button type="button" class="pwa-button" data-pwa-install aria-controls="pwaInstallInstructions" aria-expanded="false">Instalar no celular</button>
  </div>
  <div class="pwa-help" id="pwaInstallInstructions" hidden>
    <section><h3>Android · Chrome</h3><p>Abra o menu <strong>⋮</strong> e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>. Confirme para criar o ícone.</p></section>
    <section><h3>iPhone · Safari</h3><p>Toque em <strong>Compartilhar</strong> (pode estar no menu da página) e em <strong>Adicionar à Tela de Início</strong>. Se aparecer, ative <strong>Abrir como App</strong>. Toque em <strong>Adicionar</strong>.</p></section>
    <p class="pwa-first-access">No primeiro acesso, crie sua conta com apelido e senha.</p>
  </div>
  <p class="pwa-status" role="status" aria-live="polite"></p>
  <div class="pwa-update" hidden><p>Uma nova versão está pronta.<br>Atualize quando terminar o que está fazendo.</p><button type="button" class="pwa-button" data-pwa-update>Atualizar</button></div>`;
  container.querySelector('[data-pwa-install]').addEventListener('click', async () => {
    if (installing) return;
    if (!installEvent) {
      const help = container.querySelector('.pwa-help');
      help.hidden = !help.hidden;
      update();
      return;
    }
    const prompt = installEvent;
    installEvent = null;
    installing = true;
    update();
    try {
      // The browser prompt is called inside this user gesture, never automatically.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') installed = true;
    } catch {
      status('Use o menu do navegador para adicionar o Fifa GO à tela inicial.');
      container?.querySelector('.pwa-help')?.removeAttribute('hidden');
    } finally {
      installing = false;
      update();
    }
  });
  container.querySelector('[data-pwa-update]').addEventListener('click', () => {
    const worker = waitingWorker;
    if (!worker || worker.state !== 'installed') return setWaiting(null);
    if (!window.confirm('Atualizar vai recarregar o Fifa GO. Informações ainda não enviadas em formulários serão perdidas. Quer continuar?')) return;
    if (worker.state !== 'installed') return setWaiting(null);
    reloadRequested = true;
    clearTimeout(updateConsentTimer);
    updateConsentTimer = setTimeout(() => {
      reloadRequested = false;
      update();
    }, 15000);
    update();
    worker.postMessage({ type: 'PWA_APPLY_UPDATE' });
  });
  update();
}

function setWaiting(worker) {
  waitingWorker = worker?.state === 'installed' ? worker : null;
  if (!waitingWorker) {
    reloadRequested = false;
    clearTimeout(updateConsentTimer);
  } else {
    worker.addEventListener('statechange', () => {
      if (waitingWorker === worker && worker.state === 'redundant') setWaiting(null);
    });
  }
  mount();
  update();
}

async function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    if (registration.waiting) setWaiting(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(registration.waiting || worker);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const requested = reloadRequested;
      setWaiting(null);
      if (requested) location.reload();
    });
    window.addEventListener('online', () => registration.update().catch(() => {}));
  } catch {
    // Installation guidance stays available. App accounts and requests are unaffected.
  }
}

if (allowedOrigin) {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installEvent = event;
    installed = false;
    mount();
    update();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    installed = true;
    update();
  });
  standalone.addEventListener('change', () => {
    installed = standalone.matches || navigator.standalone === true;
    update();
  });
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  mount();
  if (document.readyState === 'complete') registerWorker();
  else window.addEventListener('load', registerWorker, { once: true });
}
