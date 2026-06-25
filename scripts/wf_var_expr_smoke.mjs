// Smoke check: output-tree variable path/expression generation + caret-insert behavior (Phase 2A).
// Verifies the generated {{ … }} expressions match the syntax the backend resolver already parses
// (nested keys, [index], [0] for ".first"), and that insert splices at the caret. No backend change.
// Run: node scripts/wf_var_expr_smoke.mjs
import { valType, isExpandable, previewValue, joinKey, joinIndex, firstOf, varExpr, insertAt } from '../src/utils/wfVarExpr.js'
import { wfOutputSample } from '../src/config/wfNodeDefinitions.js'

let failures = 0
const ok = (cond, msg) => { if (!cond) { console.error('  ✗', msg); failures++ } else { console.log('  ✓', msg) } }
const eq = (a, b) => a === b

console.log('valType:')
ok(valType([]) === 'array', 'array')
ok(valType(null) === 'null', 'null')
ok(valType({}) === 'object', 'object')
ok(valType('x') === 'string', 'string')
ok(valType(3) === 'number', 'number')
ok(valType(true) === 'boolean', 'boolean')

console.log('isExpandable:')
ok(isExpandable({ a: 1 }) === true, 'non-empty object')
ok(isExpandable([1]) === true, 'non-empty array')
ok(isExpandable({}) === false, 'empty object not expandable')
ok(isExpandable('x') === false, 'primitive not expandable')

console.log('path building:')
ok(eq(joinKey('', 'customer'), 'customer'), 'root key')
ok(eq(joinKey('customer', 'email'), 'customer.email'), 'nested key')
ok(eq(joinIndex('items', 2), 'items[2]'), 'array index')
ok(eq(joinIndex('', 0), '[0]'), 'index off root')
ok(eq(firstOf('items'), 'items[0]'), '.first → [0] (runtime-resolvable)')

console.log('varExpr (matches existing {{…}} syntax, no spaces):')
ok(eq(varExpr('nodes.n_x.output', 'customer.email'), '{{nodes.n_x.output.customer.email}}'), 'node nested path')
ok(eq(varExpr('nodes.n_x.output', 'items[0].sku'), '{{nodes.n_x.output.items[0].sku}}'), 'node array-index path')
ok(eq(varExpr('nodes.n_x.output', ''), '{{nodes.n_x.output}}'), 'whole node output')
ok(eq(varExpr('trigger', 'who'), '{{trigger.who}}'), 'trigger path')
ok(eq(varExpr('vars', 'company'), '{{vars.company}}'), 'vars path')
ok(eq(varExpr('item', ''), '{{item}}'), 'bare item')
ok(eq(varExpr('item', 'sku'), '{{item.sku}}'), 'item field')

console.log('insertAt (caret splice / append):')
ok(eq(insertAt('Hi !', 3, 3, 'X'), 'Hi X!'), 'insert at caret position 3')
ok(eq(insertAt('replace', 0, 7, 'X'), 'X'), 'replace selection')
ok(eq(insertAt('end', null, null, 'X'), 'endX'), 'append when caret unknown')
ok(eq(insertAt('', 0, 0, '{{trigger.x}}'), '{{trigger.x}}'), 'insert into empty')

console.log('previewValue:')
ok(eq(previewValue([1, 2, 3]), '[ 3 ]'), 'array count')
ok(eq(previewValue({ a: 1, b: 2 }), '{ 2 }'), 'object key count')
ok(eq(previewValue('short'), 'short'), 'short string verbatim')
ok(previewValue('x'.repeat(60)).endsWith('…'), 'long string truncated')

console.log('registry outputSample (design-time picker data):')
ok(!!wfOutputSample('action.http')?.status_code, 'action.http has sample')
ok(!!wfOutputSample('agent.run')?.text, 'agent.run has sample')
ok(wfOutputSample('logic.delay') === null, 'logic.delay has no sample (null)')
// clone isolation: mutating a returned sample must not affect the registry
const s1 = wfOutputSample('action.http'); s1.status_code = 999
ok(wfOutputSample('action.http').status_code === 200, 'outputSample is deep-cloned')

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exit(failures ? 1 : 0)
