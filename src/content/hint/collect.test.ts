import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isClickable } from './collect.ts'

const el = (o: Record<string, unknown>) =>
  ({
    getAttribute: (n: string) => (o as Record<string, string | null>)[`attr:${n}`] ?? null,
    hasAttribute: (n: string) => `attr:${n}` in o,
    ...o,
  }) as unknown as Element

test('links with an href are clickable', () => {
  assert.equal(isClickable(el({ tagName: 'A', 'attr:href': '/x' })), true)
})

test('an anchor without href is not clickable', () => {
  assert.equal(isClickable(el({ tagName: 'A' })), false)
})

test('form controls are clickable', () => {
  assert.equal(isClickable(el({ tagName: 'BUTTON' })), true)
  assert.equal(isClickable(el({ tagName: 'INPUT', type: 'text' })), true)
  assert.equal(isClickable(el({ tagName: 'SELECT' })), true)
  assert.equal(isClickable(el({ tagName: 'TEXTAREA' })), true)
})

test('a disabled control is not clickable', () => {
  assert.equal(isClickable(el({ tagName: 'BUTTON', 'attr:disabled': '' })), false)
})

test('hidden inputs are not clickable', () => {
  assert.equal(isClickable(el({ tagName: 'INPUT', type: 'hidden' })), false)
})

test('aria roles make an element clickable', () => {
  assert.equal(isClickable(el({ tagName: 'DIV', 'attr:role': 'button' })), true)
  assert.equal(isClickable(el({ tagName: 'DIV', 'attr:role': 'link' })), true)
  assert.equal(isClickable(el({ tagName: 'SPAN', 'attr:role': 'checkbox' })), true)
})

test('onclick and tabindex make an element clickable', () => {
  assert.equal(isClickable(el({ tagName: 'DIV', 'attr:onclick': 'x()' })), true)
  assert.equal(isClickable(el({ tagName: 'DIV', 'attr:tabindex': '0' })), true)
})

test('tabindex of -1 is not clickable', () => {
  assert.equal(isClickable(el({ tagName: 'DIV', 'attr:tabindex': '-1' })), false)
})

test('contenteditable is clickable', () => {
  assert.equal(isClickable(el({ tagName: 'DIV', isContentEditable: true })), true)
})

test('a plain div is not clickable', () => {
  assert.equal(isClickable(el({ tagName: 'DIV' })), false)
  assert.equal(isClickable(el({ tagName: 'SPAN' })), false)
  assert.equal(isClickable(el({ tagName: 'P' })), false)
})
