// One helper job on the server (VIDEO_EDITOR_PRO_CONTRACT.md section 7): POST /api/video/editor/derive/ {media, op,
// params} answers with the derived file's record {id, op, state, progress (0..1 or null), result, paid, job, ...} (200
// when it already exists, 202/201 while it is made). A paid operation (bg_removal) carries its Studio video job in
// `record.job`, which waits on its estimate: the existing quote, hold and price card (VideoJobCard) before anything is
// spent; when the job is done the record is read again for its result. A second request for the same file and
// operation while one runs is 409 {error: {code: 'running'}, derive: <record>}: the running one is followed instead.
// Free operations never charge.
import { onBeforeUnmount, reactive } from 'vue'
import api from '../../../services/api'
import { useVideoStore } from '../../../stores/useVideoStore'

const TERMINAL = ['ready', 'failed', 'cancelled', 'declined', 'expired']
const POLL_MS = 2000, JOB_POLL_MS = 4000

export function useDerive() {
  const video = useVideoStore()
  // status: idle | working | estimate (a paid job waiting on its price card) | ready | failed
  const state = reactive({ status: 'idle', progress: null, result: null, error: '', jobId: '', deriveId: '', op: '' })
  let timer = null, gone = false
  const stop = () => { clearTimeout(timer); timer = null }
  onBeforeUnmount(() => { gone = true; stop() })

  function fromRecord(d) {
    state.deriveId = String(d.id || state.deriveId || '')
    state.progress = typeof d.progress === 'number' ? d.progress : null
    if (d.state === 'ready') { state.status = 'ready'; state.result = d.result ?? null; stop(); return }
    if (TERMINAL.includes(d.state)) { state.status = 'failed'; state.error = d.error || 'This could not be made.'; stop(); return }
    state.status = 'working'
    timer = setTimeout(pollRecord, POLL_MS)
  }
  async function pollRecord() {
    if (gone || !state.deriveId) return
    try { fromRecord((await api.get(`/video/editor/derive/${state.deriveId}/`)).data) }
    catch (e) { state.status = 'failed'; state.error = message(e, 'The progress could not be read.') }
  }
  function fromJob(job) {
    video._put(job)
    state.jobId = job.job_id
    followJob()
  }
  async function followJob() {
    if (gone) return
    const job = video.jobs[state.jobId]
    if (!job) return
    if (job.state === 'awaiting_authorization') state.status = 'estimate'
    else if (job.state === 'ready') {
      // The job made the file; its record has the result.
      if (state.deriveId) { state.jobId = ''; state.status = 'working'; pollRecord(); return }
      state.status = 'ready'; state.result = job.output ?? job.result ?? null; return
    }
    else if (TERMINAL.includes(job.state)) { state.status = 'failed'; state.error = job.error?.message || job.error || 'The job did not finish.'; return }
    else state.status = 'working'
    timer = setTimeout(async () => { try { await video.refreshJob(state.jobId) } catch { /* the next poll tries again */ } followJob() }, JOB_POLL_MS)
  }
  async function start(media, op, params = {}) {
    stop()
    Object.assign(state, { status: 'working', progress: null, result: null, error: '', jobId: '', deriveId: '', op })
    try {
      follow((await api.post('/video/editor/derive/', { media, op, params })).data || {})
    } catch (e) {
      const body = e?.response?.data
      if (e?.response?.status === 409 && body?.derive?.id) { follow(body.derive); return }
      state.status = 'failed'; state.error = message(e, 'This could not be started.')
    }
  }
  // A record: its paid job while that runs (or waits on its price card), else the record itself.
  function follow(d) {
    state.deriveId = String(d.id || '')
    if (d.job?.job_id && d.state !== 'ready' && !TERMINAL.includes(d.state)) fromJob(d.job)
    else fromRecord(d)
  }
  function reset() { stop(); Object.assign(state, { status: 'idle', progress: null, result: null, error: '', jobId: '', deriveId: '', op: '' }) }
  return { state, start, reset, job: () => (state.jobId ? video.jobs[state.jobId] : null), followJob }
}

function message(e, fallback) { const d = e?.response?.data; return d?.error?.message || (typeof d?.error === 'string' ? d.error : '') || fallback }
