// Ticking "X ago" relative time. A single shared 30s interval drives a reactive `now`, so any
// component using relativeTime(ts) re-renders as time passes — "just now" → "1 minute ago" → … —
// without per-component timers or server chatter.
import { ref, onMounted, onUnmounted } from 'vue'

const now = ref(Date.now())
let timer = null
let refs = 0

function start() {
  if (!timer) timer = setInterval(() => { now.value = Date.now() }, 30_000)
}
function stop() {
  if (timer && refs <= 0) { clearInterval(timer); timer = null }
}

export function relativeTime(ts) {
  if (!ts) return ''
  const t = typeof ts === 'number' ? ts : Date.parse(ts)
  if (Number.isNaN(t)) return ''
  const sec = Math.max(0, Math.round((now.value - t) / 1000))
  if (sec < 45) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`
  return `${Math.round(mo / 12)} year(s) ago`
}

// Use inside a component to keep the shared ticker alive while mounted (and `now` reactive here).
export function useRelativeTime() {
  onMounted(() => { refs++; start(); now.value = Date.now() })
  onUnmounted(() => { refs--; stop() })
  return { relativeTime, now }
}

export default useRelativeTime
