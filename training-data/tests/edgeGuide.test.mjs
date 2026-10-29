// The Edge Devices tab's guide (EdgeTab.vue, MachinesPanel.vue): the three steps' states, the code that calls a model
// on a machine, and what a machine needs. Facts it pins: ml/fmw_walls/serve/app.py (raw photo body, /invocations,
// /ping, fmw-predict.v1), ml/machine_agent (Docker API 1.43, the container names and labels), machines.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanHost, edgeUrl, EDGE_LANGUAGES, edgeInstall, NOTHING_TO_INSTALL, edgeSnippet, pingCommand, privateRule, ANSWER_EXAMPLE,
  ANSWER_FIELDS, CALL_ERRORS, answering, startedLine, stepStates, HOST_PLACEHOLDER, DEFAULT_PORT, answerAt,
} from '../src/api/edge.js';
import { containsSecret, MACHINE_NEEDS, MACHINE_COMMANDS, reachCommand, machinesLine } from '../src/api/machines.js';

test('only an address goes in the code: IPv4, a host name, or IPv6 in brackets', () => {
  assert.equal(cleanHost('192.168.1.20'), '192.168.1.20');
  assert.equal(cleanHost('  garage.local '), 'garage.local');
  assert.equal(cleanHost('http://garage.local/'), 'garage.local');
  assert.equal(cleanHost('fe80::1'), '[fe80::1]');
  assert.equal(cleanHost('[fd00::20]'), '[fd00::20]');
  for (const bad of ['', '192.168.1.20; rm -rf /', '$(id)', 'a b', '"x"', '1::2::3', 'host:8080', 'x/../y', null]) {
    assert.equal(cleanHost(bad), '', String(bad));
  }
  assert.equal(edgeUrl('192.168.1.20', 8081), 'http://192.168.1.20:8081/invocations');
  assert.equal(edgeUrl('', 8081, '/ping'), `http://${HOST_PLACEHOLDER}:8081/ping`);
  assert.equal(edgeUrl('$(id)', 'x'), `http://${HOST_PLACEHOLDER}:${DEFAULT_PORT}/invocations`);   // nothing typed leaks in
  assert.equal(answerAt(8081), `http://${HOST_PLACEHOLDER}:8081/invocations`);
});

test('every snippet sends the photo itself to the machine address, on the right port, with no key', () => {
  const url = edgeUrl('10.0.0.7', 9001);
  assert.deepEqual(EDGE_LANGUAGES, ['Python SDK', 'JavaScript', 'cURL']);
  for (const language of EDGE_LANGUAGES) {
    const code = edgeSnippet(language, url);
    assert.ok(code.includes(language === 'Python SDK' ? 'EdgeModel("http://10.0.0.7:9001")' : 'http://10.0.0.7:9001/invocations'), language);
    if (language !== 'Python SDK') assert.ok(code.includes('image/jpeg'), language); // the body's own type (the SDK sets it)
    assert.ok(!/authorization|bearer|api[_-]?key|app key|x-api-key/i.test(code), language);
    assert.equal(containsSecret(code), false, language);
    assert.ok(!/FormData|multipart| -F /.test(code), `${language}: a form is refused (415)`);
    assert.ok(!code.includes('aadml.com'), `${language}: the call never goes to AADML`);
  }
  assert.ok(edgeSnippet('Python SDK', url).includes('model.predict("room.jpg")') && !edgeSnippet('Python SDK', url).includes('requests'));
  assert.ok(edgeSnippet('JavaScript', url).includes("body: await readFile('room.jpg')"));
  assert.ok(edgeSnippet('cURL', url).includes('--data-binary "@room.jpg"'));
  assert.ok(edgeSnippet('cURL').includes(`${HOST_PLACEHOLDER}:${DEFAULT_PORT}`));
  assert.equal(edgeInstall('Python SDK'), 'pip install "aadml-training>=0.3"');
  assert.equal(edgeInstall('JavaScript'), '');
  assert.equal(edgeInstall('cURL'), '');
  assert.ok(NOTHING_TO_INSTALL.JavaScript && NOTHING_TO_INSTALL.cURL);
});

test('the health check, the firewall rule and the answer example', () => {
  assert.equal(pingCommand('192.168.1.20', 8081), 'curl http://192.168.1.20:8081/ping');
  assert.equal(privateRule(8081), 'sudo iptables -I DOCKER-USER -p tcp -m conntrack --ctorigdstport 8081 --ctdir ORIGINAL ! -s 192.168.1.0/24 -j DROP');
  assert.ok(privateRule('nope').includes(`--ctorigdstport ${DEFAULT_PORT} `));
  const answer = JSON.parse(ANSWER_EXAMPLE);
  assert.equal(answer.schema, 'fmw-predict.v1');
  assert.ok(['success', 'low_confidence', 'no_detection'].includes(answer.status));
  assert.ok(answer.walls[0].corners.length >= 3 && answer.walls[0].corner_types.length === answer.walls[0].corners.length);
  assert.equal(answer.openings[0].wall_id, answer.walls[0].id);
  for (const gateway of ['request_id', 'capture_id', 'model']) assert.ok(!(gateway in answer), `${gateway} is only the gateway's`);
  assert.deepEqual(ANSWER_FIELDS.map(f => f.name), ['status', 'walls', 'openings', 'warnings', 'wall_marking_v1']);
  assert.deepEqual(CALL_ERRORS.map(e => e.status), [415, 413, 400, 503, 500]);
});

