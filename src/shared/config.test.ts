import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveForHost, disabledHosts, DEFAULT_DSL, OPTION_SCHEMA } from './config.ts'

test('the shipped defaults parse without error', () => {
  const r = resolveForHost(DEFAULT_DSL, 'example.com')
  assert.equal(r.disabled, false)
  assert.ok(r.bindings.normal.length > 0)
})

test('global map produces a normal-mode binding', () => {
  const r = resolveForHost('map d scrollDown', 'example.com')
  const b = r.bindings.normal.find(x => x.action === 'scrollDown')
  assert.ok(b)
  assert.equal(b!.keys[0]?.code, 'KeyD')
})

test('site block unmap removes a binding only on that host', () => {
  const src = 'map j scrollDown\nsite youtube.com {\n  unmap j\n}'
  assert.equal(
    resolveForHost(src, 'youtube.com').bindings.normal.some(b => b.action === 'scrollDown'),
    false,
  )
  assert.ok(resolveForHost(src, 'example.com').bindings.normal.some(b => b.action === 'scrollDown'))
})

test('site block disable marks the host disabled', () => {
  const src = 'site mail.google.com {\n  disable\n}'
  assert.equal(resolveForHost(src, 'mail.google.com').disabled, true)
  assert.equal(resolveForHost(src, 'drive.google.com').disabled, false)
})

test('wildcard patterns match subdomains', () => {
  const src = 'site *.google.com {\n  disable\n}'
  assert.equal(resolveForHost(src, 'drive.google.com').disabled, true)
  assert.equal(resolveForHost(src, 'google.com').disabled, false)
})

test('a more specific pattern wins over a wildcard', () => {
  const src =
    'site *.google.com {\n  disable\n}\nsite drive.google.com {\n  set hintChars = "qwer"\n}'
  const r = resolveForHost(src, 'drive.google.com')
  assert.equal(r.options.hintChars, 'qwer')
})

test('equally specific patterns resolve last-wins', () => {
  const src =
    'site a.com {\n  set hintChars = "aaaa"\n}\nsite a.com {\n  set hintChars = "bbbb"\n}'
  assert.equal(resolveForHost(src, 'a.com').options.hintChars, 'bbbb')
})

test('set overrides an option globally', () => {
  assert.equal(resolveForHost('set keyMatching = logical', 'a.com').options.keyMatching, 'logical')
})

test('an unknown set option is ignored rather than fatal', () => {
  const r = resolveForHost('set nonsense = 1\nmap d scrollDown', 'a.com')
  assert.ok(r.bindings.normal.some(b => b.action === 'scrollDown'))
})

test('disabledHosts lists every disabled pattern including wildcards', () => {
  const src = 'site a.com {\n  disable\n}\nsite b.com {\n  unmap j\n}\nsite *.c.com {\n  disable\n}'
  assert.deepEqual(disabledHosts(src), ['a.com', '*.c.com'])
})

test('a parse error does not discard valid statements', () => {
  const r = resolveForHost('map d scrollDown\nmap k bogusAction', 'a.com')
  assert.ok(r.bindings.normal.some(b => b.action === 'scrollDown'))
})

test('bindings are resolved for every mode', () => {
  const r = resolveForHost('hmap d scrollDown\ncmap k scrollUp', 'a.com')
  assert.ok(r.bindings.hint.some(b => b.action === 'scrollDown'))
  assert.ok(r.bindings.command.some(b => b.action === 'scrollUp'))
})

test('the option schema covers every runtime option', () => {
  const defaults = resolveForHost('', 'a.com').options
  const declared = new Set(OPTION_SCHEMA.map(o => o.key))
  for (const k of Object.keys(defaults)) assert.ok(declared.has(k as never), `${k} missing from schema`)
})

test('a choice option rejects a value outside its list', () => {
  assert.equal(resolveForHost('set keyMatching = nonsense', 'a.com').options.keyMatching, 'physical')
})

test('a boolean option reads false only from the literal string', () => {
  assert.equal(resolveForHost('set scrollSmooth = false', 'a.com').options.scrollSmooth, false)
  assert.equal(resolveForHost('set scrollSmooth = true', 'a.com').options.scrollSmooth, true)
})
