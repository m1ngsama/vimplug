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

test('pickPager returns the best candidate', () => {
  const list = [c({ text: 'more' }), c({ rel: 'next' }), c({ text: 'Contact' })]
  assert.equal(pickPager(list, 1), 1)
})

test('pickPager reports nothing when no candidate qualifies', () => {
  assert.equal(pickPager([c({ text: 'Contact' })], 1), -1)
  assert.equal(pickPager([], 1), -1)
})
