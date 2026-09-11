import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hintText, filterHints } from './text.ts'

const el = (o: Record<string, unknown>) =>
  ({
    getAttribute: (n: string) => (o as Record<string, string | null>)[`attr:${n}`] ?? null,
    ...o,
  }) as unknown as Element

test('links and buttons use their text', () => {
  assert.equal(hintText(el({ tagName: 'A', textContent: 'Sign in' })), 'sign in')
  assert.equal(hintText(el({ tagName: 'BUTTON', textContent: 'Submit' })), 'submit')
})

test('whitespace is collapsed', () => {
  assert.equal(hintText(el({ tagName: 'A', textContent: '  Sign\n   in  ' })), 'sign in')
})

test('inputs fall back to value, placeholder then aria-label', () => {
  assert.equal(hintText(el({ tagName: 'INPUT', value: 'Search' })), 'search')
  assert.equal(hintText(el({ tagName: 'INPUT', 'attr:placeholder': 'Email' })), 'email')
  assert.equal(hintText(el({ tagName: 'INPUT', 'attr:aria-label': 'Close' })), 'close')
})

test('images use alt text', () => {
  assert.equal(hintText(el({ tagName: 'IMG', 'attr:alt': 'Logo' })), 'logo')
})

test('an element with nothing readable yields an empty string', () => {
  assert.equal(hintText(el({ tagName: 'DIV' })), '')
})

const items = [
  { label: 'a', text: 'one' },
  { label: 's', text: 'two' },
  { label: 'd', text: 'three' },
]

test('an exact label match wins immediately', () => {
  assert.deepEqual(filterHints(items, 'a'), { kind: 'match', index: 0 })
})

test('text that is not a label filters the candidates', () => {
  assert.deepEqual(filterHints(items, 'thr'), { kind: 'filter', indexes: [2], by: 'text' })
})

test('a label prefix reports that it narrowed by label', () => {
  assert.deepEqual(filterHints([{ label: 'fj', text: 'x' }, { label: 'fk', text: 'y' }], 'f'), {
    kind: 'filter',
    indexes: [0, 1],
    by: 'label',
  })
})

test('a filter matching several keeps them all', () => {
  assert.deepEqual(filterHints([...items, { label: 'f', text: 'threefold' }], 'thr'), {
    kind: 'filter',
    indexes: [2, 3],
    by: 'text',
  })
})

test('matching nothing reports none', () => {
  assert.deepEqual(filterHints(items, 'zzz'), { kind: 'none' })
})

test('a label match is preferred over a text match on the same input', () => {
  assert.deepEqual(filterHints([{ label: 'o', text: 'one' }], 'o'), { kind: 'match', index: 0 })
})
