import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Matcher } from './matcher.ts'
import { parseKeys } from './keys.ts'

const bind = (notation: string, action: string) => ({ keys: parseKeys(notation)!, action })
const k = (notation: string) => parseKeys(notation)![0]!

test('matches a single key', () => {
  const m = new Matcher([bind('j', 'scrollDown')], 'physical')
  assert.deepEqual(m.step(k('j')), { kind: 'match', action: 'scrollDown' })
})

test('matches a two-key sequence', () => {
  const m = new Matcher([bind('gi', 'focusInput')], 'physical')
  assert.deepEqual(m.step(k('g')), { kind: 'pending' })
  assert.deepEqual(m.step(k('i')), { kind: 'match', action: 'focusInput' })
})

test('reports none for an unbound key and resets', () => {
  const m = new Matcher([bind('gi', 'focusInput')], 'physical')
  assert.deepEqual(m.step(k('g')), { kind: 'pending' })
  assert.deepEqual(m.step(k('z')), { kind: 'none' })
  assert.equal(m.pending, false)
})

test('binds one action to multiple keys', () => {
  const m = new Matcher([bind('<Esc>', 'escape'), bind('<C-[>', 'escape')], 'physical')
  assert.deepEqual(m.step(k('<Esc>')), { kind: 'match', action: 'escape' })
  assert.deepEqual(m.step(k('<C-[>')), { kind: 'match', action: 'escape' })
})

test('reset clears a pending sequence', () => {
  const m = new Matcher([bind('gi', 'focusInput')], 'physical')
  m.step(k('g'))
  m.reset()
  assert.equal(m.pending, false)
  assert.deepEqual(m.step(k('i')), { kind: 'none' })
})

test('logical matching keys off event.key', () => {
  const m = new Matcher([bind('j', 'scrollDown')], 'logical')
  const dvorak = { code: 'KeyC', key: 'j', ctrl: false, meta: false, alt: false, shift: false }
  assert.deepEqual(m.step(dvorak), { kind: 'match', action: 'scrollDown' })
})

test('a longer binding shadows a shorter one sharing its prefix', () => {
  const m = new Matcher([bind('g', 'shortOne'), bind('gi', 'focusInput')], 'physical')
  assert.deepEqual(m.step(k('g')), { kind: 'pending' })
  assert.deepEqual(m.step(k('i')), { kind: 'match', action: 'focusInput' })
})

test('shift distinguishes bindings on the same physical key', () => {
  const m = new Matcher([bind('f', 'hint'), bind('F', 'hintNewTab')], 'physical')
  assert.deepEqual(m.step(k('f')), { kind: 'match', action: 'hint' })
  assert.deepEqual(m.step(k('F')), { kind: 'match', action: 'hintNewTab' })
})
