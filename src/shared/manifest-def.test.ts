import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildManifest } from './manifest-def.ts'

test('both targets are manifest v3', () => {
  assert.equal(buildManifest('chrome').manifest_version, 3)
  assert.equal(buildManifest('safari').manifest_version, 3)
})

test('declares no static content_scripts', () => {
  for (const t of ['chrome', 'safari'] as const) {
    assert.equal(buildManifest(t).content_scripts, undefined)
  }
})

test('background is a classic service worker: safari rejects type module', () => {
  for (const t of ['chrome', 'safari'] as const) {
    const bg = buildManifest(t).background as Record<string, unknown>
    assert.equal(bg.service_worker, 'background.js')
    assert.equal(bg.type, undefined)
  }
})

test('safari omits open_in_tab, chrome keeps it', () => {
  const safari = buildManifest('safari').options_ui as Record<string, unknown>
  const chrome = buildManifest('chrome').options_ui as Record<string, unknown>
  assert.equal(safari.open_in_tab, undefined)
  assert.equal(chrome.open_in_tab, true)
})

test('requests scripting and storage permissions', () => {
  const perms = buildManifest('chrome').permissions as string[]
  assert.ok(perms.includes('scripting'))
  assert.ok(perms.includes('storage'))
  assert.ok(perms.includes('tabs'))
})
