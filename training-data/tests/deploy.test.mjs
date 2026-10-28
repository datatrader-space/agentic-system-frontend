import test from 'node:test';
import assert from 'node:assert/strict';
import { snippet, liveTag } from '../src/api/deploy.js';

const URL = 'https://aadml.example/api/training-data/v1/projects/7/environments/{environment}/predict';

test('the predict call names the real address for the chosen environment, and never a key', () => {
  for (const language of ['JavaScript', 'HTTP / cURL']) {
    const code = snippet(language, URL, 'production');
    assert.ok(code.includes('/projects/7/environments/production/predict'), language);
    assert.ok(!code.includes('{environment}'), language);
    assert.ok(code.includes("<the app's key>"), language);
    assert.ok(/file/.test(code) && /payload/.test(code), language);
  }
});

test('Python calls through AADML\'s SDK with the project and the environment of the address', () => {
  const code = snippet('Python', URL, 'staging');
  assert.ok(code.includes('pip install aadml-training') && code.includes('from aadml_training import Client'));
  assert.ok(code.includes('client.predict(project_id=7, image="room.jpg", environment="staging"'));
  assert.ok(code.includes("<the app's key>") && !code.includes('requests'));
});

test('an environment says whether it answers', () => {
  assert.deepEqual(liveTag({ live: null }), ['neutral', 'Nothing deployed']);
  assert.deepEqual(liveTag({ live: { healthy: true } }), ['green', 'Live']);
  assert.deepEqual(liveTag({ live: { healthy: false } }), ['amber', 'Live · not answering']);
});
