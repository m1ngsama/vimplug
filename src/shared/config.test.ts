import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveForHost, disabledHosts, DEFAULT_DSL, OPTION_SCHEMA } from './config.ts'
import { ACTIONS } from './actions.ts'
import { parse } from './dsl/parse.ts'

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

test('every action in the registry resolves to a binding from the shipped defaults', () => {
  const bound = new Set(
    resolveForHost(DEFAULT_DSL, 'example.com').bindings.normal.map(b => b.action),
  )
  for (const a of ACTIONS) assert.ok(bound.has(a.id), `${a.id} has no usable default binding`)
})

test('the shipped defaults contain no parse errors at all', () => {
  assert.deepEqual(parse(DEFAULT_DSL).errors, [])
})

test('theme defaults to system and every colour override defaults to empty', () => {
  const o = resolveForHost('', 'a.com').options
  assert.equal(o.theme, 'system')
  assert.equal(o.themeAccent, '')
  assert.equal(o.themeBg, '')
})

test('a scheme name outside the list is rejected like any other choice', () => {
  assert.equal(resolveForHost('set theme = nonsense', 'a.com').options.theme, 'system')
  assert.equal(resolveForHost('set theme = nord', 'a.com').options.theme, 'nord')
})

test('a colour override is taken verbatim', () => {
  assert.equal(resolveForHost('set themeAccent = "#ff0000"', 'a.com').options.themeAccent, '#ff0000')
})

test('a theme can be set for one site only', () => {
  const src = 'set theme = nord\nsite a.com {\n  set theme = gruvbox-dark\n}'
  assert.equal(resolveForHost(src, 'a.com').options.theme, 'gruvbox-dark')
  assert.equal(resolveForHost(src, 'b.com').options.theme, 'nord')
})
