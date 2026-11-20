// @vitest-environment jsdom
// The editor's markdown preview (ADM-1322): a project's .md file is untrusted, so nothing in it may run on our origin.
import { describe, it, expect } from 'vitest'
import { renderMarkdownPreview, isMarkdownPath, projectLinkOf } from './markdownPreview'

const dom = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d }

describe('renderMarkdownPreview', () => {
  it('renders markdown', () => {
    const d = dom(renderMarkdownPreview('# Notes\n\nSome **bold** text.\n\n- one\n- two\n\n```js\nconst a = 1\n```'))
    expect(d.querySelector('h1').textContent).toBe('Notes')
    expect(d.querySelector('strong').textContent).toBe('bold')
    expect(d.querySelectorAll('li')).toHaveLength(2)
    expect(d.querySelector('pre code').textContent).toContain('const a = 1')
  })

  it('no script, frame, form, style or event handler survives', () => {
    const html = renderMarkdownPreview([
      '<script>alert(1)</script>', '<img src=x onerror="alert(2)">', '<iframe src="https://evil.example"></iframe>',
      '<form action="https://evil.example"><input name=p></form>', '<style>body{display:none}</style>',
      '<a href="https://ok.example" onclick="alert(3)">x</a>', '<svg onload="alert(4)"></svg>',
    ].join('\n\n'))
    const d = dom(html)
    for (const tag of ['script', 'iframe', 'form', 'input', 'style', 'svg', 'img']) expect(d.querySelector(tag)).toBeNull()
    const handlers = [...d.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.name)).filter((n) => /^on/i.test(n))
    expect(handlers).toEqual([])
    expect(d.textContent).toContain('<script>alert(1)</script>')        // raw HTML is shown as text, never run
  })

  it('javascript: and data: links lose their target; every link opens in a new tab without the opener', () => {
    const d = dom(renderMarkdownPreview('[a](javascript:alert(1)) [b](data:text/html;base64,PHNjcmlwdD4=) [c](https://example.com) ![i](javascript:alert(2))'))
    const links = [...d.querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual([null, null, 'https://example.com'])
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toContain('noopener')
      expect(a.getAttribute('rel')).toContain('noreferrer')
    }
    const img = d.querySelector('img')
    if (img) expect(img.getAttribute('src') || '').not.toMatch(/javascript:/i)
  })

  it('which files are markdown', () => {
    expect(['README.md', 'docs/a.markdown', 'x.MD', 'a.txt', 'md'].map(isMarkdownPath)).toEqual([true, true, true, false, false])
  })
})

describe('a link to another file of the project', () => {
  it('resolves from the file it is in, and never leaves the project', () => {
    expect(projectLinkOf('setup.md', 'docs/README.md')).toBe('docs/setup.md')
    expect(projectLinkOf('../src/app.ts#L3', 'docs/README.md')).toBe('src/app.ts')
    expect(projectLinkOf('./my%20file.md', 'README.md')).toBe('my file.md')
    expect(projectLinkOf('/LICENSE', 'docs/a/b.md')).toBe('LICENSE')
    expect(projectLinkOf('../../etc/passwd', 'docs/README.md')).toBeNull()
  })
  it('a web address, a mail link or an anchor is not a project file', () => {
    for (const href of ['https://example.com', '//cdn.example/x.js', 'mailto:a@b.c', '#usage', '', null]) {
      expect(projectLinkOf(href, 'README.md')).toBeNull()
    }
  })
})
