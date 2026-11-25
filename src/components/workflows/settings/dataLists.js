// The lists the Data steps' pickers read (ADM-1363), loaded once per page session like visionModels.js:
//   tables               GET /api/workflow-tables/?workspace=<the workflow's workspace>      (optionsKey "tables")
//   databaseConnections  GET /api/database-connections/?workspace=<the workflow's workspace> (optionsKey "databaseConnections")
//   databaseTables       GET /api/database-connections/<id>/schema/                          (optionsKey "databaseTables")
// A failed read is not kept, so Retry asks again. Nothing here ever holds a secret: a connection's projection has none.
import { reactive } from 'vue'
import api from '@/services/api'

// The engines each step may use (the backend's steps refuse any other): a picker offers only those.
export const STEP_ENGINES = Object.freeze({
  'data.sql': ['postgres', 'mysql', 'mssql'],
  'data.mongo': ['mongodb'],
  'data.redis': ['redis'],
  'trigger.database': ['postgres', 'mysql', 'mssql', 'mongodb'],
})

// The reserved columns every table row has (the row object is { id, created_at, updated_at, <column>... }).
export const ROW_COLUMNS = Object.freeze([
  { key: 'id', label: 'id', type: 'number', system: true },
  { key: 'created_at', label: 'created_at', type: 'datetime', system: true },
  { key: 'updated_at', label: 'updated_at', type: 'datetime', system: true },
])

const tablesBy = reactive({})       // workspace key -> { loading, error, tables, pending }
const connectionsBy = reactive({})  // workspace key -> { loading, error, connections, pending }
const schemaBy = reactive({})       // connection id -> { loading, error, tables, pending }

const wsKey = (ws) => (ws === null || ws === undefined || ws === '' ? '' : String(ws))
const wsParams = (ws) => (wsKey(ws) ? { workspace: ws } : {})

// What a list reads as before its first load: never written, so reading a state inside a computed changes nothing.
const NOT_LOADED = Object.freeze({ loading: false, error: '', items: null, pending: null })
const peek = (store, key) => store[key] || NOT_LOADED

function slot(store, key) {
  if (!store[key]) store[key] = { loading: false, error: '', items: null, pending: null }
  return store[key]
}

/** The sentence a person reads for a failed list read. */
export function listError(err, what) {
  const d = err?.response?.data
  if (d && (d.error || d.detail)) return String(d.error || d.detail)
  if (err?.response) return `The ${what} could not be loaded (error ${err.response.status}).`
  if (err?.message && !/network/i.test(err.message)) return err.message
  return `The ${what} could not be loaded. Check your connection.`
}

function load(store, key, fetcher, pick, what, force) {
  const e = slot(store, key)
  if ((e.items && !force) || e.pending) return e.pending || Promise.resolve(e.items)
  e.loading = true
  e.error = ''
  e.pending = fetcher().then(({ data }) => {
    const items = pick(data)
    if (!Array.isArray(items)) throw new Error(`The server sent the ${what} in a shape this page does not read.`)
    e.items = items
    return items
  }).catch((err) => {
    e.error = listError(err, what)
    return null
  }).finally(() => { e.loading = false; e.pending = null })
  return e.pending
}

// ── Data Tables ──
export function tablesState(ws) { return peek(tablesBy, wsKey(ws)) }
export function loadTables(ws, { force = false } = {}) {
  return load(tablesBy, wsKey(ws), () => api.getWorkflowTables(wsParams(ws)), (d) => d?.tables, 'tables', force)
}
/** A table of the workspace's list by its id (or name, which a step may also hold), or null. */
export function findTable(ws, ref) {
  if (ref === null || ref === undefined || ref === '') return null
  const list = tablesState(ws).items || []
  return list.find((t) => String(t.id) === String(ref)) || list.find((t) => t.name === ref) || null
}
/** A table's columns for a picker: its own, then id / created_at / updated_at (`withSystem`). */
export function tableColumns(table, { withSystem = false } = {}) {
  const own = Array.isArray(table?.columns) ? table.columns.map((c) => ({ ...c, label: c.label || c.key })) : []
  return withSystem ? [...own, ...ROW_COLUMNS] : own
}

// ── database connections ──
export function connectionsState(ws) { return peek(connectionsBy, wsKey(ws)) }
export function loadConnections(ws, { force = false } = {}) {
  return load(connectionsBy, wsKey(ws), () => api.getDatabaseConnections(wsParams(ws)), (d) => d?.connections, 'database connections', force)
}
export function findConnection(ws, id) {
  if (id === null || id === undefined || id === '') return null
  return (connectionsState(ws).items || []).find((c) => String(c.id) === String(id)) || null
}
/** The connections a step type may use, as [value, label] options: "Orders DB (PostgreSQL, read only)". */
export function connectionOptions(connections, stepType) {
  const engines = STEP_ENGINES[stepType] || null
  return (connections || [])
    .filter((c) => !engines || engines.includes(c.engine))
    .map((c) => [c.id, `${c.name} (${c.engine_label || c.engine}, ${c.access === 'read_write' ? 'read and write' : 'read only'})`])
}

// ── a connection's tables (its schema) ──
export function schemaState(connectionId) { return peek(schemaBy, String(connectionId)) }
export function loadSchema(connectionId, { fresh = false } = {}) {
  if (connectionId === null || connectionId === undefined || connectionId === '') return Promise.resolve(null)
  return load(schemaBy, String(connectionId), () => api.getDatabaseConnectionSchema(connectionId, { fresh }), (d) => d?.tables, 'tables of the database', fresh)
}
/** A schema's tables as [value, label] options: the qualified name, and "(view)" for a view. */
export function schemaTableOptions(tables) {
  return (tables || []).filter((t) => t && t.name).map((t) => [t.name, t.kind === 'view' ? `${t.name} (view)` : t.name])
}
/** The columns of one schema table ({ key, label, type }), or null when the table is not in the schema. */
export function schemaColumns(tables, name) {
  const t = (tables || []).find((x) => x.name === name)
  if (!t) return null
  return (t.columns || []).map((c) => ({ key: c.name, label: c.name, type: c.type, nullable: c.nullable }))
}

/** For tests: forget every list. */
export function resetDataLists() {
  for (const store of [tablesBy, connectionsBy, schemaBy]) for (const k of Object.keys(store)) delete store[k]
}
