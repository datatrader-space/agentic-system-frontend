// The Let's Code editor's command palette (Ctrl+Shift+P, ADM-1322): which commands match what was typed, best first.
// A command matches when every word typed is found in its label (or its group's name), in order, as letters that
// follow each other or start words ("tt" finds "Toggle terminal", "md prev" finds "Markdown: Show preview"). Nothing
// typed lists every command, in the order given. Every match is listed: nothing is cut off.

const norm = (s) => String(s || '').toLowerCase()

// How well `word` matches `text` (higher is better), or -1. A run of letters scores more than scattered ones, and a
// letter at the start of a word scores more than one inside it.
function wordScore(text, word) {
  const at = text.indexOf(word)
  if (at !== -1) return 100 + (at === 0 || /[\s:/(-]/.test(text[at - 1]) ? 50 : 0) - at * 0.1
  let score = 0
  let from = 0
  let last = -2
  for (const ch of word) {
    const i = text.indexOf(ch, from)
    if (i === -1) return -1
    score += i === last + 1 ? 6 : (i === 0 || /[\s:/(-]/.test(text[i - 1]) ? 8 : 1)
    last = i
    from = i + 1
  }
  return score
}

/** The commands that match `query`, best first; each keeps its own fields. */
export function filterCommands(commands, query) {
  const words = norm(query).split(/\s+/).filter(Boolean)
  const list = commands || []
  if (!words.length) return [...list]
  const scored = []
  list.forEach((c, i) => {
    const text = norm(c.group ? `${c.group}: ${c.label}` : c.label)
    let total = 0
    for (const w of words) {
      const s = wordScore(text, w)
      if (s < 0) return
      total += s
    }
    scored.push({ c, total, i })
  })
  return scored.sort((a, b) => b.total - a.total || a.i - b.i).map((x) => x.c)
}
