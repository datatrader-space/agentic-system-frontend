// Bundle the Iconify icons the app uses, offline (page-speed plan Phase 5 item 10).
//
// <Icon icon="lucide:bot"> used to fetch every icon at runtime from api.iconify.design: a third-party
// request per page, icons popping in late, and blank icons wherever that domain is blocked. This plugin
// scans src/ at build (and dev start) for every "prefix:name" literal of the bundled collections, in
// templates AND in data maps (dynamic names like `EXT_ICON[ext]`), and serves a virtual module that
// registers ONLY those icons with addCollection(). Nothing is generated into the repo.
//
// An icon name that only arrives at runtime (e.g. from an API response) and was never written in src/
// is not in the subset; @iconify/vue then still fetches it from the Iconify API as before (fallback).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// Two modules: the UI icons every page uses (in the entry), and the colored brand logos (~136 kB raw,
// used by the connector / integration / code pages) in their own chunk, imported right after mount so
// they never weigh on the first paint.
export const VIRTUAL_MODULES = {
  'virtual:icon-subset': ['lucide', 'simple-icons'],
  'virtual:icon-subset-logos': ['logos'],
}
export const COLLECTIONS = ['lucide', 'logos', 'simple-icons']
const SOURCE_EXT = /\.(vue|js|ts|mjs|jsx|tsx)$/
const ICON_RE = new RegExp(`(?<![\\w-])(${COLLECTIONS.join('|')}):([a-z0-9]+(?:-[a-z0-9]+)*)`, 'g')

export function collectIconNames(dir, found = new Map()) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      collectIconNames(full, found)
    } else if (SOURCE_EXT.test(entry) && !/\.(test|spec)\./.test(entry)) {
      const text = readFileSync(full, 'utf8')
      for (const m of text.matchAll(ICON_RE)) {
        if (!found.has(m[1])) found.set(m[1], new Set())
        found.get(m[1]).add(m[2])
      }
    }
  }
  return found
}

// The part of an Iconify JSON collection that holds `names` (and the parents of any alias among them).
export function subsetCollection(collection, names) {
  const out = { prefix: collection.prefix, icons: {}, aliases: {} }
  if (collection.width) out.width = collection.width
  if (collection.height) out.height = collection.height
  const add = (name, depth = 0) => {
    if (depth > 5) return
    if (collection.icons[name]) { out.icons[name] = collection.icons[name]; return }
    const alias = collection.aliases && collection.aliases[name]
    if (alias) { out.aliases[name] = alias; add(alias.parent, depth + 1) }
  }
  for (const name of names) add(name)
  if (!Object.keys(out.aliases).length) delete out.aliases
  return out
}

export function buildSubsetModule(srcDir, prefixes = COLLECTIONS) {
  const found = collectIconNames(srcDir)
  const subsets = []
  for (const prefix of prefixes) {
    const names = found.get(prefix)
    if (!names || !names.size) continue
    const collection = require(`@iconify-json/${prefix}/icons.json`)
    subsets.push(subsetCollection(collection, names))
  }
  return [
    "import { addCollection } from '@iconify/vue'",
    ...subsets.map((s) => `addCollection(${JSON.stringify(s)})`),
    `export const iconCount = ${subsets.reduce((n, s) => n + Object.keys(s.icons).length + Object.keys(s.aliases || {}).length, 0)}`,
  ].join('\n')
}

export default function iconSubset({ srcDir }) {
  return {
    name: 'aadml-icon-subset',
    resolveId(id) { return VIRTUAL_MODULES[id] ? '\0' + id : null },
    load(id) {
      const prefixes = id.startsWith('\0') ? VIRTUAL_MODULES[id.slice(1)] : null
      return prefixes ? buildSubsetModule(srcDir, prefixes) : null
    },
  }
}
