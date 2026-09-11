import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isClickable, groupTargets } from './collect.ts'

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

test('a details summary is clickable', () => {
  assert.equal(isClickable(el({ tagName: 'SUMMARY' })), true)
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

const link = (href: string, top: number, bottom = top + 20) =>
  el({
    tagName: 'A',
    'attr:href': href,
    href: new URL(href, 'https://x.test/').href,
    getBoundingClientRect: () => ({ top, bottom }),
  })

test('one link drawn twice in a row gets one hint', () => {
  const avatar = link('/member/a', 0, 48)
  const name = link('https://x.test/member/a', 30)
  const title = link('/t/1', 5)
  assert.deepEqual(groupTargets([avatar, title, name]), [[avatar, name], [title]])
})

test('the same link in another row keeps its own hint', () => {
  const a = link('/go/node', 0)
  const b = link('/go/node', 72)
  assert.deepEqual(groupTargets([a, b]), [[a], [b]])
})

test('links whose behavior is up to a script are never merged', () => {
  const a = link('#', 0)
  const b = link('#', 0)
  const c = link('javascript:void(0)', 0)
  const d = link('javascript:void(0)', 0)
  assert.deepEqual(groupTargets([a, b, c, d]), [[a], [b], [c], [d]])
})

test('controls that are not links are never merged', () => {
  const box = () => ({ top: 0, bottom: 20 })
  const a = el({ tagName: 'BUTTON', getBoundingClientRect: box })
  const b = el({ tagName: 'BUTTON', getBoundingClientRect: box })
  assert.deepEqual(groupTargets([a, b]), [[a], [b]])
})