test('the code is for a model that answers, the healthy ones first; each start is said in words', () => {
  const jobs = [
    { id: 1, kind: 'serve', state: 'running', health: { ok: false } },
    { id: 2, kind: 'serve', state: 'running', health: { ok: true } },
    { id: 3, kind: 'serve', state: 'queued' },
    { id: 4, kind: 'serve', state: 'running', stopping: true, health: { ok: true } },
    { id: 5, kind: 'serve', state: 'stopped' },
  ];
  assert.deepEqual(answering(jobs).map(j => j.id), [2, 1]);
  assert.deepEqual(answering(null), []);
  const now = Date.parse('2026-10-29T10:00:00Z');
  assert.equal(startedLine({ started_at: '2026-10-29T09:57:00Z' }, now), 'Started 3 minutes ago');
  assert.equal(startedLine({ created_at: '2026-10-29T09:59:50Z' }, now), 'Started just now');
  assert.equal(startedLine({ started_at: '2026-10-29T08:00:00Z' }, now), 'Started 2 hours ago');
  assert.equal(startedLine({}, now), '');
});

test('each of the three steps says where the person is', () => {
  // Images not published: step 1 says so in one line and the others wait (the tab still shows every step and the docs).
  let s = stepStates({ available: false, machines: [], jobs: [] });
  assert.deepEqual(s.map(x => x.state), ['waiting', 'waiting', 'waiting']);
  assert.match(s[0].line, /published/);
  s = stepStates({ available: true, machines: [], jobs: [] });
  assert.deepEqual(s.map(x => x.state), ['current', 'waiting', 'waiting']);
  s = stepStates({ available: true, machines: [{ id: 1, name: 'garage', state: 'offline' }], jobs: [] });
  assert.deepEqual(s.map(x => x.state), ['attention', 'waiting', 'waiting']);
  assert.equal(s[0].line, 'garage is offline. Your machines says what to check.');
  const machines = [{ id: 1, name: 'garage', state: 'online' }, { id: 2, name: 'lab', state: 'offline' }, { id: 3, name: 'gone', state: 'removed' }];
  s = stepStates({ available: true, machines, jobs: [] });
  assert.deepEqual(s.map(x => x.state), ['done', 'current', 'waiting']);
  assert.equal(s[0].line, '1 of 2 machines are online.');
  const job = { id: 9, kind: 'serve', state: 'queued', port: 8081, model: { name: 'fmw-walls', version: '2.0.0' }, machine: { name: 'garage' } };
  s = stepStates({ available: true, machines, jobs: [job] });
  assert.equal(s[1].state, 'current');
  assert.equal(s[1].line, 'fmw-walls 2.0.0 is starting on garage.');
  s = stepStates({ available: true, machines, jobs: [{ ...job, state: 'running', health: { ok: true } }] });
  assert.deepEqual(s.map(x => x.state), ['done', 'done', 'current']);
  assert.equal(s[1].line, 'fmw-walls 2.0.0 answers on garage, port 8081.');
  assert.equal(stepStates().length, 3);
});

test('what a machine needs, and the checks a person runs on it', () => {
  assert.deepEqual(MACHINE_NEEDS.map(n => n.id), ['docker', 'cpu', 'memory', 'gpu']);
  assert.match(MACHINE_NEEDS[0].title, /Docker 24/);                             // Docker Engine API 1.43
  assert.match(MACHINE_NEEDS[1].title, /x86-64/);                                // the images are linux/amd64
  assert.match(MACHINE_NEEDS[2].title, /4 GB/);                                  // a served model's memory limit
  for (const command of Object.values(MACHINE_COMMANDS)) assert.equal(containsSecret(command), false, command);
  assert.ok(MACHINE_COMMANDS.clean.includes('docker volume rm aadml-machine'));  // a removed key must not stay behind
  assert.ok(MACHINE_COMMANDS.clean.includes('label=aadml.job'));
  assert.ok(MACHINE_COMMANDS.gpu.startsWith('docker run --rm --gpus all public.ecr.aws/'));   // not Docker Hub
  assert.equal(reachCommand('aadml.com'), 'curl -sS -o /dev/null -w "%{http_code}\\n" https://aadml.com/');
  assert.equal(reachCommand('x; rm -rf /'), '');
  assert.equal(reachCommand(''), '');
});

test('the machines in one line', () => {
  assert.deepEqual(machinesLine([]), ['waiting', 'No machine yet.']);
  assert.deepEqual(machinesLine([{ name: 'garage', state: 'online' }]), ['done', 'garage is online.']);
  assert.deepEqual(machinesLine([{ name: 'a', state: 'online' }, { name: 'b', state: 'offline' }]), ['done', '1 of 2 machines are online.']);
  assert.deepEqual(machinesLine([{ name: 'a', state: 'offline' }]), ['attention', 'a is offline.']);
});
