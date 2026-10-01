import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as M from './model.mjs';
import {createAdminPanel, adminIcon} from './admin-panel.mjs';
import {accountArt, accountIcon} from './account-art.mjs';

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
  function node(id) {
    return nodes[id] ??= {
      id, innerHTML: '', textContent: '', value: '', hidden: false, open: false, isConnected: true, disabled: false, dataset: {},
      classList: {add() {}, remove() {}}, focus() {document.activeElement = this;},
      showModal() {this.open = true;}, close() {this.open = false;},
      addEventListener(name, callback) {this[name] = callback;}
    };
  }
  const document = {getElementById: id => id === 'roomError' ? null : node(id), activeElement: null, addEventListener(name, callback) {listeners[name] = callback;}};
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
    M, API, adminIcon, accountArt, accountIcon, createAdminPanel: options => createAdminPanel({...options, storage: sessionStorage}),
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
    await listeners.click({preventDefault() {}, target: {closest: selector => selector === '.skip-link' ? null : button}});
    await settle();
  }
  async function login() {
    await click('login');
    const button = {disabled: false, isConnected: true, setAttribute() {}, removeAttribute() {}};
    const form = {dataset: {form: 'login'}, fields: {nickname: 'Jogador', password: 'a secure passphrase'}, elements: {nickname: {value: 'Jogador'}, password: {value: 'a secure passphrase'}}, querySelectorAll: () => [], querySelector: () => button};
    await listeners.submit({preventDefault() {}, target: {closest: () => form}});
    await settle();
  }
  return {nodes, location, calls, click, login};
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
