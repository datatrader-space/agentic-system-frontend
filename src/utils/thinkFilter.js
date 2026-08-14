const OPEN = '<think>'
const CLOSE = '</think>'

/** Remove private reasoning blocks from a complete or partially streamed response. */
export function stripThinkBlocks(value) {
  if (!value || typeof value !== 'string') return value || ''

  let text = value
  let output = ''
  while (text) {
    const openAt = text.indexOf(OPEN)
    if (openAt === -1) {
      // Hide a possible opener split across stream chunks ("<thi" + "nk>").
      let hold = 0
      for (let size = Math.min(OPEN.length - 1, text.length); size > 0; size -= 1) {
        if (text.endsWith(OPEN.slice(0, size))) { hold = size; break }
      }
      output += hold ? text.slice(0, -hold) : text
      break
    }
    output += text.slice(0, openAt)
    const closeAt = text.indexOf(CLOSE, openAt + OPEN.length)
    if (closeAt === -1) break
    text = text.slice(closeAt + CLOSE.length)
  }
  return output
}

/** Stateful chunk filter so tag fragments and private text never flash during streaming. */
export class ThinkStreamFilter {
  constructor() { this.reset() }

  reset() {
    this.inThink = false
    this.buffer = ''
  }

  feed(chunk) {
    this.buffer += chunk || ''
    let output = ''
    while (this.buffer) {
      if (this.inThink) {
        const closeAt = this.buffer.indexOf(CLOSE)
        if (closeAt !== -1) {
          this.inThink = false
          this.buffer = this.buffer.slice(closeAt + CLOSE.length)
          continue
        }
        this.buffer = this.buffer.slice(-Math.min(CLOSE.length - 1, this.buffer.length))
        break
      }

      const openAt = this.buffer.indexOf(OPEN)
      if (openAt !== -1) {
        output += this.buffer.slice(0, openAt)
        this.inThink = true
        this.buffer = this.buffer.slice(openAt + OPEN.length)
        continue
      }

      let hold = 0
      for (let size = Math.min(OPEN.length - 1, this.buffer.length); size > 0; size -= 1) {
        if (this.buffer.endsWith(OPEN.slice(0, size))) { hold = size; break }
      }
      output += hold ? this.buffer.slice(0, -hold) : this.buffer
      this.buffer = hold ? this.buffer.slice(-hold) : ''
      break
    }
    return output
  }

  flush() {
    if (this.inThink) {
      this.reset()
      return ''
    }
    const output = this.buffer
    this.buffer = ''
    return output
  }
}
