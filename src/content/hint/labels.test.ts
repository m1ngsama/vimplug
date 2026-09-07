import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateLabels } from './labels.ts'

test('single character labels when the alphabet is large enough', () => {
  assert.deepEqual(generateLabels(3, 'abc'), ['a', 'b', 'c'])
})

test('grows to two characters when it must', () => {
  const labels = generateLabels(4, 'ab')
  assert.equal(labels.length, 4)
  assert.ok(labels.every(l => l.length === 2))
})

test('labels are all the same length so none is a prefix of another', () => {
  for (const n of [1, 2, 3, 5, 9, 27, 64]) {
    const labels = generateLabels(n, 'abc')
    const lengths = new Set(labels.map(l => l.length))
    assert.equal(lengths.size, 1, `n=${n} produced mixed lengths`)
  }
})

test('labels are unique', () => {
  const labels = generateLabels(50, 'asdfghjkl')
  assert.equal(new Set(labels).size, 50)
})

test('only alphabet characters appear', () => {
  for (const l of generateLabels(30, 'xy')) {
    assert.match(l, /^[xy]+$/)
  }
})

test('zero targets yields no labels', () => {
  assert.deepEqual(generateLabels(0, 'abc'), [])
})

test('a single target still gets a label', () => {
  assert.deepEqual(generateLabels(1, 'abc'), ['a'])
})

test('an empty alphabet yields no labels rather than looping', () => {
  assert.deepEqual(generateLabels(5, ''), [])
})
