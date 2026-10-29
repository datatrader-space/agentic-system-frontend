import test from 'node:test';
import assert from 'node:assert/strict';
import {
  costBenchmarkApi, modelOptions, parseCallsPerDay, roundDecimal, usd, count, modelTimeText, measuredSummary, wayName,
  trafficText, METRICS, defaultMetric, barRows, barsSummary, MAX_CALLS_PER_DAY,
} from '../src/api/costBenchmark.js';

const SHARED = { way: 'shared', instance_type: null, price_set: false, price_note: 'Price set when per-call charging opens',
  model_time: { seconds: '0.50', source: 'benchmark', calls: 0, instance_type: 'ml.c5.xlarge' },
  usd_per_hour: null, usd_per_month: null, usd_per_1000_full_use: null, usd_per_1000_at_traffic: null, fits: null };
const LARGE = { way: 'dedicated', instance_type: 'ml.c5.large', usd_per_hour: '0.102', usd_per_day: '2.45', usd_per_month: '73.44',
  photos_per_hour: 3829, photos_per_day: 91914, usd_per_1000_full_use: '0.0266', usd_per_1000_at_traffic: '2.4480', fits: true,
  model_time: { seconds: '0.94', source: 'benchmark', calls: 0, instance_type: 'ml.c5.large' } };
const XL = { way: 'dedicated', instance_type: 'ml.c5.xlarge', usd_per_hour: '0.204', usd_per_day: '4.90', usd_per_month: '146.88',
  photos_per_hour: 7200, photos_per_day: 172800, usd_per_1000_full_use: '0.0283', usd_per_1000_at_traffic: '4.8960', fits: true,
  model_time: { seconds: '0.50', source: 'benchmark', calls: 0, instance_type: 'ml.c5.xlarge' } };

test('the requests go to the cost-benchmark address with only the values that are set', async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push([url, init.method]); return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  await costBenchmarkApi.models();
  await costBenchmarkApi.compare({ project: '~5', model: 2, calls_per_day: '' });
  await costBenchmarkApi.compare({ project: 'walls', model: 1, calls_per_day: 5000 });
  assert.deepEqual(seen, [
    ['/api/training-data/app/workspace/cost-benchmark/', 'GET'],
    ['/api/training-data/app/workspace/cost-benchmark/?project=%7E5&model=2', 'GET'],
    ['/api/training-data/app/workspace/cost-benchmark/?project=walls&model=1&calls_per_day=5000', 'GET'],
  ]);
});

test('every model of every project is one option, a smoke model says so', () => {
  const listing = { projects: [
    { ref: 'walls', name: 'Walls', models: [{ number: 2, name: 'walls', version: '2.0.0', smoke: false }, { number: 1, name: 'walls', version: '1.0.0', smoke: true }] },
    { ref: '~9', name: 'Doors', models: [] },
  ] };
  assert.deepEqual(modelOptions(listing), [
    { key: 'walls#2', ref: 'walls', number: 2, label: 'Walls: walls 2.0.0' },
    { key: 'walls#1', ref: 'walls', number: 1, label: 'Walls: walls 1.0.0 (smoke test)' },
  ]);
  assert.deepEqual(modelOptions(null), []);
});

test('calls a day: empty is not given, a whole number in range is taken, anything else says what is wrong', () => {
  assert.deepEqual(parseCallsPerDay(''), { value: null, problem: '' });
  assert.deepEqual(parseCallsPerDay('  '), { value: null, problem: '' });
  assert.deepEqual(parseCallsPerDay(undefined), { value: null, problem: '' });
  assert.deepEqual(parseCallsPerDay('5,000'), { value: 5000, problem: '' });
  assert.deepEqual(parseCallsPerDay(' 12 000 '), { value: 12000, problem: '' });
  for (const bad of ['abc', '1.5', '-3', '1e3']) assert.match(parseCallsPerDay(bad).problem, /whole number/, bad);
  assert.match(parseCallsPerDay('0').problem, /from 1 to 100,000,000/);
  assert.match(parseCallsPerDay(String(MAX_CALLS_PER_DAY + 1)).problem, /from 1 to/);
  assert.equal(parseCallsPerDay(String(MAX_CALLS_PER_DAY)).value, MAX_CALLS_PER_DAY);
});

test('rounding a decimal string is half up on its digits, never through a float', () => {
  assert.equal(roundDecimal('2.445', 2), '2.45');           // (2.445).toFixed(2) is 2.44
  assert.equal(roundDecimal('1.005', 2), '1.01');           // (1.005).toFixed(2) is 1.00
  assert.equal(roundDecimal('9.995', 2), '10.00');
  assert.equal(roundDecimal('99.999', 2), '100.00');
  assert.equal(roundDecimal('146.88', 2), '146.88');
  assert.equal(roundDecimal('7', 2), '7.00');
  assert.equal(roundDecimal('0.004', 2), '0.00');
  assert.equal(roundDecimal('nope', 2), null);
});

