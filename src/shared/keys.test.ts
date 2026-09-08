import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseKeys, keyId, hasModifier, toNotation } from './keys.ts'

test('parses a plain letter to a physical code', () => {
  const keys = parseKeys('j')
  assert.equal(keys?.length, 1)
  assert.equal(keys?.[0]?.code, 'KeyJ')
  assert.equal(keys?.[0]?.key, 'j')
  assert.equal(keys?.[0]?.ctrl, false)
})

test('parses a sequence', () => {
  const keys = parseKeys('gi')
  assert.equal(keys?.length, 2)
  assert.equal(keys?.[0]?.code, 'KeyG')
  assert.equal(keys?.[1]?.code, 'KeyI')
})

test('parses modifiers', () => {
  const ctrlD = parseKeys('<C-d>')?.[0]
  assert.equal(ctrlD?.code, 'KeyD')
  assert.equal(ctrlD?.ctrl, true)

  const metaK = parseKeys('<M-k>')?.[0]
  assert.equal(metaK?.meta, true)
})

test('parses named keys', () => {
  assert.equal(parseKeys('<Esc>')?.[0]?.code, 'Escape')
  assert.equal(parseKeys('<Space>')?.[0]?.code, 'Space')
  assert.equal(parseKeys('<CR>')?.[0]?.code, 'Enter')
})

test('parses digits', () => {
  assert.equal(parseKeys('1')?.[0]?.code, 'Digit1')
})

test('parses bracket keys so <C-[> can stand in for Esc', () => {
  assert.equal(parseKeys('[')?.[0]?.code, 'BracketLeft')
  assert.equal(parseKeys(']')?.[0]?.code, 'BracketRight')
  const k = parseKeys('<C-[>')?.[0]
  assert.equal(k?.code, 'BracketLeft')
  assert.equal(k?.ctrl, true)
})

test('parses punctuation used by vimkey bindings', () => {
  assert.equal(parseKeys('-')?.[0]?.code, 'Minus')
  assert.equal(parseKeys('=')?.[0]?.code, 'Equal')
  assert.equal(parseKeys('?')?.[0]?.code, 'Slash')
})

test('returns null on malformed notation', () => {
  assert.equal(parseKeys('<C-'), null)
  assert.equal(parseKeys('<Nope>'), null)
  assert.equal(parseKeys(''), null)
})

test('keyId distinguishes physical from logical matching', () => {
  const k = { code: 'KeyJ', key: 'j', ctrl: false, meta: false, alt: false, shift: false }
  assert.equal(keyId(k, 'physical'), 'KeyJ')
  assert.equal(keyId(k, 'logical'), 'j')
})

test('keyId encodes modifiers in a stable order', () => {
  const k = { code: 'KeyD', key: 'd', ctrl: true, meta: true, alt: false, shift: false }
  assert.equal(keyId(k, 'physical'), 'C-M-KeyD')
})

test('hasModifier ignores shift because S and s are different keys', () => {
  const shifted = { code: 'KeyF', key: 'F', ctrl: false, meta: false, alt: false, shift: true }
  assert.equal(hasModifier(shifted), false)
  assert.equal(hasModifier({ ...shifted, shift: false, meta: true }), true)
})

test('an uppercase letter carries shift', () => {
  const k = parseKeys('F')?.[0]
  assert.equal(k?.code, 'KeyF')
  assert.equal(k?.shift, true)
})

test('toNotation round-trips through parseKeys', () => {
  for (const n of ['j', 'F', '<C-d>', '<M-k>', '<Esc>', '<Space>', '1', '[', '?', '-', '`', ',', '.', '<lt>']) {
    const key = parseKeys(n)![0]!
    assert.deepEqual(parseKeys(toNotation(key))![0], key, `round trip failed for ${n}`)
  }
})

test('toNotation prefers the bare form when there is no modifier', () => {
  assert.equal(toNotation(parseKeys('j')![0]!), 'j')
  assert.equal(toNotation(parseKeys('F')![0]!), 'F')
})

test('toNotation wraps modified and named keys in angle brackets', () => {
  assert.equal(toNotation(parseKeys('<C-d>')![0]!), '<C-d>')
  assert.equal(toNotation(parseKeys('<Esc>')![0]!), '<Esc>')
  assert.equal(toNotation(parseKeys('<C-[>')![0]!), '<C-[>')
})
