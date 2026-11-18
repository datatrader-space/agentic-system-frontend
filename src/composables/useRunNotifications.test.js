// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { notifyRunFinished } from './useRunNotifications'

// The browser notification is raised only for a run the person did not watch end (`seen`), on every surface: the
// page's URL no longer decides it (phase 8 run 3, finding 41).
let made
beforeEach(() => {
  made = []
  globalThis.Notification = class { constructor(title, opts) { made.push({ title, ...opts }) } }
  globalThis.Notification.permission = 'granted'
})
afterEach(() => { delete globalThis.Notification; vi.restoreAllMocks() })

describe('notifyRunFinished', () => {
  it('notifies a run the person did not watch end', () => {
    notifyRunFinished({ agentName: 'Coding Agent', snippet: 'Done.', conversationId: '1281', seen: false })
    expect(made.map((n) => n.title)).toEqual(['Coding Agent finished'])
  })

  it('stays quiet for a run the person watched end, whatever page it is on', () => {
    notifyRunFinished({ agentName: 'Coding Agent', snippet: 'Done.', conversationId: '1281', seen: true })
    expect(made).toEqual([])
  })
})
