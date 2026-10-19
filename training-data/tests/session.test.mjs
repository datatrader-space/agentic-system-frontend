import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSession } from '../src/api/session.js';
const reply = (body, status = 200, type = 'application/json') => new Response(body, {status, headers: {'Content-Type': type}});
test('session is a same-origin read and drops private data and privilege flags', async () => {
  const result = await checkSession(async (path, options) => {
    assert.equal(path, '/api/auth/me');
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, undefined);
    return reply(JSON.stringify({user:{id:1, full_name:'Demo User', email:'demo@example.com', is_platform_admin:true}}));
  });
  assert.deepEqual(result, {displayName:'Demo User'});
});
test('rejects expired or forbidden sessions without exposing response bodies', async () => {
  for (const status of [401,403]) await assert.rejects(checkSession(async()=>reply('private details',status)), {code:'auth'});
});
test('rejects HTML, malformed JSON, invalid users and server failures', async () => {
  const cases = [
    [()=>reply('<html>login</html>',200,'text/html'),'format'],
    [()=>reply('not json'),'format'],
    [()=>reply('{"user":null}'),'schema'],
    [()=>reply('{"user":{"id":0}}'),'schema'],
    [()=>reply('private stack trace',500),'server'],
  ];
  for (const [fetcher,code] of cases) await assert.rejects(checkSession(fetcher),{code});
});
test('redirects and network failures cannot become successful sessions', async () => {
  await assert.rejects(checkSession(async()=>({redirected:true})),{code:'redirect'});
  await assert.rejects(checkSession(async()=>{throw new Error('sensitive network information');}),{code:'network'});
});
test('timeout aborts the request', async () => {
  await assert.rejects(checkSession((_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))),5),{code:'timeout'});
});
