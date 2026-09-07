import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scrollDelta } from './scroll.ts'

const opts = { scrollStep: 60 }

test('single-step scrolls use scrollStep', () => {
  assert.deepEqual(scrollDelta('scrollDown', opts, 800), { top: 60, left: 0 })
  assert.deepEqual(scrollDelta('scrollUp', opts, 800), { top: -60, left: 0 })
  assert.deepEqual(scrollDelta('scrollRight', opts, 800), { top: 0, left: 60 })
  assert.deepEqual(scrollDelta('scrollLeft', opts, 800), { top: 0, left: -60 })
})

test('half-page scrolls use half the viewport', () => {
  assert.deepEqual(scrollDelta('scrollHalfDown', opts, 800), { top: 400, left: 0 })
  assert.deepEqual(scrollDelta('scrollHalfUp', opts, 800), { top: -400, left: 0 })
})

test('half-page scrolls track the viewport, not the step', () => {
  assert.deepEqual(scrollDelta('scrollHalfDown', opts, 1200), { top: 600, left: 0 })
})

test('an unrelated action yields no delta', () => {
  assert.equal(scrollDelta('copyUrl', opts, 800), null)
})
