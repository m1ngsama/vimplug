import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromEvent } from './event-keys.ts'

const ev = (o: Partial<KeyboardEvent>) => o as KeyboardEvent

test('maps code and key straight through', () => {
  const k = fromEvent(
    ev({ code: 'KeyJ', key: 'j', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }),
  )
  assert.equal(k.code, 'KeyJ')
  assert.equal(k.key, 'j')
})

test('maps modifier flags', () => {
  const k = fromEvent(
    ev({ code: 'KeyK', key: 'k', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }),
  )
  assert.equal(k.meta, true)
  assert.equal(k.ctrl, false)
})

test('an IME-composed key keeps its physical code', () => {
  const k = fromEvent(
    ev({ code: 'KeyJ', key: 'Process', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }),
  )
  assert.equal(k.code, 'KeyJ')
})
