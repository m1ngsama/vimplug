import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectMatches, stepIndex } from './matches.ts'

test('finds every occurrence', () => {
  assert.deepEqual(collectMatches('abcabc', 'abc'), [
    { start: 0, end: 3 },
    { start: 3, end: 6 },
  ])
})

test('matching is case insensitive', () => {
  assert.deepEqual(collectMatches('Hello hello', 'HELLO'), [
    { start: 0, end: 5 },
    { start: 6, end: 11 },
  ])
})

test('overlapping candidates advance past the previous match', () => {
  assert.deepEqual(collectMatches('aaaa', 'aa'), [
    { start: 0, end: 2 },
    { start: 2, end: 4 },
  ])
})

test('an empty query matches nothing', () => {
  assert.deepEqual(collectMatches('abc', ''), [])
})

test('no occurrence yields no matches', () => {
  assert.deepEqual(collectMatches('abc', 'zzz'), [])
})

test('stepIndex wraps in both directions', () => {
  assert.equal(stepIndex(0, 3, 1), 1)
  assert.equal(stepIndex(2, 3, 1), 0)
  assert.equal(stepIndex(0, 3, -1), 2)
})

test('stepIndex on an empty set stays at zero', () => {
  assert.equal(stepIndex(0, 0, 1), 0)
})
