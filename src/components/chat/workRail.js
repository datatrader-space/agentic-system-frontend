// A Work turn's timeline (ADM-1302), the pure half: the rail's rows from the turn's timeline steps, and how a tool
// row reads (its one-line description, its IN and OUT as text, a file edit's diff). WorkTimeline.vue draws them.
//
// The steps are useAgentTimeline's (live, or the snapshot saved on the message): the same list the card reads, with
// a Work turn's additions — narration rows (`isText`), each call's tool name, IN, OUT and the ref they were recorded
// under (`ioRef`). Nothing here decides what the agent does; it only orders and words what already happened.

//: A row's IN or OUT longer than this is not kept in the saved timeline: the row keeps its `ioRef` and the length,
//: and the rail loads the whole text again on expand (`GET /conversations/<id>/tool-result/`). Nothing is cut.
export const INLINE_IO_CHARS = 4000

//: The `Agent` tool: a subagent. Its row shows the agent type and the tools it used, nested under it.
const SUBAGENT_TOOLS = new Set(['AGENT', 'Agent'])

// The argument that says what a call did, in the order a person looks for it (the same order the Coding Agent's own
// status line uses, `graph_adapter._STEP_ARGS`, then the common ones of other tools).
const DESCRIBE_KEYS = ['command', 'path', 'file_path', 'target', 'pattern', 'query', 'url', 'name', 'label', 'subdir',
  'handle', 'description', 'prompt']

// Base64 is never shown as text (the no-base64 rule): data URIs and long runs read `<base64>`, as the backend writes
// them (`audit_redaction.strip_base64_payloads`). Applied to everything the rail prints.
const DATA_URI = /data:[^;,\s]{0,120};base64,[A-Za-z0-9+/=]+/gi
const BASE64_RUN = /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{200,}={0,2}(?![A-Za-z0-9+/=])/g
export function stripBase64(text) {
  const s = String(text == null ? '' : text)
  if (s.length < 64) return s
  return s.replace(DATA_URI, '<base64>').replace(BASE64_RUN, '<base64>')
}

export function isSubagent(row) {
  return !!row && SUBAGENT_TOOLS.has(String(row.tool || ''))
}

// IN or OUT as the text the rail prints: a string as it is (JSON pretty-printed, so a structured result reads line by
// line), anything else as indented JSON. Never cut.
export function ioText(value) {
  if (value == null) return ''
  if (typeof value === 'string') {
    const t = value.trim()
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try { return stripBase64(JSON.stringify(JSON.parse(t), null, 2)) } catch { /* not JSON: as it is */ }
    }
    return stripBase64(value)
  }
  try { return stripBase64(JSON.stringify(value, null, 2)) } catch { return stripBase64(String(value)) }
}

function inputObject(row) {
  const v = row && row.input
  if (v && typeof v === 'object' && !Array.isArray(v)) return v
  if (typeof v === 'string') {
    try { const o = JSON.parse(v); if (o && typeof o === 'object') return o } catch { /* plain text */ }
  }
  return null
}

function oneLine(text) {
  return stripBase64(String(text || '')).replace(/\s+/g, ' ').trim()
}

// The one line under a tool's name: what it did (the command, the file, the query). A subagent's is its agent type
// and its task. Falls back to the step's own words.
export function toolDescription(row) {
  if (!row) return ''
  const args = inputObject(row)
  if (isSubagent(row) && args) {
    const kind = String(args.subagent_type || '').trim()
    const task = oneLine(args.description || args.prompt || '')
    return [kind, task].filter(Boolean).join(': ')
  }
  if (args) {
    for (const k of DESCRIBE_KEYS) {
      const v = args[k]
      if (v != null && typeof v !== 'object' && String(v).trim()) return oneLine(v)
    }
  }
  return oneLine(row.label || '')
}

