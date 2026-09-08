import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SCHEMES, SCHEME_NAMES, TOKEN_VARS, resolveTheme, applyTheme } from './theme.ts'

const bare = {
  theme: 'system',
  themeBg: '',
  themeFg: '',
  themeMuted: '',
  themeBorder: '',
  themeAccent: '',
  themeAccentFg: '',
  themeMatch: '',
  themeMatchCurrent: '',
  themeGround: '',
  themeScrim: '',
}

test('system picks a built-in by the reported preference', () => {
  assert.deepEqual(resolveTheme(bare, true), SCHEMES['default-dark'])
  assert.deepEqual(resolveTheme(bare, false), SCHEMES['default-light'])
})

test('a named scheme is used as-is', () => {
  assert.deepEqual(resolveTheme({ ...bare, theme: 'nord' }, true), SCHEMES['nord'])
})

test('an unknown scheme falls back rather than yielding nothing', () => {
  assert.deepEqual(resolveTheme({ ...bare, theme: 'nonsense' }, true), SCHEMES['default-dark'])
})

test('an override replaces one token and leaves the rest', () => {
  const t = resolveTheme({ ...bare, theme: 'nord', themeAccent: '#ff0000' }, true)
  assert.equal(t.accent, '#ff0000')
  assert.equal(t.bg, SCHEMES['nord']!.bg)
})

test('an empty override means no override, so a scheme value survives', () => {
  const t = resolveTheme({ ...bare, theme: 'nord', themeAccent: '' }, true)
  assert.equal(t.accent, SCHEMES['nord']!.accent)
})

test('every token can be overridden', () => {
  const all = { ...bare, theme: 'nord' } as Record<string, string>
  for (const key of Object.keys(bare)) if (key !== 'theme') all[key] = '#123456'
  const t = resolveTheme(all as typeof bare, true)
  for (const v of Object.values(t)) assert.equal(v, '#123456')
})

test('SCHEME_NAMES offers system plus every built-in', () => {
  assert.ok(SCHEME_NAMES.includes('system'))
  for (const name of Object.keys(SCHEMES)) assert.ok(SCHEME_NAMES.includes(name), name)
})

// Data self-check: a scheme added later that forgets a token fails here, not on a page.
test('every built-in scheme defines every token', () => {
  const names = Object.keys(TOKEN_VARS)
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    for (const n of names) {
      assert.ok((tokens as Record<string, string>)[n], `${scheme} is missing ${n}`)
    }
  }
})

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!
}

const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

// A hint whose text cannot be read is a bug in our palette, not in anyone's config.
test('hint text is legible on hint background in every built-in scheme', () => {
  for (const [scheme, t] of Object.entries(SCHEMES)) {
    const ratio = contrast(t.accent, t.accentFg)
    assert.ok(ratio >= 3, `${scheme}: accent vs accentFg is only ${ratio.toFixed(1)}:1`)
  }
})

test('panel text is legible on panel background in every built-in scheme', () => {
  for (const [scheme, t] of Object.entries(SCHEMES)) {
    const ratio = contrast(t.bg, t.fg)
    assert.ok(ratio >= 4.5, `${scheme}: bg vs fg is only ${ratio.toFixed(1)}:1`)
  }
})

test('applyTheme writes one custom property per token', () => {
  const set: Record<string, string> = {}
  const el = {
    style: { setProperty: (k: string, v: string) => (set[k] = v) },
  } as unknown as HTMLElement

  applyTheme(el, SCHEMES['nord']!)
  for (const [name, cssVar] of Object.entries(TOKEN_VARS)) {
    assert.equal(set[cssVar], (SCHEMES['nord'] as Record<string, string>)[name], cssVar)
  }
})
