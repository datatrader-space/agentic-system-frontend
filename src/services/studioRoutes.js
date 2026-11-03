import { studioFeatures, CREATIVE_STUDIO_PAGES as creativePages } from './studioFeatures'
const existing = {
  home: () => import('../views/VideoStudioDiscover.vue'),
  projects: () => import('../views/VideoStudioProjects.vue'),
  library: () => import('../views/VideoStudioLibrary.vue'),
  elements: () => import('../views/VideoStudioElements.vue'),
  help: () => import('../views/VideoStudioHelp.vue'),
}
export const studioChildRoutes = studioFeatures.value.map(feature => ({
  path: feature.route.slice('/video-studio'.length).replace(/^\//, ''),
  name: feature.id === 'home' ? 'video-studio' : `video-studio-${feature.id}`,
  component: existing[feature.id] || (['image','video'].includes(feature.id) ? () => import('../views/VideoStudioGenerate.vue') : feature.id === 'enhance' ? () => import('../views/VideoStudioEnhance.vue') : creativePages.includes(feature.id) ? () => import('../views/VideoStudioCreative.vue') : undefined),
  props: ['image','video'].includes(feature.id) ? { kind: feature.id } : { featureId: feature.id },
  ...(feature.id === 'home' ? { beforeEnter: to => (to.query.conversation || to.query.project) ? { path: '/video-studio/dashboard', query: to.query, hash: to.hash } : true } : {}),
  meta: { studioFeature: feature.id, ...(['library','elements'].includes(feature.id) ? { libraryTab: feature.id === 'elements' ? 'ingredients' : 'files' } : {}) },
}))
studioChildRoutes.push({ path: 'ingredients', name: 'video-studio-ingredients', redirect: to => ({ path: '/video-studio/elements', query: to.query, hash: to.hash }) })

// Dashboard reuses the existing production Studio composer/session, while Discover is the default landing.
studioChildRoutes.push({ path: 'dashboard', name: 'video-studio-dashboard', component: () => import('../views/VideoStudio.vue'), meta: { studioFeature: 'dashboard' } })
studioChildRoutes.push({ path: 'discover', redirect: to => ({ path: '/video-studio', query: to.query, hash: to.hash }) })
