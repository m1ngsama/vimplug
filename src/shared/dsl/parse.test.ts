import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse } from './parse.ts'

test('parses a map statement', () => {
  const r = parse('map j scrollDown')
  assert.deepEqual(r.errors, [])
  assert.equal(r.stmts.length, 1)
  const s = r.stmts[0]!
  assert.equal(s.kind, 'map')
  if (s.kind !== 'map') return
  assert.equal(s.mode, 'normal')
  assert.equal(s.keys, 'j')
  assert.equal(s.action, 'scrollDown')
})

test('nmap is an alias for map, hmap and cmap set the mode', () => {
  const r = parse('nmap j scrollDown\nhmap k scrollUp\ncmap h scrollLeft')
  assert.deepEqual(r.errors, [])
  assert.deepEqual(
    r.stmts.map(s => s.kind === 'map' && s.mode),
    ['normal', 'hint', 'command'],
  )
})

test('records a source span covering the statement text', () => {
  const src = '\nmap j scrollDown\n'
  const s = parse(src).stmts[0]!
  assert.equal(src.slice(s.span.start, s.span.end), 'map j scrollDown')
})

test('a span skips leading indentation', () => {
  const src = 'site a.com {\n    unmap j\n}'
  const site = parse(src).stmts[0]!
  assert.equal(site.kind, 'site')
  if (site.kind !== 'site') return
  const inner = site.body[0]!
  assert.equal(src.slice(inner.span.start, inner.span.end), 'unmap j')
})

test('ignores comments and blank lines', () => {
  const r = parse('# a comment\n\nmap j scrollDown\n')
  assert.deepEqual(r.errors, [])
  assert.equal(r.stmts.length, 1)
})

test('parses set statements', () => {
  const r = parse('set hintChars = "asdf"')
  const s = r.stmts[0]!
  assert.equal(s.kind, 'set')
  if (s.kind !== 'set') return
  assert.equal(s.option, 'hintChars')
  assert.equal(s.value, 'asdf')
})

test('parses a site block with nested statements', () => {
  const r = parse('site youtube.com {\n  unmap j\n  disable\n}')
  assert.deepEqual(r.errors, [])
  const s = r.stmts[0]!
  assert.equal(s.kind, 'site')
  if (s.kind !== 'site') return
  assert.equal(s.pattern, 'youtube.com')
  assert.deepEqual(
    s.body.map(b => b.kind),
    ['unmap', 'disable'],
  )
})

test('reports unknown action with a line number', () => {
  const r = parse('map j scrollDown\nmap k bogusAction')
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0]?.line, 2)
  assert.match(r.errors[0]!.message, /bogusAction/)
})

test('reports malformed key notation with a line number', () => {
  const r = parse('map <C- scrollDown')
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0]?.line, 1)
})

test('reports disable outside a site block', () => {
  const r = parse('disable')
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0]!.message, /site/)
})

test('reports an unclosed site block', () => {
  const r = parse('site a.com {\n  unmap j')
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0]!.message, /unclosed/)
})

test('reports nested site blocks', () => {
  const r = parse('site a.com {\nsite b.com {\n}\n}')
  assert.ok(r.errors.some(e => /nested/.test(e.message)))
})

test('collects errors without discarding valid statements', () => {
  const r = parse('map j scrollDown\nmap k bogusAction\nmap h scrollLeft')
  assert.equal(r.errors.length, 1)
  assert.equal(r.stmts.length, 2)
})
