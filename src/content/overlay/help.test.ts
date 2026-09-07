import { test } from 'node:test'
import assert from 'node:assert/strict'
import { helpRows } from './help.ts'
import { parseKeys } from '../../shared/keys.ts'

const bind = (notation: string, action: string) => ({
  keys: parseKeys(notation)!,
  action,
  notation,
})

test('rows come from the action registry, not a hand-written list', () => {
  const rows = helpRows([bind('j', 'scrollDown')])
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.label, 'Scroll down')
  assert.equal(rows[0]?.sub, 'j')
})

test('multiple bindings for one action are listed together', () => {
  const rows = helpRows([bind('<Esc>', 'escape'), bind('<C-[>', 'escape')])
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.sub, '<Esc>  <C-[>')
})

test('unbound actions are omitted', () => {
  const rows = helpRows([bind('j', 'scrollDown')])
  assert.equal(
    rows.some(r => r.value === 'scrollUp'),
    false,
  )
})

test('bindings with no notation are ignored', () => {
  assert.deepEqual(helpRows([{ keys: parseKeys('j')!, action: 'scrollDown' }]), [])
})