// The name in bold: a SHORT name like Claude Code's ("Read", "Edit", "Bash"), never the platform's raw tool name
// (owner, 2026-11-18). The server declares it beside each tool's label (`streaming/labels.display_name`) and sends it
// on the call's frames as `title`; a tool with no short name gets one from its declared label. A row without one
// (its frames never reached this page) reads "Tool".
export function toolName(row) {
  return String((row && row.title) || 'Tool')
}

// The rows a subagent's result names as the tools it used (`delegation_tools._delegate_one`: `tools_used`), nested
// under its row. Empty while it runs and when the result does not say.
export function subagentChildren(row) {
  if (!isSubagent(row) || row.output == null) return []
  let out = row.output
  if (typeof out === 'string') {
    try { out = JSON.parse(out) } catch { return [] }
  }
  const used = out && Array.isArray(out.tools_used) ? out.tools_used : []
  // Named by the short names the server sent with the result (`used_titles`), never the raw tool names.
  const titles = Array.isArray(row.usedTitles) ? row.usedTitles : []
  return used.map((t, i) => ({
    key: `${row.stepId}_c${i}`, name: String(titles[i] || 'Tool'),
    failed: !!(t && typeof t === 'object' && t.ok === false),
  }))
}

// A file edit's diff, from the call's own input: CODE_PATCH_FILE's find/replace edits, CODE_APPLY_PATCH's patch.
// `[{ sign: '+' | '-' | ' ' | '@', text }]`, or [] when the call carries no edit (a write's whole file is its IN).
export function diffLines(row) {
  const args = inputObject(row)
  if (!args) return []
  const tool = String(row.tool || '')
  if (tool === 'CODE_APPLY_PATCH' && typeof args.patch === 'string') {
    return args.patch.split('\n').map((ln) => {
      const c = ln.charAt(0)
      if (ln.startsWith('+++') || ln.startsWith('---')) return { sign: '@', text: ln }
      if (c === '+' || c === '-') return { sign: c, text: ln.slice(1) }
      if (c === '@') return { sign: '@', text: ln }
      return { sign: ' ', text: ln.startsWith(' ') ? ln.slice(1) : ln }
    })
  }
  if (tool === 'CODE_PATCH_FILE') {
    let edits = args.edits
    if (typeof edits === 'string') { try { edits = JSON.parse(edits) } catch { edits = null } }
    if (edits && !Array.isArray(edits) && typeof edits === 'object') edits = [edits]
    if (!edits && 'find' in args) edits = [{ find: args.find, replace: args.replace }]
    if (!Array.isArray(edits)) return []
    const lines = []
    edits.forEach((e, i) => {
      if (!e || typeof e !== 'object') return
      if (edits.length > 1) lines.push({ sign: '@', text: `Edit ${i + 1}` })
      for (const t of String(e.find ?? '').split('\n')) lines.push({ sign: '-', text: t })
      for (const t of String(e.replace ?? '').split('\n')) lines.push({ sign: '+', text: t })
    })
    return lines
  }
  return []
}

// Where a row's dot sits: running (animated), done (green), failed (red), waiting for the person (amber), not run
// (grey). Interrupted reads as not run: the step never finished.
export function dotState(row) {
  const s = String((row && row.status) || '')
  if (s === 'running') return 'running'
  if (s === 'failed') return 'failed'
  if (s === 'waiting') return 'waiting'
  if (s === 'held' || s === 'interrupted') return 'notrun'
  return 'done'
}

function seconds(ms) {
  const s = Math.max(0, Number(ms) || 0) / 1000
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
}

// "Thought for 4s", or "Thinking" while it runs.
export function thoughtLabel(row) {
  if (row && row.status === 'running') return 'Thinking'
  return row && row.durationMs != null ? `Thought for ${seconds(row.durationMs)}` : 'Thought'
}

