// ADM-1363: the database connection form. Secrets are write-only: the form never starts with one, an empty field
// keeps what is stored (it is not sent), "clear" sends null; the engine is not sent on an update; encryption is always on (ADM-1369)
// has its warning; a form without what the engine needs says so.
import { describe, expect, it } from 'vitest'
import {
  ENCRYPTION_NOTE, buildPayload, connectionErrorText, defaultPort, emptyForm, formFromProjection, formProblems, lastTestState, normalizeOptions,
} from './databaseConnectionForm'

const ownerProjection = {
  id: 7, name: 'Orders', engine: 'postgres', engine_label: 'PostgreSQL', access: 'read_only', encryption: 'verified',
  host: 'db.example.com', port: 5432, database: 'shop', username: 'reader', has_password: true, has_uri: false,
  ssh: { enabled: true, host: 'bastion.example.com', port: 22, username: 'ops', has_private_key: true, has_key_passphrase: false, has_password: false,
    host_key_fingerprint: 'SHA256:abc', host_key_type: 'ssh-ed25519', host_key_pinned_at: '2026-11-25T08:00:00Z' },
}

describe('a new connection', () => {
  it('starts with the engine default port, no CA certificate and read only', () => {
    const f = emptyForm('mysql')
    expect(f).toMatchObject({ engine: 'mysql', port: 3306, ca_certificate: '', access: 'read_only', password: '' })
    expect(f).not.toHaveProperty('tls_mode')
    expect(defaultPort('redis')).toBe(6379)
    expect(defaultPort('mssql', [{ value: 'mssql', default_port: 11433 }])).toBe(11433)
  })

  it('sends the engine, the workspace and a typed password', () => {
    const f = { ...emptyForm('postgres'), name: ' Orders ', host: 'db.example.com', database: 'shop', username: 'reader', password: 's3cret' }
    expect(buildPayload(f, { workspace: 4 })).toEqual({
      name: 'Orders', engine: 'postgres', workspace: 4, ca_certificate: '', access: 'read_only',
      host: 'db.example.com', port: 5432, database: 'shop', username: 'reader', password: 's3cret',
    })
  })

  it('says what is missing', () => {
    expect(formProblems(emptyForm('postgres'))).toEqual({ name: 'Give the connection a name.', host: 'Give the host name or address.', database: 'Give the database name.' })
    const mongo = { ...emptyForm('mongodb'), name: 'M', uri: 'http://x' }
    expect(formProblems(mongo).uri).toMatch(/mongodb:\/\//)
    const ssh = { ...emptyForm('postgres'), name: 'P', host: 'h', database: 'd', ssh: { ...emptyForm().ssh, enabled: true } }
    expect(Object.keys(formProblems(ssh))).toEqual(['ssh.host', 'ssh.username', 'ssh.private_key'])
  })
})

describe('an existing connection', () => {
  it('never starts with a secret, and says which are saved', () => {
    const f = formFromProjection(ownerProjection)
    expect(f.password).toBe('')
    expect(f.has_password).toBe(true)
    expect(f.ssh.private_key).toBe('')
    expect(f.ssh.has_private_key).toBe(true)
    expect(f.ssh.host_key_fingerprint).toBe('SHA256:abc')
    expect(JSON.stringify(f)).not.toMatch(/s3cret/)
  })

  it('an empty secret is kept (not sent), clear sends null, and the engine is not sent', () => {
    const f = formFromProjection(ownerProjection)
    const keep = buildPayload(f, { editing: true })
    expect(keep).not.toHaveProperty('password')
    expect(keep).not.toHaveProperty('engine')
    expect(keep.ssh).toEqual({ enabled: true, host: 'bastion.example.com', port: 22, username: 'ops' })

    f.clear_password = true
    f.ssh.reset_host_key = true
    const cleared = buildPayload(f, { editing: true })
    expect(cleared.password).toBeNull()
    expect(cleared.ssh.reset_host_key).toBe(true)
  })

  it('turning the tunnel off is sent; switching SSH to a password clears the saved key', () => {
    const f = formFromProjection(ownerProjection)
    f.ssh.enabled = false
    expect(buildPayload(f, { editing: true }).ssh).toEqual({ enabled: false })
    const g = formFromProjection(ownerProjection)
    g.ssh.auth = 'password'
    g.ssh.password = 'pw'
    expect(buildPayload(g, { editing: true }).ssh).toMatchObject({ password: 'pw', private_key: null })
  })

  it('a MongoDB connection string is a secret too', () => {
    const f = { ...emptyForm('mongodb'), name: 'M', uri: 'mongodb+srv://u:p@c.example.net/' }
    expect(buildPayload(f)).toMatchObject({ engine: 'mongodb', uri: 'mongodb+srv://u:p@c.example.net/' })
    const saved = formFromProjection({ id: 2, name: 'M', engine: 'mongodb', has_uri: true })
    expect(saved.uri).toBe('')
    expect(formProblems(saved, { editing: true })).toEqual({})
    expect(buildPayload(saved, { editing: true })).not.toHaveProperty('uri')
  })
})

describe('what the page says', () => {
  it('says encryption is always on and checked (ADM-1369)', () => {
    expect(ENCRYPTION_NOTE).toMatch(/Always encrypted/)
    expect(ENCRYPTION_NOTE).toMatch(/certificate and name are checked/)
  })

  it('reads the server\'s option lists in any of their shapes', () => {
    expect(normalizeOptions(['require', 'disable'], [{ value: 'require', label: 'Require' }])).toEqual([
      { value: 'require', label: 'Require' }, { value: 'disable', label: 'disable' }])
    expect(normalizeOptions([['a', 'A']])).toEqual([{ value: 'a', label: 'A' }])
    expect(normalizeOptions(null, [{ value: 'x', label: 'X' }])).toEqual([{ value: 'x', label: 'X' }])
  })

  it('names the last test and the server\'s refusals', () => {
    expect(lastTestState(null)).toEqual({ text: 'Not tested yet', tone: 'muted' })
    expect(lastTestState({ at: '2026-11-25T08:00:00Z', ok: false }).tone).toBe('bad')
    expect(connectionErrorText({ response: { status: 503, data: {} } }, 'x')).toMatch(/worker is not running/)
    expect(connectionErrorText({ response: { status: 403, data: {} } }, 'x')).toMatch(/owner/)
    expect(connectionErrorText({ response: { status: 400, data: { error: 'Private address refused.', field: 'host' } } }, 'x')).toBe('Private address refused.')
  })
})
