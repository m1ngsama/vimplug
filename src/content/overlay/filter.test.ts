import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterRows } from './filter.ts'

const rows = [
  { label: 'GitHub', sub: 'https://github.com', value: '1' },
  { label: 'Hacker News', sub: 'https://news.ycombinator.com', value: '2' },
  { label: 'docs', sub: 'https://example.com/GITHUB', value: '3' },
]

test('an empty query keeps everything', () => {
  assert.equal(filterRows(rows, '').length, 3)
  assert.equal(filterRows(rows, '   ').length, 3)
})

test('matching is case insensitive on the label', () => {
  assert.deepEqual(
    filterRows(rows, 'github').map(r => r.value),
    ['1', '3'],
  )
})

test('the sub line participates in matching', () => {
  assert.deepEqual(
    filterRows(rows, 'ycombinator').map(r => r.value),
    ['2'],
  )
})

test('all terms must match, in any order', () => {
  assert.deepEqual(
    filterRows(rows, 'news hacker').map(r => r.value),
    ['2'],
  )
})

test('no match yields an empty list', () => {
  assert.deepEqual(filterRows(rows, 'nothing here'), [])
})
