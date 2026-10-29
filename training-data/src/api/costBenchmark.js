// The Cost Benchmark tab of the workspace's Deployments page. Backend: training_models_data/cost_benchmark_api.py
// (GET workspace/cost-benchmark/ for the models, ?project=&model=&calls_per_day= for the comparison). Every figure is
// the backend's, worked out in Decimal and rounded there; these helpers only put it in words. A price the backend
// does not have (the Shared Cloud API's) stays empty here too: nothing is ever made up.
import { apiFetch } from './client.js';

const APP = '/training-data/app';
const SLOW = 30000;

export const MAX_CALLS_PER_DAY = 100000000;

function query(params) {
  return new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)).toString();
}

export const costBenchmarkApi = {
  models: () => apiFetch(`${APP}/workspace/cost-benchmark/`, { timeoutMs: SLOW }),
  compare: ({ project, model, calls_per_day }) => apiFetch(`${APP}/workspace/cost-benchmark/?${query({ project, model, calls_per_day })}`, { timeoutMs: SLOW }),
};

// The models a person may pick, one option each. `key` is stable for a project and model number.
export function modelOptions(listing) {
  const options = [];
  for (const project of listing?.projects || []) {
    for (const model of project.models || []) {
      options.push({
        key: `${project.ref}#${model.number}`, ref: project.ref, number: model.number,
        label: `${project.name}: ${model.name} ${model.version}${model.smoke ? ' (smoke test)' : ''}`,
      });
    }
  }
  return options;
}

// The calls-a-day field: '' is "not given"; otherwise a whole number from 1 to MAX_CALLS_PER_DAY (commas allowed).
export function parseCallsPerDay(text) {
  const raw = String(text ?? '').trim().replace(/[,_\s]/g, '');
  if (!raw) return { value: null, problem: '' };
  if (!/^\d+$/.test(raw)) return { value: null, problem: 'Enter a whole number of calls, such as 5000.' };
  const value = Number(raw);
  if (value < 1 || value > MAX_CALLS_PER_DAY) return { value: null, problem: `Enter from 1 to ${MAX_CALLS_PER_DAY.toLocaleString('en-US')} calls a day.` };
  return { value, problem: '' };
}

// A decimal string rounded half up to `places`, done on the digits so no float error creeps in ('2.445' -> '2.45').
export function roundDecimal(text, places) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(text ?? '').trim());
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const digits = (whole + fraction.padEnd(places + 1, '0').slice(0, places + 1)).split('').map(Number);
  const up = digits.pop() >= 5;
  if (up) {
    let i = digits.length - 1;
    while (i >= 0) { if (digits[i] === 9) { digits[i] = 0; i -= 1; } else { digits[i] += 1; break; } }
    if (i < 0) digits.unshift(1);
  }
  const all = digits.join('');
  const head = all.slice(0, all.length - places).replace(/^0+(?=\d)/, '') || '0';
  const tail = places ? `.${all.slice(all.length - places)}` : '';
  return `${sign}${head}${tail}`;
}

// A dollar amount from the backend's decimal string. Under a dollar it keeps the backend's places with trailing zeros
// trimmed, at least 2 ('0.0283' -> $0.0283, '0.5000' -> $0.50): a cost per 1,000 calls is often a fraction of a cent.
// From a dollar it is cents with thousands separators ('2.4480' -> $2.45, '1234.5' -> $1,234.50).
export function usd(text) {
  if (text === null || text === undefined || text === '') return '';
  const value = String(text).trim();
  if (!/^-?\d+(\.\d+)?$/.test(value)) return '';
  if (Math.abs(Number(value)) < 1) {
    const [whole, fraction = ''] = value.split('.');
    return `$${whole}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`;
  }
  const [whole, cents] = roundDecimal(value, 2).split('.');
  return `$${Number(whole).toLocaleString('en-US')}.${cents}`;
}

