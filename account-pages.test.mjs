import * as chatUI from './chat-ui.mjs';
import {preparationState} from './room-ui.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, basename} from 'node:path';
import * as M from './model.mjs';
import {COUNTRY_CODES, TERMS_VERSION} from './account-policy.mjs';
import {createAdminPanel, adminIcon} from './admin-panel.mjs';
import {accountArt} from './account-art.mjs';
import {uiIcon} from './ui-icons.mjs';
import {renderLobbyView} from './lobby-view.mjs';
import {confirmationClock,safeRoomCards,notificationKey,notificationLabel} from './room-ui.mjs';
import {renderWalletView, renderHistoryView, renderRankingView, renderProfileView} from './account-views.mjs';
import {createArenaServer} from './backend/server.mjs';

// Exercise the actual production route controller with server-owned fixtures.
// DOM layout and touch behavior are checked separately in the browser preview.
const source = fs.readFileSync(new URL('./play.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const user = {id: 'account-a', nickname: 'Cado', publicPlayerId: 'FG-PLAYER0001', balance: 777, countryCode: 'BR', isAdmin: false, isReviewer: false};
const opponent = {id: 'account-b', nickname: 'Rival', publicPlayerId: 'FG-PLAYER0002'};
const status = {available: true, apiVersion: 1, paymentMode: 'unconfigured', paymentsAvailable: false, realMoney: false};
const wallet = {balance: 0, reserved: 0, paymentMode: 'unconfigured', paymentsAvailable: false, transactions: [], deposits: []};
const deferred = () => {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};};
const plain = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const duel = (overrides = {}) => ({id: 'private-match-a', publicMatchId: 'FG-1234567890', hostId: user.id, guestId: opponent.id, host: {...user}, guest: {...opponent}, mode: '1v1', platform: 'playstation', stake: 100, status: 'completed', createdAt: '2026-10-01T12:00:00.000Z', winnerId: user.id, result: {id: 'private-result', reporterId: user.id, homeScore: 3, awayScore: 1, evidenceId: 'private-photo'}, ...overrides});

async function harness({sessionUser = {...user}, backendStatus = status, arena = {}, api = {}, route = 'arena'} = {}) {
  const nodes = {}, listeners = {}, windowListeners = {}, calls = [], copies = [];
  const stored = new Map([[M.STORAGE_KEY, JSON.stringify(M.emptyState())]]), session = new Map();
  const storage = map => ({getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key)});
  const location = {href: `https://betfifa.com.br/#${route}`, hash: `#${route}`, pathname: '/', origin: 'https://betfifa.com.br'};
  let signedIn = !!sessionUser;
  function element(tagName = 'div', attributes = {}) {
    let markup = '', children = [];
    const attributesMap = new Map(Object.entries(attributes)), element = {tagName: tagName.toUpperCase(), id: attributes.id || '', textContent: '', value: '', hidden: Object.hasOwn(attributes, 'hidden'), open: false, disabled: false, isConnected: true, dataset: {},
      classList: {add() {}, remove() {}, toggle() {}}, focus() {document.activeElement = this;}, setSelectionRange() {},
      append() {}, showModal() {this.open = true;}, close() {this.open = false;}, contains(target) {return children.includes(target);}, closest() {return null;},
      setAttribute(name, value) {attributesMap.set(name, String(value));}, getAttribute(name) {return attributesMap.get(name) ?? null;}, removeAttribute(name) {attributesMap.delete(name);},
      remove() {this.isConnected = false; if (nodes[this.id] === this) delete nodes[this.id];},
      scrollIntoView(options) {this.scrollOptions = options;},
      querySelector(selector) {return this.querySelectorAll(selector)[0] ?? null;},
      querySelectorAll(selector) {return children.filter(child => selector.startsWith('.') ? (child.getAttribute('class') || '').split(/\s+/).includes(selector.slice(1)) : child.tagName.toLowerCase() === selector);},
      insertAdjacentHTML(position, html) {
        assert.equal(position, 'afterend');
        const opening = html.match(/^<div\b([^>]*)>/); assert.ok(opening, 'the sibling menu is a div');
        const panel = elementForTag('div', opening[1]); nodes[panel.id] = panel; panel.innerHTML = html.slice(opening[0].length, -6);
      },
      addEventListener(event, callback) {this[event] = callback;}};
    for (const [name, value] of attributesMap) if (name.startsWith('data-')) element.dataset[name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = value;
    Object.defineProperty(element, 'innerHTML', {get: () => markup, set(value) {
      markup = String(value); children.forEach(child => {child.isConnected = false;});
      children = [...markup.matchAll(/<(a|button)\b([^>]*)>/g)].map(([, tag, attrs]) => elementForTag(tag, attrs));
      if (this.id === 'screen') {
        nodes.queueTitle?.remove();
        const heading = markup.match(/<h2\b([^>]*\bid=['"]queueTitle['"][^>]*)>/);
        if (heading) nodes.queueTitle = elementForTag('h2', heading[1]);
      }
    }});
    return element;
  }
  function readAttributes(markup) {
    return Object.fromEntries([...markup.matchAll(/([\w-]+)(?:=(?:'([^']*)'|"([^"]*)"))?/g)].map(([, name, single, double]) => [name, single ?? double ?? '']));
  }
  function elementForTag(tag, markup) {return element(tag, readAttributes(markup));}
  function node(id) {return nodes[id] ??= element('div', {id});}
  const document = {activeElement: null, hidden: false, createElement: tag => ({...element(tag),append(){}}), getElementById: id => ['roomError', 'mobileMoreNav', 'queueTitle'].includes(id) ? nodes[id] ?? null : node(id), querySelector: () => null,
    addEventListener(event, callback) {listeners[event] = callback;}};
  const API = {
    async detectBackend() {return backendStatus;}, async loadSession() {return {user: sessionUser};},
    async getArena() {calls.push('arena'); return {user: signedIn ? sessionUser : null, duels: [], history: [], stats: {reserved: 0}, ...arena};},
    async getWallet() {calls.push('wallet'); return wallet;}, async getLeaderboard() {calls.push('ranking'); return {entries: []};},
    async logoutAccount() {signedIn = false;}, evidenceUrl: id => `/api/v1/evidence/${id}`, depositEvidenceUrl: id => `/api/v1/deposit-evidence/${id}`,
    ...api
  };
  const sessionStorage = storage(session);
  const context = {M, API, confirmationClock,safeRoomCards,notificationKey,notificationLabel, COUNTRY_CODES, TERMS_VERSION, accountArt, uiIcon, renderLobbyView, renderWalletView, renderHistoryView, renderRankingView, renderProfileView, adminIcon, createAdminPanel: options => createAdminPanel({...options, storage: sessionStorage}),
    document, location, URL, crypto, Intl, console, localStorage: storage(stored), sessionStorage,
    navigator: {clipboard: {async writeText(value) {copies.push(value);}}},
    window: {addEventListener(event, callback) {windowListeners[event] = callback;}, scrollTo() {}},
    history: {replaceState(_state, _title, value) {const next = new URL(value, location.href); Object.assign(location, {href: next.href, hash: next.hash, pathname: next.pathname});}},
    setTimeout() {return 1;}, clearTimeout() {}, setInterval() {return 2;}, clearInterval() {}
  };
  Object.assign(context,chatUI,{preparationState});
  vm.createContext(context);
  vm.runInContext(source.replace(/^import .*?;\r?\n/gm, '').replace(/\nstart\(\)\.catch\(/, '\nglobalThis.__boot=start().catch('), context);
  await context.__boot;
  await settle();
  async function routeTo(name, {wait = true} = {}) {
    location.hash = `#${name}`; location.href = `${location.origin}${location.pathname}${location.hash}`;
    windowListeners.hashchange(); if (wait) await settle();
  }
  async function click(action, id) {
    const button = {dataset: {action, id}, disabled: false, isConnected: true};
    await listeners.click({preventDefault() {}, target: {closest: selector => selector === '[data-action]' ? button : null}});
    await settle();
  }
  async function search(value) {
    const field = node('historySearch'); field.value = value; field.selectionStart = value.length;
    listeners.input({target: field}); await settle();
  }
  async function input(id, value) {
    const field = node(id); field.value = value;
    listeners.input({target: field}); await settle();
  }
  async function filter(value) {
    const field = node('historyStatus'); field.value = value; field.closest = () => null;
    await listeners.change({target: field}); await settle();
  }
  return {nodes, document, listeners, calls, copies, location, routeTo, click, search, input, filter, html: () => nodes.screen.innerHTML};
}

test('anonymous account pages never request a private wallet or ranking', async () => {
  const h = await harness({sessionUser: null});
  for (const page of ['carteira', 'historico', 'ranking', 'perfil']) {
    await h.routeTo(page);
    assert.doesNotMatch(h.html(), /Cado|FG-PLAYER0001|777|private-photo/);
    assert.equal(h.nodes.breadcrumb.textContent, {carteira: 'Carteira', historico: 'Histórico', ranking: 'Ranking', perfil: 'Meu perfil'}[page]);
  }
  assert.deepEqual(h.calls, []);
});

test('wallet presents server balances and keeps purchased, reserved and pending amounts distinct', async () => {
  const h = await harness({route: 'carteira', api: {async getWallet() {return {...wallet, balance: 321, reserved: 78, deposits: [
    {id: 'pending-order', amount: 125, method: 'pix', status: 'review', paymentMode: 'pix_manual', createdAt: '2026-10-01T12:00:00Z'},
    {id: 'old-demo', amount: 999, method: 'pix', status: 'pending', paymentMode: 'demo', createdAt: '2026-10-01T12:00:00Z'}
  ]};}}});
  const text = plain(h.html());
  assert.match(text, /321/); assert.match(text, /78/); assert.match(text, /125/);
  assert.doesNotMatch(text, /777/);
  assert.doesNotMatch(h.html(), /data-action='deposit'/);
});

test('an unconfigured wallet does not offer payment generation or invent credits and packages', async () => {
  const h = await harness({route: 'carteira'});
  assert.match(plain(h.html()), /zero|zerado|configuração/);
  assert.doesNotMatch(h.html(), /data-action='deposit'|R\$\s*10|Simular aprovação|dados de cartão/);
  await h.click('deposit');
  assert.match(plain(h.nodes.modalContent.innerHTML), /configuração|desativada/);
  assert.doesNotMatch(h.nodes.modalContent.innerHTML, /data-form='deposit'/);
});

test('a Pix mode flag alone never enables purchases without availability and a catalog', async () => {
  for (const config of [{paymentsAvailable: false, catalog: [{amount: 100, priceCents: 1000}]}, {paymentsAvailable: true, catalog: []}]) {
    const h = await harness({route: 'carteira', backendStatus: {...status, paymentMode: 'pix_manual', ...config}, api: {
      async getWallet() {return {...wallet, paymentMode: 'pix_manual', ...config};}
    }});
    assert.doesNotMatch(h.html(), /data-action='deposit'/);
  }
});

test('wallet loading cannot replace another route when its request resolves late', async () => {
  const wait = deferred(), h = await harness({api: {getWallet: () => wait.promise}});
  await h.routeTo('carteira', {wait: false}); assert.match(h.html(), /role='status'/);
  await h.routeTo('perfil'); const profileHTML = h.html();
  wait.resolve({...wallet, balance: 923}); await settle();
  assert.equal(h.html(), profileHTML); assert.equal(h.location.hash, '#perfil');
});

test('wallet errors are escaped and retry returns to the same account page', async () => {
  let attempts = 0;
  const h = await harness({route: 'carteira', api: {async getWallet() {if (++attempts === 1) throw Error('<img src=x onerror=alert(1)> indisponível'); return {...wallet, balance: 432};}}});
  assert.match(h.html(), /&lt;img/); assert.doesNotMatch(h.html(), /<img src=x onerror/);
  assert.match(h.html(), /data-action='refresh'/);
  await h.click('refresh'); assert.equal(h.location.hash, '#carteira'); assert.match(plain(h.html()), /432/); assert.equal(attempts, 2);
});

test('history displays participant results using public match identifiers and escapes rival names', async () => {
  const match = duel({guest: {...opponent, nickname: '<img src=x onerror=alert(1)>'}});
  const h = await harness({route: 'historico', arena: {history: [match]}});
  assert.match(h.html(), /FG-1234567890/); assert.match(plain(h.html()), /3 × 1/);
  assert.match(h.html(), /&lt;img/); assert.doesNotMatch(h.html(), /<img src=x onerror/);
  assert.doesNotMatch(h.html(), /private-photo|private-result|evidence\/private/);
  assert.match(h.html(), /data-action='details'/);
});

test('history filters retain the selected category without changing stored outcomes', async () => {
  const completed = duel(), review = duel({id: 'review-match', publicMatchId: 'FG-2222222222', status: 'pending_review'});
  const h = await harness({route: 'historico', arena: {history: [completed], duels: [review]}});
  await h.filter('review'); assert.match(h.html(), /data-id='review-match'/); assert.doesNotMatch(h.html(), /data-id='private-match-a'/);
  await h.filter('settled'); assert.match(h.html(), /data-id='private-match-a'/); assert.doesNotMatch(h.html(), /data-id='review-match'/);
  assert.equal(completed.status, 'completed'); assert.equal(review.status, 'pending_review');
});

test('history finds a public match code and clearing filters restores every permitted match', async () => {
  const completed = duel(), review = duel({id: 'review-match', publicMatchId: 'FG-2222222222', status: 'pending_review'});
  const h = await harness({route: 'historico', arena: {history: [completed], duels: [review]}});
  await h.search('fg-1234567890');
  assert.match(h.html(), /data-id='private-match-a'/); assert.doesNotMatch(h.html(), /data-id='review-match'/);
  await h.filter('review'); assert.doesNotMatch(h.html(), /data-id='private-match-a'|data-id='review-match'/);
  await h.click('clear-history'); assert.match(h.html(), /data-id='private-match-a'/); assert.match(h.html(), /data-id='review-match'/);
});

test('ranking uses approved server entries and never exposes private account fields', async () => {
  const rankingPlayer = {...opponent, nickname: '<script>alert(1)</script>', email: 'private@example.test', balance: 55555};
  const h = await harness({route: 'ranking', api: {async getLeaderboard() {return {entries: [{player: rankingPlayer, played: 7, wins: 4, draws: 2, losses: 1}]};}}});
  assert.match(h.html(), /&lt;script&gt;/); assert.doesNotMatch(h.html(), /<script>|private@example.test|55555|BiaGoals|LeoPlay/);
  assert.match(h.html(), /FG-PLAYER0002/); assert.match(plain(h.html()), /7/); assert.match(plain(h.html()), /4/);
});

test('empty ranking remains an honest empty state and supports a recoverable load failure', async () => {
  let attempts = 0;
  const h = await harness({route: 'ranking', api: {async getLeaderboard() {if (++attempts === 1) throw Error('Ranking temporariamente indisponível.'); return {entries: []};}}});
  assert.match(h.html(), /data-action='refresh'/); assert.match(h.html(), /indisponível/);
  await h.click('refresh'); assert.equal(h.location.hash, '#ranking'); assert.match(plain(h.html()), /primeira|ainda|Nenhum/i);
  assert.doesNotMatch(h.html(), /BiaGoals|LeoPlay|18 vitórias/);
});

test('profile displays and copies only the public player ID and preserves useful account controls', async () => {
  const h = await harness({route: 'perfil', sessionUser: {...user, email: 'private@example.test', oauthSubject: 'secret-subject', nickname: '<b>Cado</b>'}});
  assert.match(h.html(), /&lt;b&gt;Cado&lt;\/b&gt;/); assert.match(h.html(), /FG-PLAYER0001/);
  assert.doesNotMatch(h.html(), /private@example.test|secret-subject/);
  for (const action of ['profile', 'copy-id', 'logout']) assert.match(h.html(), new RegExp(`data-action='${action}'`));
  await h.click('copy-id'); assert.deepEqual(h.copies, ['FG-PLAYER0001']); assert.match(h.nodes.toast.textContent, /copiado/i);
});

test('logging out while the wallet loads prevents rendering the former account balance', async () => {
  const wait = deferred(), h = await harness({api: {getWallet: () => wait.promise}});
  await h.routeTo('carteira', {wait: false}); await h.click('logout');
  wait.resolve({...wallet, balance: 654321}); await settle();
  assert.doesNotMatch(h.html(), /654321|Cado|FG-PLAYER0001/);
  assert.match(h.html(), /data-action='signup'|data-action='login'/);
});

test('an unfinished OAuth profile cannot load private account pages until onboarding is completed', async () => {
  const h = await harness({sessionUser: {...user, needsOnboarding: true}});
  for (const page of ['carteira', 'historico', 'ranking', 'perfil']) {
    await h.routeTo(page); assert.match(h.html(), /data-action='complete-signup'/); assert.doesNotMatch(h.html(), /777|private-photo/);
  }
  assert.deepEqual(h.calls, ['arena']);
});

test('late ranking failure cannot overwrite a page opened while the ranking was loading', async () => {
  const wait = deferred(), h = await harness({api: {getLeaderboard: () => wait.promise}});
  await h.routeTo('ranking', {wait: false}); assert.match(h.html(), /role='status'/);
  await h.routeTo('historico'); const historyHTML = h.html();
  wait.reject(Error('Resposta atrasada indisponível.')); await settle();
  assert.equal(h.html(), historyHTML); assert.equal(h.location.hash, '#historico');
});

test('browsing account pages preserves the unfinished match draft without performing account writes', async () => {
  const writes = [];
  const rejectWrite = name => async () => {writes.push(name); throw Error('A page read attempted a write.');};
  const h = await harness({route: 'criar', api: {
    createDuel: rejectWrite('createDuel'), createDeposit: rejectWrite('createDeposit'), updateProfile: rejectWrite('updateProfile'),
    addAdminCredits: rejectWrite('addAdminCredits'), submitResult: rejectWrite('submitResult')
  }});
  await h.input('rivalId', 'FG-FRIEND0001');
  for (const page of ['carteira', 'historico', 'ranking', 'perfil']) await h.routeTo(page);
  await h.routeTo('criar'); assert.match(h.html(), /value='FG-FRIEND0001'/); assert.deepEqual(writes, []);
});

test('account pages keep semantic headings, decorative art and labelled table columns', async () => {
  const h = await harness({arena: {history: [duel()]}, api: {
    async getWallet() {return {...wallet, transactions: [{date: '2026-10-01T12:00:00Z', label: 'Reserva da partida', amount: -100}]};},
    async getLeaderboard() {return {entries: [{player: {...opponent}, played: 1, wins: 1, draws: 0, losses: 0}]};}
  }});
  for (const page of ['carteira', 'historico', 'ranking', 'perfil']) {
    await h.routeTo(page);
    assert.equal([...h.html().matchAll(/<h1\b/g)].length, 1);
    assert.match(h.html(), /<svg class="account-art"[^>]*aria-hidden="true"[^>]*focusable="false"/);
    assert.doesNotMatch(h.html(), /<iframe|<image\b|https:\/\/.*\.(?:png|jpg)/);
    for (const tableHead of h.html().matchAll(/<thead\b[^>]*>([\s\S]*?)<\/thead>/g)) {
      const headers = [...tableHead[1].matchAll(/<th\b([^>]*)>/g)]; assert.ok(headers.length > 0);
      for (const header of headers) assert.match(header[1], /scope='col'/);
    }
    for (const tableBody of h.html().matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/g)) {
      for (const header of tableBody[1].matchAll(/<th\b([^>]*)>/g)) assert.match(header[1], /scope='row'/);
    }
  }
  await h.routeTo('historico');
  for (const field of ['historySearch', 'historyStatus']) assert.match(h.html(), new RegExp(`<label for='${field}'>`));
});

test('activity shortcuts count actual incoming and active matches and focus the matching queue', async () => {
  const incoming = duel({id: 'incoming-a', publicMatchId: 'FG-INCOMING01', status: 'invited', hostId: opponent.id, host: {...opponent}, guestId: user.id, guest: {...user}, result: null});
  const sent = duel({id: 'sent-a', publicMatchId: 'FG-OUTGOING01', status: 'invited', result: null});
  const active = duel({id: 'active-a', publicMatchId: 'FG-ACTIVE0001', status: 'in_progress', result: null});
  const review = duel({id: 'review-a', publicMatchId: 'FG-REVIEW0001', status: 'pending_review'});
  const h = await harness({arena: {duels: [incoming, sent, active, review], history: [duel()]}});
  const shortcuts = () => Object.fromEntries([...h.html().matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].flatMap(([, attrs, content]) => {
    const attributes = Object.fromEntries([...attrs.matchAll(/([\w-]+)=['"]([^'"]*)['"]/g)].map(([, name, value]) => [name, value]));
    return attributes['data-action'] === 'view-activity' ? [[attributes['data-id'], plain(content).trim()]] : [];
  }));
  assert.deepEqual(shortcuts(), {incoming: '1 convite recebido', active: '1 partida em andamento'});
  await h.click('view-activity', 'incoming');
  assert.match(h.html(), /data-id='incoming-a'/); assert.doesNotMatch(h.html(), /data-id='active-a'|data-id='sent-a'|data-id='review-a'|data-id='private-match-a'/);
  assert.equal(h.document.activeElement, h.nodes.queueTitle); assert.equal(h.nodes.queueTitle.getAttribute('tabindex'), '-1');
  assert.deepEqual(JSON.parse(JSON.stringify(h.nodes.queueTitle.scrollOptions)), {block: 'start', behavior: 'auto'});
  await h.click('view-activity', 'active');
  assert.match(h.html(), /data-id='active-a'/); assert.doesNotMatch(h.html(), /data-id='incoming-a'|data-id='sent-a'|data-id='review-a'/);
  const filteredHTML = h.html(); await h.click('view-activity', 'settled'); assert.equal(h.html(), filteredHTML);
  assert.deepEqual(shortcuts(), {incoming: '1 convite recebido', active: '1 partida em andamento'});
  assert.deepEqual(h.calls, ['arena']); assert.equal(incoming.status, 'invited'); assert.equal(active.status, 'in_progress');
  await h.routeTo('perfil'); const profileHTML = h.html(); await h.click('view-activity', 'incoming'); assert.equal(h.html(), profileHTML);
  const anonymous = await harness({sessionUser: null, arena: {duels: [incoming, active]}});
  assert.doesNotMatch(anonymous.html(), /data-action="view-activity"/); await anonymous.click('view-activity', 'incoming'); assert.equal(anonymous.nodes.queueTitle, undefined);
});

test('production HTTP serves the new account assets with correct types and keeps test sources private', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'fifago-account-pages-assets-'));
  // Only the isolated directory created by this test is removed during teardown.
  assert.ok(basename(resolve(dataDir)).startsWith('fifago-account-pages-assets-'));
  const server = await createArenaServer({dataDir, paymentMode: 'unconfigured', env: {FIFABET_OCR_ENABLED: '0'}});
  t.after(async () => {await server.close(); await rm(dataDir, {recursive: true, force: true});});
  await new Promise(resolve => server.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.server.address().port}`;
  for (const [file, type] of [['account-art.mjs', 'text/javascript'], ['account-pages.css', 'text/css']]) {
    const response = await fetch(`${base}/${file}?v=1`);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), new RegExp(type));
    const body = await response.text(); assert.equal(body.replace(/\r\n/g, '\n'), fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  const privateSource = await fetch(`${base}/account-pages.test.mjs`); assert.equal(privateSource.status, 404); await privateSource.text();
  const home = await fetch(base); const homeHTML = await home.text();
  assert.match(homeHTML, /href=["']account-pages\.css\?v=/);
});

test('the connected arena renders only current server rooms and escapes public nicknames', async()=>{
  const room={publicMatchId:'FG-0000000001',host:{nickname:'<img onerror=alert(1)>',clubId:null},stake:1000,mode:'1v1',platform:'playstation',creditMode:'coins',expiresAt:new Date(Date.now()+3600000).toISOString(),economics:{winnerPayout:1820}};
  const h=await harness({api:{getRooms:async()=>({rooms:[room]})}});
  assert.match(h.html(),/Salas da arena/);
  assert.match(h.html(),/data-action='public-room' data-id='FG-0000000001'/);
  assert.match(h.html(),/&lt;img onerror=alert\(1\)&gt;/);
  assert.match(h.html(),/Conferir Coin exigidos/);
  assert.doesNotMatch(h.html(),/data-action='public-room' data-id='private/);
});

test('a public room load failure keeps the account and normal arena available', async()=>{
  const h=await harness({api:{getRooms:async()=>{throw Error('private server detail');}}});
  assert.match(h.html(),/Não foi possível atualizar as salas/);
  assert.match(h.html(),/data-action="create"/);
  assert.doesNotMatch(h.html(),/temporariamente indisponível|private server detail/);
});

test('a preset Coin room blocks entry for an incoming player with insufficient balance', async()=>{
  const invited=duel({status:'invited',hostId:opponent.id,guestId:null,recipientId:user.id,host:{...opponent},guest:null,recipient:{...user},stake:1000,fundingVersion:2,result:null});
  const h=await harness({arena:{duels:[invited]},route:'partida/private-match-a'});
  assert.match(h.html(),/precisa de 1.000 Coin disponíveis/);
  assert.doesNotMatch(h.html(),/data-action='accept'/);
  assert.match(h.html(),/Ver minha carteira/);
});

test('result confirmation opens a separate photo form and never confirms from a click alone', async()=>{
  let confirms=0;
  const pending=duel({status:'pending_review',fundingVersion:2,result:{id:'result-a',reporterId:opponent.id,evidenceId:'photo-rival',homeScore:2,awayScore:1,confirmationDeadline:new Date(Date.now()+300000).toISOString()}});
  const h=await harness({arena:{duels:[pending]},route:'partida/private-match-a',api:{confirmResult:async()=>{confirms++;}}});
  assert.match(h.html(),/Enviar minha foto e confirmar/);
  await h.click('confirm',pending.id);
  assert.equal(confirms,0);
  assert.match(h.nodes.modalContent.innerHTML,/data-form='confirm-result'/);
  assert.match(h.nodes.modalContent.innerHTML,/name='scoreSide' required/);
  assert.match(h.nodes.modalContent.innerHTML,/Fotos de até 30 MB/);
  assert.match(h.nodes.modalContent.innerHTML,/Envie uma foto própria/);
});

test('waiting alerts point to the actual room and nudge uses the existing room API', async()=>{
  const active=duel({status:'in_progress',fundingVersion:2,result:null}),nudges=[];
  const h=await harness({arena:{duels:[active],notifications:[{id:'wait-a',type:'waiting',duelId:active.id,publicMatchId:active.publicMatchId,createdAt:new Date().toISOString()}]},api:{nudgeDuel:async id=>{nudges.push(id);}}});
  assert.match(h.html(),/Seu rival está esperando você/);
  assert.match(h.html(),/data-action='room' data-id='private-match-a'/);
  await h.routeTo('partida/private-match-a');
  assert.match(h.html(),/Avisar que estou esperando/);
  await h.click('nudge',active.id);
  assert.deepEqual(nudges,[active.id]);
  assert.match(h.nodes.toast.textContent,/Aviso enviado/);
});

test('confirmation timeout explains team review and never renders an automatic win', async()=>{
  const pending=duel({status:'pending_review',fundingVersion:2,result:{id:'result-a',reporterId:user.id,evidenceId:'photo-a',homeScore:3,awayScore:1,confirmationDeadline:new Date(Date.now()-1).toISOString()}});
  const h=await harness({arena:{duels:[pending]},route:'partida/private-match-a'});
  assert.match(h.html(),/ninguém vence por falta de resposta/);
  assert.doesNotMatch(h.html(),/Você venceu|Prêmio creditado/);
});

test('a legacy confirmation without a second evidence never claims two photos were received', async()=>{
  const pending=duel({status:'pending_review',fundingVersion:1,result:{id:'result-a',reporterId:user.id,evidenceId:'photo-a',homeScore:3,awayScore:1,confirmedBy:opponent.id}});
  const h=await harness({arena:{duels:[pending]},route:'partida/private-match-a'});
  assert.match(h.html(),/Placar confirmado pelo rival/);
  assert.match(h.html(),/revisar a evidência desta partida anterior/);
  assert.doesNotMatch(h.html(),/As duas fotos foram recebidas|compara os placares das duas fotos/);
});

test('completed rooms distinguish automatic validation from a team decision without claiming one photo',async()=>{
  for(const source of ['bilateral_verified','team_review']){
    const completed=duel({fundingVersion:2,review:{source,reason:'Resultado conferido.'},result:{id:'result-a',reporterId:user.id,evidenceId:'photo-a',confirmationEvidenceId:'photo-b',confirmedBy:opponent.id,homeScore:3,awayScore:1},economics:{pot:200,houseFee:18,winnerPayout:182,feeBps:900},settlement:{pot:200,fee:18,prize:182,winner:'host',winnerId:user.id}});
    const h=await harness({arena:{history:[completed]},route:'partida/private-match-a'});
    assert.match(h.html(),source==='bilateral_verified'?/Validação automática:/ : /Decisão da equipe:/);
    assert.doesNotMatch(h.html(),source==='bilateral_verified'?/Decisão da equipe:/ : /Validação automática:/);
    assert.match(h.html(),/Foto do placar · resultado validado/);
    assert.doesNotMatch(h.html(),/Foto enviada por um participante/);
  }
});
