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
  assert.equal(s.keys, 'j')
  assert.equal(s.action, 'scrollDown')
})

test('nmap and nunmap are aliases for map and unmap', () => {
  const r = parse('map j scrollDown\nnmap k scrollUp\nunmap j\nnunmap k')
  assert.deepEqual(r.errors, [])
  assert.deepEqual(
    r.stmts.map(({ span, ...stmt }) => stmt),
    [
      { kind: 'map', keys: 'j', action: 'scrollDown' },
      { kind: 'map', keys: 'k', action: 'scrollUp' },
      { kind: 'unmap', keys: 'j' },
      { kind: 'unmap', keys: 'k' },
    ],
  )
})

for (const head of ['hmap', 'cmap', 'hunmap', 'cunmap']) {
  test(`${head} reports an unknown statement globally and inside a site`, () => {
    const src = [
      'map j scrollDown',
      `${head} j scrollUp`,
      'set scrollStep = 80',
      'site a.com {',
      '  nmap k scrollUp',
      `  ${head} k scrollDown`,
      '  nunmap j',
      '}',
      'map h scrollLeft',
    ].join('\n')
    const r = parse(src)
    assert.deepEqual(r.errors, [
      { line: 2, message: `unknown statement: ${head}` },
      { line: 6, message: `unknown statement: ${head}` },
    ])
    assert.deepEqual(r.stmts.map(s => s.kind), ['map', 'set', 'site', 'map'])
    const site = r.stmts[2]!
    assert.equal(site.kind, 'site')
    if (site.kind !== 'site') return
    assert.deepEqual(site.body.map(s => s.kind), ['map', 'unmap'])
  })
}

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

test('legacy sequenceTimeout remains a set statement without diagnostics', () => {
  const src = 'set sequenceTimeout = 250\nsite a.com {\n  set sequenceTimeout = 500\n}'
  const r = parse(src)
  assert.deepEqual(r.errors, [])
  const global = r.stmts[0]!
  assert.equal(global.kind, 'set')
  if (global.kind !== 'set') return
  assert.equal(global.option, 'sequenceTimeout')
  assert.equal(global.value, '250')
  const site = r.stmts[1]!
  assert.equal(site.kind, 'site')
  if (site.kind !== 'site') return
  const local = site.body[0]!
  assert.equal(local.kind, 'set')
  if (local.kind !== 'set') return
  assert.equal(local.option, 'sequenceTimeout')
  assert.equal(local.value, '500')
  for (const stmt of [global, local]) {
    assert.equal(src.slice(stmt.span.start, stmt.span.end), `set sequenceTimeout = ${stmt.value}`)
  }
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
