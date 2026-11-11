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
    groups.push(group('runtime', 'Runtime', runtimeRows(used.runtime)));
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

// USD as text ("1.20") as a person reads it ("$1.20").
const usd = value => `$${Number(value || 0).toFixed(2)}`;
const someHeld = cost => Number(cost?.held || 0) > 0;

// The Cost line: on AADML's own computer or the person's own machine it costs nothing; else the total, and while it
// runs, the part still held (the most the rest can cost).
export function costText(cost, ownMachines = []) {
  if (!cost) return '';
  if (cost.paid === false) {
    const own = (ownMachines || []).filter(Boolean);
    return own.length ? `No AADML machine cost: it ran on your machine ${own.join(', ')}.` : 'No AADML machine cost.';
  }
  if (!someHeld(cost)) return `${usd(cost.total)} charged.`;
  return `${usd(cost.total)} at most: ${usd(cost.settled)} charged and ${usd(cost.held)} held while it runs, the most the rest can cost.`;
}

// An attempt's Cost cell: its total, with a note when part of it is still held; its own machine costs AADML nothing.
export function attemptCost(attempt) {
  if (attempt?.own_machine) return { text: 'No AADML cost', note: `Ran on ${attempt.own_machine}` };
  const cost = attempt?.cost;
  if (!cost || empty(cost.total)) return { text: '—', note: '' };
  return { text: usd(cost.total), note: someHeld(cost) ? `${usd(cost.held)} of it held while it runs` : '' };
}

// When an attempt ran, in the reader's own format; '' when it never started.
export function attemptWhen(attempt, format = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })) {
  if (!attempt?.started_at) return '';
  return attempt.finished_at ? `Started ${format(attempt.started_at)}, ended ${format(attempt.finished_at)}` : `Started ${format(attempt.started_at)}`;
}

// One attempt as the attempts table shows it, for a vision row (``reason``) and a language-model row (``failure``).
export function attemptRow(attempt) {
  const state = attempt?.state || '';
  return {
    number: attempt?.number,
    state,
    stateLabel: state ? state.charAt(0).toUpperCase() + state.slice(1) : '',
    what: attemptText({ ...attempt, reason: attempt?.reason || attempt?.failure || '' }),
    exit: attempt?.exit_code ?? null,
    machineTime: billableText(attempt?.billable_seconds),
    cost: attemptCost(attempt),
    job: attempt?.job_name || '',
    log: attempt?.log || '',
    onDemand: !!attempt?.on_demand,
    retryOf: attempt?.retry_of ?? null,
  };
}
