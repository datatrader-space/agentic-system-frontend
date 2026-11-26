// The database connection form's rules (ADM-1363), pure: no Vue, no requests.
//
// SECRETS ARE WRITE-ONLY. The server never sends a password, connection string, SSH key or passphrase back (the
// projection says only has_password, has_uri, ...). The form starts every secret empty, and the payload follows the
// API's rule: a non-empty string sets the value, null clears it, and a missing key keeps what is stored. So an empty
// field is never sent as "" or null by accident: it is left out, unless the person ticked "clear".

export const ENGINE_FALLBACK = Object.freeze([
  { value: 'postgres', label: 'PostgreSQL', default_port: 5432 },
  { value: 'mysql', label: 'MySQL / MariaDB', default_port: 3306 },
  { value: 'mssql', label: 'Microsoft SQL Server', default_port: 1433 },
  { value: 'mongodb', label: 'MongoDB', default_port: 27017 },
  { value: 'redis', label: 'Redis', default_port: 6379 },
])
export const ACCESS_FALLBACK = Object.freeze([
  { value: 'read_only', label: 'Read only' },
  { value: 'read_write', label: 'Read and write' },
])

// Every connection is encrypted and checks the server's certificate and name (ADM-1369); there is no mode to choose.
export const ENCRYPTION_NOTE = 'Always encrypted (TLS 1.2 or later). The server\'s certificate and name are checked against the public authorities, the AWS RDS authorities and, when you add one, your own CA certificate.'

/** The server's option list (strings, [value, label] pairs or { value, label }) as [{ value, label, ... }]. */
export function normalizeOptions(list, fallback = []) {
  if (!Array.isArray(list) || !list.length) return [...fallback]
  return list.map((o) => {
    if (Array.isArray(o)) return { value: o[0], label: o[1] ?? String(o[0]) }
    if (o && typeof o === 'object') return { ...o, value: o.value, label: o.label ?? String(o.value) }
    const known = fallback.find((f) => f.value === o)
    return known ? { ...known } : { value: o, label: String(o) }
  })
}

export const isSql = (engine) => ['postgres', 'mysql', 'mssql'].includes(engine)

/** The engine's default port, from the server's list. */
export function defaultPort(engine, engines = ENGINE_FALLBACK) {
  const e = engines.find((x) => x.value === engine) || ENGINE_FALLBACK.find((x) => x.value === engine)
  return e?.default_port ?? ''
}

function blankSsh() {
  return {
    enabled: false, host: '', port: 22, username: '', auth: 'key',
    private_key: '', key_passphrase: '', password: '',
    clear_private_key: false, clear_key_passphrase: false, clear_password: false,
    reset_host_key: false,
    has_private_key: false, has_key_passphrase: false, has_password: false,
    host_key_fingerprint: '', host_key_type: '', host_key_pinned_at: '',
  }
}

/** A new connection's form. */
export function emptyForm(engine = 'postgres', engines = ENGINE_FALLBACK) {
  return {
    name: '', engine, host: '', port: defaultPort(engine, engines), database: '', username: '',
    password: '', clear_password: false, has_password: false,
    mongo_mode: 'uri', uri: '', clear_uri: false, has_uri: false,
    ca_certificate: '', access: 'read_only',
    ssh: blankSsh(),
  }
}

/** The form for an existing connection (the owner's projection), every secret empty. */
export function formFromProjection(p, engines = ENGINE_FALLBACK) {
  const f = emptyForm(p.engine, engines)
  Object.assign(f, {
    name: p.name || '', engine: p.engine, host: p.host || '', port: p.port ?? defaultPort(p.engine, engines),
    database: p.database ?? '', username: p.username || '',
    has_password: !!p.has_password, has_uri: !!p.has_uri,
    mongo_mode: p.engine === 'mongodb' && !p.has_uri && p.host ? 'host' : 'uri',
    ca_certificate: p.ca_certificate || '', access: p.access || 'read_only',
  })
  const s = p.ssh || {}
  Object.assign(f.ssh, {
    enabled: !!(s.enabled ?? p.ssh_enabled), host: s.host || '', port: s.port ?? 22, username: s.username || '',
    auth: s.has_password && !s.has_private_key ? 'password' : 'key',
    has_private_key: !!s.has_private_key, has_key_passphrase: !!s.has_key_passphrase, has_password: !!s.has_password,
    host_key_fingerprint: s.host_key_fingerprint || '', host_key_type: s.host_key_type || '', host_key_pinned_at: s.host_key_pinned_at || '',
  })
  return f
}

/** A secret's payload entry: [key, value] to send, or null to send nothing (keep what is stored). */
function secret(value, clear) {
  if (clear) return null
  return typeof value === 'string' && value !== '' ? value : undefined
}
function putSecret(out, key, value, clear) {
  const v = secret(value, clear)
  if (v !== undefined) out[key] = v
}

