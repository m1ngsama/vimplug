import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldHandle, boundKeyIds } from './dispatch.ts'
import { parseKeys, keyId } from '../shared/keys.ts'

const bindings = [{ keys: parseKeys('j')!, action: 'scrollDown' }]
const ids = boundKeyIds(bindings, 'physical')

const k = (n: string) => parseKeys(n)![0]!

test('handles an unmodified bound key', () => {
  assert.equal(shouldHandle(k('j'), ids, 'physical'), true)
})

test('handles an unmodified unbound key so the matcher can reject it', () => {
  assert.equal(shouldHandle(k('z'), ids, 'physical'), true)
})

test('passes through cmd+k because nothing binds it', () => {
  assert.equal(shouldHandle(k('<M-k>'), ids, 'physical'), false)
})

test('passes through cmd+i and cmd+b', () => {
  assert.equal(shouldHandle(k('<M-i>'), ids, 'physical'), false)
  assert.equal(shouldHandle(k('<M-b>'), ids, 'physical'), false)
})

test('passes through ctrl and alt combos too', () => {
  assert.equal(shouldHandle(k('<C-l>'), ids, 'physical'), false)
  assert.equal(shouldHandle(k('<A-j>'), ids, 'physical'), false)
})

test('handles a modified key that is explicitly bound', () => {
  const withCtrlD = boundKeyIds([{ keys: parseKeys('<C-d>')!, action: 'scrollDown' }], 'physical')
  assert.equal(shouldHandle(k('<C-d>'), withCtrlD, 'physical'), true)
})

test('shift alone never counts as a modifier', () => {
  assert.equal(shouldHandle(k('F'), ids, 'physical'), true)
})

test('boundKeyIds indexes the first key of every sequence', () => {
  const seq = boundKeyIds([{ keys: parseKeys('gi')!, action: 'focusInput' }], 'physical')
  assert.ok(seq.has(keyId(k('g'), 'physical')))
  assert.equal(seq.has(keyId(k('i'), 'physical')), false)
})
