import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextVolume } from './media.ts'

test('volume steps up and down', () => {
  assert.equal(nextVolume(0.5, 1, 0.1).toFixed(2), '0.60')
  assert.equal(nextVolume(0.5, -1, 0.1).toFixed(2), '0.40')
})

test('volume clamps to the 0..1 range', () => {
  assert.equal(nextVolume(0.95, 1, 0.1), 1)
  assert.equal(nextVolume(0.05, -1, 0.1), 0)
  assert.equal(nextVolume(1, 1, 0.1), 1)
  assert.equal(nextVolume(0, -1, 0.1), 0)
})
