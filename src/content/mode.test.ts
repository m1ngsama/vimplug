import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ModeMachine, needsKeydown } from './mode.ts'

test('modes owning a text input do not need a keydown listener', () => {
  assert.equal(needsKeydown('insert'), false)
  assert.equal(needsKeydown('passthrough'), false)
  assert.equal(needsKeydown('command'), false)
  assert.equal(needsKeydown('normal'), true)
  assert.equal(needsKeydown('hint'), true)
  assert.equal(needsKeydown('pending'), true)
  assert.equal(needsKeydown('visual'), true)
})

test('pending times out so a stray M cannot wedge the engine', async () => {
  const m = new ModeMachine(20)
  m.enter('pending')
  await new Promise(r => setTimeout(r, 60))
  assert.equal(m.current, 'normal')
})

test('starts in normal mode', () => {
  assert.equal(new ModeMachine().current, 'normal')
})

test('notifies listeners on change with the previous mode', () => {
  const m = new ModeMachine()
  const seen: Array<[string, string]> = []
  m.onChange((next, prev) => seen.push([prev, next]))
  m.enter('insert')
  assert.deepEqual(seen, [['normal', 'insert']])
})

test('does not notify when entering the current mode', () => {
  const m = new ModeMachine()
  let calls = 0
  m.onChange(() => {
    calls += 1
  })
  m.enter('normal')
  assert.equal(calls, 0)
})

test('hint has no deadline: its labels are on screen and it has clear exits', async () => {
  const m = new ModeMachine(20)
  m.enter('hint')
  await new Promise(r => setTimeout(r, 60))
  assert.equal(m.current, 'hint')
})

test('command has no deadline because its overlay is visible and dismissible', async () => {
  const m = new ModeMachine(20)
  m.enter('command')
  await new Promise(r => setTimeout(r, 60))
  assert.equal(m.current, 'command')
})

test('visual has no deadline because the selection is visible', async () => {
  const m = new ModeMachine(20)
  m.enter('visual')
  await new Promise(r => setTimeout(r, 60))
  assert.equal(m.current, 'visual')
})

test('normal and insert never time out', async () => {
  const m = new ModeMachine(20)
  m.enter('insert')
  await new Promise(r => setTimeout(r, 60))
  assert.equal(m.current, 'insert')
})

test('leaving a transient mode cancels its timeout', async () => {
  const m = new ModeMachine(20)
  m.enter('pending')
  m.enter('insert')
  await new Promise(r => setTimeout(r, 60))
  assert.equal(m.current, 'insert')
})
