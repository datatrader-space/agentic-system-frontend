/*!
 * AgentChat webchat widget (Botpress inject.js-equivalent).
 * Embed on any site:
 *   <script src="https://YOURHOST/webchat/widget.js"></script>
 *   <script>AgentChat.init({ token: "pk-...", mode: "bubble" });</script>
 * mode: "bubble" (floating launcher, default) | "embedded" (mount into target, default "#agent-chat").
 * Renders the chat in an iframe (/embed/<token>) so the host page CSS can't clash, and the
 * chat WS authenticates with the public share token. Reads branding from the public config.
 */
(function () {
  'use strict';
  var script = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var ORIGIN = (function () { try { return new URL(script.src).origin; } catch (e) { return window.location.origin; } })();

  var st = { token: null, mode: 'bubble', target: '#agent-chat', cfg: null, open: false, panel: null, launcher: null, proactiveEl: null };

  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
  function iframeSrc() { return ORIGIN + '/embed/' + encodeURIComponent(st.token); }

  function buildPanel() {
    var p = el('div', 'position:fixed;bottom:90px;right:20px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18);overflow:hidden;z-index:2147483000;display:none;');
    var f = el('iframe', 'width:100%;height:100%;border:0;'); f.src = iframeSrc(); f.allow = 'microphone';
    p.appendChild(f); document.body.appendChild(p); st.panel = p;
  }
  function buildLauncher() {
    var color = (st.cfg && st.cfg.theme_color) || '#4f46e5';
    var img = st.cfg && st.cfg.button_image_url;
    var b = el('button', 'position:fixed;bottom:20px;right:20px;width:56px;height:56px;border:none;border-radius:50%;background:' + color + ';color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.22);z-index:2147483000;display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;',
      img ? '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover"/>' : '💬');
    b.onclick = toggle; document.body.appendChild(b); st.launcher = b;
  }
  function showProactive() {
    var pr = st.cfg && st.cfg.proactive;
    if (!pr || !pr.enabled || !pr.text) return;
    setTimeout(function () {
      if (st.open) return;
      var bub = el('div', 'position:fixed;bottom:86px;right:20px;max-width:260px;background:#fff;border:1px solid #eee;border-radius:14px;padding:10px 12px;font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:2147483000;cursor:pointer;', pr.text);
      bub.onclick = function () { open(); if (bub.parentNode) bub.remove(); };
      document.body.appendChild(bub); st.proactiveEl = bub;
      setTimeout(function () { if (bub.parentNode) bub.remove(); }, 12000);
    }, (pr.delay_s || 4) * 1000);
  }
  function open() { if (!st.panel) buildPanel(); st.panel.style.display = 'block'; st.open = true; if (st.proactiveEl && st.proactiveEl.parentNode) st.proactiveEl.remove(); }
  function close() { if (st.panel) st.panel.style.display = 'none'; st.open = false; }
  function toggle() { st.open ? close() : open(); }
  function mountEmbedded() {
    var t = typeof st.target === 'string' ? document.querySelector(st.target) : st.target;
    if (!t) { console.warn('[AgentChat] target not found:', st.target); return; }
    var f = el('iframe', 'width:100%;height:100%;min-height:480px;border:0;'); f.src = iframeSrc(); t.appendChild(f);
  }
  function init(opts) {
    opts = opts || {}; st.token = opts.token; st.mode = opts.mode || 'bubble'; st.target = opts.target || '#agent-chat';
    if (!st.token) { console.warn('[AgentChat] missing token'); return; }
    fetch(ORIGIN + '/api/public/agents/' + encodeURIComponent(st.token) + '/config.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        st.cfg = cfg || {};
        if (cfg && cfg.offline) { console.warn('[AgentChat] agent is offline'); return; }
        if (st.mode === 'embedded') mountEmbedded();
        else { buildLauncher(); showProactive(); }
      })
      .catch(function () { /* network */ });
  }
  window.AgentChat = { init: init, open: open, close: close, toggle: toggle };
})();
