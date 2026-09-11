import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canScroll, pickScrollable, type ScrollMetrics } from './scroll-target.ts'

const box = (over: Partial<ScrollMetrics> = {}): ScrollMetrics => ({
  scrollTop: 0,
  scrollLeft: 0,
  scrollHeight: 100,
  clientHeight: 100,
  scrollWidth: 100,
  clientWidth: 100,
  overflowY: 'auto',
  overflowX: 'auto',
  ...over,
})

test('an element with no overflow cannot scroll', () => {
  assert.equal(canScroll(box(), 'y', 1), false)
})

test('overflow alone is not enough; the content must actually be taller', () => {
  assert.equal(canScroll(box({ scrollHeight: 500 }), 'y', 1), true)
  assert.equal(canScroll(box({ scrollHeight: 500, overflowY: 'hidden' }), 'y', 1), false)
  assert.equal(canScroll(box({ scrollHeight: 500, overflowY: 'visible' }), 'y', 1), false)
})

test('scroll and overlay count as scrollable overflow', () => {
  assert.equal(canScroll(box({ scrollHeight: 500, overflowY: 'scroll' }), 'y', 1), true)
  assert.equal(canScroll(box({ scrollHeight: 500, overflowY: 'overlay' }), 'y', 1), true)
})

test('direction matters: an element at the bottom cannot scroll further down', () => {
  const atBottom = box({ scrollHeight: 500, scrollTop: 400 })
  assert.equal(canScroll(atBottom, 'y', 1), false)
  assert.equal(canScroll(atBottom, 'y', -1), true)
})

test('an element at the top cannot scroll up', () => {
  const atTop = box({ scrollHeight: 500, scrollTop: 0 })
  assert.equal(canScroll(atTop, 'y', -1), false)
  assert.equal(canScroll(atTop, 'y', 1), true)
})

test('the horizontal axis is judged on its own metrics', () => {
  const wide = box({ scrollWidth: 500 })
  assert.equal(canScroll(wide, 'x', 1), true)
  assert.equal(canScroll(wide, 'y', 1), false)
})

test('a one pixel difference is rounding, not a scrollable region', () => {
  assert.equal(canScroll(box({ scrollHeight: 101 }), 'y', 1), false)
})

test('pickScrollable walks up to the nearest ancestor that can scroll', () => {
  const chain = [box(), box(), box({ scrollHeight: 900 }), box()]
  assert.equal(pickScrollable(chain, 'y', 1), 2)
})

test('pickScrollable prefers the innermost candidate', () => {
  const chain = [box({ scrollHeight: 900 }), box({ scrollHeight: 900 })]
  assert.equal(pickScrollable(chain, 'y', 1), 0)
})

test('pickScrollable skips an inner box already at its limit', () => {
  const chain = [box({ scrollHeight: 500, scrollTop: 400 }), box({ scrollHeight: 900 })]
  assert.equal(pickScrollable(chain, 'y', 1), 1)
})

test('with no direction, a box counts when it can scroll either way', () => {
  assert.equal(canScroll(box({ scrollHeight: 500, scrollTop: 400 }), 'y'), true)
  assert.equal(canScroll(box({ scrollHeight: 500, scrollTop: 0 }), 'y'), true)
  assert.equal(canScroll(box(), 'y'), false)
})

test('pickScrollable with no direction finds a pane parked at either end', () => {
  const chain = [box(), box({ scrollHeight: 500, scrollTop: 0 })]
  assert.equal(pickScrollable(chain, 'y'), 1)
})

test('pickScrollable reports nothing when the chain cannot scroll', () => {
  assert.equal(pickScrollable([box(), box()], 'y', 1), -1)
  assert.equal(pickScrollable([], 'y', 1), -1)
})
