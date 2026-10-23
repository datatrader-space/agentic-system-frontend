import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const run = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config', 'playwright.workflow.config.mjs', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || resolve('.cache/playwright') },
})
run.on('exit', code => { process.exitCode = code ?? 1 })
run.on('error', error => { console.error(error.message); process.exitCode = 1 })
