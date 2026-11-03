import { useRoute, useRouter } from 'vue-router'
// Keep a selected look shareable without creating a conversation or submitting a job.
export function useStudioPresetRoute() {
  const route=useRoute(),router=useRouter()
  return (id,mode) => { if(!route || !router) return; return router.replace({path:route.path,query:{...route.query,preset:id || undefined,...(mode?{mode}:{})}}) }
}
