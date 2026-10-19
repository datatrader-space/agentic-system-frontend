import test from 'node:test';
import assert from 'node:assert/strict';
import { readDeepLink, findProject } from '../src/api/notifications.js';
import { toCard } from '../src/api/training.js';

test('a notification link names the project, its page and the assignment', () => {
  assert.deepEqual(readDeepLink('#project/~5/annotate/1'), { ref: '~5', page: 'annotate', assignment: 1 });
  assert.deepEqual(readDeepLink('#project/leads/annotate'), { ref: 'leads', page: 'annotate', assignment: null });
  assert.deepEqual(readDeepLink('project/~12/train'), { ref: '~12', page: 'train', assignment: null });
  for (const other of ['#projects', '#notifications', '', '#project/', '#project/~5', '#project/~5/annotate/x', '#project/a/b/1/2']) {
    assert.equal(readDeepLink(other), null, other);
  }
});

test('the project is found by its own address or by its id', () => {
  const own = toCard({ ref: 'leads', id: 5, name: 'Leads' });
  const shared = toCard({ ref: '~9', id: 9, name: 'Orders' });
  assert.equal(own.serverId, 5);
  assert.equal(findProject([own, shared], 'leads'), own);
  assert.equal(findProject([own, shared], '~5'), own);          // a notice names the project by id
  assert.equal(findProject([own, shared], '~9'), shared);
  assert.equal(findProject([own, shared], '~7'), null);
  assert.equal(findProject([], '~5'), null);
});

test('an invite link token is read from the address only when it looks like one', async () => {
  const { joinToken, emailsOf } = await import('../src/api/members.js');
  assert.equal(joinToken('?join=AbC_def-0123456789xyzABCDEFGH'), 'AbC_def-0123456789xyzABCDEFGH');
  assert.equal(joinToken('?join=short'), '');
  assert.equal(joinToken('?join=<script>alert(1)</script>aaaaaaaaaaaaaa'), '');
  assert.equal(joinToken(''), '');
  assert.deepEqual(emailsOf('a@x.com, b@y.com;c@z.com\nd@w.com  '), ['a@x.com', 'b@y.com', 'c@z.com', 'd@w.com']);
  assert.deepEqual(emailsOf(''), []);
});
