import { describe, it, expect } from 'vitest'
import {
  challengeLabel, isEnded, keyAction, parseFrame, pointerEvent, stateLabel, textEvent, toRemotePoint, wheelEvent,
} from './browserLive'

// The relay's framing: a 4-byte big-endian length, a JSON header, then the JPEG.
function frame(header, body = [0xff, 0xd8, 0xff, 0x01]) {
  const head = new TextEncoder().encode(JSON.stringify(header))
  const out = new Uint8Array(4 + head.length + body.length)
  new DataView(out.buffer).setUint32(0, head.length)
  out.set(head, 4)
  out.set(body, 4 + head.length)
  return out.buffer
}

describe('a frame message', () => {
  it('is split into its header and its picture', () => {
    const got = parseFrame(frame({ t: 'frame', seq: 7, w: 1440, h: 900, address: 'https://shop.example/cart' }))
    expect(got.header).toEqual({ t: 'frame', seq: 7, w: 1440, h: 900, address: 'https://shop.example/cart' })
    expect(Array.from(got.jpeg)).toEqual([0xff, 0xd8, 0xff, 0x01])
  })

  it('may carry no picture at all (a masked page)', () => {
    const got = parseFrame(frame({ t: 'frame', seq: 8, masked: 'secret' }, []))
    expect(got.header.masked).toBe('secret')
    expect(got.jpeg.byteLength).toBe(0)
  })

  it('is refused when it is not one', () => {
    expect(parseFrame(null)).toBeNull()
    expect(parseFrame(new ArrayBuffer(2))).toBeNull()
    expect(parseFrame(frame({ t: 'state' }))).toBeNull()
    const lying = new Uint8Array(8)
    new DataView(lying.buffer).setUint32(0, 9999)        // says its header is longer than the message
    expect(parseFrame(lying.buffer)).toBeNull()
    const junk = new Uint8Array([0, 0, 0, 2, 0x7b, 0x7b])  // a header that is not JSON
    expect(parseFrame(junk.buffer)).toBeNull()
  })
})

describe('a click on the picture', () => {
  const viewport = { w: 1440, h: 900 }
  // The picture is drawn at half size, 100px in from the left and 50px down.
  const rect = { left: 100, top: 50, width: 720, height: 450 }

  it('lands on the same spot of the remote page, whatever size the panel is', () => {
    expect(toRemotePoint(100, 50, rect, viewport)).toEqual({ x: 0, y: 0 })
    expect(toRemotePoint(460, 275, rect, viewport)).toEqual({ x: 720, y: 450 })
    expect(toRemotePoint(250, 112.5, rect, viewport)).toEqual({ x: 300, y: 125 })
  })

  it('stays on the page when the pointer leaves the picture', () => {
    expect(toRemotePoint(5000, -20, rect, viewport)).toEqual({ x: 1439, y: 0 })
  })

  it('means nothing before there is a picture', () => {
    expect(toRemotePoint(10, 10, { left: 0, top: 0, width: 0, height: 0 }, viewport)).toBeNull()
    expect(toRemotePoint(10, 10, rect, { w: 0, h: 0 })).toBeNull()
    expect(pointerEvent('down', null)).toBeNull()
  })

  it('carries its button and its click count, and a move carries neither', () => {
    expect(pointerEvent('down', { x: 3, y: 4 }, 2, 2)).toEqual({ t: 'pointer', k: 'down', x: 3, y: 4, b: 'right', c: 2 })
    expect(pointerEvent('up', { x: 3, y: 4 }, 9, 9)).toEqual({ t: 'pointer', k: 'up', x: 3, y: 4, b: 'left', c: 3 })
    expect(pointerEvent('move', { x: 3, y: 4 }, 0, 1)).toEqual({ t: 'pointer', k: 'move', x: 3, y: 4 })
  })

  it('scrolls by pixels however the wheel reports itself', () => {
    const at = { x: 10, y: 20 }
    expect(wheelEvent(at, { deltaX: 0, deltaY: 120, deltaMode: 0 })).toEqual({ t: 'wheel', x: 10, y: 20, dx: 0, dy: 120 })
    expect(wheelEvent(at, { deltaX: 0, deltaY: 3, deltaMode: 1 }).dy).toBe(120)
    expect(wheelEvent(at, { deltaX: 0, deltaY: 1, deltaMode: 2 }).dy).toBe(800)
  })
})

describe('a key', () => {
  it('is forwarded by name', () => {
    expect(keyAction({ key: 'Enter' }, 'down')).toEqual({ event: { t: 'key', k: 'down', key: 'Enter' } })
    expect(keyAction({ key: 'a', shiftKey: true }, 'up')).toEqual({ event: { t: 'key', k: 'up', key: 'a' } })
  })

  it('is not forwarded when it is paste: the text comes from our own page instead', () => {
    expect(keyAction({ key: 'v', ctrlKey: true }, 'down')).toEqual({ paste: true })
    expect(keyAction({ key: 'V', metaKey: true }, 'down')).toEqual({ paste: true })
  })

  it('is ignored while an input method is composing, and when it has no name', () => {
    expect(keyAction({ key: 'a', isComposing: true }, 'down')).toBeNull()
    expect(keyAction({ key: 'Process' }, 'down')).toBeNull()
    expect(keyAction({ key: '' }, 'down')).toBeNull()
    expect(keyAction(null, 'down')).toBeNull()
  })

  it('text is one event, cut to what the relay accepts', () => {
    expect(textEvent('hello')).toEqual({ t: 'text', text: 'hello' })
    expect(textEvent('x'.repeat(9000)).text).toHaveLength(4000)
    expect(textEvent('')).toBeNull()
  })
})

describe('what a session is called', () => {
  it('reads as a person would say it', () => {
    expect(stateLabel({ state: 'ACTIVE' })).toBe('Working')
    expect(stateLabel({ state: 'READY' })).toBe('Starting')
    expect(stateLabel({ state: 'WAITING_HUMAN' })).toBe('Waiting for you')
    expect(stateLabel({ state: 'STOPPED' })).toBe('Ended')
    expect(stateLabel({ state: 'ACTIVE', control: { mine: true } })).toBe('You are in control')
    expect(stateLabel(null)).toBe('')
  })

  it('knows which states are over', () => {
    for (const state of ['STOPPED', 'FAILED', 'CANCELLED', 'REAPED']) expect(isEnded({ state })).toBe(true)
    for (const state of ['READY', 'ACTIVE', 'WAITING_HUMAN']) expect(isEnded({ state })).toBe(false)
    expect(isEnded(null)).toBe(false)
  })

  it('says what the page is asking for', () => {
    expect(challengeLabel('CAPTCHA')).toContain('only a person')
    expect(challengeLabel('MFA')).toContain('code')
    expect(challengeLabel('LOGIN')).toContain('sign in')
    expect(challengeLabel('')).toBe('')
  })
})
