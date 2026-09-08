import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indicatorLabel } from './indicator.ts'
import type { Mode } from './mode.ts'

test('the modes you enter deliberately and cannot otherwise see are labelled', () => {
  assert.equal(indicatorLabel('passthrough'), '-- INSERT --')
  assert.equal(indicatorLabel('visual'), '-- VISUAL --')
})

test('normal is unlabelled, or the badge would be on screen permanently', () => {
  assert.equal(indicatorLabel('normal'), null)
})

test('modes that already draw themselves are not labelled twice', () => {
  assert.equal(indicatorLabel('hint'), null)
  assert.equal(indicatorLabel('command'), null)
})

test('insert is unlabelled: focusing a text field already announces itself', () => {
  assert.equal(indicatorLabel('insert'), null)
})

test('every mode is handled', () => {
  const all: Mode[] = ['normal', 'insert', 'hint', 'command', 'passthrough', 'pending', 'visual']
  for (const m of all) {
    const label = indicatorLabel(m)
    assert.ok(label === null || label.startsWith('-- '), `${m} yielded ${String(label)}`)
  }
})
