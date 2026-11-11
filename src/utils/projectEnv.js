// A Let's Code project's environment variables (ADM-1205 phase D): the name check the server makes
// (agent/services/project_env.py, which checks again and decides), and reading a pasted .env file.

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/
const RESERVED = new Set([
  'PATH', 'HOME', 'SHELL', 'USER', 'LOGNAME', 'PWD', 'OLDPWD', 'IFS', 'ENV', 'BASH_ENV', 'ZDOTDIR', 'CDPATH',
  'PS1', 'PS2', 'PS3', 'PS4', 'PROMPT_COMMAND', 'PROMPT', 'TERM', 'COLORTERM', 'SHLVL', 'HOSTNAME', 'TMPDIR',
  'BROWSER', 'GLOBIGNORE', 'HISTFILE', 'MAIL', 'MAILPATH', 'SSH_AUTH_SOCK', 'SSH_ASKPASS', 'SUDO_ASKPASS',
])
const RESERVED_PREFIXES = ['LD_', 'GIT_', 'AADML_', 'BASH_FUNC', 'DAYTONA_', 'NORTHRAYS_']

// '' when `key` can be saved, else why not.
export function checkEnvKey(key) {
  const k = String(key || '').trim()
  if (!KEY_RE.test(k)) return 'Use letters, digits and _ only, not starting with a digit (at most 128 characters).'
  const up = k.toUpperCase()
  if (RESERVED.has(up) || RESERVED_PREFIXES.some((p) => up.startsWith(p))) {
    return `${k} is set by the sandbox or the terminal and cannot be changed here.`
  }
  return ''
}

// { values: { KEY: value }, skipped: n } from a .env file's text: `KEY=value` lines, `export ` allowed, blank lines
// and `#` comments ignored; a value in "double" quotes keeps its \n escapes as new lines, one in 'single' quotes is
// kept as it is, an unquoted one loses a trailing ` # comment`. A line that is none of these is counted as skipped.
export function parseDotEnv(text) {
  const values = {}
  let skipped = 0
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) { skipped += 1; continue }
    let value = m[2]
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '').trim()
    }
    values[m[1]] = value
  }
  return { values, skipped }
}
