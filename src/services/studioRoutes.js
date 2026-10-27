import { studioFeatures, CREATIVE_STUDIO_PAGES as creativePages } from './studioFeatures'
const existing = {
  home: () => import('../views/VideoStudio.vue'),
  projects: () => import('../views/VideoStudioProjects.vue'),
  library: () => import('../views/VideoStudioLibrary.vue'),
  elements: () => import('../views/VideoStudioLibrary.vue'),
  help: () => import('../views/VideoStudioHelp.vue'),
}
export const studioChildRoutes = studioFeatures.value.map(feature => ({
  path: feature.route.slice('/video-studio'.length).replace(/^\//, ''),
  name: feature.id === 'home' ? 'video-studio' : `video-studio-${feature.id}`,
  component: existing[feature.id] || (['image','video'].includes(feature.id) ? () => import('../views/VideoStudioGenerate.vue') : feature.id === 'enhance' ? () => import('../views/VideoStudioEnhance.vue') : creativePages.includes(feature.id) ? () => import('../views/VideoStudioCreative.vue') : undefined),
  props: ['image','video'].includes(feature.id) ? { kind: feature.id } : { featureId: feature.id },
  meta: { studioFeature: feature.id, ...(['library','elements'].includes(feature.id) ? { libraryTab: feature.id === 'elements' ? 'ingredients' : 'files' } : {}) },
}))
studioChildRoutes.push({ path: 'ingredients', name: 'video-studio-ingredients', redirect: to => ({ path: '/video-studio/elements', query: to.query, hash: to.hash }) })
