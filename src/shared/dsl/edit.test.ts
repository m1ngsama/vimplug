import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse } from './parse.ts'
import { replaceStmt, removeStmt, appendStmt } from './edit.ts'

const SRC = `# my bindings
map j scrollDown

# keep this comment
map k scrollUp
`

test('replaceStmt rewrites one statement and preserves comments', () => {
  const s = parse(SRC).stmts[0]!
  const out = replaceStmt(SRC, s.span, 'map d scrollDown')
  assert.ok(out.includes('# my bindings'))
  assert.ok(out.includes('# keep this comment'))
  assert.ok(out.includes('map d scrollDown'))
  assert.equal(out.includes('map j scrollDown'), false)
  assert.ok(out.includes('map k scrollUp'))
})

test('removeStmt drops the statement line without eating neighbours', () => {
  const s = parse(SRC).stmts[0]!
  const out = removeStmt(SRC, s.span)
  assert.equal(out.includes('map j scrollDown'), false)
  assert.ok(out.includes('# my bindings'))
  assert.ok(out.includes('map k scrollUp'))
})

test('removeStmt on an indented statement drops its whole line', () => {
  const src = 'site a.com {\n  unmap j\n  disable\n}'
  const site = parse(src).stmts[0]!
  assert.equal(site.kind, 'site')
  if (site.kind !== 'site') return
  const out = removeStmt(src, site.body[0]!.span)
  assert.equal(out, 'site a.com {\n  disable\n}')
})

test('appendStmt adds to the end with a trailing newline', () => {
  const out = appendStmt(SRC, 'map h scrollLeft')
  assert.ok(out.endsWith('map h scrollLeft\n'))
  assert.ok(out.includes('map k scrollUp'))
})

test('appendStmt inserts a newline when the source lacks one', () => {
  assert.equal(appendStmt('map j scrollDown', 'map k scrollUp'), 'map j scrollDown\nmap k scrollUp\n')
})

test('appendStmt handles empty source', () => {
  assert.equal(appendStmt('', 'map j scrollDown'), 'map j scrollDown\n')
})

test('an edit round-trips through the parser', () => {
  const s = parse(SRC).stmts[0]!
  const out = replaceStmt(SRC, s.span, 'map d scrollDown')
  const r = parse(out)
  assert.deepEqual(r.errors, [])
  assert.deepEqual(
    r.stmts.map(x => x.kind === 'map' && x.action),
    ['scrollDown', 'scrollUp'],
  )
})
