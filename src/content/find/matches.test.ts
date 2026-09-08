import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectMatches, stepIndex } from './matches.ts'

test('finds every occurrence', () => {
  assert.deepEqual(collectMatches('abcabc', 'abc'), [
    { start: 0, end: 3 },
    { start: 3, end: 6 },
  ])
})

// smartcase, as in vim and Vimium: an all-lowercase query is the common case and should
// not make you think about case; typing a capital is a deliberate act.
test('an all-lowercase query ignores case', () => {
  assert.deepEqual(collectMatches('Hello hello', 'hello'), [
    { start: 0, end: 5 },
    { start: 6, end: 11 },
  ])
})

test('any uppercase in the query makes the match case sensitive', () => {
  assert.deepEqual(collectMatches('Hello hello', 'Hello'), [{ start: 0, end: 5 }])
})

test('a fully uppercase query matches only itself', () => {
  assert.deepEqual(collectMatches('Hello hello HELLO', 'HELLO'), [{ start: 12, end: 17 }])
})

test('digits and punctuation do not make a query case sensitive', () => {
  assert.deepEqual(collectMatches('Item-1 item-1', 'item-1'), [
    { start: 0, end: 6 },
    { start: 7, end: 13 },
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
