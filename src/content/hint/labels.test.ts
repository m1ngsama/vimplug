import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateLabels } from './labels.ts'

const noPrefixCollision = (labels: string[]) => {
  for (const a of labels) {
    for (const b of labels) {
      if (a !== b && b.startsWith(a)) return `${a} is a prefix of ${b}`
    }
  }
  return null
}

test('labels stay one character while the alphabet can cover every target', () => {
  assert.deepEqual(generateLabels(3, 'abc'), ['a', 'b', 'c'])
  assert.ok(generateLabels(9, 'abcdefghi').every(l => l.length === 1))
})

test('the earliest targets keep the shortest labels', () => {
  const labels = generateLabels(20, 'abcde')
  assert.equal(labels[0]?.length, 1)
  assert.ok(labels.at(-1)!.length > 1)
})

test('no label is a prefix of another', () => {
  for (const n of [1, 2, 5, 9, 12, 27, 64, 200]) {
    const labels = generateLabels(n, 'fjdkslagh')
    assert.equal(noPrefixCollision(labels), null, `n=${n}: ${noPrefixCollision(labels)}`)
  }
})

test('labels are unique', () => {
  const labels = generateLabels(200, 'fjdkslagh')
  assert.equal(new Set(labels).size, 200)
})

test('it produces exactly as many labels as asked for', () => {
  for (const n of [0, 1, 7, 40, 300]) assert.equal(generateLabels(n, 'fjdkslagh').length, n)
})

test('a realistic page keeps most labels to two characters', () => {
  const labels = generateLabels(60, 'fjdkslagh')
  assert.ok(labels.every(l => l.length <= 2), 'some label needed three characters')
  assert.ok(labels.filter(l => l.length === 1).length > 0, 'no single-character labels at all')
})

test('only alphabet characters appear', () => {
  for (const l of generateLabels(30, 'xy')) assert.match(l, /^[xy]+$/)
})

test('zero targets yields no labels', () => {
  assert.deepEqual(generateLabels(0, 'abc'), [])
})

test('an empty alphabet yields no labels rather than looping', () => {
  assert.deepEqual(generateLabels(5, ''), [])
})

// A prefix-free set larger than one is impossible with a single character, so rather
// than emit ambiguous labels the engine declines and hint mode simply does not open.
test('a single-character alphabet yields no labels', () => {
  assert.deepEqual(generateLabels(3, 'a'), [])
})
