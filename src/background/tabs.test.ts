import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTabTarget, tabsToClose } from './tabs.ts'

test('next wraps past the last tab', () => {
  assert.equal(resolveTabTarget(2, 3, 1), 0)
  assert.equal(resolveTabTarget(0, 3, 1), 1)
})

test('prev wraps past the first tab', () => {
  assert.equal(resolveTabTarget(0, 3, -1), 2)
  assert.equal(resolveTabTarget(2, 3, -1), 1)
})

test('a single tab always resolves to itself', () => {
  assert.equal(resolveTabTarget(0, 1, 1), 0)
  assert.equal(resolveTabTarget(0, 1, -1), 0)
})

test('an empty window resolves to zero rather than NaN', () => {
  assert.equal(resolveTabTarget(0, 0, 1), 0)
})

test('a repeat moves that many tabs, still wrapping', () => {
  assert.equal(resolveTabTarget(0, 5, 1, 3), 3)
  assert.equal(resolveTabTarget(0, 5, 1, 7), 2)
  assert.equal(resolveTabTarget(0, 5, -1, 2), 3)
  assert.equal(resolveTabTarget(4, 5, 1, 1), 0)
})

const row = (id: number, extra: object = {}) => ({
  id,
  index: id,
  windowId: 1,
  active: false,
  incognito: false,
  ...extra,
})

test('closing other tabs spares the current one', () => {
  const tabs = [row(0), row(1), row(2), row(3)]
  assert.deepEqual(tabsToClose('closeOtherTabs', tabs, 1), [0, 2, 3])
  assert.deepEqual(tabsToClose('closeTabsLeft', tabs, 2), [0, 1])
  assert.deepEqual(tabsToClose('closeTabsRight', tabs, 1), [2, 3])
})

test('pinned tabs are never closed in bulk', () => {
  const tabs = [row(0, { pinned: true }), row(1), row(2)]
  assert.deepEqual(tabsToClose('closeOtherTabs', tabs, 2), [1])
  assert.deepEqual(tabsToClose('closeTabsLeft', tabs, 2), [1])
})
