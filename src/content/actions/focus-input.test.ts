import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstTextField } from './focus-input.ts'

const el = (o: Record<string, unknown>) =>
  ({ getAttribute: () => null, ...o }) as unknown as Element

const visible = () => true

test('picks the first editable element', () => {
  const div = el({ tagName: 'DIV' })
  const input = el({ tagName: 'INPUT', type: 'text' })
  assert.equal(firstTextField([div, input], visible), input)
})

test('skips invisible fields', () => {
  const hidden = el({ tagName: 'INPUT', type: 'text' })
  const shown = el({ tagName: 'TEXTAREA' })
  assert.equal(
    firstTextField([hidden, shown], e => e !== hidden),
    shown,
  )
})

test('skips non-typing inputs', () => {
  const box = el({ tagName: 'INPUT', type: 'checkbox' })
  const text = el({ tagName: 'INPUT', type: 'search' })
  assert.equal(firstTextField([box, text], visible), text)
})

test('returns null when nothing qualifies', () => {
  assert.equal(firstTextField([el({ tagName: 'DIV' })], visible), null)
  assert.equal(firstTextField([], visible), null)
})
