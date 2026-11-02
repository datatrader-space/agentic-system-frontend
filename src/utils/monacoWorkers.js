// Monaco's web workers, bundled by Vite (`?worker`).
//
// Monaco asks `self.MonacoEnvironment.getWorker(label)` for a worker. With nothing set it tries to load its
// worker scripts by a relative URL the Vite bundle does not have, logs "Failed to load worker script for label:
// editorWorkerService" (plus a page error per language), and runs the language services on the page's main
// thread instead. Seen live on the Let's Code editor, 2026-11-02 (ADM-1128).
//
// Imported only by the code editor's lazy loader, so none of this is in the first-load bundle.
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker'
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker'

export function workerFor(label) {
  if (label === 'json') return new JsonWorker()
  if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
  if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
  if (label === 'typescript' || label === 'javascript') return new TsWorker()
  return new EditorWorker()
}

self.MonacoEnvironment = { getWorker: (_workerId, label) => workerFor(label) }
