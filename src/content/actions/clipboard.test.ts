import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clipboardTarget, looksLikeUrl } from './clipboard.ts'

const SEARCH = 'https://www.google.com/search?q=%s'

test('a full url passes through unchanged', () => {
  assert.equal(clipboardTarget('https://x.com/a?b=1', SEARCH), 'https://x.com/a?b=1')
  assert.equal(clipboardTarget('http://x.com', SEARCH), 'http://x.com')
})

test('a bare domain gets https', () => {
  assert.equal(clipboardTarget('example.com', SEARCH), 'https://example.com')
  assert.equal(clipboardTarget('sub.example.co.uk/path', SEARCH), 'https://sub.example.co.uk/path')
})

// Chrome's omnibox sends loopback to http and everything else to https; dev servers are
// almost never TLS, so guessing https there just breaks the navigation.
test('loopback hosts get http, not https', () => {
  assert.equal(clipboardTarget('localhost:3000', SEARCH), 'http://localhost:3000')
  assert.equal(clipboardTarget('localhost', SEARCH), 'http://localhost')
  assert.equal(clipboardTarget('127.0.0.1:8000/x', SEARCH), 'http://127.0.0.1:8000/x')
  assert.equal(clipboardTarget('0.0.0.0:5173', SEARCH), 'http://0.0.0.0:5173')
})

test('non-loopback hosts still get https', () => {
  assert.equal(clipboardTarget('192.168.1.4:8080', SEARCH), 'https://192.168.1.4:8080')
})

test('text with spaces becomes a search', () => {
  assert.equal(
    clipboardTarget('hello world', SEARCH),
    'https://www.google.com/search?q=hello%20world',
  )
})

test('a single word with no dot becomes a search', () => {
  assert.equal(clipboardTarget('vimplug', SEARCH), 'https://www.google.com/search?q=vimplug')
})

test('surrounding whitespace is trimmed', () => {
  assert.equal(clipboardTarget('  example.com \n', SEARCH), 'https://example.com')
})

test('empty input yields an empty target', () => {
  assert.equal(clipboardTarget('   ', SEARCH), '')
})

test('search queries are percent encoded', () => {
  assert.equal(clipboardTarget('a&b=c', SEARCH), 'https://www.google.com/search?q=a%26b%3Dc')
})

test('looksLikeUrl separates navigation from search', () => {
  assert.equal(looksLikeUrl('https://x.com'), true)
  assert.equal(looksLikeUrl('example.com'), true)
  assert.equal(looksLikeUrl('localhost:3000'), true)
  assert.equal(looksLikeUrl('how to cook rice'), false)
  assert.equal(looksLikeUrl('textarea'), false)
  assert.equal(looksLikeUrl(''), false)
})
