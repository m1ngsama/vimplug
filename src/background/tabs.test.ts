import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTabTarget } from './tabs.ts'

test('next wraps past the last tab', () => {
  assert.equal(resolveTabTarget(2, 3, 1), 0)
  assert.equal(resolveTabTarget(0, 3, 1), 1)
})

test('prev wraps past the first tab', () => {
  assert.equal(resolveTabTarget(0, 3, -1), 2)
  assert.equal(resolveTabTarget(2, 3, -1), 1)
})

test('a single tab always resolves to itself', () => {
  assert.equal(resolveTabTarget(0, 1, 1), 0)
  assert.equal(resolveTabTarget(0, 1, -1), 0)
})

test('an empty window resolves to zero rather than NaN', () => {
  assert.equal(resolveTabTarget(0, 0, 1), 0)
})

test('a repeat moves that many tabs, still wrapping', () => {
  assert.equal(resolveTabTarget(0, 5, 1, 3), 3)
  assert.equal(resolveTabTarget(0, 5, 1, 7), 2)
  assert.equal(resolveTabTarget(0, 5, -1, 2), 3)
  assert.equal(resolveTabTarget(4, 5, 1, 1), 0)
})
