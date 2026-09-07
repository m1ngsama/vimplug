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

test('requests scripting and storage permissions', () => {
  const perms = buildManifest('chrome').permissions as string[]
  assert.ok(perms.includes('scripting'))
  assert.ok(perms.includes('storage'))
  assert.ok(perms.includes('tabs'))
})
