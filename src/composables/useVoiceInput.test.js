// @vitest-environment jsdom
//
// Voice input: the mic records and the AGENT'S transcription model turns it into text, server-side.
// The behaviours pinned here are the ones that would be silently wrong in a way no one notices:
// a mic that opens when the agent has no model, a recording that uploads after the user cancelled, a
// transcript that overwrites what the user already typed, and a microphone track left running.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { api, notify, confirmSpy } = vi.hoisted(() => ({
  api: { getVoiceInput: vi.fn(), transcribeVoice: vi.fn() },
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  confirmSpy: vi.fn(() => Promise.resolve(true)),
}))
vi.mock('@/services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmSpy }))

import { useVoiceInput, clearVoiceInputCache } from './useVoiceInput'

// ── a controllable MediaRecorder + getUserMedia ───────────────────────────────────────────────
let recorders = []
let tracks = []

class FakeRecorder {
  constructor(stream, opts) {
    this.stream = stream
    this.mimeType = opts?.mimeType || 'audio/webm'
    this.state = 'inactive'
    recorders.push(this)
  }
  static isTypeSupported() { return true }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['xx'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

function installMediaStack({ denied = false } = {}) {
  recorders = []
  tracks = []
  global.MediaRecorder = FakeRecorder
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn(async () => {
      if (denied) {
        const e = new Error('denied')
        e.name = 'NotAllowedError'
        throw e
      }
      const track = { stop: vi.fn() }
      tracks.push(track)
      return { getTracks: () => [track] }
    }),
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

const make = (over = {}) => useVoiceInput({
  agentId: () => 3163,
  conversationId: () => 'c9',
  onTranscript: vi.fn(),
  getDraft: () => '',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  clearVoiceInputCache()
  installMediaStack()
  api.getVoiceInput.mockResolvedValue({
    data: { enabled: true, model_name: 'OpenAI: GPT Transcribe', max_seconds: 120, message: null },
  })
  api.transcribeVoice.mockResolvedValue({ data: { text: 'hello there' } })
})

afterEach(() => { vi.useRealTimers() })

describe('enablement follows the agent config', () => {
  it('is enabled when the agent has a transcription model', async () => {
    const v = make()
    await flush()
    expect(v.enabled.value).toBe(true)
    expect(api.getVoiceInput).toHaveBeenCalledWith('3163')
  })

  it('is disabled, with the server message, when no model is configured', async () => {
    api.getVoiceInput.mockResolvedValue({
      data: { enabled: false, reason: 'NO_TRANSCRIPTION_MODEL', message: 'No model. Assign one.' },
    })
    const v = make()
    await flush()
    expect(v.enabled.value).toBe(false)
    expect(v.disabledMessage.value).toBe('No model. Assign one.')
  })

  it('a disabled click opens the popup and never opens the microphone', async () => {
    api.getVoiceInput.mockResolvedValue({ data: { enabled: false, message: 'No model. Assign one.' } })
    const v = make()
    await flush()
    await v.toggle()
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toMatchObject({ hideCancel: true, message: 'No model. Assign one.' })
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  })

  it('stays disabled when the config endpoint fails — never guesses "enabled"', async () => {
    api.getVoiceInput.mockRejectedValue(new Error('boom'))
    const v = make()
    await flush()
    expect(v.enabled.value).toBe(false)
  })
})

describe('record → transcribe → auto-send', () => {
  it('sends the transcript and releases the microphone', async () => {
    const onTranscript = vi.fn()
    const v = make({ onTranscript })
    await flush()
    await v.toggle()                 // start
    expect(v.recording.value).toBe(true)
    await v.toggle()                 // stop
    await flush()
    expect(api.transcribeVoice).toHaveBeenCalledTimes(1)
    const [agentId, blob, opts] = api.transcribeVoice.mock.calls[0]
    expect(agentId).toBe(3163)
    expect(blob.size).toBeGreaterThan(0)
    expect(opts.conversationId).toBe('c9')
    expect(opts.filename).toBe('recording.webm')
    expect(onTranscript).toHaveBeenCalledWith('hello there')
    expect(tracks[0].stop).toHaveBeenCalled()      // mic indicator released
    expect(v.state.value).toBe('idle')
  })

  it('keeps what the user already typed, ahead of the transcript', async () => {
    const onTranscript = vi.fn()
    const v = make({ onTranscript, getDraft: () => 'summarize this:' })
    await flush()
    await v.toggle()
    await v.toggle()
    await flush()
    expect(onTranscript).toHaveBeenCalledWith('summarize this: hello there')
  })

  it('sends nothing when the transcript is empty', async () => {
    api.transcribeVoice.mockResolvedValue({ data: { text: '   ' } })
    const onTranscript = vi.fn()
    const v = make({ onTranscript })
    await flush()
    await v.toggle()
    await v.toggle()
    await flush()
    expect(onTranscript).not.toHaveBeenCalled()
    expect(notify.info).toHaveBeenCalled()
  })

  it('cancel discards the recording without uploading', async () => {
    const onTranscript = vi.fn()
    const v = make({ onTranscript })
    await flush()
    await v.toggle()
    v.cancel()
    await flush()
    expect(api.transcribeVoice).not.toHaveBeenCalled()
    expect(onTranscript).not.toHaveBeenCalled()
    expect(tracks[0].stop).toHaveBeenCalled()
    expect(v.state.value).toBe('idle')
  })

  it('auto-stops at the configured limit', async () => {
    vi.useFakeTimers()
    api.getVoiceInput.mockResolvedValue({ data: { enabled: true, max_seconds: 5 } })
    const v = make()
    await vi.advanceTimersByTimeAsync(0)
    await v.toggle()
    expect(v.recording.value).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(recorders[0].state).toBe('inactive')
  })
})

describe('failures never reach the agent', () => {
  it('reports a denied microphone and sends nothing', async () => {
    installMediaStack({ denied: true })
    const onTranscript = vi.fn()
    const v = make({ onTranscript })
    await flush()
    await v.toggle()
    await flush()
    expect(notify.error).toHaveBeenCalled()
    expect(String(notify.error.mock.calls[0][0])).toMatch(/microphone/i)
    expect(api.transcribeVoice).not.toHaveBeenCalled()
    expect(onTranscript).not.toHaveBeenCalled()
    expect(v.state.value).toBe('idle')
  })

  it('surfaces the server message on a failed transcription', async () => {
    api.transcribeVoice.mockRejectedValue({ response: { data: { message: 'Budget exceeded.' } } })
    const onTranscript = vi.fn()
    const v = make({ onTranscript })
    await flush()
    await v.toggle()
    await v.toggle()
    await flush()
    expect(notify.error).toHaveBeenCalledWith('Budget exceeded.')
    expect(onTranscript).not.toHaveBeenCalled()
  })
})
