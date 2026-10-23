// Mirrors agent/services/ingestion_policy.py should_ingest(intent=chat_attachment).
import { describe, it, expect } from 'vitest'
import { willIngestChatAttachment } from './ingestionPolicy'

describe('willIngestChatAttachment', () => {
  it.each([
    ['application/pdf', 'a.pdf'],
    ['text/plain', 'notes.txt'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'cv.docx'],
    ['', 'data.csv'],
    ['application/octet-stream', 'report.md'],
  ])('ingests %s %s', (mime, name) => { expect(willIngestChatAttachment(mime, name)).toBe(true) })

  it.each([
    ['video/mp4', 'clip.mp4'],
    ['audio/mpeg', 'talk.mp3'],
    ['image/png', 'x.png'],
    ['video/mp4', 'weird.pdf'],                  // media MIME wins, as on the backend
    ['application/zip', 'bundle.zip'],
    ['', 'binary.bin'],
  ])('does not wait on %s %s', (mime, name) => { expect(willIngestChatAttachment(mime, name)).toBe(false) })
})
