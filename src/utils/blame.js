// The editor's inline blame (ADM-1321): who last changed each line, when, and in which commit, as GitLens shows it.
// The server sends one sha per line and each commit once (`source-control/blame/`); here they become Monaco
// decorations: the commit's author, age and subject at the end of the first line of each run of lines from one
// commit, and the details on every line's hover. It is read once when blame is turned on, for the file as it is on
// disk, never on each keystroke; a tab with unsaved edits shows none, since its lines no longer match.
import { ago } from './timeAgo'

/** Consecutive lines from one commit: [{ start, end, sha }] (1-based, inclusive). */
export function blameRuns(lines) {
  const runs = []
  ;(lines || []).forEach((sha, i) => {
    const last = runs[runs.length - 1]
    if (last && last.sha === sha && last.end === i) last.end = i + 1
    else runs.push({ start: i + 1, end: i + 1, sha })
  })
  return runs
}

/** "Ada, 3 days ago · Fix the footer" (or "You, not committed yet"). */
export function blameLabel(commit, now = Date.now()) {
  if (!commit) return ''
  if (commit.uncommitted) return 'Not committed yet'
  return [commit.author, ago(commit.date, now)].filter(Boolean).join(', ') + (commit.subject ? ` · ${commit.subject}` : '')
}

const md = (s) => String(s ?? '').replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&')

/** The hover for a line: author, date, short sha and subject, as plain Markdown (never trusted). */
export function blameHover(commit) {
  if (!commit) return null
  if (commit.uncommitted) return { value: 'Not committed yet: this line changed after the last commit.' }
  const when = commit.date ? new Date(commit.date).toLocaleString() : ''
  return { value: `**${md(commit.author)}**, ${md(when)}  \n\`${commit.short}\` ${md(commit.subject)}` }
}

/** Monaco decorations for blame ``data`` ({lines, commits}); ``Range`` is Monaco's Range class. */
export function blameDecorations(Range, data, now = Date.now()) {
  const commits = data?.commits || {}
  const out = []
  for (const run of blameRuns(data?.lines)) {
    const c = commits[run.sha]
    const hoverMessage = blameHover(c)
    for (let n = run.start; n <= run.end; n++) {
      const options = { isWholeLine: true, hoverMessage }
      if (n === run.start) {
        options.after = { content: `    ${blameLabel(c, now)}`, inlineClassName: 'lc-blame-after' }
      }
      out.push({ range: new Range(n, 1, n, 1), options })
    }
  }
  return out
}
