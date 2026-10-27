import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LABELS, MISSING_LABELS } from './labels.ts'

test('every schema option has UI copy', () => {
  assert.deepEqual(MISSING_LABELS, [])
})

test('legacy sequenceTimeout has no UI copy', () => {
  assert.equal('sequenceTimeout' in LABELS, false)
})
