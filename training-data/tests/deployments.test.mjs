import test from 'node:test';
import assert from 'node:assert/strict';
import { runsChart, runsDay, RUN_RANGES, workspaceApi } from '../src/api/workspace.js';

const series = values => values.map((answered, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, answered, calls: answered }));

test('the Deployments overview asks for its range, the backend names the ranges', async () => {
  assert.deepEqual(RUN_RANGES.map(([key]) => key), ['1w', '2w', '1m', 'all']);
  const asked = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { asked.push([init.method || 'GET', url]); return new Response('{"projects":[],"runs":null}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  try { await workspaceApi.deployments('2w'); await workspaceApi.deployments(); } finally { globalThis.fetch = original; }
  assert.deepEqual(asked.map(([, url]) => url), ['/api/training-data/app/workspace/deployments/?range=2w', '/api/training-data/app/workspace/deployments/?range=1m']);
});

test('the area chart spans the box, peaks at the top and never dips below the baseline', () => {
  const chart = runsChart(series([0, 0, 4, 0, 1, 9, 0]), 1000, 200, 8);
  assert.equal(chart.max, 9);
  assert.deepEqual([chart.xs[0], chart.xs.at(-1)], [0, 1000]);
  assert.equal(Math.min(...chart.ys), 8);                                  // the peak touches the top padding
  assert.equal(Math.max(...chart.ys), 192);                                // a zero day sits on the baseline
  const numbers = chart.line.match(/-?\d+(\.\d+)?/g).map(Number);
  const yValues = numbers.filter((_, i) => i % 2 === 1);
  assert.ok(Math.max(...yValues) <= 192.01 && Math.min(...yValues) >= 7.99, 'a monotone curve never overshoots');
  assert.ok(chart.area.endsWith('L1000,200 L0,200 Z'));
});

test('no calls draws a flat line; one point fills the width; nothing draws nothing', () => {
  const flat = runsChart(series([0, 0, 0]));
  assert.equal(flat.max, 0);
  assert.ok(flat.ys.every(y => y === 192));
  assert.ok(runsChart(series([5])).line.startsWith('M0,'));
  assert.deepEqual(runsChart([]), { line: '', area: '', xs: [], ys: [], max: 0 });
});

test('a point of the overview reads as a day, or as a week', () => {
  assert.match(runsDay('2026-10-20'), /20/);
  assert.match(runsDay('2026-10-13', 'week'), /^week of .*13/);
  assert.equal(runsDay(''), '');
});