export const count = value => (value === null || value === undefined ? '' : Number(value).toLocaleString('en-US'));

// Where the model time of a row comes from, in words.
export function modelTimeText(time) {
  if (!time) return 'No model time known for this machine';
  const seconds = `${time.seconds} s a photo`;
  if (time.source === 'measured') return `${seconds}, measured on ${count(time.calls)} of its calls`;
  return `${seconds}, benchmark on ${time.instance_type}`;
}

// The one line above the table: which model time the comparison uses.
export function measuredSummary(body) {
  const measured = body?.measured;
  if (!measured) return '';
  if (measured.used) return `Model time measured on this model's ${count(measured.calls)} successful calls in the last ${measured.days} days.`;
  const had = measured.calls ? `only ${count(measured.calls)}` : 'none';
  return `This model had ${had} of the ${measured.min_calls} successful calls in the last ${measured.days} days that a measured time needs, so each machine uses its benchmark time.`;
}

// The way of deploying, as the first cell says it.
export const wayName = option => (option.way === 'shared' ? 'Shared Cloud API' : 'Dedicated Deployment');

// The "at your traffic" cell.
export function trafficText(option, callsPerDay) {
  if (option.way === 'shared') return '';
  if (!callsPerDay) return 'Enter your calls a day';
  if (option.fits === false) return `More than one machine answers in a day (${count(option.photos_per_day)})`;
  return usd(option.usd_per_1000_at_traffic);
}

// The bar comparison's measures. Each bar is one way of deploying; the shared row has no price, so it has no bar.
export const METRICS = [
  { id: 'traffic', label: 'At your traffic', field: 'usd_per_1000_at_traffic', unit: 'per 1,000 calls' },
  { id: 'full', label: 'At full use', field: 'usd_per_1000_full_use', unit: 'per 1,000 calls' },
  { id: 'month', label: 'A month', field: 'usd_per_month', unit: 'a 30-day month' },
];

export const defaultMetric = callsPerDay => (callsPerDay ? 'traffic' : 'full');

// The bars for `metric`: each with its value in words and its length as a share of the largest (0 to 100). A row
// with no figure has `value` null and says why instead of drawing a bar of 0.
export function barRows(options, metric, callsPerDay) {
  const spec = METRICS.find(m => m.id === metric) || METRICS[0];
  const rows = (options || []).map(option => {
    // No traffic given: no cost at traffic, even if a figure from an earlier answer is still on the row.
    const raw = spec.id === 'traffic' && !callsPerDay ? null : option[spec.field];
    const value = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    let why = '';
    if (value === null) {
      if (option.way === 'shared') why = option.price_note || 'Price set when per-call charging opens';
      else if (spec.id === 'traffic' && !callsPerDay) why = 'Enter your calls a day';
      else if (spec.id === 'traffic' && option.fits === false) why = 'More than one machine would be needed';
      else why = 'No model time known for this machine';
    }
    return { key: option.instance_type || option.way, name: wayName(option), machine: option.instance_type || 'Shared pool',
             value, text: value === null ? '' : usd(raw), why };
  });
  const top = Math.max(0, ...rows.filter(r => r.value !== null).map(r => r.value));
  for (const row of rows) row.share = row.value === null ? 0 : top > 0 ? Math.max(1.5, (row.value / top) * 100) : 0;
  return { rows, unit: spec.unit, label: spec.label };
}

// What a screen reader is told about the chart, in one sentence.
export function barsSummary(bars) {
  const priced = bars.rows.filter(r => r.value !== null);
  if (!priced.length) return `No way of deploying has a cost ${bars.label.toLowerCase()} yet.`;
  const lowest = priced.reduce((a, b) => (b.value < a.value ? b : a));
  return `Cost ${bars.unit}, ${bars.label.toLowerCase()}: ${priced.map(r => `${r.name} on ${r.machine} ${r.text}`).join(', ')}. Lowest: ${lowest.machine}.`;
}
