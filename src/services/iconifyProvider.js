// Where Iconify asks for an icon this app did not bundle (a name that only arrives in an API response, such as a
// connector's logo): AADML's own /api/iconify (ADM-1342). The backend answers from the icons it stored, sanitized,
// when it handed the name out, so no browser asks api.iconify.design (or its mirrors) for anything.
//
// The bundled `logos:*` are a chunk of their own; every file that names one imports 'virtual:icon-subset-logos'
// itself (iconifyProvider.test.js checks it), so a bundled logo is registered before that file renders and is never
// asked of the API.
import { addAPIProvider } from '@iconify/vue'

export const ICON_API = '/api/iconify'

export function useAadmlIconApi() {
  addAPIProvider('', { resources: [ICON_API] })
}
