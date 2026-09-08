import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildManifest } from './manifest-def.ts'

test('both targets are manifest v3', () => {
  assert.equal(buildManifest('chrome', '9.9.9').manifest_version, 3)
  assert.equal(buildManifest('safari', '9.9.9').manifest_version, 3)
})

test('declares no static content_scripts', () => {
  for (const t of ['chrome', 'safari'] as const) {
    assert.equal(buildManifest(t, '9.9.9').content_scripts, undefined)
  }
})

test('background is a classic service worker: safari rejects type module', () => {
  for (const t of ['chrome', 'safari'] as const) {
    const bg = buildManifest(t, '9.9.9').background as Record<string, unknown>
    assert.equal(bg.service_worker, 'background.js')
    assert.equal(bg.type, undefined)
  }
})

test('safari omits open_in_tab, chrome keeps it', () => {
  const safari = buildManifest('safari', '9.9.9').options_ui as Record<string, unknown>
  const chrome = buildManifest('chrome', '9.9.9').options_ui as Record<string, unknown>
  assert.equal(safari.open_in_tab, undefined)
  assert.equal(chrome.open_in_tab, true)
})

test('safari exposes content.js so the bootstrap can import it', () => {
  const war = buildManifest('safari', '9.9.9').web_accessible_resources as Array<{ resources: string[] }>
  assert.deepEqual(war[0]?.resources, ['content.js'])
  assert.equal(buildManifest('chrome', '9.9.9').web_accessible_resources, undefined)
})

test('requests scripting and storage permissions', () => {
  const perms = buildManifest('chrome', '9.9.9').permissions as string[]
  assert.ok(perms.includes('scripting'))
  assert.ok(perms.includes('storage'))
  assert.ok(perms.includes('tabs'))
})

test('the omnibar needs history and bookmarks, and X needs sessions', () => {
  const perms = buildManifest('chrome', '9.9.9').permissions as string[]
  for (const p of ['history', 'bookmarks', 'sessions']) assert.ok(perms.includes(p), p)
})

test('safari asks for none of the three permissions it rejects', () => {
  const perms = buildManifest('safari', '9.9.9').permissions as string[]
  for (const p of ['history', 'bookmarks', 'sessions']) assert.equal(perms.includes(p), false, p)
})

test('both targets declare the icon set the stores and Safari need', () => {
  for (const t of ['chrome', 'safari'] as const) {
    const icons = buildManifest(t, '9.9.9').icons as Record<string, string>
    assert.deepEqual(Object.keys(icons).sort(), ['128', '16', '32', '48'])
  }
})

test('the version comes from the caller so package.json stays the only source', () => {
  assert.equal(buildManifest('chrome', '1.2.3').version, '1.2.3')
})
