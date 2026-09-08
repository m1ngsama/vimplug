import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrate, CONFIG_VERSION } from './storage.ts'
import { DEFAULT_DSL } from './config.ts'

test('a bare string is the version 0 shape and survives untouched', () => {
  assert.equal(migrate('map j scrollDown'), 'map j scrollDown')
})

test('the current shape is read straight through', () => {
  assert.equal(migrate({ version: CONFIG_VERSION, dsl: 'map k scrollUp' }), 'map k scrollUp')
})

test('nothing stored yields the shipped defaults', () => {
  assert.equal(migrate(undefined), DEFAULT_DSL)
  assert.equal(migrate(null), DEFAULT_DSL)
})

test('an unreadable value falls back rather than throwing', () => {
  assert.equal(migrate(42), DEFAULT_DSL)
  assert.equal(migrate({ version: CONFIG_VERSION }), DEFAULT_DSL)
  assert.equal(migrate({ dsl: 7 }), DEFAULT_DSL)
})

test('an empty configuration is kept, not replaced by defaults', () => {
  assert.equal(migrate({ version: CONFIG_VERSION, dsl: '' }), '')
})

test('a version from the future is read as-is rather than discarded', () => {
  assert.equal(migrate({ version: CONFIG_VERSION + 9, dsl: 'map j scrollDown' }), 'map j scrollDown')
})
