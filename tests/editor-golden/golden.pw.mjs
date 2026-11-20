// Golden frames (contract section 10, plan P3, ADM-1199): every sample the backend renders with the export
// (`manage.py editor_golden <dir>`, 320x180 PNGs) is rendered again here with the editor's WebGL compositor in
// Chromium, and each frame must reach a PSNR of at least 35 dB against the export's.
//
// The reference folder (GOLDEN_DIR, default tests/editor-golden/reference) holds what the backend command writes:
//   golden.json   {width, height, media: {<id>: "media/<file>"}, derived: {"<id>:<op>": <id>}, samples: [{id, doc,
//                 times_ms}]} (editor_cases/golden.json; a plain list of samples, each with its own media, also works)
//   media/...     the synthetic files the samples use
//   png_chroma    in golden.json, optional: how the PNGs were converted from yuv420p, 'nearest' (the default: ffmpeg's
//                 format=rgb24) or 'bilinear' (scale=flags=bilinear+full_chroma_int+accurate_rnd)
//   <id>_<t>.png  the export's frame of sample <id> at <t> ms (or a sample's frames: [{t_ms, png}])
// With no golden.json there the test is skipped and says so.
//
// Run: npx playwright test -c tests/editor-golden/playwright.config.mjs  (GOLDEN_CHANNEL=chrome to decode H.264 media)
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const DIR = process.env.GOLDEN_DIR || 'tests/editor-golden/reference'
const MIN_PSNR = 35
const file = path.join(DIR, 'golden.json')
const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
const samples = raw ? (Array.isArray(raw) ? raw : raw.samples || []) : []
const base = '/' + DIR.replace(/\\/g, '/').replace(/^\.?\//, '')

const frames = s => (s.frames || (s.times_ms || []).map(t => ({ t_ms: t, png: `${s.id}_${t}.png` })))

test.describe('golden frames: the preview against the export', () => {
  if (!samples.length) {
    test('reference frames are present', () => {
      test.skip(true, raw ? `${file} lists no samples.`
        : `No reference frames in ${DIR}: run the backend's "python manage.py editor_golden <dir>" and copy its golden.json, media/ and PNGs into ${DIR} (contract section 10).`)
    })
  }
  for (const sample of samples) {
    for (const f of frames(sample)) {
      test(`${sample.id} at ${f.t_ms} ms`, async ({ page }, info) => {
        const missing = path.join(DIR, f.png)
        test.skip(!fs.existsSync(missing), `the reference ${missing} is missing`)
        await page.goto('/tests/editor-golden/harness.html')
        await page.waitForFunction(() => window.goldenReady === true)
        const r = await page.evaluate(args => window.golden(args), { base, sample, t: f.t_ms, reference: f.png, media: raw.media || {},
          derived: raw.derived || {}, chroma420: raw.png_chroma || 'nearest' })
        const out = info.outputPath(`${sample.id}_${f.t_ms}.preview.png`)
        fs.writeFileSync(out, Buffer.from(r.png, 'base64'))
        info.annotations.push({ type: 'psnr', description: `${r.psnr.toFixed(2)} dB (${r.width}x${r.height})` })
        expect(r.psnr, `PSNR of ${sample.id} at ${f.t_ms} ms (preview saved as ${out})`).toBeGreaterThanOrEqual(MIN_PSNR)
      })
    }
  }
})
