import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rebind, unbind, setOption, toggleSite } from './edits.ts'
import { resolveForHost } from '../shared/config.ts'

const SRC = `# my bindings
map j scrollDown

# keep me
map k scrollUp
`

test('rebind rewrites the binding in place and keeps every comment', () => {
  const out = rebind(SRC, 'scrollDown', 'd')
  assert.ok(out.includes('# my bindings'))
  assert.ok(out.includes('# keep me'))
  assert.ok(out.includes('map d scrollDown'))
  assert.equal(out.includes('map j scrollDown'), false)
  assert.ok(out.includes('map k scrollUp'))
})

test('rebind appends when the action has no binding yet', () => {
  const out = rebind(SRC, 'scrollLeft', 'h')
  assert.ok(out.includes('map h scrollLeft'))
  assert.ok(out.includes('map j scrollDown'))
})

test('rebind survives a round trip through the resolver', () => {
  const site = resolveForHost(rebind(SRC, 'scrollDown', 'd'), 'a.com')
  const b = site.bindings.normal.find(x => x.action === 'scrollDown')
  assert.equal(b?.notation, 'd')
})

test('unbind removes the binding and leaves neighbours alone', () => {
  const out = unbind(SRC, 'scrollDown')
  assert.equal(out.includes('scrollDown'), false)
  assert.ok(out.includes('map k scrollUp'))
  assert.ok(out.includes('# my bindings'))
})

test('unbind on an unbound action changes nothing', () => {
  assert.equal(unbind(SRC, 'scrollLeft'), SRC)
})

test('setOption appends a new option', () => {
  const out = setOption(SRC, 'hintChars', 'qwer')
  assert.ok(out.includes('set hintChars = "qwer"'))
})

test('setOption replaces an existing option rather than duplicating it', () => {
  const once = setOption(SRC, 'hintChars', 'qwer')
  const twice = setOption(once, 'hintChars', 'asdf')
  assert.equal(twice.match(/set hintChars/g)?.length, 1)
  assert.ok(twice.includes('set hintChars = "asdf"'))
})

test('setOption round-trips through the resolver', () => {
  const out = setOption(SRC, 'scrollStep', '120')
  assert.equal(resolveForHost(out, 'a.com').options.scrollStep, 120)
})

test('toggleSite adds a disable block for a host', () => {
  const out = toggleSite(SRC, 'youtube.com', true)
  assert.equal(resolveForHost(out, 'youtube.com').disabled, true)
  assert.equal(resolveForHost(out, 'other.com').disabled, false)
})

test('toggleSite removes the block again', () => {
  const on = toggleSite(SRC, 'youtube.com', true)
  const off = toggleSite(on, 'youtube.com', false)
  assert.equal(resolveForHost(off, 'youtube.com').disabled, false)
  assert.ok(off.includes('# my bindings'))
})

test('toggleSite twice is idempotent', () => {
  const once = toggleSite(SRC, 'a.com', true)
  assert.equal(toggleSite(once, 'a.com', true), once)
})
