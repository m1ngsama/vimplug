import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registrationFor, isDisabled, hostOf } from './injection.ts'

test('chrome uses excludeMatches for disabled hosts', () => {
  const r = registrationFor('chrome', ['youtube.com'])
  assert.equal(r.js?.[0], 'content.js')
  assert.deepEqual(r.excludeMatches, ['*://youtube.com/*', '*://*.youtube.com/*'])
})

test('a wildcard pattern maps to a single match pattern', () => {
  assert.deepEqual(registrationFor('chrome', ['*.google.com']).excludeMatches, [
    '*://*.google.com/*',
  ])
})

test('safari never uses excludeMatches because it ignores the field', () => {
  const r = registrationFor('safari', ['youtube.com'])
  assert.equal(r.excludeMatches, undefined)
})

test('safari injects the fail-closed bootstrap, not the engine', () => {
  assert.equal(registrationFor('safari', []).js?.[0], 'bootstrap.js')
  assert.equal(registrationFor('chrome', []).js?.[0], 'content.js')
})

test('both targets register for all frames at document_start', () => {
  for (const t of ['chrome', 'safari'] as const) {
    const r = registrationFor(t, [])
    assert.equal(r.allFrames, true)
    assert.equal(r.runAt, 'document_start')
  }
})

test('chrome with no disabled hosts omits excludeMatches', () => {
  assert.equal(registrationFor('chrome', []).excludeMatches, undefined)
})

test('both targets match all urls', () => {
  for (const t of ['chrome', 'safari'] as const) {
    assert.deepEqual(registrationFor(t, []).matches, ['<all_urls>'])
  }
})

test('isDisabled matches exact hosts', () => {
  assert.equal(isDisabled(['a.com'], 'a.com'), true)
  assert.equal(isDisabled(['a.com'], 'sub.a.com'), false)
  assert.equal(isDisabled([], 'a.com'), false)
})

test('isDisabled matches wildcard subdomains but not the bare host', () => {
  assert.equal(isDisabled(['*.a.com'], 'sub.a.com'), true)
  assert.equal(isDisabled(['*.a.com'], 'a.com'), false)
})

test('hostOf reads the hostname from a page URL', () => {
  assert.equal(hostOf('https://example.com/a?b=1'), 'example.com')
  assert.equal(hostOf('http://sub.example.com:8080/'), 'sub.example.com')
})

test('hostOf ignores anything the engine cannot run on', () => {
  assert.equal(hostOf('chrome://extensions'), '')
  assert.equal(hostOf('about:blank'), '')
  assert.equal(hostOf('chrome-extension://abc/options.html'), '')
  assert.equal(hostOf(undefined), '')
  assert.equal(hostOf('not a url'), '')
})
