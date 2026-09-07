import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MISSING_LABELS } from './labels.ts'

test('every schema option has UI copy', () => {
  assert.deepEqual(MISSING_LABELS, [])
})
