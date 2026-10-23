// defineAsyncComponent with an error state (page-speed plan F-C1).
//
// A bare defineAsyncComponent whose chunk fails to load renders nothing: the Settings modal opened
// blank, a section stayed on "Loading…" forever. Every lazy component goes through this instead:
//   - a chunk that no longer exists (deploy while the tab was open) reloads the page once
//     (services/chunkReload.js, guarded so it cannot loop);
//   - any other load failure is retried once, then shows LoadError with a Retry (reload) button.
//
// suspensible: false on purpose: inside <Suspense> Vue ignores an async component's own loading and
// error components, so a failed chunk would surface nowhere. The loaded component itself still
// joins the nearest Suspense boundary if its setup is async.
import { defineAsyncComponent, h } from 'vue'
import LoadError from '@/components/common/LoadError.vue'
import { isChunkLoadError, reloadOnceForChunkError } from '@/services/chunkReload'

const AsyncLoadError = {
  name: 'AsyncLoadError',
  props: { error: { type: [Object, Error, String], default: null } },
  setup() {
    return () => h(LoadError, {
      title: "This part of the page didn't load",
      message: 'Check your connection, then reload to try again.',
      retryText: 'Reload',
      compact: true,
      onRetry: () => window.location.reload(),
    })
  },
}

const AsyncLoading = {
  name: 'AsyncLoading',
  props: { label: { type: String, default: 'Loading…' } },
  setup(props) {
    return () => h('p', {
      role: 'status',
      style: 'margin:0;padding:20px 0;font-size:13px;color:var(--text-muted,#718096)',
    }, props.label)
  },
}

// showLoading: false for a floating widget or overlay, where an inline "Loading…" line has no place.
export function lazyComponent(loader, { loadingLabel = 'Loading…', delay = 150, showLoading = true } = {}) {
  return defineAsyncComponent({
    loader,
    suspensible: false,
    delay,
    loadingComponent: showLoading ? { render: () => h(AsyncLoading, { label: loadingLabel }) } : undefined,
    errorComponent: AsyncLoadError,
    onError(error, retry, fail, attempts) {
      if (isChunkLoadError(error) && reloadOnceForChunkError()) return // the page is reloading
      if (attempts <= 1) retry()
      else fail()
    },
  })
}

export default lazyComponent