test('dollars: a fraction of a dollar keeps the backend places, from a dollar it is cents', () => {
  assert.equal(usd('0.0283'), '$0.0283');
  assert.equal(usd('0.5000'), '$0.50');
  assert.equal(usd('0.102'), '$0.102');
  assert.equal(usd('0.9792'), '$0.9792');
  assert.equal(usd('2.4480'), '$2.45');
  assert.equal(usd('73.44'), '$73.44');
  assert.equal(usd('1234.5'), '$1,234.50');
  assert.equal(usd('0'), '$0.00');
  for (const none of [null, undefined, '', 'abc']) assert.equal(usd(none), '');
  assert.equal(count(172800), '172,800');
  assert.equal(count(null), '');
});

test('the model time says where it comes from', () => {
  assert.equal(modelTimeText(LARGE.model_time), '0.94 s a photo, benchmark on ml.c5.large');
  assert.equal(modelTimeText({ seconds: '0.505', source: 'measured', calls: 1234 }), '0.505 s a photo, measured on 1,234 of its calls');
  assert.equal(modelTimeText(null), 'No model time known for this machine');
  assert.match(measuredSummary({ measured: { calls: 20, days: 30, min_calls: 20, used: true } }), /measured on this model's 20 successful calls in the last 30 days/);
  assert.match(measuredSummary({ measured: { calls: 7, days: 30, min_calls: 20, used: false } }), /had only 7 of the 20 successful calls/);
  assert.match(measuredSummary({ measured: { calls: 0, days: 30, min_calls: 20, used: false } }), /had none of the 20/);
  assert.equal(measuredSummary(null), '');
});

test('the traffic cell asks for traffic, prices it, or says one machine is not enough; the shared row has none', () => {
  assert.equal(wayName(SHARED), 'Shared Cloud API');
  assert.equal(wayName(LARGE), 'Dedicated Deployment');
  assert.equal(trafficText(SHARED, 5000), '');
  assert.equal(trafficText(LARGE, null), 'Enter your calls a day');
  assert.equal(trafficText(LARGE, 1000), '$2.45');
  assert.equal(trafficText({ ...XL, fits: false, usd_per_1000_at_traffic: null }, 200000), 'More than one machine answers in a day (172,800)');
});

test('the bars: a share of the largest, and no bar of 0 for the unpriced shared row', () => {
  assert.equal(defaultMetric(5000), 'traffic');
  assert.equal(defaultMetric(null), 'full');
  assert.deepEqual(METRICS.map(m => m.id), ['traffic', 'full', 'month']);
  const full = barRows([SHARED, LARGE, XL], 'full', null);
  assert.equal(full.unit, 'per 1,000 calls');
  assert.deepEqual(full.rows.map(r => [r.machine, r.value, r.text, r.why]), [
    ['Shared pool', null, '', 'Price set when per-call charging opens'],
    ['ml.c5.large', 0.0266, '$0.0266', ''],
    ['ml.c5.xlarge', 0.0283, '$0.0283', ''],
  ]);
  assert.equal(full.rows[0].share, 0);
  assert.equal(full.rows[2].share, 100);
  assert.ok(Math.abs(full.rows[1].share - (0.0266 / 0.0283) * 100) < 1e-9);
  const traffic = barRows([SHARED, LARGE, XL], 'traffic', null);
  assert.deepEqual(traffic.rows.slice(1).map(r => r.why), ['Enter your calls a day', 'Enter your calls a day']);
  const month = barRows([SHARED, LARGE, XL], 'month', 1000);
  assert.deepEqual(month.rows.map(r => r.text), ['', '$73.44', '$146.88']);
  assert.equal(month.unit, 'a 30-day month');
  const over = barRows([{ ...XL, fits: false, usd_per_1000_at_traffic: null }], 'traffic', 200000);
  assert.equal(over.rows[0].why, 'More than one machine would be needed');
  assert.equal(barRows([], 'nope', null).label, 'At your traffic');
});

test('the chart is told in one sentence for a screen reader', () => {
  assert.equal(barsSummary(barRows([SHARED, LARGE, XL], 'month', null)),
    'Cost a 30-day month, a month: Dedicated Deployment on ml.c5.large $73.44, Dedicated Deployment on ml.c5.xlarge $146.88. Lowest: ml.c5.large.');
  assert.equal(barsSummary(barRows([SHARED], 'full', null)), 'No way of deploying has a cost at full use yet.');
});
