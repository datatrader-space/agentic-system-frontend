// @vitest-environment jsdom
// A Work turn's plan goes on its rail (ADM-1302), but only a plan the card would draw. LIVE TEST 2026-11-18: a plain
// Work turn carried a stepless plan record; the card drew nothing (a stepless plan says nothing, prod convs 1662 and
// 1666) and the rail still drew its row, a dot standing alone over an empty line at the top of the turn.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../../stores/useChatStore'
import { usePlanStore, planIsStepless } from '../../stores/usePlanStore'
import ChatMessageList from './ChatMessageList.vue'

class FakeResizeObserver { observe() {} disconnect() {} }

function mountWith(plan) {
  setActivePinia(createPinia())
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const chat = useChatStore()
  const plans = usePlanStore()
  if (plan) plans.plansByRunId = { r1: plan }
  chat.messages = [
    { id: 'u1', role: 'user', content: 'Read package.json', status: 'done' },
    { id: 'a1', role: 'assistant', content: 'It is 16.4.6.', status: 'done', turnMode: 'work',
      planArtifacts: [{ run_id: 'r1', plan_id: 'p1' }] },
  ]
  // The real ChatMessage hands the rail-plan slot to the rail; the stub just shows whether the list gave one.
  return mount(ChatMessageList, {
    global: {
      stubs: {
        InlinePlanArtifact: true,
        ChatMessage: { template: '<div class="cm"><div v-if="$slots[\'rail-plan\']" class="has-rail-plan"><slot name="rail-plan" /></div></div>' },
      },
    },
  })
}

describe('a Work turn\'s plan on its rail', () => {
  it('a stepless plan gets no rail row', () => {
    const w = mountWith({ steps: [], total_step_count: 0 })
    expect(w.find('.has-rail-plan').exists()).toBe(false)
  })

  it('a plan with steps is on the rail', () => {
    const w = mountWith({ steps: [{ id: 's1', title: 'Read the file' }] })
    expect(w.find('.has-rail-plan').exists()).toBe(true)
  })

  it('a plan not loaded yet keeps its row, so its card can load it', () => {
    const w = mountWith(null)
    expect(w.find('.has-rail-plan').exists()).toBe(true)
  })

  it('the card and the rail ask the same question', () => {
    expect(planIsStepless({ steps: [] })).toBe(true)
    expect(planIsStepless({ steps: [], total_step_count: 2 })).toBe(false)
    expect(planIsStepless(null)).toBe(false)
  })
})
