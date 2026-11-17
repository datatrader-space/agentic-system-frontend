// What a training run or an evaluation used, and what it cost (ADM-1210 §3.9): the rows of the "What this run used"
// block and the cost words of a run's or an evaluation's view, vision and language model alike. The backend
// (training_models_data/provenance.py) sends ``used``, ``cost`` and, on each attempt, ``cost``, ``own_machine``,
// ``billable_seconds`` and ``job_name``. Nothing is invented: a value that is empty or missing is left out.
import { billableText, attemptText } from './models.js';

// A sha256 or a commit as the page shows it: its first 12 characters (the full value goes in a title and the copy).
export const SHORT = 12;
export function shortSha(value) {
  const text = value == null ? '' : String(value);
  return text.length > SHORT ? text.slice(0, SHORT) : text;
}

const empty = value => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);

// The provider's own words; one this page does not know is shown as the backend names it.
const PROVIDERS = { local: "AADML's own computer", machine: 'Your own machine', runpod: 'RunPod', managed: 'Amazon SageMaker' };
export const providerText = name => PROVIDERS[name] || name || '';
// Who marks a language-model evaluation's answers, in the backend's words (llm/models.py MARKING_CHOICES).
const MARKING = { none: 'Automatic measures only', people: 'People', ai: 'AI judge', both: 'People and AI judge' };

// One row: ``text`` is read as is, ``sha`` is shown short (12 characters) with its full value to copy.
function row(label, text, sha) {
  if (empty(text) && empty(sha)) return null;
  return { label, text: empty(text) ? '' : String(text), sha: empty(sha) ? '' : String(sha) };
}
function group(key, title, rows) {
  const kept = rows.filter(Boolean);
  return kept.length ? { key, title, rows: kept } : null;
}
const yesNo = value => (value === true ? 'Yes' : value === false ? 'No' : '');

