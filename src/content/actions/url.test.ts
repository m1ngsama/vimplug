import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parentUrl, rootUrl } from './url.ts'

test('gu drops the last path segment', () => {
  assert.equal(parentUrl('https://a.com/x/y/z'), 'https://a.com/x/y')
  assert.equal(parentUrl('https://a.com/x/y/'), 'https://a.com/x')
})

test('gu drops a query or fragment before it touches the path', () => {
  assert.equal(parentUrl('https://a.com/x/y?q=1'), 'https://a.com/x/y')
  assert.equal(parentUrl('https://a.com/x/y#frag'), 'https://a.com/x/y')
})

test('gu at the root has nowhere to go', () => {
  assert.equal(parentUrl('https://a.com/'), null)
  assert.equal(parentUrl('https://a.com'), null)
})

test('gU goes to the domain root, keeping the scheme', () => {
  assert.equal(rootUrl('https://a.com/x/y?q=1'), 'https://a.com/')
  assert.equal(rootUrl('http://sub.a.com:8080/x'), 'http://sub.a.com:8080/')
})

test('gU at the root is already there', () => {
  assert.equal(rootUrl('https://a.com/'), null)
})

test('anything unparseable is left alone', () => {
  assert.equal(parentUrl('not a url'), null)
  assert.equal(rootUrl('not a url'), null)
})
