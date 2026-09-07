import { test } from 'node:test'
import assert from 'node:assert/strict'
import { markKey, isMarkChar } from './marks.ts'

test('the key is scoped to host and path', () => {
  assert.equal(markKey('a.com', '/x', 'q'), 'mark:a.com/x:q')
  assert.notEqual(markKey('a.com', '/x', 'q'), markKey('a.com', '/y', 'q'))
  assert.notEqual(markKey('a.com', '/x', 'q'), markKey('b.com', '/x', 'q'))
})

test('the key is scoped to the letter', () => {
  assert.notEqual(markKey('a.com', '/x', 'q'), markKey('a.com', '/x', 'w'))
})

test('letters are valid mark characters, in either case', () => {
  assert.equal(isMarkChar('a'), true)
  assert.equal(isMarkChar('Z'), true)
})

test('non-letters are rejected', () => {
  assert.equal(isMarkChar('1'), false)
  assert.equal(isMarkChar('Escape'), false)
  assert.equal(isMarkChar(' '), false)
  assert.equal(isMarkChar(''), false)
})
