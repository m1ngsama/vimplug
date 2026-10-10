import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLOSED_LIMIT,
  byRecency,
  emptyState,
  noteActive,
  noteOpen,
  noteClosed,
  previousTab,
  takeClosed,
} from './tab-log.ts'

const tab = (id: number, url: string, extra: object = {}) => ({
  id,
  url,
  index: 0,
  windowId: 1,
  active: false,
  incognito: false,
  ...extra,
})

test('a closed tab comes back with its URL, position and window', () => {
  const s = emptyState()
  noteOpen(s, tab(7, 'https://a.test/', { index: 3, windowId: 2 }))
  noteClosed(s, 7)
  assert.deepEqual(takeClosed(s, false), {
    url: 'https://a.test/',
    index: 3,
    windowId: 2,
    incognito: false,
  })
})

test('tabs come back most recently closed first, each only once', () => {
  const s = emptyState()
  noteOpen(s, tab(1, 'https://a.test/'))
  noteOpen(s, tab(2, 'https://b.test/'))
  noteClosed(s, 1)
  noteClosed(s, 2)
  assert.equal(takeClosed(s, false)?.url, 'https://b.test/')
  assert.equal(takeClosed(s, false)?.url, 'https://a.test/')
  assert.equal(takeClosed(s, false), undefined)
})

test('a tab is restored to the last page it showed', () => {
  const s = emptyState()
  noteOpen(s, tab(1, 'https://a.test/'))
  noteOpen(s, tab(1, 'https://a.test/next'))
  noteClosed(s, 1)
  assert.equal(takeClosed(s, false)?.url, 'https://a.test/next')
})

test('a tab that never had a URL leaves nothing to restore', () => {
  const s = emptyState()
  noteOpen(s, tab(1, ''))
  noteClosed(s, 1)
  noteClosed(s, 99)
  assert.equal(takeClosed(s, false), undefined)
})

test('a private tab is only handed back to a private window', () => {
  const s = emptyState()
  noteOpen(s, tab(1, 'https://public.test/'))
  noteOpen(s, tab(2, 'https://private.test/', { incognito: true }))
  noteClosed(s, 1)
  noteClosed(s, 2)
  assert.equal(takeClosed(s, false)?.url, 'https://public.test/')
  assert.equal(takeClosed(s, false), undefined)
  assert.equal(takeClosed(s, true)?.url, 'https://private.test/')
})

test('the oldest closed tabs are dropped past the limit', () => {
  const s = emptyState()
  for (let i = 0; i <= CLOSED_LIMIT; i++) {
    noteOpen(s, tab(i, `https://a.test/${i}`))
    noteClosed(s, i)
  }
  assert.equal(s.closed.length, CLOSED_LIMIT)
  assert.equal(s.closed[0]?.url, 'https://a.test/1')
})

test('the state survives a round trip through storage', () => {
  const s = emptyState()
  noteOpen(s, tab(1, 'https://a.test/'))
  const revived = JSON.parse(JSON.stringify(s))
  noteClosed(revived, 1)
  assert.equal(takeClosed(revived, false)?.url, 'https://a.test/')
})

test('the previous tab is the one active before the current one', () => {
  const s = emptyState()
  for (const id of [1, 2, 3, 2]) noteActive(s, id)
  assert.equal(previousTab(s, 2), 3)
  assert.equal(previousTab(emptyState(), 2), undefined)
})

test('a closed tab is no longer the previous tab', () => {
  const s = emptyState()
  for (const id of [1, 2, 3]) noteActive(s, id)
  noteClosed(s, 2)
  assert.equal(previousTab(s, 3), 1)
})

test('tabs list most recently used first, the current one last', () => {
  const s = emptyState()
  for (const id of [1, 2, 3]) noteActive(s, id)
  const tabs = [1, 2, 3, 4].map(id => tab(id, `https://a.test/${id}`))
  assert.deepEqual(
    byRecency(tabs, s, 3).map(t => t.id),
    [2, 1, 4, 3],
  )
})
