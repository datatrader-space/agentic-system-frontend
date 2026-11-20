import { nodeSize } from './wfFlow'

// The room an unmeasured node is assumed to take (one not yet drawn by Vue Flow).
const UNMEASURED = { width: 230, height: 110 }

// Place new content near the requested point without moving the person's existing graph.
export function freeWorkflowPosition(nodes, preferred, size = UNMEASURED) {
  const gap = 28
  const sizeOf = node => nodeSize(node) || UNMEASURED
  const clear = p => nodes.every(node => {
    const pos = node.position || { x: 0, y: 0 }
    const { width, height } = sizeOf(node)
    return p.x + size.width + gap <= pos.x || p.x >= pos.x + width + gap || p.y + size.height + gap <= pos.y || p.y >= pos.y + height + gap
  })
  if (clear(preferred)) return { ...preferred }
  const stepX = size.width + gap, stepY = size.height + gap
  for (let ring = 1; ring <= nodes.length + 2; ring++) {
    const offsets = [[0, ring], [ring, 0], [0, -ring], [-ring, 0]]
    for (let x = -ring; x <= ring; x++) for (let y = -ring; y <= ring; y++) {
      if (Math.max(Math.abs(x), Math.abs(y)) === ring) offsets.push([x, y])
    }
    for (const [x, y] of offsets) {
      const candidate = { x: preferred.x + x * stepX, y: preferred.y + y * stepY }
      if (clear(candidate)) return candidate
    }
  }
  // Oversized imported nodes may cover several grid cells; step beyond the graph's right edge.
  return { x: Math.max(preferred.x, ...nodes.map(n => (n.position?.x || 0) + sizeOf(n).width)) + gap, y: preferred.y }
}
