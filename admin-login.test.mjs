import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as M from './model.mjs';
import {createAdminPanel, adminIcon} from './admin-panel.mjs';
import {COUNTRY_CODES, TERMS_VERSION} from './account-policy.mjs';
import {accountArt} from './account-art.mjs';
import {uiIcon} from './ui-icons.mjs';
import {renderLobbyView} from './lobby-view.mjs';
import {renderWalletView, renderHistoryView, renderRankingView, renderProfileView} from './account-views.mjs';

const source = fs.readFileSync(new URL('./play.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const ordinary = {id: 'player', nickname: 'Jogador', publicPlayerId: 'FBA-PLAYER0001', balance: 0, isAdmin: false, isReviewer: false};
const administrator = {...ordinary, id: 'admin', nickname: 'Administrador', isAdmin: true, isReviewer: true};

async function harness({sessionUser = null, arenaUser = sessionUser, loginUser = arenaUser, online = true, url = 'https://example.test/jogar.html#arena', initial = M.emptyState()} = {}) {
  const nodes = {}, listeners = {}, windowListeners = {}, calls = [];
  const stored = new Map([[M.STORAGE_KEY, JSON.stringify(initial)]]), session = new Map();
  const storage = map => ({getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key)});
  let authenticated = !!sessionUser;
  const parsed = new URL(url), location = {href: parsed.href, hash: parsed.hash, pathname: parsed.pathname, origin: parsed.origin};
  function element(tagName = 'div', attributes = {}) {
    let markup = '', children = [];
    const attrs = new Map(Object.entries(attributes)), result = {
      id: attributes.id || '', tagName: tagName.toUpperCase(), textContent: '', value: '', hidden: Object.hasOwn(attributes, 'hidden'), open: false, isConnected: true, disabled: false, dataset: {},
      classList: {add() {}, remove() {}, toggle() {}}, focus() {document.activeElement = this;},
      showModal() {this.open = true;}, close() {this.open = false;}, closest() {return null;},
      setAttribute(name, value) {attrs.set(name, String(value));}, getAttribute(name) {return attrs.get(name) ?? null;}, removeAttribute(name) {attrs.delete(name);},
      remove() {this.isConnected = false; if (nodes[this.id] === this) delete nodes[this.id];}, scrollIntoView() {},
      querySelector(selector) {return this.querySelectorAll(selector)[0] ?? null;},
      querySelectorAll(selector) {return children.filter(child => selector.startsWith('.') ? (child.getAttribute('class') || '').split(/\s+/).includes(selector.slice(1)) : child.tagName.toLowerCase() === selector);},
      insertAdjacentHTML(position, html) {
        assert.equal(position, 'afterend'); const opening = html.match(/^<div\b([^>]*)>/); assert.ok(opening);
        const panel = element('div', readAttributes(opening[1])); nodes[panel.id] = panel; panel.innerHTML = html.slice(opening[0].length, -6);
      }, addEventListener(name, callback) {this[name] = callback;}
    };
    for (const [name, value] of attrs) if (name.startsWith('data-')) result.dataset[name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = value;
    Object.defineProperty(result, 'innerHTML', {get: () => markup, set(value) {
      markup = String(value); children.forEach(child => {child.isConnected = false;});
      children = [...markup.matchAll(/<(a|button)\b([^>]*)>/g)].map(([, tag, attributes]) => element(tag, readAttributes(attributes)));
    }});
    return result;
  }
  function readAttributes(markup) {return Object.fromEntries([...markup.matchAll(/([\w-]+)(?:=(?:'([^']*)'|"([^"]*)"))?/g)].map(([, name, single, double]) => [name, single ?? double ?? '']));}
  function node(id) {return nodes[id] ??= element('div', {id});}
  const document = {getElementById: id => ['roomError', 'mobileMoreNav'].includes(id) ? nodes[id] ?? null : node(id), activeElement: null, querySelector: () => null, addEventListener(name, callback) {listeners[name] = callback;}};
  const API = {
    async detectBackend() {return online ? {available: true, paymentsAvailable: false, authProviders: {google: {available: true}}} : null;},
    async loadSession() {calls.push('session'); return {user: sessionUser};},
    async getArena() {calls.push('arena'); return {user: authenticated ? arenaUser : null, duels: [], history: [], stats: {reserved: 0}};},
    async loginAccount(payload) {calls.push(['login', payload]); authenticated = true; return {user: loginUser};},
    async getAdminOverview() {calls.push('admin-overview'); return {stats: {users: 1, activeMatches: 0, pendingResults: 0, pendingDeposits: 0}, paymentsAvailable: false};},
    async getAdminUsers() {calls.push('admin-users'); return {users: [ordinary], total: 1};},
    async getAdminAudit() {calls.push('admin-audit'); return {entries: []};}
  };
  const sessionStorage = storage(session);
  const context = {
    M, API, COUNTRY_CODES, TERMS_VERSION, adminIcon, accountArt, uiIcon, renderLobbyView, renderWalletView, renderHistoryView, renderRankingView, renderProfileView, createAdminPanel: options => createAdminPanel({...options, storage: sessionStorage}),
    document, location, localStorage: storage(stored), sessionStorage, URL, crypto, console,
    window: {addEventListener(name, callback) {windowListeners[name] = callback;}, scrollTo() {}},
    history: {replaceState(_state, _title, value) {const next = new URL(value, location.href); Object.assign(location, {href: next.href, hash: next.hash, pathname: next.pathname, origin: next.origin});}},
    setTimeout() {return 1;}, clearTimeout() {}, setInterval() {return 2;}, clearInterval() {},
    FormData: class {constructor(form) {this.fields = form.fields;} get(key) {return this.fields[key] ?? null;}}
  };
  vm.createContext(context);
  const code = source.replace(/^import .*?;\r?\n/gm, '').replace(/\nstart\(\)\.catch\(/, '\nglobalThis.__boot=start().catch(');
  vm.runInContext(code, context);
  await context.__boot;
  await settle();
  async function click(action, id) {
    const button = {dataset: {action, id}, disabled: false, isConnected: true};
    await listeners.click({preventDefault() {}, target: {closest: selector => selector === '[data-action]' ? button : null}});
    await settle();
  }
  async function login() {
    await click('login');
    const button = {disabled: false, isConnected: true, setAttribute() {}, removeAttribute() {}};
    const form = {dataset: {form: 'login'}, fields: {nickname: 'Jogador', password: 'a secure passphrase'}, elements: {nickname: {value: 'Jogador'}, password: {value: 'a secure passphrase'}}, querySelectorAll: () => [], querySelector: () => button};
    await listeners.submit({preventDefault() {}, target: {closest: () => form}});
    await settle();
  }
  return {nodes, document, listeners, location, calls, click, login};
}

const privateCalls = calls => calls.filter(call => typeof call === 'string' && call.startsWith('admin-'));
function assertAdmin(h) {
  assert.equal(h.location.hash, '#admin');
  assert.match(h.nodes.navigation.innerHTML, /href='#admin'/);
  assert.equal(h.nodes.breadcrumb.textContent, 'Administração');
  assert.match(h.nodes.screen.innerHTML, /Bem-vindo, administrador/);
  assert.deepEqual(privateCalls(h.calls), ['admin-overview', 'admin-users', 'admin-audit']);
}

test('server-authorized administrators open the private panel from the default arena route', async () => {
  for (const id of ['first-verified-google-admin', 'second-verified-google-admin']) {
    const h = await harness({sessionUser: {...administrator, id}});
    assertAdmin(h);
    assert.deepEqual(h.calls.slice(0, 2), ['session', 'arena']);
  }
});

test('a successful Google callback opens the administrator panel and cleans the callback URL', async () => {
  const h = await harness({sessionUser: administrator, url: 'https://example.test/jogar.html?auth=success#perfil'});
  assertAdmin(h);
  assert.equal(new URL(h.location.href).searchParams.has('auth'), false);
  assert.equal(h.nodes.toast.textContent, 'Bem-vindo, administrador.');
});

test('a successful login uses the server arena role to open the administrator panel', async () => {
  const h = await harness({arenaUser: administrator});
  await h.login();
  assertAdmin(h);
  assert.equal(h.nodes.modal.open, false);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[1])), ['login', {nickname: 'Jogador', password: 'a secure passphrase'}]);
  assert.equal(h.calls[2], 'arena');
});

test('ordinary accounts keep the arena on startup, Google callback, and login', async () => {
  for (const url of ['https://example.test/jogar.html#arena', 'https://example.test/jogar.html?auth=success#arena']) {
    const h = await harness({sessionUser: ordinary, url});
    assert.equal(h.location.hash, '#arena');
    assert.doesNotMatch(h.nodes.navigation.innerHTML, /href='#admin'/);
    assert.deepEqual(privateCalls(h.calls), []);
  }
  const h = await harness({arenaUser: ordinary});
  await h.login();
  assert.equal(h.location.hash, '#arena');
  assert.doesNotMatch(h.nodes.navigation.innerHTML, /href='#admin'/);
  assert.deepEqual(privateCalls(h.calls), []);
});

test('session and login responses cannot override a non-admin role returned by the server arena', async () => {
  const restored = await harness({sessionUser: administrator, arenaUser: ordinary});
  assert.equal(restored.location.hash, '#arena');
  assert.deepEqual(privateCalls(restored.calls), []);
  const signedIn = await harness({arenaUser: ordinary, loginUser: administrator});
  await signedIn.login();
  assert.equal(signedIn.location.hash, '#arena');
  assert.deepEqual(privateCalls(signedIn.calls), []);
});

test('a direct admin route reveals no private data to ordinary or anonymous accounts', async () => {
  for (const sessionUser of [ordinary, null]) {
    const h = await harness({sessionUser, url: 'https://example.test/jogar.html#admin'});
    assert.match(h.nodes.screen.innerHTML, /Painel restrito à administração/);
    assert.doesNotMatch(h.nodes.navigation.innerHTML, /href='#admin'/);
    assert.deepEqual(privateCalls(h.calls), []);
    await h.click('admin-refresh');
    assert.match(h.nodes.toast.textContent, /conta administradora/);
    assert.deepEqual(privateCalls(h.calls), []);
  }
});

test('a forged local admin profile cannot query the private panel without a server session', async () => {
  const initial = M.change(M.emptyState(), 'create', {nickname: 'Administrador'});
  initial.profiles[initial.activeProfileId].isAdmin = true;
  const h = await harness({initial, online: false, url: 'https://example.test/jogar.html#admin'});
  assert.match(h.nodes.screen.innerHTML, /Painel restrito à administração/);
  assert.doesNotMatch(h.nodes.navigation.innerHTML, /href='#admin'/);
  assert.deepEqual(h.calls, []);
});

test('the inline More menu exposes only server-authorized role links and Escape restores focus', async () => {
  for (const [sessionUser, expected] of [[ordinary, []], [{...ordinary, isReviewer: true}, ['#perfil', '#revisao']], [administrator, ['#perfil', '#admin']]]) {
    const h = await harness({sessionUser, url: 'https://example.test/#perfil'});
    const button = h.nodes.navigation.querySelector('.nav-more'), panel = h.nodes.mobileMoreNav;
    assert.equal(!!button, expected.length > 0); assert.equal(!!panel, expected.length > 0);
    if (!panel) {assert.doesNotMatch(h.nodes.navigation.innerHTML, /href='#admin'|href='#revisao'/); continue;}
    assert.equal(panel.hidden, true); assert.equal(panel.getAttribute('role'), 'navigation');
    assert.equal(button.getAttribute('aria-controls'), panel.id); assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(panel.querySelectorAll('a').map(link => link.getAttribute('href')), expected);
    await h.click('nav-more'); assert.equal(panel.hidden, false); assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(h.document.activeElement, panel.querySelector('a'));
    let prevented = false; h.listeners.keydown({key: 'Escape', preventDefault() {prevented = true;}});
    assert.equal(prevented, true); assert.equal(panel.hidden, true); assert.equal(button.getAttribute('aria-expanded'), 'false'); assert.equal(h.document.activeElement, button);
    await h.click('nav-more'); await h.click('refresh');
    assert.equal(panel.isConnected, false); assert.equal(h.nodes.mobileMoreNav.hidden, true); assert.equal(h.nodes.navigation.querySelector('.nav-more').getAttribute('aria-expanded'), 'false');
    assert.deepEqual(privateCalls(h.calls), []);
  }
});

test('refresh removes the More menu when the server no longer authorizes the privileged role', async () => {
  const role = {...administrator}, h = await harness({sessionUser: role, url: 'https://example.test/#perfil'});
  const panel = h.nodes.mobileMoreNav; await h.click('nav-more'); assert.equal(panel.hidden, false);
  role.isAdmin = false; role.isReviewer = false; await h.click('refresh');
  assert.equal(panel.isConnected, false); assert.equal(h.nodes.mobileMoreNav, undefined); assert.equal(h.nodes.navigation.querySelector('.nav-more'), null);
  assert.doesNotMatch(h.nodes.navigation.innerHTML, /href='#admin'|href='#revisao'/); assert.deepEqual(privateCalls(h.calls), []);
  await h.click('nav-more'); assert.equal(h.nodes.mobileMoreNav, undefined);
});
