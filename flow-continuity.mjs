const MAX_TTL = 15 * 60 * 1000;
const FLOW_KEY = 'fifago-pending-flow-v1';
const ACTIONS = new Set(['create', 'join-code', 'deposit', 'rematch']);
const ENUM_FIELDS = {
  mode: ['1v1', 'Ultimate Team', 'Clubes'],
  platform: ['pc', 'playstation', 'xbox', 'switch'],
  visibility: ['public', 'private'],
  crossplay: ['any', 'enabled', 'disabled'],
};
const TEXT_LIMITS = {rules: 240, gameEdition: 40, consoleGeneration: 40};
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const duration = value => Number.isSafeInteger(value) && value > 0 ? Math.min(value, MAX_TTL) : MAX_TTL;
const timestamp = now => {
  try { const value = now(); return Number.isSafeInteger(value) && value >= 0 ? value : null; }
  catch { return null; }
};
function defaultStorage() { try { return globalThis.sessionStorage; } catch { return undefined; } }

function sanitizeDraft(value) {
  if (!plain(value)) return null;
  const draft = {};
  for (const [field, values] of Object.entries(ENUM_FIELDS)) {
    if (!Object.hasOwn(value, field)) continue;
    if (!values.includes(value[field])) return null;
    draft[field] = value[field];
  }
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (!Object.hasOwn(value, field)) continue;
    const text = value[field];
    if (typeof text !== 'string' || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) return null;
    draft[field] = text;
  }
  if (Object.hasOwn(value, 'rival')) {
    if (typeof value.rival !== 'string' || value.rival.length > 18) return null;
    const rival = value.rival.trim().toUpperCase();
    if (rival && !/^FBA-(?:[A-F0-9]{8}|[A-F0-9]{10})$/.test(rival)) return null;
    draft.rival = rival;
  }
  if (Object.hasOwn(value, 'stake')) {
    const stake = value.stake;
    if (typeof stake !== 'number' && typeof stake !== 'string') return null;
    if (typeof stake === 'string' && !/^\d{1,4}$/.test(stake)) return null;
    const number = Number(stake);
    if (!Number.isSafeInteger(number) || number < 0 || number > 5000) return null;
    draft.stake = stake;
  }
  for (const field of ['extraTime', 'penalties']) {
    if (!Object.hasOwn(value, field)) continue;
    if (typeof value[field] !== 'boolean') return null;
    draft[field] = value[field];
  }
  return draft;
}
function sanitizeIntent(value) {
  if (!plain(value) || !ACTIONS.has(value.action)) return null;
  const intent = {action: value.action};
  if (Object.hasOwn(value, 'draft')) {
    intent.draft = sanitizeDraft(value.draft);
    if (!intent.draft) return null;
  }
  if (Object.hasOwn(value, 'joinCode')) {
    if (typeof value.joinCode !== 'string' || value.joinCode.length > 32) return null;
    const code = value.joinCode.trim().toUpperCase();
    if (!/^FG-[A-F0-9]{10}$/.test(code)) return null;
    intent.joinCode = code;
  }
  return intent;
}

/** Save only a short-lived, allowlisted navigation intent in this tab's session storage. */
export function createPendingFlow({storage = defaultStorage(), now = Date.now, ttlMs = MAX_TTL} = {}) {
  const ttl = duration(ttlMs);
  let memory = null, storageAvailable = Boolean(storage);
  const clear = () => {
    memory = null;
    try { storage?.removeItem(FLOW_KEY); } catch { storageAvailable = false; }
  };
  const envelope = value => {
    const time = timestamp(now);
    if (time === null || !plain(value) || value.version !== 1 || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0 || value.createdAt > time || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= time || value.expiresAt <= value.createdAt || value.expiresAt - value.createdAt > ttl) return null;
    const intent = sanitizeIntent(value.intent);
    return intent ? {...value, intent} : null;
  };
  return {
    save(value) {
      let intent;
      try { intent = sanitizeIntent(value); } catch { intent = null; }
      const time = timestamp(now);
      if (!intent || time === null || !Number.isSafeInteger(time + ttl)) { clear(); return false; }
      memory = {version: 1, createdAt: time, expiresAt: time + ttl, intent};
      if (storageAvailable) {
        try { storage.setItem(FLOW_KEY, JSON.stringify(memory)); }
        catch {
          storageAvailable = false;
          try { storage.removeItem(FLOW_KEY); } catch {}
        }
      }
      return true;
    },
    read() {
      let value = memory;
      if (storageAvailable) {
        try {
          const raw = storage.getItem(FLOW_KEY);
          if (raw === null) value = null;
          else if (typeof raw !== 'string' || raw.length > 4096) { clear(); return null; }
          else {
            try { value = JSON.parse(raw); } catch { clear(); return null; }
          }
        } catch { storageAvailable = false; }
      }
      try {
        const valid = envelope(value);
        if (!valid) { clear(); return null; }
        return valid.intent;
      } catch { clear(); return null; }
    },
    clear,
  };
}

const identity = value => typeof value === 'string' && value.length <= 160 && value.trim() ? value : null;

/** Private photos remain memory-only; clear on logout/account change. Reads do not renew expiry. */
export function createResultDraftStore({now = Date.now, ttlMs = MAX_TTL, maxEntries = 3} = {}) {
  const ttl = duration(ttlMs), limit = Number.isSafeInteger(maxEntries) && maxEntries > 0 ? Math.min(maxEntries, 20) : 3;
  const entries = new Map();
  const key = (owner, id) => identity(owner) && identity(id) ? JSON.stringify([owner, id]) : null;
  const prune = () => {
    const time = timestamp(now);
    if (time === null) { entries.clear(); return null; }
    for (const [id, entry] of entries) if (entry.expiresAt <= time || entry.createdAt > time) entries.delete(id);
    return time;
  };
  return {
    put(owner, id, value) {
      const time = prune(), entryKey = key(owner, id);
      if (time === null || !entryKey || value === null || typeof value !== 'object' || !Number.isSafeInteger(time + ttl)) return false;
      entries.delete(entryKey);
      entries.set(entryKey, {value, createdAt: time, expiresAt: time + ttl});
      while (entries.size > limit) entries.delete(entries.keys().next().value);
      return true;
    },
    get(owner, id) { prune(); return entries.get(key(owner, id))?.value ?? null; },
    delete(owner, id) { return entries.delete(key(owner, id)); },
    clear() { entries.clear(); },
  };
}
