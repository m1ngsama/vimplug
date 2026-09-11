import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pagerScore, pickPager, type PagerCandidate } from './pager.ts'

const c = (over: Partial<PagerCandidate> = {}): PagerCandidate => ({
  text: '',
  rel: '',
  ariaLabel: '',
  ...over,
})

test('rel is the strongest signal, because the page declared it', () => {
  assert.ok(pagerScore(c({ rel: 'next' }), 1) > pagerScore(c({ text: 'next' }), 1))
})

test('common wordings for next are recognised', () => {
  for (const text of ['next', 'Next', 'next page', 'older', 'more', '›', '»', '→']) {
    assert.ok(pagerScore(c({ text }), 1) > 0, `missed ${text}`)
  }
})

test('common wordings for previous are recognised', () => {
  for (const text of ['prev', 'Previous', 'previous page', 'newer', '‹', '«', '←']) {
    assert.ok(pagerScore(c({ text }), -1) > 0, `missed ${text}`)
  }
})

test('a next link does not count as a previous link', () => {
  assert.equal(pagerScore(c({ text: 'next' }), -1), 0)
  assert.equal(pagerScore(c({ rel: 'next' }), -1), 0)
})

test('an aria-label counts when the text is only an icon', () => {
  assert.ok(pagerScore(c({ text: '', ariaLabel: 'Next page' }), 1) > 0)
})

test('unrelated links score nothing', () => {
  assert.equal(pagerScore(c({ text: 'Contact us' }), 1), 0)
  assert.equal(pagerScore(c({ text: 'nextdoor neighbours' }), 1), 0)
})

test('Chinese wordings for next are recognised inside longer text', () => {
  for (const text of ['下一页', '下页', '下一章', '下一张', '后一页', '下一頁', '下頁', '後頁', '点击下一页 »']) {
    assert.ok(pagerScore(c({ text }), 1) > 0, `missed ${text}`)
    assert.equal(pagerScore(c({ text }), -1), 0, `${text} read as previous`)
  }
})

test('Chinese wordings for previous are recognised inside longer text', () => {
  for (const text of ['上一页', '上页', '上一章', '上一张', '前一页', '上一頁', '上頁', '前頁', '« 返回上一页']) {
    assert.ok(pagerScore(c({ text }), -1) > 0, `missed ${text}`)
    assert.equal(pagerScore(c({ text }), 1), 0, `${text} read as next`)
  }
})

test('a rel among other rel tokens still counts', () => {
  assert.ok(pagerScore(c({ rel: 'nofollow next' }), 1) > pagerScore(c({ text: 'next' }), 1))
  assert.equal(pagerScore(c({ rel: 'prev nofollow', text: 'next' }), 1), 0)
})

test('pickPager returns the best candidate', () => {
  const list = [c({ text: 'more' }), c({ rel: 'next' }), c({ text: 'Contact' })]
  assert.equal(pickPager(list, 1), 1)
})

test('a rel on an anchor outranks any wording', () => {
  const list = [c({ text: 'Next' }), c({ rel: 'next', text: 'go on to the page after this one' })]
  assert.equal(pickPager(list, 1), 1)
})

test('the shortest matching text wins, so "Learn more" loses to "Next"', () => {
  assert.equal(pickPager([c({ text: 'Learn more' }), c({ text: 'Next' })], 1), 1)
  assert.equal(pickPager([c({ text: 'Back to top' }), c({ text: 'Previous' })], -1), 1)
  assert.equal(pickPager([c({ text: 'Next' }), c({ text: 'Read the next chapter' })], 1), 0)
})

test('an icon link is ranked by its aria-label', () => {
  assert.equal(pickPager([c({ ariaLabel: 'Next' }), c({ text: 'Learn more' })], 1), 0)
})

test('a tie goes to the last candidate, where the pager usually sits', () => {
  assert.equal(pickPager([c({ text: 'Next' }), c({ text: 'Contact' }), c({ text: 'Next' })], 1), 2)
})

test('pickPager reports nothing when no candidate qualifies', () => {
  assert.equal(pickPager([c({ text: 'Contact' })], 1), -1)
  assert.equal(pickPager([], 1), -1)
})
