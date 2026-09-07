import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectionCommand } from './visual.ts'

test('hjkl move by character and line', () => {
  assert.deepEqual(selectionCommand('l'), ['extend', 'forward', 'character'])
  assert.deepEqual(selectionCommand('h'), ['extend', 'backward', 'character'])
  assert.deepEqual(selectionCommand('j'), ['extend', 'forward', 'line'])
  assert.deepEqual(selectionCommand('k'), ['extend', 'backward', 'line'])
})

test('w and b move by word', () => {
  assert.deepEqual(selectionCommand('w'), ['extend', 'forward', 'word'])
  assert.deepEqual(selectionCommand('b'), ['extend', 'backward', 'word'])
})

test('0 and $ move to the line boundaries', () => {
  assert.deepEqual(selectionCommand('0'), ['extend', 'backward', 'lineboundary'])
  assert.deepEqual(selectionCommand('$'), ['extend', 'forward', 'lineboundary'])
})

test('an unrelated key has no command', () => {
  assert.equal(selectionCommand('y'), null)
  assert.equal(selectionCommand('Escape'), null)
  assert.equal(selectionCommand('z'), null)
})
