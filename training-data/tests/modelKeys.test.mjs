// An API key for one model, made in its Use dialog (WorkspaceModels.vue; backend model_keys.py, ADM-1180), and the
// rows of the Open models tab's "Workspace models" list (OpenModels.vue).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/components/WorkspaceModels.vue');
const list = read('../src/components/OpenModels.vue');
const api = read('../src/api/workspace.js');
const script = text => text.replace(/<style[\s\S]*<\/style>/, '');

test('the key calls go to the backend\'s model-keys routes, the workspace from the header', () => {
  assert.match(api, /list: model => apiFetch\(`\$\{APP\}\/workspace\/model-keys\/\?\$\{query\(\{ model \}\)\}`\)/);
  assert.match(api, /make: \(model, name\) => apiFetch\(`\$\{APP\}\/workspace\/model-keys\/`, \{ method: 'POST', body: \{ model, name \} \}\)/);
  assert.match(api, /revoke: id => apiFetch\(`\$\{APP\}\/workspace\/model-keys\/\$\{enc\(id\)\}\/revoke\/`/);
});

test('the Use dialog names an app and generates its key, shown once and forgotten when the dialog closes', () => {
  assert.match(page, /<label class="field-label">App name<input v-model="appName"/);
  assert.match(page, /<form v-if="keys\.may\.make" class="use-key-form" @submit\.prevent="makeKey">/);
  assert.match(page, /:disabled="making \|\| !appName\.trim\(\)"/, 'disabled while it works and without a name');
  assert.match(page, /it is shown only once/);
  assert.match(page, /watch\(using, now => \{ if \(!now\) \{ newKey\.value = null;/);
  assert.equal(/Make one on a project's Deploy page/.test(page), false, 'no detour through a project');
  assert.match(page, /Your role in this workspace reads only: it makes no API key\./);
  // Revoking asks first, inside the dialog: no native confirm.
  assert.match(page, /Revoke "\{\{ item\.name \}\}"\? Apps using its key stop working at once\./);
  assert.equal(/(^|[^.\w])(window\.)?(confirm|alert|prompt)\(/m.test(script(page)), false, 'no native dialog');
  // The key list shows a hint, never a key.
  assert.match(page, /<code>\{\{ item\.hint \|\| 'No key' \}\}<\/code>/);
  assert.equal(/v-html/.test(page), false);
});

test('the dialog says what one call is for a chat model, and shows an open model\'s licence', () => {
  assert.match(page, /using\.use\.call==='chat' \? 'Each call is one chat completion/);
  assert.match(page, /\{\{ using\.licence \|\| using\.licence_name \}\}/);
});

test('a workspace model row: name and tags on top, notes, then manage and use actions in one row', () => {
  assert.match(list, /<div class="om-row-head">[\s\S]*class="om-added-name"[\s\S]*class="om-row-tags"/);
  assert.match(list, /<div class="om-row-notes">/);
  assert.match(list, /<div class="om-row-manage">[\s\S]*Hugging Face<\/a>[\s\S]*Remove<\/UiButton>/);
  assert.match(list, /<div class="om-row-use">[\s\S]*Try it<\/UiButton>[\s\S]*Use model<\/UiButton>/);
  assert.match(list, /\.om-added-actions\{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between/);
  assert.match(list, /\.om-added-actions \.button\{min-height:44px\}/, 'touch targets on phones');
});
