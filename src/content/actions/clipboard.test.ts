import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clipboardTarget } from './clipboard.ts'

const SEARCH = 'https://www.google.com/search?q=%s'

test('a full url passes through unchanged', () => {
  assert.equal(clipboardTarget('https://x.com/a?b=1', SEARCH), 'https://x.com/a?b=1')
  assert.equal(clipboardTarget('http://x.com', SEARCH), 'http://x.com')
})

test('a bare domain gets https', () => {
  assert.equal(clipboardTarget('example.com', SEARCH), 'https://example.com')
  assert.equal(clipboardTarget('sub.example.co.uk/path', SEARCH), 'https://sub.example.co.uk/path')
})

test('localhost with a port is treated as a url', () => {
  assert.equal(clipboardTarget('localhost:3000', SEARCH), 'https://localhost:3000')
  assert.equal(clipboardTarget('localhost', SEARCH), 'https://localhost')
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