/** Problems with the form, { field: message }; empty when it can be sent. */
export function formProblems(f, { editing = false } = {}) {
  const p = {}
  if (!String(f.name || '').trim()) p.name = 'Give the connection a name.'
  const usesUri = f.engine === 'mongodb' && f.mongo_mode === 'uri'
  if (usesUri) {
    if (!editing && !f.uri) p.uri = 'Paste the connection string.'
    if (editing && !f.has_uri && !f.uri) p.uri = 'Paste the connection string.'
    if (f.uri && !/^mongodb(\+srv)?:\/\//.test(f.uri)) p.uri = 'A MongoDB connection string starts with mongodb:// or mongodb+srv://.'
  } else {
    if (!String(f.host || '').trim()) p.host = 'Give the host name or address.'
    const port = Number(f.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) p.port = 'A port is a whole number from 1 to 65535.'
    if (isSql(f.engine) && !String(f.database || '').trim()) p.database = 'Give the database name.'
  }
  if (f.ssh.enabled) {
    if (!String(f.ssh.host || '').trim()) p['ssh.host'] = 'Give the SSH host.'
    const sp = Number(f.ssh.port)
    if (!Number.isInteger(sp) || sp < 1 || sp > 65535) p['ssh.port'] = 'A port is a whole number from 1 to 65535.'
    if (!String(f.ssh.username || '').trim()) p['ssh.username'] = 'Give the SSH user.'
    if (f.ssh.auth === 'key' && !f.ssh.private_key && !f.ssh.has_private_key) p['ssh.private_key'] = 'Upload or paste the private key.'
    if (f.ssh.auth === 'password' && !f.ssh.password && !f.ssh.has_password) p['ssh.password'] = 'Give the SSH password.'
  }
  return p
}

/** The request body for create (`editing` false) or update. The engine is never sent on an update (it cannot change). */
export function buildPayload(f, { editing = false, workspace = null } = {}) {
  const out = { name: String(f.name || '').trim(), ca_certificate: String(f.ca_certificate || '').trim(), access: f.access }
  if (!editing) {
    out.engine = f.engine
    if (workspace !== null && workspace !== undefined && workspace !== '') out.workspace = workspace
  }
  const usesUri = f.engine === 'mongodb' && f.mongo_mode === 'uri'
  if (usesUri) {
    putSecret(out, 'uri', f.uri, f.clear_uri)
    if (String(f.database || '').trim()) out.database = String(f.database).trim()
  } else {
    out.host = String(f.host || '').trim()
    out.port = Number(f.port)
    out.database = String(f.database ?? '').trim()   // Redis: the database number, empty for 0
    out.username = String(f.username || '').trim()
    putSecret(out, 'password', f.password, f.clear_password)
    if (f.engine === 'mongodb' && f.has_uri) out.uri = null          // switched from a connection string to a host
  }
  const s = f.ssh
  if (s.enabled) {
    const ssh = { enabled: true, host: String(s.host || '').trim(), port: Number(s.port), username: String(s.username || '').trim() }
    if (s.auth === 'key') {
      putSecret(ssh, 'private_key', s.private_key, s.clear_private_key)
      putSecret(ssh, 'key_passphrase', s.key_passphrase, s.clear_key_passphrase)
      if (s.has_password) ssh.password = null                       // one way in: the key
    } else {
      putSecret(ssh, 'password', s.password, s.clear_password)
      if (s.has_private_key) ssh.private_key = null
      if (s.has_key_passphrase) ssh.key_passphrase = null
    }
    if (s.reset_host_key) ssh.reset_host_key = true
    out.ssh = ssh
  } else if (editing) {
    out.ssh = { enabled: false }
  }
  return out
}

/** "Read only" / "Read and write". */
export const accessLabel = (access) => (access === 'read_write' ? 'Read and write' : 'Read only')

/** A connection's last test as a word and a tone: { text, tone: 'ok' | 'bad' | 'muted' }. */
export function lastTestState(lastTest) {
  if (!lastTest || !lastTest.at) return { text: 'Not tested yet', tone: 'muted' }
  const at = new Date(lastTest.at)
  const when = Number.isNaN(at.getTime()) ? '' : ` ${at.toLocaleString()}`
  return lastTest.ok ? { text: `Test passed${when}`, tone: 'ok' } : { text: `Test failed${when}`, tone: 'bad' }
}

/** The sentence for a failed request, in the server's words (403 and 503 said plainly). */
export function connectionErrorText(err, fallback) {
  const d = err?.response?.data
  const status = err?.response?.status
  if (d && (d.error || d.detail)) return String(d.error || d.detail)
  if (status === 403) return 'Only the connection\'s owner can change it.'
  if (status === 404) return 'This connection is not one you can use.'
  if (status === 503) return 'The database worker is not running, so nothing can connect right now. Try again later.'
  if (status) return `${fallback} (error ${status}).`
  return `${fallback}. Check your connection.`
}

// "Trust this server's certificate" (ADM-1374). A failed test carries `certificate` for the owner: the chain the
// server presented (its own first), the one that can be pinned (`pin`, `fingerprint`) or why none can (`reason`), and
// `scope`, what trusting it will accept, in words.

/** The rows shown for one described certificate ({ issued_to, issued_by, not_after, names, ... }). */
export function certificateRows(cert) {
  if (!cert || typeof cert !== 'object') return []
  const rows = [
    { label: 'Issued to', value: cert.issued_to || cert.subject || '' },
    { label: 'Issued by', value: cert.self_signed ? 'itself (self-signed)' : (cert.issued_by || cert.issuer || '') },
    { label: 'Valid until', value: shortDate(cert.not_after) + (cert.expired ? ' (expired)' : '') },
  ]
  if (Array.isArray(cert.names) && cert.names.length) rows.push({ label: 'For', value: cert.names.join(', ') })
  return rows.filter((r) => r.value)
}

/** Whether the certificate to pin is the server's own one (else it is the authority the server sends). */
export function pinsServerCertificate(certificate) {
  const own = certificate?.chain?.[0]?.fingerprint_sha256
  return !!own && own === certificate?.fingerprint
}

function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
