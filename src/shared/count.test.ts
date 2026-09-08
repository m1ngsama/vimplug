import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CountBuffer } from './count.ts'
import { parseKeys } from './keys.ts'

const k = (n: string) => parseKeys(n)![0]!

test('digits accumulate into a count', () => {
  const c = new CountBuffer()
  assert.equal(c.feed(k('5')), true)
  assert.equal(c.value, 5)
  assert.equal(c.feed(k('2')), true)
  assert.equal(c.value, 52)
})

test('a leading zero is a binding, not a count', () => {
  const c = new CountBuffer()
  assert.equal(c.feed(k('0')), false)
  assert.equal(c.value, 1)
})

test('zero continues a count already under way', () => {
  const c = new CountBuffer()
  c.feed(k('1'))
  assert.equal(c.feed(k('0')), true)
  assert.equal(c.value, 10)
})

test('with no digits the count is one, so every action runs once', () => {
  assert.equal(new CountBuffer().value, 1)
})

test('a non-digit is not consumed', () => {
  const c = new CountBuffer()
  c.feed(k('3'))
  assert.equal(c.feed(k('j')), false)
  assert.equal(c.value, 3)
})

test('take returns the count and clears it', () => {
  const c = new CountBuffer()
  c.feed(k('7'))
  assert.equal(c.take(), 7)
  assert.equal(c.value, 1)
})

test('reset clears a half-typed count', () => {
  const c = new CountBuffer()
  c.feed(k('9'))
  c.reset()
  assert.equal(c.value, 1)
})

test('a modified digit is not a count: <C-1> belongs to whoever bound it', () => {
  const c = new CountBuffer()
  assert.equal(c.feed(k('<C-1>')), false)
  assert.equal(c.value, 1)
})

test('counts are capped so a leaning keyboard cannot ask for a million repeats', () => {
  const c = new CountBuffer()
  for (const d of '999999') c.feed(k(d))
  assert.ok(c.value <= 1000, `count reached ${c.value}`)
})
