// @vitest-environment jsdom
// The element picked in the Preview tab (ADM-1318): where it is written. The framework's own location when the page
// gives one; else the places AADML found in the project's files, best first, each opening the file at its line.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PreviewElementCard from './PreviewElementCard.vue'

const ELEMENT = {
  tag: 'h1', id: 'hero', classes: ['title'], text: 'Welcome', html: '<h1 id="hero" class="title">', selector: 'h1#hero',
  box: { x: 0, y: 0, width: 300, height: 40 }, source: null, editable: true, page: '/',
}
const PLACES = [
  { path: 'index.html', line: 5, column: 7, why: 'This line has id="hero" and the text "Welcome".' },
  { path: 'about.html', line: 3, column: 3, why: 'This line has the text "Welcome".' },
  { path: 'blog/index.html', line: 9, column: 1, why: 'This line has the class "title".' },
]
const card = (props) => mount(PreviewElementCard, { props: { element: ELEMENT, ...props }, global: { stubs: { Icon: true } } })

describe('where the element is written', () => {
  it("the framework's own location is shown first, and no place in the files", () => {
    const w = card({ element: { ...ELEMENT, source: { file: 'src/Hero.vue', line: 4, column: 3, framework: 'Vue' } }, locations: PLACES })
    expect(w.find('.pe-src').text()).toBe('src/Hero.vue:4:3')
    expect(w.find('.pe-loc').exists()).toBe(false)
  })

  it('shows the best place, every other one, and opens a file at its line', async () => {
    const w = card({ locations: PLACES })
    const best = w.find('.pe-loc.best')
    expect(best.text()).toBe('index.html:5')
    expect(best.attributes('aria-label')).toBe('Open index.html:5 in the editor')
    expect(w.find('.pe-more summary').text()).toBe('2 other places match')
    expect(w.findAll('.pe-locs .pe-loc').map((b) => b.text())).toEqual(['about.html:3', 'blog/index.html:9'])
    await best.trigger('click')
    await w.findAll('.pe-locs .pe-loc')[1].trigger('click')
    expect(w.emitted('open')).toEqual([[PLACES[0]], [PLACES[2]]])
  })

  it('says while it looks, and why nothing was found', () => {
    expect(card({ locating: true }).find('[role="status"]').text()).toContain("Looking for it in the project's files")
    expect(card({ locateNote: 'No file in the project has this element.' }).find('.pe-none').text())
      .toBe('No file in the project has this element.')
    expect(card({}).find('.pe-none').text()).toContain('the agent finds it from the element')
  })
})
