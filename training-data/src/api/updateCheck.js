// "AADML was updated": a tab opened before a deploy keeps running the code it loaded. Live, 2026-11-18: such a tab could
// not show a saved phone camera's new link (#phonecam=, changed minutes before), and the owner saw no QR code. The page
// reads its own index.html now and then (nginx revalidates it on every load, hashed assets are cached for a year) and
// compares the entry script it names with the one this tab runs. When they differ, or a code chunk fails to load (what
// an old tab meets once the old chunks are gone), it says so and offers a reload. It never reloads by itself: what the
// person is typing is theirs.

const ENTRY = /<script[^>]+type="module"[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/;

// The entry script an index.html names, or '' when it names none.
export function entryOf(html) {
  const found = ENTRY.exec(String(html || ''));
  return found ? found[1] : '';
}

// Whether the page now served is another release than this tab: both are known and they differ. An answer that is not
// the page (an error page, a sign-in redirect) names no entry and changes nothing.
export function isNewRelease(running, served) {
  const path = value => { try { return new URL(value, 'https://x').pathname; } catch { return ''; } };
  return Boolean(running && served && path(running) !== path(served));
}

export const UPDATE_TEXT = 'AADML was updated. Reload to use the latest version; a page opened before an update can miss what it changed.';
export const CHECK_EVERY_MS = 5 * 60 * 1000;

// Starts the check in a browser: on an interval, when the tab is shown again, and on a failed chunk load. The banner is
// plain DOM (it must work on the phone pages too, which are other Vue apps), shown once.
export function watchForUpdates({ doc = globalThis.document, win = globalThis.window, fetchImpl = globalThis.fetch, every = CHECK_EVERY_MS } = {}) {
  if (!doc || !win || typeof fetchImpl !== 'function') return () => {};
  const running = doc.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') || '';
  if (!running) return () => {};                                           // the dev server: nothing to compare
  const page = new URL('./', new URL(running, win.location.href)).pathname.replace(/assets\/$/, '');
  let shown = false;
  function show() {
    if (shown) return;
    shown = true;
    const bar = doc.createElement('div');
    bar.setAttribute('role', 'status');
    bar.className = 'td-update-bar';
    bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;gap:12px;align-items:center;'
      + 'max-width:calc(100vw - 32px);padding:10px 14px;border-radius:10px;background:#1e293b;color:#f8fafc;font:14px/1.45 Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(15,23,42,.25)';
    const text = doc.createElement('span'); text.textContent = UPDATE_TEXT;
    const reload = doc.createElement('button'); reload.type = 'button'; reload.textContent = 'Reload';
    reload.style.cssText = 'flex-shrink:0;border:0;border-radius:7px;padding:6px 12px;background:#f8fafc;color:#1e293b;font:600 13px Inter,system-ui,sans-serif;cursor:pointer';
    reload.addEventListener('click', () => win.location.reload());
    bar.append(text, reload);
    doc.body.append(bar);
  }
  async function check() {
    if (shown) return;
    try {
      const answer = await fetchImpl(page, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'text/html' } });
      if (answer && answer.ok && isNewRelease(running, entryOf(await answer.text()))) show();
    } catch { /* offline or blocked: try again later */ }
  }
  const timer = win.setInterval(check, every);
  const onShow = () => { if (doc.visibilityState === 'visible') check(); };
  doc.addEventListener('visibilitychange', onShow);
  win.addEventListener('vite:preloadError', show);                        // an old chunk is gone: this tab is old
  return () => { win.clearInterval(timer); doc.removeEventListener('visibilitychange', onShow); win.removeEventListener('vite:preloadError', show); };
}
