import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paletteRows } from './palette.ts'
import { helpRows } from './help.ts'
import { ACTIONS } from '../../shared/actions.ts'
import { parseKeys } from '../../shared/keys.ts'

const bind = (notation: string, action: string) => ({
  keys: parseKeys(notation)!,
  action,
  notation,
})

test('lists every action, unlike help which lists only bound ones', () => {
  const bindings = [bind('j', 'scrollDown')]
  assert.equal(paletteRows(bindings).length, ACTIONS.length)
  assert.equal(helpRows(bindings).length, 1)
})

test('bound actions show their keys', () => {
  const row = paletteRows([bind('j', 'scrollDown')]).find(r => r.value === 'scrollDown')
  assert.equal(row?.sub, 'j')
})

test('unbound actions show no keys', () => {
  const row = paletteRows([bind('j', 'scrollDown')]).find(r => r.value === 'scrollUp')
  assert.equal(row?.sub, '')
})

test('rows carry the action id as their value so the runtime can execute it', () => {
  for (const r of paletteRows([])) {
    assert.ok(ACTIONS.some(a => a.id === r.value))
  }
})
