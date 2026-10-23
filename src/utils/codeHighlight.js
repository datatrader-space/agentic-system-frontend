// Syntax highlighting for code blocks in rendered answers. highlight.js's "common" build (~40 languages) is
// loaded the first time a rendered message holds a code block, never with the page. It reads each block's
// text and writes escaped, highlighted markup back, so it cannot introduce HTML of its own.
let loading = null

function load() {
  if (!loading) {
    loading = Promise.all([import('highlight.js/lib/common'), import('highlight.js/styles/github-dark-dimmed.css')])
      .then(([mod]) => mod.default || mod)
      .catch(() => { loading = null; return null })
  }
  return loading
}

/** Highlight every not-yet-highlighted `<pre><code>` inside `root`. Safe to call repeatedly. */
export async function highlightCodeIn(root) {
  if (!root || !root.querySelector) return
  const blocks = [...root.querySelectorAll('pre code:not(.hljs)')]
  if (!blocks.length) return
  const hljs = await load()
  if (!hljs) return
  for (const el of blocks) {
    if (!el.isConnected || el.classList.contains('hljs')) continue
    const lang = (/(?:^|\s)language-([\w+#.-]+)/.exec(el.className) || [])[1]
    try {
      if (lang && !hljs.getLanguage(lang)) {
        el.classList.add('hljs')        // an unknown language stays plain rather than being guessed at
        continue
      }
      hljs.highlightElement(el)
    } catch { /* leave the block as plain text */ }
  }
}
