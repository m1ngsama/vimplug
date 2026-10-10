import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushHistory } from './history.ts'

test('the newest query goes first and is not repeated', () => {
  assert.deepEqual(pushHistory(['b', 'a'], 'c'), ['c', 'b', 'a'])
  assert.deepEqual(pushHistory(['b', 'a'], 'a'), ['a', 'b'])
})

test('an empty query is not remembered and old queries fall off the end', () => {
  assert.deepEqual(pushHistory(['a'], ''), ['a'])
  assert.deepEqual(pushHistory(['c', 'b', 'a'], 'd', 3), ['d', 'c', 'b'])
})
