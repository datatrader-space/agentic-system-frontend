// The Let's Code editor's message catalogue (ADM-1330): English only for now, ready for a second language.
import { describe, it, expect, afterEach } from 'vitest'
import { t, tn, has, locale, addCatalogue } from './messages'

afterEach(() => { locale.value = 'en' })

describe('the message catalogue', () => {
  it('gives the English words, with their placeholders filled in', () => {
    expect(t('landing.title')).toBe("Let's Code")
    expect(t('light.openPort', { port: 3000 })).toBe('Open port 3000')
    expect(t('landing.noReposMatch', { q: 'shop' })).toBe('No repositories match "shop".')
  })

  it('leaves a placeholder it has no value for, and shows a missing key as it is', () => {
    expect(t('light.openPort')).toBe('Open port {port}')
    expect(t('light.openPort', {})).toBe('Open port {port}')
    expect(t('no.such.key')).toBe('no.such.key')
    expect(has('no.such.key')).toBe(false)
    expect(has('chat.send')).toBe(true)
  })

  it('picks the plural form by the count', () => {
    expect(tn('chat.messages', 1)).toBe('1 message')
    expect(tn('chat.messages', 0)).toBe('0 messages')
    expect(tn('light.needYou', 3)).toBe('3 chats need you')
    expect(tn('chat.moreChanges', 2, { head: 'Changed 1 file: a.js' })).toBe('Changed 1 file: a.js · 2 more changes not committed')
  })

  it('a second language overrides the words it has and falls back to English for the rest', () => {
    addCatalogue('xx', { 'chat.send': 'Senden' })
    locale.value = 'xx'
    expect(t('chat.send')).toBe('Senden')
    expect(t('chat.stop')).toBe('Stop')
  })
})
