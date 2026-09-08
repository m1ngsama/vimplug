import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scrollDelta } from './scroll.ts'

const opts = { scrollStep: 60 }
const view = (over: Record<string, number> = {}) => ({
  height: 800,
  scrollX: 0,
  scrollY: 0,
  maxX: 2000,
  maxY: 5000,
  ...over,
})

test('single-step scrolls use scrollStep', () => {
  assert.deepEqual(scrollDelta('scrollDown', opts, view()), { top: 60, left: 0 })
  assert.deepEqual(scrollDelta('scrollUp', opts, view()), { top: -60, left: 0 })
  assert.deepEqual(scrollDelta('scrollRight', opts, view()), { top: 0, left: 60 })
  assert.deepEqual(scrollDelta('scrollLeft', opts, view()), { top: 0, left: -60 })
})

test('half-page scrolls use half the viewport', () => {
  assert.deepEqual(scrollDelta('scrollHalfDown', opts, view()), { top: 400, left: 0 })
  assert.deepEqual(scrollDelta('scrollHalfUp', opts, view()), { top: -400, left: 0 })
})

test('half-page scrolls track the viewport, not the step', () => {
  assert.deepEqual(scrollDelta('scrollHalfDown', opts, view({ height: 1200 })), {
    top: 600,
    left: 0,
  })
})

test('gg travels exactly the distance back to the top', () => {
  assert.deepEqual(scrollDelta('scrollToTop', opts, view({ scrollY: 1234 })), {
    top: -1234,
    left: 0,
  })
  assert.deepEqual(scrollDelta('scrollToTop', opts, view({ scrollY: 0 })), { top: 0, left: 0 })
})

test('G travels exactly the remaining distance to the bottom', () => {
  assert.deepEqual(scrollDelta('scrollToBottom', opts, view({ scrollY: 1000 })), {
    top: 4000,
    left: 0,
  })
  assert.deepEqual(scrollDelta('scrollToBottom', opts, view({ scrollY: 5000 })), {
    top: 0,
    left: 0,
  })
})

test('horizontal ends behave the same way', () => {
  assert.deepEqual(scrollDelta('scrollToStart', opts, view({ scrollX: 300 })), {
    top: 0,
    left: -300,
  })
  assert.deepEqual(scrollDelta('scrollToEnd', opts, view({ scrollX: 500 })), {
    top: 0,
    left: 1500,
  })
})

test('an unrelated action yields no delta', () => {
  assert.equal(scrollDelta('copyUrl', opts, view()), null)
})