// The rail's rows, in the order they happened.
//  - status phases ("Getting ready", "Generating response") are not rows: they feed the live status line;
//  - a thought, a narration, a steer, a compaction, a plan, a tool or a subagent is one row each;
//  - once the turn has ended with an answer, the answer is the last row, in place of the round's text it is (the
//    saved answer is the authoritative text: cleaned, with its media). While the turn runs, its text is narration.
export function workRows(steps, { finished = false, hasAnswer = false } = {}) {
  const rows = []
  for (const s of Array.isArray(steps) ? steps : []) {
    if (!s) continue
    if (s.isText) {
      if (String(s.text || '').trim()) rows.push({ kind: 'text', key: s.stepId, step: s })
    } else if (s.phase === 'reasoning') {
      if (String(s.reasoningText || '').trim() || s.status === 'running') rows.push({ kind: 'thought', key: s.stepId, step: s })
    } else if (s.isSteer) {
      rows.push({ kind: 'steer', key: s.stepId, step: s })
    } else if (s.isCompaction) {
      rows.push({ kind: 'compaction', key: s.stepId, step: s })
    } else if (s.isPlan) {
      // The host draws the turn's plan card (one per run) at the first place a plan was given.
      if (!rows.some((r) => r.kind === 'plan')) rows.push({ kind: 'plan', key: s.stepId, step: s })
    } else if (s.isPhase) {
      continue
    } else {
      rows.push({ kind: isSubagent(s) ? 'subagent' : 'tool', key: s.stepId, step: s })
    }
  }
  if (finished && hasAnswer) {
    let last = -1
    for (let i = rows.length - 1; i >= 0; i--) {
      const k = rows[i].kind
      if (k === 'text') { last = i; break }
      if (k === 'tool' || k === 'subagent' || k === 'steer' || k === 'plan') break
    }
    if (last >= 0) rows.splice(last, 1)
    rows.push({ kind: 'answer', key: 'answer' })
  }
  return rows
}

// Does a row need its IN or OUT loaded from the server (the saved timeline kept only the ref of a long one)?
export function needsLoad(row) {
  if (!row || !row.ioRef) return false
  return (row.inputChars > 0 && row.input == null) || (row.outputChars > 0 && row.output == null)
}

// A Work snapshot's row: a long IN or OUT that the server holds under the row's ref is not copied into the saved
// timeline (its length is kept, and the rail loads it again on expand). One without a ref is kept whole.
export function compactIo(row) {
  if (!row || !row.ioRef) return row
  const out = { ...row }
  const inText = row.input == null ? '' : (typeof row.input === 'string' ? row.input : JSON.stringify(row.input))
  const outText = row.output == null ? '' : String(row.output)
  // Its first lines stay as the closed row's preview (Claude Code shows a few faded lines of each); the whole text is
  // loaded by the ref when the row is opened.
  if (inText.length > INLINE_IO_CHARS) { out.inputChars = inText.length; out.inputHead = headOf(ioText(row.input)); delete out.input }
  if (outText.length > INLINE_IO_CHARS) { out.outputChars = outText.length; out.outputHead = headOf(ioText(row.output)); delete out.output }
  return out
}

//: How many lines a closed row's IN and OUT preview shows (Claude Code shows a few lines that fade out).
export const PREVIEW_LINES = 3
// The first lines of a long IN or OUT, kept in the saved timeline for the closed row's preview: one line more than
// the preview shows, so its fade still says there is more.
export function headOf(text) {
  return String(text || '').split('\n').slice(0, PREVIEW_LINES + 1).join('\n').slice(0, 600)
}

// Does a closed tool row show its IN/OUT preview? Claude Code shows a Read as its path alone (the file is the OUT) and
// a subagent as its task with what it used nested under it; every other call shows the start of what went in and
// what came back. Both still open to their whole IN and OUT.
export function showsPreview(row) {
  return !!row && !isSubagent(row) && toolName(row) !== 'Read'
}

// "12s", "1m 05s": the live status line's elapsed time.
export function elapsedText(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
