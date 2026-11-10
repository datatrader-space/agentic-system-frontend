// Which Monaco language a file opens in (ADM-1200).
//
// The editor kept its own 17-entry map, so Go, Rust, Java, PHP, C/C++, Dockerfile, TOML and the rest opened as
// plain text although Monaco highlights about 90 languages. The list now comes from Monaco itself
// (`monaco.languages.getLanguages()`: each language's extensions, exact file names and name patterns). Monaco loads
// lazily, so until it has, a short list covers the common files; a tab opened before then is re-labelled.

// Before Monaco has loaded, and for files Monaco has no language for.
const FALLBACK = {
  py: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown', html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less', yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql',
  sh: 'shell', bash: 'shell',
  // Monaco has no Vue grammar; HTML highlights its template, style and script blocks best.
  vue: 'html',
}

function globToRegExp(glob) {
  const body = String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${body}$`, 'i')
}

// `languages`: Monaco's `getLanguages()` (or null while Monaco is loading).
export function languageFor(filePath, languages = null) {
  const name = String(filePath || '').split('/').pop()
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot + 1) : ''
  if (ext === 'vue') return FALLBACK.vue
  if (Array.isArray(languages) && languages.length) {
    for (const lang of languages) {                       // an exact file name wins: Dockerfile, Makefile
      if ((lang.filenames || []).some((f) => String(f).toLowerCase() === lower)) return lang.id
    }
    for (const lang of languages) {
      if ((lang.filenamePatterns || []).some((p) => globToRegExp(p).test(name))) return lang.id
    }
    if (ext) {
      // Several languages can claim one extension; the most specific claim (the longest) is the one meant.
      let best = null
      for (const lang of languages) {
        for (const e of lang.extensions || []) {
          const le = String(e).toLowerCase()
          if (lower.endsWith(le) && le.length > 1 && (!best || le.length > best.len)) best = { id: lang.id, len: le.length }
        }
      }
      if (best) return best.id
    }
  }
  return FALLBACK[ext] || 'plaintext'
}
