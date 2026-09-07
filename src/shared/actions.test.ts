import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ACTIONS, isActionId } from './actions.ts'

test('action ids are unique', () => {
  const ids = ACTIONS.map(a => a.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('isActionId accepts known and rejects unknown', () => {
  assert.ok(isActionId('scrollDown'))
  assert.equal(isActionId('nope'), false)
})

test('every action has a non-empty description', () => {
  for (const a of ACTIONS) assert.ok(a.description.length > 0, a.id)
})
