// Find Objects with AI as one card (owner, 2026-11-19, ADM-1182; agentic-docs/FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md):
// the person names what to find (never a fixed class list), chooses the model (never where it runs), reviews what was found
// with a confidence slider, and Save adds it beside what is drawn; a new class is added only by a person who may.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const editor = read('../src/components/AnnotationEditor.vue');
const api = read('../src/api/annotate.js');
const autoLabel = read('../src/components/AutoLabel.vue');

test('the card asks for a model, a typed class name and an optional description', () => {
  assert.match(editor, /<section v-if="detectOpen" class="find-card"/);
  // The same picker as Auto Label, NOT inline: a dropdown, with no place to choose (ADM-1182, 2026-11-19).
  assert.match(editor, /<ModelSourcePicker v-model="detectPick" :sources="meta\?\.detect\?\.sources\|\|\[\]"\/>/);
  assert.doesNotMatch(editor, /ModelSourcePicker v-model="detectPick"[^>]*\binline\b/);
  assert.match(editor, /<input id="find-class-name" v-model="findName" class="text-input" list="find-class-names"/);
  assert.match(editor, /placeholder="e\.g\. person, car, dog"/);
  assert.match(editor, /<textarea id="find-class-description" v-model="findDescription"/);
  // The project's classes are suggestions only; nothing is filled in.
  assert.match(editor, /<datalist id="find-class-names"><option v-for="c in state\.classes"/);
  assert.match(editor, /const findName=ref\(''\)/);
  assert.doesNotMatch(editor, /The AI looks for/);
  assert.doesNotMatch(editor, /['"]wall['"],\s*['"]window['"],\s*['"]door['"]/);
});

test('the typed class is sent instead of the project classes, and the API says so', () => {
  assert.match(editor, /runDetect\(pickedSource\.value\.id,null,\{name:findClass\.value,description:findDescription\.value\.trim\(\)\}\)/);
  assert.match(editor, /liveApi\.detect\(props\.state\.ref,it\.id,id,find\?null:askedClasses\(props\.state\.ref,classNames\.value\),find\)/);
  assert.match(api, /\.\.\.\(find \? \{ find \} : classes \? \{ classes \} : \{\}\)/);
  // The poll for a model that is being started keeps asking for the same class.
  assert.match(editor, /pollTimer=setTimeout\(\(\)=>runDetect\(id,refine,find\),4000\)/);
});

test('what was found is reviewed on the photo with a confidence slider before anything is added', () => {
  assert.match(editor, /Found \$\{found\.shapes\.length\} object\$\{found\.shapes\.length===1\?'':'s'\} matching "\$\{found\.cls\}"/);
  assert.match(editor, /No object matching "\$\{found\.cls\}" was found/);
  assert.match(editor, /<label v-if="foundScored" class="find-threshold">/);
  assert.match(editor, /x\.score\*100>=findThreshold\.value/);
  assert.match(editor, /<g v-if="found" class="find-preview" pointer-events="none"><polygon v-for="shape in foundKept"/);
  assert.match(editor, /<UiButton @click="found=null">Back<\/UiButton>/);
  assert.match(editor, /`Save \(\$\{foundKept\.length\}\)`/);
});

test('Save adds the kept shapes beside what is drawn, as one Undo step, and adds a new class first', () => {
  assert.match(editor, /remember\(\);const before=shapes\.value\.length;shapes\.value=\[\.\.\.shapes\.value,\.\.\.kept\.map/);
  assert.doesNotMatch(editor, /What is drawn now is thrown away and replaced/);
  // The new class takes the next palette colour no class of the project has (live, 2026-11-19: "sofa" got the red of "wall").
  assert.match(editor, /liveApi\.addClass\(props\.state\.ref,\{name:f\.cls,color:nextClassColor\(props\.state\.classes\),description:findDescription\.value\.trim\(\)\}\)/);
  assert.match(editor, /liveApi\.addClass\(props\.state\.ref,\{name:editorClassName\.value,color:nextClassColor\(props\.state\.classes\)\}\)/);
  // A class that could not be added adds nothing.
  assert.match(editor, /was not added to the project's classes, so nothing was added/);
});

test('a new class is offered only to a person who may change classes, and never while they are locked', () => {
  assert.match(editor, /const mayAddClass=computed\(\(\)=>!!props\.state\.canChangeClasses&&!props\.state\.classesLocked\)/);
  assert.match(editor, /its classes are locked':'your role does not add classes'/);
  assert.match(api, /store\.classesLocked = !!body\.locked/);
  assert.match(editor, /state\.canChangeClasses&&!state\.classesLocked&&!meta\?\.readonly/);
  assert.match(autoLabel, /!!props\.state\.canChangeClasses && !props\.state\.classesLocked/);
});

test('Find Objects works in a project with no class yet, and Start over lives in the label menu', () => {
  assert.match(editor, /<UiButton class="find-ai" title="Find any object you name, with a model \(M\)" :disabled="live&&!meta\?\.detect"/);
  assert.match(editor, /Start over from…/);
  assert.doesNotMatch(editor, /class="detect-dialog"/);
  assert.doesNotMatch(editor, /The model offered first here/);
});
