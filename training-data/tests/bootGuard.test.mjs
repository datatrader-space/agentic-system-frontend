// The boot guard in index.html: a page whose app script does not load, or that shows nothing, is never left blank.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const guard = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function element(tagName) {
  return {
    tagName, children: [], attrs: {}, style: {}, textContent: '',
    hasChildNodes() { return this.children.length > 0; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attrs[name] = value; },
  };
}

function page({ storage = new Map(), storageThrows = false, now = 1_000_000 } = {}) {
  const root = element('DIV');
  const listeners = {}; const timers = []; let reloads = 0;
  const sessionStorage = {
    getItem: key => { if (storageThrows) throw new Error('blocked'); return storage.has(key) ? storage.get(key) : null; },
    setItem: (key, value) => { if (storageThrows) throw new Error('blocked'); storage.set(key, value); },
  };
  const win = {
    sessionStorage,
    location: { reload: () => { reloads += 1; } },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); },
  };
  const doc = { getElementById: id => (id === 'training-data-app' ? root : null), createElement: element };
  const clock = { now };
  vm.runInNewContext(guard, { window: win, document: doc, Date: { now: () => clock.now }, Number, String });
  return {
    root, storage, clock,
    get reloads() { return reloads; },
    scriptFails: (src = 'https://aadml.com/dashboard/training-data/assets/index-old.js') => listeners.error({ target: { tagName: 'SCRIPT', src } }),
    imageFails: () => listeners.error({ target: { tagName: 'IMG', src: 'x.png' } }),
    wait: () => timers.forEach(t => t.fn()),
    timers,
  };
}

const said = p => p.root.children.map(c => c.textContent).join(' ');

test('a script from before an update reloads the page once', () => {
  const p = page();
  p.scriptFails();
  assert.equal(p.reloads, 1);
  assert.equal(p.storage.get('tmd.bootReload'), String(p.clock.now));
  assert.equal(p.root.hasChildNodes(), false);
});

test('it does not reload again within a minute: the page says to reload instead', () => {
  const storage = new Map([['tmd.bootReload', String(1_000_000 - 30_000)]]);
  const p = page({ storage });
  p.scriptFails();
  assert.equal(p.reloads, 0);
  assert.match(said(p), /did not load/);
  assert.equal(p.root.children[1].textContent, 'Reload');
  assert.equal(p.root.attrs.role, 'alert');
  p.root.children[1].onclick();
  assert.equal(p.reloads, 1);
});

test('a minute after the last automatic reload it may reload again', () => {
  const storage = new Map([['tmd.bootReload', String(1_000_000 - 61_000)]]);
  const p = page({ storage });
  p.scriptFails();
  assert.equal(p.reloads, 1);
});

test('blocked storage: no automatic reload, the message instead', () => {
  const p = page({ storageThrows: true });
  p.scriptFails();
  assert.equal(p.reloads, 0);
  assert.match(said(p), /did not load/);
});

test('nothing on the page after 20 seconds is said, with Reload', () => {
  const p = page();
  assert.equal(p.timers[0].ms, 20000);
  p.wait();
  assert.match(said(p), /did not load/);
  assert.equal(p.reloads, 0);
});

test('a page that started is left alone', () => {
  const p = page();
  p.root.appendChild(element('MAIN'));
  p.wait();
  p.scriptFails();
  assert.equal(p.root.children.length, 1);
  assert.equal(p.reloads, 0);
});

test('an image or other file that fails is not a failed page', () => {
  const p = page();
  p.imageFails();
  assert.equal(p.reloads, 0);
  assert.equal(p.root.hasChildNodes(), false);
});

test('the message is said once', () => {
  const storage = new Map([['tmd.bootReload', String(1_000_000)]]);
  const p = page({ storage });
  p.scriptFails(); p.wait(); p.scriptFails();
  assert.equal(p.root.children.length, 2);
});

test('the guard runs before the app script', () => {
  assert.ok(html.indexOf('<script>') < html.indexOf('<script type="module"'));
});
