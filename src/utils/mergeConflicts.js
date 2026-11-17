// A merge's conflict blocks in a file, and VS Code's actions on each one (ADM-1205): "Accept current change",
// "Accept incoming change", "Accept both changes" above every block, the two sides coloured. Source control keeps
// a whole file to one side ("Keep mine" / "Keep GitHub's"); these resolve one block at a time, each as one undoable
// edit in the editor. The person saves the file and marks it resolved, as before.
//
//   <<<<<<< HEAD            start   (current: this project's side)
//   current lines
//   ||||||| base            base    (only with merge.conflictStyle diff3 / zdiff3)
//   base lines
//   =======                 sep
//   incoming lines                  (incoming: the side being merged in, GitHub's on a pull)
//   >>>>>>> origin/main     end

const MARK = { start: '<<<<<<<', base: '|||||||', sep: '=======', end: '>>>>>>>' }
// A marker is seven characters at the start of a line, then nothing or a space and a label (git's default size).
const isMark = (line, m) => line.startsWith(m) && (line.length === 7 || line[7] === ' ')
const LINES = /\r?\n/
const LINES_END = /\r?\n$/
const eolOf = (s) => (s.includes('\r\n') ? '\r\n' : '\n')

/**
 * Every complete conflict block in ``text``: [{start, base, sep, end, currentLabel, incomingLabel}], line numbers
 * 1-based; ``base`` is null without a base section. A block whose markers do not close is left out.
 */
export function findConflicts(text) {
  const lines = String(text ?? '').split(LINES)
  const out = []
  let open = null
  lines.forEach((line, i) => {
    const n = i + 1
    if (isMark(line, MARK.start)) open = { start: n, base: null, sep: null, currentLabel: line.slice(8).trim() }
    else if (!open) return
    else if (isMark(line, MARK.base) && open.sep === null && open.base === null) open.base = n
    else if (isMark(line, MARK.sep) && open.sep === null) open.sep = n
    else if (isMark(line, MARK.end) && open.sep !== null) {
      out.push({ ...open, end: n, incomingLabel: line.slice(8).trim() })
      open = null
    }
  })
  return out
}

/** The lines a block keeps for ``choice`` ('current' | 'incoming' | 'both'); VS Code's "both" is current, then incoming. */
function keptLines(lines, block, choice) {
  const current = lines.slice(block.start, (block.base ?? block.sep) - 1)
  const incoming = lines.slice(block.sep, block.end - 1)
  return choice === 'current' ? current : choice === 'incoming' ? incoming : [...current, ...incoming]
}

/** The text a block becomes for ``choice``, each kept line with its line break. */
export function resolvedText(text, block, choice) {
  const s = String(text ?? '')
  return keptLines(s.split(LINES), block, choice).map((l) => l + eolOf(s)).join('')
}

/** ``text`` with one block resolved: what the editor's edit produces (the tests read it). */
export function resolveConflict(text, block, choice) {
  const s = String(text ?? '')
  const lines = s.split(LINES)
  return [...lines.slice(0, block.start - 1), ...keptLines(lines, block, choice), ...lines.slice(block.end)].join(eolOf(s))
}

export const CHOICES = [
  { choice: 'current', title: 'Accept current change' },
  { choice: 'incoming', title: 'Accept incoming change' },
  { choice: 'both', title: 'Accept both changes' },
]

/**
 * The actions and colours in the text editor ``editor()`` (Monaco's), for whatever file it shows. Returns the
 * release function. ``monaco()`` and ``editor()`` are read when needed: the editor is re-created when the project
 * turns ready.
 */
export function bindConflictActions({ monaco, editor }) {
  const m = monaco()
  const ed = editor()
  if (!m || !ed || !m.languages?.registerCodeLensProvider || typeof ed.addCommand !== 'function') return () => {}
  const changed = new m.Emitter()
  let decorations = null
  // One command for every block: it is given the block's first line and the choice, and finds the block again in
  // the text as it is now (an edit above it may have moved it).
  const command = ed.addCommand(0, (_accessor, startLine, choice) => accept(startLine, choice))

  function accept(startLine, choice) {
    const model = ed.getModel()
    if (!model) return
    const text = model.getValue()
    const block = findConflicts(text).find((b) => b.start === startLine)
    if (!block) return
    // The block's lines and the line break after the last one; at the end of the file there is none to take.
    const last = block.end === model.getLineCount()
    const range = last ? new m.Range(block.start, 1, block.end, model.getLineMaxColumn(block.end))
      : new m.Range(block.start, 1, block.end + 1, 1)
    let kept = resolvedText(text, block, choice)
    if (last) kept = kept.replace(LINES_END, '')
    ed.pushUndoStop()
    ed.executeEdits('merge-conflict', [{ range, text: kept, forceMoveMarkers: true }])
    ed.pushUndoStop()
    ed.focus()
  }

  function paint() {
    const model = ed.getModel()
    const blocks = model ? findConflicts(model.getValue()) : []
    const line = (n, className) => ({ range: new m.Range(n, 1, n, 1), options: { isWholeLine: true, className } })
    const deco = []
    for (const b of blocks) {
      deco.push(line(b.start, 'lc-conflict-current-head'))
      for (let n = b.start + 1; n < (b.base ?? b.sep); n++) deco.push(line(n, 'lc-conflict-current'))
      if (b.base !== null) for (let n = b.base; n < b.sep; n++) deco.push(line(n, 'lc-conflict-base'))
      deco.push(line(b.sep, 'lc-conflict-sep'))
      for (let n = b.sep + 1; n < b.end; n++) deco.push(line(n, 'lc-conflict-incoming'))
      deco.push(line(b.end, 'lc-conflict-incoming-head'))
    }
    try {
      if (!decorations) decorations = ed.createDecorationsCollection(deco)
      else decorations.set(deco)
    } catch { /* the editor went away */ }
    changed.fire()
  }

  const provider = m.languages.registerCodeLensProvider('*', {
    onDidChange: changed.event,
    provideCodeLenses(model) {
      if (model !== ed.getModel()) return { lenses: [], dispose() {} }
      const lenses = findConflicts(model.getValue()).flatMap((b) => CHOICES.map(({ choice, title }) => ({
        range: new m.Range(b.start, 1, b.start, 1), id: `${b.start}:${choice}`,
        command: { id: command, title, arguments: [b.start, choice] },
      })))
      return { lenses, dispose() {} }
    },
    resolveCodeLens: (_model, lens) => lens,
  })
  let timer = null
  const later = () => { clearTimeout(timer); timer = setTimeout(paint, 150) }
  const subs = [ed.onDidChangeModelContent(later), ed.onDidChangeModel(paint)]
  paint()
  return () => {
    clearTimeout(timer)
    subs.forEach((s) => { try { s.dispose() } catch { /* gone */ } })
    try { provider.dispose() } catch { /* gone */ }
    try { decorations && decorations.clear() } catch { /* gone */ }
    try { changed.dispose() } catch { /* gone */ }
  }
}
