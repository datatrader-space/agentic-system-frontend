// Inline edit on a selection (ADM-1315, LETS_CODE_EDITOR_GAPS_2026_PLAN.md §G2): Ctrl+K over the selected lines opens a
// small prompt in the editor; the Coding Agent's answer comes back as a change in place (the old lines tinted red, the
// new ones below them in green) with Accept / Reject / Retry. The answer is ONE turn of the engine on the server
// (agent/services/inline_edit.py); nothing here talks to a model.
//
// The zone is VS Code's own ZoneWidget pattern: a view zone keeps the room above the selected lines, and an overlay
// widget (which takes the mouse and the keyboard, unlike a view zone) is moved onto it whenever the zone moves.
import { selectedLines } from './codeMentions'

/** How many lines above and below the selection go with it, as context for the change. */
export const CONTEXT_LINES = 60
/** And at most this many characters of each (the server refuses more; the lines nearest the selection are kept). */
export const CONTEXT_CHARS = 30000

/** Lines ``from``..``to`` (1-based, inclusive) of ``model`` with their line breaks, '' when the range is empty. */
function linesOf(model, from, to) {
  if (to < from) return ''
  const eol = model.getEOL ? model.getEOL() : '\n'
  const out = []
  for (let n = from; n <= to; n++) out.push(model.getLineContent(n))
  return out.join(eol) + eol
}

/**
 * What one press sends: the selected WHOLE lines (or the line the cursor is on, an empty one included), the lines
 * around them and the person's words: ``{ path, start_line, end_line, text, before, after, language, instruction }``,
 * or null for a tab that is not a file (the same lines "Ask the Coding Agent about this" takes, `selectedLines`).
 */
export function inlineEditRequest(model, sel, tab, instruction = '') {
  const s = selectedLines(model, sel, tab)
  return s && requestForLines(model, s.start_line, s.end_line, tab, instruction)
}

/** The same, for lines ``start``..``end`` as they are now (Retry, after the text above them moved them). */
export function requestForLines(model, start, end, tab, instruction = '') {
  if (!model || !tab || !tab.path || start < 1 || end < start) return null
  const count = model.getLineCount()
  const text = model.getValueInRange({ startLineNumber: start, startColumn: 1, endLineNumber: end,
    endColumn: model.getLineMaxColumn(end) })
  let before = linesOf(model, Math.max(1, start - CONTEXT_LINES), start - 1)
  let after = linesOf(model, end + 1, Math.min(count, end + CONTEXT_LINES))
  if (before.length > CONTEXT_CHARS) before = before.slice(before.length - CONTEXT_CHARS)
  if (after.length > CONTEXT_CHARS) after = after.slice(0, CONTEXT_CHARS)
  return { path: tab.path, start_line: start, end_line: end, text, before, after, language: tab.language || '',
    instruction: String(instruction || '').trim() }
}

/** "2 lines become 3" for the screen reader and the widget's line. */
export function changeSummary(oldText, newText) {
  const count = (t) => (t === '' ? 0 : String(t).split(/\r?\n/).length)
  const a = count(String(oldText ?? '').replace(/\r?\n$/, ''))
  const b = count(newText ?? '')
  const lines = (n) => `${n} line${n === 1 ? '' : 's'}`
  if (b === 0) return `${lines(a)} removed`
  return `${lines(a)} ${a === 1 ? 'becomes' : 'become'} ${lines(b)}`
}

/**
 * The inline edit's place in Monaco editor ``ed`` over lines ``startLine``..``endLine``: the room for the prompt above
 * them (``host``, the overlay widget's node, which the page fills), the selected lines kept track of as the text above
 * them changes, and the suggested lines shown below them. Returns
 *   { range(), setPromptHeight(px), showSuggestion(text), clearSuggestion(), dispose() }.
 */
