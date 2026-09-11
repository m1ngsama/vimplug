import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nthTextField } from './focus-input.ts'

const el = (o: Record<string, unknown>) =>
  ({ getAttribute: () => null, ...o }) as unknown as Element

const visible = () => true

test('picks the first editable element', () => {
  const div = el({ tagName: 'DIV' })
  const input = el({ tagName: 'INPUT', type: 'text' })
  assert.equal(nthTextField([div, input], visible, 1), input)
})

test('skips invisible fields', () => {
  const hidden = el({ tagName: 'INPUT', type: 'text' })
  const shown = el({ tagName: 'TEXTAREA' })
  assert.equal(
    nthTextField([hidden, shown], e => e !== hidden, 1),
    shown,
  )
})

test('skips non-typing inputs', () => {
  const box = el({ tagName: 'INPUT', type: 'checkbox' })
  const text = el({ tagName: 'INPUT', type: 'search' })
  assert.equal(nthTextField([box, text], visible, 1), text)
})

test('skips disabled and readonly fields', () => {
  const off = el({ tagName: 'INPUT', type: 'text', disabled: true })
  const locked = el({ tagName: 'TEXTAREA', readOnly: true })
  const open = el({ tagName: 'INPUT', type: 'text', disabled: false, readOnly: false })
  assert.equal(nthTextField([off, locked, open], visible, 1), open)
})

test('a count picks the nth eligible field', () => {
  const a = el({ tagName: 'INPUT', type: 'text' })
  const off = el({ tagName: 'INPUT', type: 'text', disabled: true })
  const b = el({ tagName: 'TEXTAREA' })
  assert.equal(nthTextField([a, off, b], visible, 2), b)
})

test('a count past the end stops at the last field', () => {
  const a = el({ tagName: 'INPUT', type: 'text' })
  const b = el({ tagName: 'TEXTAREA' })
  assert.equal(nthTextField([a, b], visible, 9), b)
})

test('returns null when nothing qualifies', () => {
  assert.equal(nthTextField([el({ tagName: 'DIV' })], visible, 1), null)
  assert.equal(nthTextField([], visible, 3), null)
})
