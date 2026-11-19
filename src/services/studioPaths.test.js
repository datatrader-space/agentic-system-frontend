// @vitest-environment jsdom
// CR-2 (owner, 2026-11-19): Video Studio lives at /dashboard/video-studio, in its own shell; every old /video-studio
// link (in chats, emails and notifications) lands on the same page with its query and hash.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { LEGACY_STUDIO_BASE, STUDIO_BASE, currentStudioPath, isStudioHome, isStudioPath, studioPath } from './studioPaths'
import { legacyStudioRoute, studioChildRoutes } from './studioRoutes'
import { studioFeatures } from './studioFeatures'

const read = file => readFileSync(join(process.cwd(), file), 'utf8')
const Blank = { template: '<div />' }
function appRouter() {
  return createRouter({ history: createMemoryHistory(), routes: [
    { path: '/dashboard', component: Blank, children: [{ path: '', name: 'dashboard-home', component: Blank }, { path: 'projects/:id', component: Blank }, { path: 'chat/:sessionId', component: Blank }] },
    { path: STUDIO_BASE, component: Blank, children: studioChildRoutes },
    legacyStudioRoute,
  ] })
}

describe('the Studio address', () => {
  it('builds every Studio link from one base under the dashboard', () => {
    expect(STUDIO_BASE).toBe('/dashboard/video-studio')
    expect(studioPath()).toBe('/dashboard/video-studio')
    expect(studioPath('library')).toBe('/dashboard/video-studio/library')
    expect(studioPath('/team-spend')).toBe('/dashboard/video-studio/team-spend')
    for (const feature of studioFeatures.value) expect(feature.route.startsWith(STUDIO_BASE)).toBe(true)
    expect(isStudioHome('/dashboard/video-studio')).toBe(true); expect(isStudioHome('/dashboard/video-studio/')).toBe(true)
    expect(isStudioHome('/dashboard/video-studio/library')).toBe(false)
  })
  it('knows the current and the old address, and nothing else', () => {
    for (const path of ['/dashboard/video-studio', '/dashboard/video-studio/image', '/video-studio', '/video-studio/', '/video-studio/library']) expect(isStudioPath(path)).toBe(true)
    for (const path of ['/dashboard', '/dashboard/chat/new', '/video-studios', '/dashboard/video-studiox', '/dashboard/training-data/']) expect(isStudioPath(path)).toBe(false)
    expect(currentStudioPath('/video-studio')).toBe('/dashboard/video-studio')
    expect(currentStudioPath('/video-studio/projects/p1/review')).toBe('/dashboard/video-studio/projects/p1/review')
    expect(currentStudioPath('/dashboard/chat/new')).toBe('/dashboard/chat/new')
  })
})

describe('old /video-studio links', () => {
  it.each([
    ['/video-studio', '/dashboard/video-studio', 'video-studio'],
    ['/video-studio/', '/dashboard/video-studio', 'video-studio'],
    ['/video-studio/library?preset=neon-noir#top', '/dashboard/video-studio/library?preset=neon-noir#top', 'video-studio-library'],
    ['/video-studio/projects/p1/review', '/dashboard/video-studio/projects/p1/review', 'video-studio-project-room'],
    ['/video-studio/share/tok123', '/dashboard/video-studio/share/tok123', 'video-studio-share'],
    ['/video-studio/team-spend', '/dashboard/video-studio/team-spend', 'video-studio-team-spend'],
    ['/video-studio/publish', '/dashboard/video-studio/publish', 'video-studio-publish'],
    ['/video-studio/dashboard?conversation=c9', '/dashboard/video-studio/dashboard?conversation=c9', 'video-studio-dashboard'],
  ])('%s lands on %s', async (from, to, name) => {
    const router = appRouter()
    await router.push(from)
    expect(router.currentRoute.value.fullPath).toBe(to)
    expect(router.currentRoute.value.name).toBe(name)
  })
  it('keeps an old conversation link going to the Studio dashboard, with its query', async () => {
    const router = appRouter()
    await router.push('/video-studio?conversation=c42')
    expect(router.currentRoute.value.path).toBe('/dashboard/video-studio/dashboard')
    expect(router.currentRoute.value.query.conversation).toBe('c42')
  })
  it('does not take over the main dashboard', async () => {
    const router = appRouter()
    await router.push('/dashboard')
    expect(router.currentRoute.value.name).toBe('dashboard-home')
    await router.push('/dashboard/projects/7')
    expect(router.currentRoute.value.matched[0].path).toBe('/dashboard')
  })
})

describe('the app router (main.js)', () => {
  const main = read('src/main.js')
  it('mounts the Studio as its own top-level route with its own shell, not inside the AppShell', () => {
    expect(main).toMatch(/path: STUDIO_BASE,\s*component: \(\) => import\('\.\/components\/video-shell\/VideoStudioShell\.vue'\)/)
    expect(main).toContain('legacyStudioRoute,')
    // The AppShell's children have no video-studio entry any more.
    const dashboard = main.slice(main.indexOf("path: '/dashboard',"), main.indexOf('Separate ADMIN dashboard'))
    expect(dashboard).not.toContain('video-studio')
    expect(main).not.toContain("'/video-studio'")
  })
})

// ISSUE-3: a full load of a Studio page is dark from the first paint.
describe('the first paint of a Studio page', () => {
  const html = read('index.html')
  const script = /<script>\s*([\s\S]*?)<\/script>/.exec(html)?.[1] || ''
  function paint(path) {
    document.documentElement.className = ''
    new Function('location', 'document', script)({ pathname: path }, document)
    return document.documentElement.classList.contains('vs-boot')
  }
  it('is dark on the Studio, the old address included, and nowhere else', () => {
    expect(script).toBeTruthy()
    for (const path of ['/dashboard/video-studio', '/dashboard/video-studio/library', '/video-studio', '/video-studio/image']) expect(paint(path)).toBe(true)
    for (const path of ['/', '/dashboard', '/dashboard/chat/new', '/login', '/video-studios', '/dashboard/video-studiox']) expect(paint(path)).toBe(false)
    expect(html).toMatch(/html\.vs-boot, html\.vs-boot body \{ background: #101216;/)
    document.documentElement.className = ''
  })
  it('gives the page back its own background once the router lands outside the Studio', () => {
    const main = read('src/main.js')
    expect(main).toContain("if (typeof document !== 'undefined' && !isStudioPath(to.path)) document.documentElement.classList.remove('vs-boot')")
  })
})

// The robots and sitemap lists, the prerender list and nginx have no Studio address of their own to move.
it('leaves no other copy of the old address in the app files', () => {
  for (const file of ['nginx.conf', 'public/robots.txt', 'public/sitemap.xml', 'scripts/prerender.mjs', 'src/prerenderedPages.js']) {
    const text = read(file)
    expect(text.includes('/video-studio') && !text.includes('/dashboard/video-studio')).toBe(false)
  }
  expect(LEGACY_STUDIO_BASE).toBe('/video-studio')
})
