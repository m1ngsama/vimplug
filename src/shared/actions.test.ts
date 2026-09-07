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

test('every action ships with at least one default binding', () => {
  for (const a of ACTIONS) assert.ok(a.defaultKeys.length > 0, a.id)
})

// Transcribed from the vimkey README. Losing any of these is a parity regression.
test('every vimkey key is bound out of the box', () => {
  const bound = new Set(ACTIONS.flatMap(a => a.defaultKeys))
  const vimkey = [
    'J', 'K', 'H', 'L',
    'j', 'k', 'h', 'l', 'u', 'd',
    'f', 'o', 'T', 't', 'P', 'p',
    'i', 'gf', 'yt', 'r', 'x', 'X', 'gi', 'yy',
    '-', '=', 'm',
    '?', '<Esc>',
  ]
  for (const k of vimkey) assert.ok(bound.has(k), `unbound vimkey binding: ${k}`)
})

test('no two actions claim the same default key', () => {
  const seen = new Map<string, string>()
  for (const a of ACTIONS) {
    for (const k of a.defaultKeys) {
      const owner = seen.get(k)
      assert.equal(owner, undefined, `${k} claimed by both ${owner} and ${a.id}`)
      seen.set(k, a.id)
    }
  }
})

test('every action belongs to a group', () => {
  const groups = new Set(['Scroll', 'Navigation', 'Tabs', 'Open', 'Media', 'Modes'])
  for (const a of ACTIONS) assert.ok(groups.has(a.group), `${a.id} has group ${a.group}`)
})
