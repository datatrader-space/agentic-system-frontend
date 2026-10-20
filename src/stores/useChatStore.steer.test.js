import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

// A STEER — a message the person sent while a run worked, taken in by that run — is shown INSIDE that run's
// step list, never as a bubble of its own. As a bubble its saved order (sent before the answer) put it above
// the answer on reload, while live it sat below the working run: it jumped (owner report, 2026-10-20).
vi.mock('../services/api', () => ({ default: { getConversation: vi.fn() } }))

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

const steerRow = (text, id = 5) => ({ role: 'user', kind: 'steer', content: text, serverId: id })
const answer = (steps) => ({ role: 'assistant', content: 'done', timeline: steps ? { steps } : null })

describe('_foldSteers — a reloaded steer shows inside its run', () => {
  it('drops the bubble and keeps the line the live run saved', () => {
    const chat = useChatStore()
    const saved = [{ stepId: 'a', label: 'Searching' }, { stepId: 's', label: 'end with PINEAPPLE', isSteer: true }]
    const out = chat._foldSteers([{ role: 'user', content: 'search' }, steerRow('end with PINEAPPLE'), answer(saved)])
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(out[1].timeline.steps.filter((s) => s.isSteer).length).toBe(1)
  })

  it('adds the line when the saved timeline lacks it', () => {
    const chat = useChatStore()
    const out = chat._foldSteers([steerRow('also add dates'), answer([{ stepId: 'a', label: 'Searching' }])])
    expect(out.length).toBe(1)
    expect(out[0].timeline.steps[0]).toMatchObject({ isSteer: true, label: 'also add dates' })
  })

  it('keeps the bubble when there is no run timeline to hold it — the words are never dropped', () => {
    const chat = useChatStore()
    const out = chat._foldSteers([steerRow('hello'), answer(null)])
    expect(out.map((m) => m.kind || m.role)).toEqual(['steer', 'assistant'])
    expect(chat._foldSteers([steerRow('mid-run, no answer yet')]).length).toBe(1)
  })

  it('leaves an ordinary message alone', () => {
    const chat = useChatStore()
    const list = [{ role: 'user', kind: 'message', content: 'hi' }, answer([])]
    expect(chat._foldSteers(list)).toEqual(list)
  })
})
