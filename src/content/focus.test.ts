import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isEditable, deepActiveElement, modeForFocus, ownsEscape } from './focus.ts'

const el = (o: Record<string, unknown>) =>
  ({
    getAttribute: (n: string) => (o as Record<string, string | null>)[`attr:${n}`] ?? null,
    ...o,
  }) as unknown as Element

test('input, textarea and select are editable', () => {
  assert.equal(isEditable(el({ tagName: 'INPUT', type: 'text' })), true)
  assert.equal(isEditable(el({ tagName: 'TEXTAREA' })), true)
  assert.equal(isEditable(el({ tagName: 'SELECT' })), true)
})

test('an input with no type attribute is editable', () => {
  assert.equal(isEditable(el({ tagName: 'INPUT' })), true)
})

test('non-typing input types are not editable', () => {
  assert.equal(isEditable(el({ tagName: 'INPUT', type: 'checkbox' })), false)
  assert.equal(isEditable(el({ tagName: 'INPUT', type: 'radio' })), false)
  assert.equal(isEditable(el({ tagName: 'INPUT', type: 'submit' })), false)
})

test('contenteditable is editable', () => {
  assert.equal(isEditable(el({ tagName: 'DIV', isContentEditable: true })), true)
})

test('textbox and searchbox roles are editable', () => {
  assert.equal(isEditable(el({ tagName: 'DIV', 'attr:role': 'textbox' })), true)
  assert.equal(isEditable(el({ tagName: 'DIV', 'attr:role': 'searchbox' })), true)
})

test('a plain div is not editable', () => {
  assert.equal(isEditable(el({ tagName: 'DIV' })), false)
})

test('null is not editable', () => {
  assert.equal(isEditable(null), false)
})

test("monaco's hidden textarea is detected by class", () => {
  const classList = { contains: (c: string) => c === 'inputarea' }
  assert.equal(isEditable(el({ tagName: 'TEXTAREA', classList })), true)
  assert.equal(isEditable(el({ tagName: 'DIV', classList })), true)
})

test('codemirror is detected by ancestor', () => {
  const closest = (sel: string) => (sel.includes('cm-content') ? ({} as Element) : null)
  assert.equal(isEditable(el({ tagName: 'DIV', closest })), true)
})

test('deepActiveElement descends through shadow roots', () => {
  const inner = el({ tagName: 'INPUT', type: 'text' })
  const host = { tagName: 'DIV', shadowRoot: { activeElement: inner } }
  const root = { activeElement: host } as unknown as Document
  assert.equal(deepActiveElement(root), inner)
})

test('deepActiveElement descends through nested shadow roots', () => {
  const inner = el({ tagName: 'INPUT', type: 'text' })
  const mid = { tagName: 'DIV', shadowRoot: { activeElement: inner } }
  const outer = { tagName: 'DIV', shadowRoot: { activeElement: mid } }
  const root = { activeElement: outer } as unknown as Document
  assert.equal(deepActiveElement(root), inner)
})

test('deepActiveElement returns the element when there is no shadow root', () => {
  const only = el({ tagName: 'INPUT', type: 'text' })
  assert.equal(deepActiveElement({ activeElement: only } as unknown as Document), only)
})

test('deepActiveElement returns null when nothing is focused', () => {
  assert.equal(deepActiveElement({ activeElement: null } as unknown as Document), null)
})

test('a focused iframe puts the outer document in passthrough', () => {
  assert.equal(modeForFocus(el({ tagName: 'IFRAME' })), 'passthrough')
})

test('a focused text field is insert, anything else is normal', () => {
  assert.equal(modeForFocus(el({ tagName: 'TEXTAREA' })), 'insert')
  assert.equal(modeForFocus(el({ tagName: 'DIV' })), 'normal')
  assert.equal(modeForFocus(null), 'normal')
})

test('a field with its popup open keeps Esc for itself', () => {
  assert.equal(ownsEscape(el({ tagName: 'INPUT', 'attr:role': 'combobox', 'attr:aria-expanded': 'true' })), true)
})

test('a code editor keeps Esc for itself', () => {
  const editor = el({ tagName: 'DIV', closest: (s: string) => (s.includes('.cm-content') ? {} : null) })
  assert.equal(ownsEscape(editor), true)
})

test('a plain field or a closed combobox gives Esc up', () => {
  assert.equal(ownsEscape(el({ tagName: 'INPUT', closest: () => null })), false)
  const closed = el({ tagName: 'INPUT', 'attr:role': 'combobox', 'attr:aria-expanded': 'false', closest: () => null })
  assert.equal(ownsEscape(closed), false)
})
