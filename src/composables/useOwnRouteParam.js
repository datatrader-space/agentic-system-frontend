// Watch a route param for THIS page only (page-speed plan F-M1).
//
// A page stays mounted for its leave transition while the router already points at the next route, so
// a plain `watch(() => route.params.id, load)` fires on the way out: with undefined (calls like
// /agents/undefined/...), or with the NEXT page's param of the same name (a request for the wrong
// thing). This fires only while the route is still the one the page was mounted for, and only for a
// real, changed value.
import { watch } from 'vue'
import { useRoute } from 'vue-router'

export function isOwnParamChange(route, ownName, value, previous) {
  if (value === undefined || value === null || value === '') return false
  if (route.name !== ownName) return false
  return String(value) !== String(previous ?? '')
}

export function watchOwnRouteParam(param, callback, route = useRoute()) {
  const ownName = route.name
  return watch(() => route.params[param], (value, previous) => {
    if (isOwnParamChange(route, ownName, value, previous)) callback(value, previous)
  })
}

export default watchOwnRouteParam
