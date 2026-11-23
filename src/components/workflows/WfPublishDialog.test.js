// @vitest-environment jsdom
// The question before publishing (ADM-1351 phase 4): the server's message, what uses the workflow grouped by kind with
// names, versions and states, "N more you cannot see", the notes; Publish anyway / Cancel; a failed check with Try again.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'

vi.mock('@/services/api', () => ({ default: {} }))

import WfPublishDialog from './WfPublishDialog.vue'
import { useWorkflowPublish } from '@/composables/useWorkflowPublish'

const tick = async () => { await flushPromises(); await nextTick(); await new Promise((r) => setTimeout(r, 0)); await nextTick() }
const q = (sel) => document.body.querySelector(sel)
const qa = (sel) => [...document.body.querySelectorAll(sel)]
const button = (text) => qa('button').find((b) => b.textContent.trim() === text)

const STREAM = {
  workflow: { id: 86, public_id: 'wf_86', published_version: 2 },
  items: [
    { kind: 'stream', id: 5, name: 'Shelves: Aisle 3 camera', state: 'running', version: 2, project: 9 },
    { kind: 'trigger', id: 't1', name: 'Every morning (0 7 * * *)', state: 'active', version: null, binding: 'schedule', node_id: 'start' },
  ],
  counts: { stream: 3, batch: 0, app: 1, trigger: 1, parent: 0 },
  not_shown: { stream: 2, batch: 0, app: 1 },
  total: 5,
  confirm: true,
  message: '3 live streams use this workflow (version 2). A stream keeps the version it started with until it is restarted: publishing does not change it.',
  notes: ['Only this workflow\'s workspace is read. Workflows you cannot see are not listed as callers.'],
}

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null })

function mountDialog(answer) {
  const api = { getWorkflowGraphImpact: vi.fn(answer) }
  const doc = { publish: vi.fn(async () => true) }
  let flow
  const Host = defineComponent({
    setup() {
      flow = useWorkflowPublish(86, doc, { api })
      return () => h(WfPublishDialog, { flow })
    },
  })
  wrapper = mount(Host, { attachTo: document.body })
  return { api, doc, flow }
}

describe('WfPublishDialog', () => {
  it('a live stream: the message, the groups with names, versions and states, the hidden count and the notes', async () => {
    const { flow, doc } = mountDialog(async () => ({ data: STREAM }))
    await flow.start()
    await tick()
    const dialog = q('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain('Publish this workflow?')
    expect(dialog.textContent).toContain('3 live streams use this workflow (version 2).')
    const heads = qa('.wfb-impact__h').map((e) => e.textContent.trim())
    expect(heads).toEqual(['Live streams3', 'Connected Apps1', 'Triggers1'])
    const items = qa('.wfb-impact__item').map((e) => e.textContent.replace(/\s+/g, ' ').trim())
    expect(items).toEqual([
      'Shelves: Aisle 3 camera, v2, Running', '2 more you cannot see',
      '1 more you cannot see',
      'Every morning (0 7 * * *), Active',
    ])
    expect(q('.wfb-impact__notes').textContent).toContain('Workflows you cannot see are not listed as callers.')
    // Every group is a labelled section.
    for (const s of qa('.wfb-impact__group')) expect(document.getElementById(s.getAttribute('aria-labelledby'))).not.toBeNull()
    expect(doc.publish).not.toHaveBeenCalled()
    button('Publish anyway').click()
    await tick()
    expect(doc.publish).toHaveBeenCalledTimes(1)
    expect(q('[role="dialog"]')).toBeNull()
  })

  it('Cancel closes it and publishes nothing', async () => {
    const { flow, doc } = mountDialog(async () => ({ data: STREAM }))
    await flow.start()
    await tick()
    button('Cancel').click()
    await tick()
    expect(q('[role="dialog"]')).toBeNull()
    expect(doc.publish).not.toHaveBeenCalled()
  })

  it('a failed check says so with Try again and Cancel; there is no Publish anyway', async () => {
    let calls = 0
    const { flow, doc } = mountDialog(async () => {
      calls += 1
      if (calls === 1) throw Object.assign(new Error('x'), { response: { status: 404, data: { detail: 'Not found.' } } })
      return { data: { ...STREAM, confirm: false, items: [], counts: { stream: 0, batch: 0, app: 0, trigger: 0, parent: 0 }, not_shown: {}, total: 0 } }
    })
    await flow.start()
    await tick()
    expect(q('[role="alert"]').textContent).toContain('What uses this workflow could not be checked: Not found.')
    expect(q('[role="dialog"]').textContent).toContain('Nothing was published.')
    expect(button('Publish anyway')).toBeUndefined()
    button('Try again').click()
    await tick()
    expect(calls).toBe(2)
    expect(doc.publish).toHaveBeenCalledTimes(1)
    expect(q('[role="dialog"]')).toBeNull()
  })
})
