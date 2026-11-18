// "AADML was updated": a tab opened before a deploy says so and offers a reload (src/api/updateCheck.js). Live,
// 2026-11-18: an old tab could not show a new phone camera link and the owner saw no QR code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryOf, isNewRelease, watchForUpdates, UPDATE_TEXT } from '../src/api/updateCheck.js';

const page = src => `<!doctype html><html><head><script type="module" crossorigin src="${src}"></script></head><body></body></html>`;
const OLD = '/dashboard/training-data/assets/index-OLD11111.js';
const NEW = '/dashboard/training-data/assets/index-NEW22222.js';

test('the entry script is read from the page, and only a real other release counts', () => {
  assert.equal(entryOf(page(NEW)), NEW);
  assert.equal(entryOf('<html>Sign in</html>'), '');
  assert.equal(entryOf(null), '');
  assert.equal(isNewRelease(OLD, NEW), true);
  assert.equal(isNewRelease(OLD, OLD), false);
  assert.equal(isNewRelease(`https://aadml.com${OLD}`, OLD), false);             // same file, other form
  assert.equal(isNewRelease(OLD, ''), false);                                    // an error page changes nothing
  assert.equal(isNewRelease('', NEW), false);
});

function fakes(served, { ok = true } = {}) {
  const listeners = {}; const winListeners = {}; const appended = []; const asked = []; let interval = null; let reloaded = 0;
  const el = () => ({ attrs: {}, style: {}, children: [], textContent: '', listeners: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.children.push(...c); },
    addEventListener(k, f) { this.listeners[k] = f; } });
  const doc = {
    visibilityState: 'visible',
    querySelector: () => ({ getAttribute: () => OLD }),
    createElement: el, body: { append: x => appended.push(x) },
    addEventListener: (k, f) => { listeners[k] = f; }, removeEventListener: k => { delete listeners[k]; },
  };
  const win = {
    location: { href: 'https://aadml.com/dashboard/training-data/#models', reload: () => { reloaded++; } },
    setInterval: f => { interval = f; return 1; }, clearInterval: () => { interval = null; },
    addEventListener: (k, f) => { winListeners[k] = f; }, removeEventListener: k => { delete winListeners[k]; },
  };
  const fetchImpl = async (url, init) => { asked.push({ url, init }); return { ok, text: async () => served }; };
  return { doc, win, fetchImpl, appended, asked, tick: () => interval(), show: () => listeners.visibilitychange(),
    preloadError: () => winListeners['vite:preloadError'](), reloads: () => reloaded };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('a newer release served shows one notice with Reload; the same release shows nothing', async () => {
  const same = fakes(page(OLD));
  watchForUpdates(same);
  same.tick(); await settle();
  assert.equal(same.appended.length, 0);
  assert.equal(same.asked[0].url, '/dashboard/training-data/');                   // the page itself, not cached
  assert.equal(same.asked[0].init.cache, 'no-store');

  const newer = fakes(page(NEW));
  watchForUpdates(newer);
  newer.show(); await settle();                                                    // the tab is shown again
  newer.tick(); await settle();
  assert.equal(newer.appended.length, 1);                                          // once
  const [bar] = newer.appended;
  assert.equal(bar.attrs.role, 'status');
  assert.equal(bar.children[0].textContent, UPDATE_TEXT);
  assert.equal(newer.reloads(), 0);                                                // never by itself
  bar.children[1].listeners.click();
  assert.equal(newer.reloads(), 1);
});

test('a failed chunk load shows the notice; an error answer or the dev server shows nothing', async () => {
  const gone = fakes(page(OLD));
  watchForUpdates(gone);
  gone.preloadError();
  assert.equal(gone.appended.length, 1);
  const failing = fakes(page(NEW), { ok: false });
  watchForUpdates(failing);
  failing.tick(); await settle();
  assert.equal(failing.appended.length, 0);
  const dev = fakes(page(NEW));
  dev.doc.querySelector = () => null;                                              // /src/main.js, no hashed entry
  watchForUpdates(dev);
  assert.equal(dev.asked.length, 0);
});
