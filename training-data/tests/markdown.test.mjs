import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// DOMPurify needs a DOM: it is given one before markdown.js is loaded, as the browser gives it.
globalThis.window = new JSDOM('').window;
const { safeMarkdown } = await import('../src/markdown.js');

test('a model answer is shown as formatted text', () => {
  const html = safeMarkdown('**Open Settings**, then:\n\n- Security\n- `Reset`');
  assert.match(html, /<strong>Open Settings<\/strong>/);
  assert.match(html, /<li>Security<\/li>/);
  assert.match(html, /<code>Reset<\/code>/);
});

test('nothing in an answer can run or reach the page', () => {
  const html = safeMarkdown('<script>alert(1)</script><img src=x onerror=alert(2)> <iframe src="https://x"></iframe>');
  assert.doesNotMatch(html, /<script|<img|onerror|<iframe/i);
  const sneaky = safeMarkdown('[click](javascript:alert(3))');
  assert.doesNotMatch(sneaky, /href=/i);                                  // the link is kept as words, never as a link
  const link = safeMarkdown('[docs](https://example.com)');
  assert.match(link, /href="https:\/\/example\.com"/);
  assert.match(link, /rel="noopener noreferrer nofollow"/);
});