export function mountInlineEdit(m, ed, { startLine, endLine, host, id = 'lets-code.inline-edit' }) {
  const model = ed.getModel()
  const lineRange = () => new m.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine))
  const tracked = ed.createDecorationsCollection([{
    range: lineRange(),
    options: { isWholeLine: true, className: 'lc-ie-selected',
      stickiness: m.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
  }])
  let removed = null
  let promptZone = null
  let suggestZone = null
  let promptHeight = 44
  let disposed = false

  const layout = () => {
    const info = ed.getLayoutInfo()
    host.style.left = `${info.contentLeft}px`
    host.style.width = `${Math.max(200, info.width - info.contentLeft - (info.verticalScrollbarWidth || 0)
      - (info.minimap?.minimapWidth || 0) - 8)}px`
  }
  host.style.position = 'absolute'
  host.style.top = '-1000px'
  const widget = { getId: () => id, getDomNode: () => host, getPosition: () => null }
  ed.addOverlayWidget(widget)
  layout()
  const subs = [ed.onDidLayoutChange?.(layout)]

  const current = () => {
    const r = tracked.getRanges()[0]
    return r ? { start: r.startLineNumber, end: r.endLineNumber } : null
  }
  function placePrompt() {
    const at = current()
    ed.changeViewZones((acc) => {
      if (promptZone !== null) acc.removeZone(promptZone)
      promptZone = at === null ? null : acc.addZone({
        afterLineNumber: at.start - 1, heightInPx: promptHeight, domNode: document.createElement('div'),
        onDomNodeTop: (top) => { host.style.top = `${top}px` },
      })
    })
  }
  placePrompt()

  return {
    /** The selected lines as they are now (an edit above them moves them), or null when they are gone. */
    range() {
      const at = current()
      return at && new m.Range(at.start, 1, at.end, model.getLineMaxColumn(at.end))
    },
    setPromptHeight(px) {
      const h = Math.max(32, Math.round(px))
      if (disposed || h === promptHeight) return
      promptHeight = h
      placePrompt()
    },
    /** The suggested ``text`` below the selected lines, which are tinted as the lines it replaces. */
    showSuggestion(text) {
      this.clearSuggestion()
      const at = current()
      if (!at) return
      removed = ed.createDecorationsCollection(
        [{ range: new m.Range(at.start, 1, at.end, 1), options: { isWholeLine: true, className: 'lc-ie-removed',
          linesDecorationsClassName: 'lc-ie-removed-gutter' } }])
      const lines = text === '' ? [] : String(text).split(/\r?\n/)
      if (!lines.length) return
      const node = document.createElement('div')
      node.className = 'lc-ie-added'
      node.setAttribute('aria-hidden', 'true')          // the widget reads the change out (its own text)
      const font = ed.getOption(m.editor.EditorOption.fontInfo)
      const lineHeight = ed.getOption(m.editor.EditorOption.lineHeight)
      node.style.fontFamily = font?.fontFamily || 'monospace'
      node.style.fontSize = `${font?.fontSize || 13}px`
      node.style.lineHeight = `${lineHeight}px`
      for (const line of lines) {
        const row = document.createElement('div')
        row.className = 'lc-ie-added-line'
        row.textContent = line || ' '                     // text, never HTML: the model's answer is not trusted
        node.appendChild(row)
      }
      ed.changeViewZones((acc) => {
        suggestZone = acc.addZone({ afterLineNumber: at.end, heightInLines: lines.length, domNode: node })
      })
    },
    clearSuggestion() {
      try { removed && removed.clear() } catch { /* the editor went away */ }
      removed = null
      if (suggestZone !== null) {
        const z = suggestZone
        suggestZone = null
        try { ed.changeViewZones((acc) => acc.removeZone(z)) } catch { /* gone */ }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      this.clearSuggestion()
      try { ed.changeViewZones((acc) => { if (promptZone !== null) acc.removeZone(promptZone) }) } catch { /* gone */ }
      try { tracked.clear() } catch { /* gone */ }
      try { ed.removeOverlayWidget(widget) } catch { /* gone */ }
      subs.forEach((s) => { try { s && s.dispose() } catch { /* gone */ } })
    },
  }
}

/**
 * Put ``replacement`` in place of the selected lines of ``ed`` as ONE undoable edit, only if those lines are still
 * exactly ``original`` (the person may have typed in them meanwhile). Returns whether it was applied.
 */
export function applyInlineEdit(m, ed, range, original, replacement) {
  const model = ed?.getModel?.()
  if (!m || !model || !range) return false
  const eol = model.getEOL ? model.getEOL() : '\n'
  const now = model.getValueInRange(range)
  if (now !== String(original ?? '').replace(/\r?\n$/, '').split(/\r?\n/).join(eol)) return false
  const text = String(replacement ?? '').split(/\r?\n/).join(eol)
  // Removing every line takes the line break after them too (or before them, at the end of the file).
  let target = range
  if (text === '') {
    const last = range.endLineNumber === model.getLineCount()
    target = last && range.startLineNumber > 1
      ? new m.Range(range.startLineNumber - 1, model.getLineMaxColumn(range.startLineNumber - 1), range.endLineNumber,
        range.endColumn)
      : last ? range : new m.Range(range.startLineNumber, 1, range.endLineNumber + 1, 1)
  }
  ed.pushUndoStop()
  ed.executeEdits('lets-code-inline-edit', [{ range: target, text, forceMoveMarkers: true }])
  ed.pushUndoStop()
  return true
}
