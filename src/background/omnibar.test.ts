import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankSuggestions, type Suggestion } from './omnibar.ts'

const s = (over: Partial<Suggestion>): Suggestion => ({
  kind: 'history',
  title: '',
  url: 'https://example.com/',
  ...over,
})

test('every term must appear somewhere in the title or url', () => {
  const items = [
    s({ title: 'GitHub pull requests' }),
    s({ title: 'GitHub issues' }),
    s({ title: 'Wikipedia' }),
  ]
  assert.deepEqual(
    rankSuggestions(items, 'github pull').map(r => r.title),
    ['GitHub pull requests'],
  )
})

test('an open tab outranks a bookmark, which outranks history', () => {
  const items = [
    s({ kind: 'history', title: 'Docs', url: 'https://h.example/' }),
    s({ kind: 'tab', title: 'Docs', url: 'https://t.example/' }),
    s({ kind: 'bookmark', title: 'Docs', url: 'https://b.example/' }),
  ]
  assert.deepEqual(
    rankSuggestions(items, 'docs').map(r => r.kind),
    ['tab', 'bookmark', 'history'],
  )
})

test('switching to an open tab beats opening a second copy of it', () => {
  const items = [
    s({ kind: 'history', title: 'Mail', url: 'https://mail.example.com/' }),
    s({ kind: 'tab', title: 'Mail', url: 'https://mail.example.com/', tabId: 4 }),
  ]
  assert.equal(rankSuggestions(items, 'mail')[0]?.tabId, 4)
})

test('a title the query starts is preferred over one that merely contains it', () => {
  const items = [
    s({ title: 'The best docs anywhere' }),
    s({ title: 'Docs for everything' }),
  ]
  assert.equal(rankSuggestions(items, 'docs')[0]?.title, 'Docs for everything')
})

test('frequently visited history rises above a one-off visit', () => {
  const items = [
    s({ title: 'Docs', url: 'https://a.example/', visits: 1 }),
    s({ title: 'Docs', url: 'https://b.example/', visits: 90 }),
  ]
  assert.equal(rankSuggestions(items, 'docs')[0]?.url, 'https://b.example/')
})

test('the same url from two sources appears once, at its best rank', () => {
  const items = [
    s({ kind: 'history', title: 'Docs', url: 'https://x.example/' }),
    s({ kind: 'tab', title: 'Docs', url: 'https://x.example/', tabId: 2 }),
    s({ kind: 'bookmark', title: 'Docs', url: 'https://x.example/' }),
  ]
  const out = rankSuggestions(items, 'docs')
  assert.equal(out.length, 1)
  assert.equal(out[0]?.kind, 'tab')
})

test('matching is case insensitive and reaches the url', () => {
  const items = [s({ title: 'Untitled', url: 'https://news.ycombinator.com/' })]
  assert.equal(rankSuggestions(items, 'YCOMBINATOR').length, 1)
})

test('an empty query keeps everything, most useful first', () => {
  const items = [
    s({ kind: 'history', title: 'a', url: 'https://a.example/' }),
    s({ kind: 'tab', title: 'b', url: 'https://b.example/' }),
  ]
  assert.deepEqual(
    rankSuggestions(items, '').map(r => r.kind),
    ['tab', 'history'],
  )
})

test('entries without a url are dropped rather than offered', () => {
  assert.deepEqual(rankSuggestions([s({ title: 'x', url: '' })], 'x'), [])
})
