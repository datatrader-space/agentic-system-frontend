// The editor's golden-frame test (contract section 10): its own Vite server on a port of its own (never the shared
// :5173), Chromium (bundled, or GOLDEN_CHANNEL=chrome for the installed Chrome, which also decodes H.264).
// GOLDEN_BROWSER=firefox or webkit (Safari's engine) runs the same frames in those browsers.
import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.GOLDEN_PORT || 5193)
const BROWSER = process.env.GOLDEN_BROWSER || 'chromium'
export default defineConfig({
  testDir: '.',
  testMatch: 'golden.pw.mjs',
  workers: 1,
  timeout: 120000,
  reporter: [['list']],
  outputDir: '../../test-results/editor-golden',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`, headless: true, viewport: { width: 800, height: 600 },
    browserName: BROWSER,
    channel: BROWSER === 'chromium' ? process.env.GOLDEN_CHANNEL || undefined : undefined,
    launchOptions: BROWSER === 'chromium'
      ? { args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
      : BROWSER === 'firefox' ? { firefoxUserPrefs: { 'media.autoplay.default': 0, 'webgl.force-enabled': true } } : {},
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: '../..', url: `http://127.0.0.1:${PORT}/tests/editor-golden/harness.html`, reuseExistingServer: false, timeout: 120000,
  },
})