// The versions the job said it ran on (``runtime``), flat: ``{python: '3.11', packages: {torch: '2.4'}}`` gives
// "python 3.11" and "packages torch 2.4". Arrays are joined; empty values are left out.
export function runtimeRows(runtime, prefix = '') {
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) return [];
  const rows = [];
  for (const [key, value] of Object.entries(runtime)) {
    const label = prefix ? `${prefix} ${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) rows.push(...runtimeRows(value, label));
    else if (Array.isArray(value)) { if (value.length) rows.push({ label, text: value.join(', '), sha: '' }); }
    else if (!empty(value)) rows.push({ label, text: String(value), sha: '' });
  }
  return rows;
}

// The configuration part: its name, whether these are the values the job resolved or the ones it was started with,
// its sha256, a vision run's seed and the values themselves (pretty JSON). null when there is nothing to show.
export function configPart(used) {
  const values = used?.config;
  const hasValues = !!values && typeof values === 'object' && Object.keys(values).length > 0;
  if (!hasValues && empty(used?.config_name) && empty(used?.config_sha256) && empty(used?.seed)) return null;
  return {
    name: used.config_name || '',
    source: hasValues ? (used.config_resolved === true ? 'Resolved by the job' : 'As started') : '',
    sha: used.config_sha256 || '',
    seed: empty(used.seed) ? '' : String(used.seed),
    text: hasValues ? JSON.stringify(values, null, 2) : '',
  };
}

// The groups of the block (the configuration is apart: configPart), in the order a person checks them. ``what`` is
// 'run' or 'evaluation'; the family (vision or language model) is read from the fields the backend sent.
export function usedGroups(used, what = 'run') {
  if (!used || typeof used !== 'object') return [];
  const llm = 'method' in used || 'base_model' in used || 'marking' in used || 'suite' in used;
  const placement = used.placement || {};
  const groups = [];

  if (what === 'run') {
    groups.push(group('data', 'Data', [row('Dataset version', used.dataset_version), row('Dataset files', '', used.dataset_manifest_sha256)]));
    if (llm) {
      groups.push(group('start', 'Started from', [
        row('Method', used.method ? String(used.method).toUpperCase() : ''),
        row('Base model', used.base_model), row('Base model revision', '', used.base_model_revision),
        row('Base model files', '', used.base_manifest_sha256),
        row('Continues model', used.continues_model),
      ]));
    } else {
      groups.push(group('start', 'Started from', [row('Continues run', empty(used.continues_run) ? '' : `Run ${used.continues_run}`)]));
    }
  }

  groups.push(group('code', 'Code', [
    row('Commit', used.code_dirty ? 'with local changes' : '', used.code_commit),
    row('Code files', '', used.code_tree_sha256),
  ]));
  groups.push(group('image', 'Image', [row('Image', '', used.image_digest), row('Kind', used.image_kind)]));

  const own = (used.own_machines || []).filter(Boolean);
  groups.push(group('machine', 'Machine', [
    row('Provider', providerText(used.provider)), row('Instance type', used.instance_type),
    row('Machine kind', placement.kind ? String(placement.kind).toUpperCase() : ''),
    row('GPU', placement.gpu_name), row('vCPUs', placement.vcpus),
    row('Memory', empty(placement.memory_gb) ? '' : `${placement.memory_gb} GB`),
    row('Data center', placement.data_center), row('SOC 2 data center', yesNo(placement.soc2)),
    row(own.length === 1 ? 'Your machine' : 'Your machines', own.join(', ')),
    row('Longest it may run', empty(used.max_runtime_seconds) ? '' : billableText(used.max_runtime_seconds)),
  ]));

  if (what === 'run') {
    // What the job reported about itself; a value that only repeats the Machine's instance type (its "gpu" and its
    // "instance_type", seen twice on the live page on 2026-11-12) is left out. One that differs stays: it is news.
    const asked = empty(used.instance_type) ? null : String(used.instance_type);
    groups.push(group('runtime', 'Runtime', runtimeRows(used.runtime)
      .filter(r => !(asked && ['gpu', 'instance_type'].includes(r.label) && r.text === asked))));
    const made = used.model || {};
    groups.push(group('made', 'What it made', [row('Model file', '', made.artifact_sha256), row('ONNX file', '', made.onnx_sha256)]));
  } else if (llm) {
    const model = used.model || {};
    groups.push(group('compared', 'What it compared', [
      row('Model', model.version, model.artifact_sha256), row('Questions', used.suite), row('Marked by', MARKING[used.marking] || used.marking),
    ]));
  } else {
    const model = used.model || {}; const previous = used.previous || {};
    groups.push(group('compared', 'What it compared', [
      row('Model', model.version, model.onnx_sha256), row('Previous model', previous.version, previous.onnx_sha256),
      row('Test photos', used.test_version, used.test_manifest_sha256),
      row('Golden photos', used.golden_version, used.golden_manifest_sha256),
      row('Evaluator version', used.evaluator_version), row('Report', '', used.report_sha256),
    ]));
  }
  return groups.filter(Boolean);
}

// USD as text as a person reads it: cents as cents ("1.20" is "$1.20"), and a fraction of a cent to a hundredth of a
// cent ("0.0264" is "$0.0264"). A short job costs a fraction of a cent, and its attempts each rounded to the cent did
// not add up to the run's own cost ($0.03 + $0.01 under "$0.03 charged", seen live on 2026-11-12).
export const usd = value => `$${Number(value || 0).toFixed(4).replace(/(\.\d{2}\d*?)0+$/, '$1')}`;
const someHeld = cost => Number(cost?.held || 0) > 0;

// What the PERSON is charged and held, markup included: the block's ``price`` (provenance.py, 2026-11-17), else, from a
// backend before it, the block's own settled / held / total. null when there is no cost block.
export function personCost(cost) {
  if (!cost || typeof cost !== 'object') return null;
  const price = cost.price && typeof cost.price === 'object' ? cost.price : null;
  const from = price || cost;
  if (empty(from.total) && empty(from.settled) && empty(from.held)) return null;
  return { settled: from.settled ?? '0', held: from.held ?? '0', total: from.total ?? '0' };
}

function amountText(price) {
  if (!someHeld(price)) return `${usd(price.total)} charged.`;
  return `${usd(price.total)} at most: ${usd(price.settled)} charged and ${usd(price.held)} held while it runs, the most the rest can cost.`;
}

// The Cost line. On the person's own machine: AADML's platform fee for it (``price_text``, "$0.10 an hour, on your
// machine"), then what was charged and held for it; a machine of the person's is not free (live, 2026-11-17: "No AADML
// machine cost" while $0.0625 was held). On AADML's own computer nothing is charged. Else what was charged, and while
// it runs, the part still held (the most the rest can cost). ``machine``: the run's or evaluation's ``machine`` row.
export function costText(cost, ownMachines = [], machine = null) {
  if (!cost) return '';
  const price = personCost(cost);
  const fee = String(cost.price_text || machine?.price_text || '').trim();
  const own = [...(ownMachines || []), machine?.name].filter(Boolean).filter((name, i, all) => all.indexOf(name) === i);
  if (own.length || fee || machine) {
    const where = own.length ? `On your machine ${own.join(', ')}` : 'On your machine';
    const head = `${where}: ${fee ? `the platform fee, ${fee}` : 'the platform fee for your machine'}, charged by the second.`;
    return price && (cost.price || Number(price.total) > 0 || someHeld(price)) ? `${head} ${amountText(price)}` : head;
  }
  if (cost.paid === false) return price && Number(price.total) > 0 ? amountText(price) : "Nothing is charged for the machine: it ran on AADML's own computer.";
  return price ? amountText(price) : '';
}

// An attempt's Cost cell: what the person was charged for it (``cost.price``, else its old total), with a note when part
// of it is still held, and, on the person's own machine, where it ran.
export function attemptCost(attempt) {
  const price = personCost(attempt?.cost);
  const where = attempt?.own_machine ? `Ran on ${attempt.own_machine}` : '';
  if (!price) return { text: '—', note: where };
  const held = someHeld(price) ? `${usd(price.held)} of it held while it runs` : '';
  return { text: usd(price.total), note: [held, where].filter(Boolean).join('. ') };
}

// An attempt's machine time. ``billable_seconds`` stays 0 until its job ends, so while it is active the time since it
// started is shown ("so far"), or '—' before it started; never "0 s" for a job that is running.
const ACTIVE = ['queued', 'starting', 'running', 'finalizing'];
export function attemptTime(attempt, now = Date.now()) {
  const seconds = Number(attempt?.billable_seconds);
  if (ACTIVE.includes(attempt?.state) && !(seconds > 0)) {
    const started = attempt?.started_at ? Date.parse(attempt.started_at) : NaN;
    return Number.isFinite(started) && now >= started ? `${billableText((now - started) / 1000)} so far` : '—';
  }
  return billableText(attempt?.billable_seconds);
}

// When an attempt ran, in the reader's own format; '' when it never started.
export function attemptWhen(attempt, format = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })) {
  if (!attempt?.started_at) return '';
  return attempt.finished_at ? `Started ${format(attempt.started_at)}, ended ${format(attempt.finished_at)}` : `Started ${format(attempt.started_at)}`;
}

// One attempt as the attempts table shows it, for a vision row (``reason``) and a language-model row (``failure``).
export function attemptRow(attempt, now = Date.now()) {
  const state = attempt?.state || '';
  return {
    number: attempt?.number,
    state,
    stateLabel: state ? state.charAt(0).toUpperCase() + state.slice(1) : '',
    what: attemptText({ ...attempt, reason: attempt?.reason || attempt?.failure || '' }),
    exit: attempt?.exit_code ?? null,
    machineTime: attemptTime(attempt, now),
    cost: attemptCost(attempt),
    job: attempt?.job_name || '',
    log: attempt?.log || '',
    onDemand: !!attempt?.on_demand,
    retryOf: attempt?.retry_of ?? null,
  };
}
