import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advance, type AxisState } from './scroll-physics.ts'

const smooth = { scrollStep: 60, scrollSmooth: true }
const instant = { scrollStep: 60, scrollSmooth: false }

const idle = (over: Partial<AxisState> = {}): AxisState => ({
  current: 0,
  target: 0,
  dir: 0,
  heldMs: 0,
  movingMs: 0,
  ...over,
})

test('a one-shot impulse converges on the target', () => {
  let s = idle({ target: 60 })
  for (let i = 0; i < 60; i += 1) s = advance(s, 16, smooth)
  assert.ok(Math.abs(s.current - 60) < 0.5, `settled at ${s.current}`)
})

test('smoothing moves part of the way each frame, never overshooting', () => {
  const s = advance(idle({ target: 60 }), 16, smooth)
  assert.ok(s.current > 0, 'did not move')
  assert.ok(s.current < 60, 'jumped the whole way')
})

test('without smoothing the position lands on the target at once', () => {
  assert.equal(advance(idle({ target: 60 }), 16, instant).current, 60)
})

test('holding grows the target over time', () => {
  const a = advance(idle({ dir: 1 }), 16, smooth)
  const b = advance(a, 16, smooth)
  assert.ok(a.target > 0)
  assert.ok(b.target > a.target)
})

test('holding accelerates: a later frame covers more ground than an early one', () => {
  let s = idle({ dir: 1 })
  const first = advance(s, 16, smooth)
  const firstGain = first.target - s.target

  s = first
  for (let i = 0; i < 30; i += 1) s = advance(s, 16, smooth)
  const later = advance(s, 16, smooth)
  const laterGain = later.target - s.target

  assert.ok(laterGain > firstGain * 2, `${laterGain} vs ${firstGain}`)
})

test('acceleration stops at a ceiling', () => {
  let s = idle({ dir: 1 })
  for (let i = 0; i < 200; i += 1) s = advance(s, 16, smooth)
  const a = advance(s, 16, smooth)
  const b = advance(a, 16, smooth)
  assert.ok(Math.abs((b.target - a.target) - (a.target - s.target)) < 0.01)
})

test('releasing stops the target growing but lets the position catch up', () => {
  let s = idle({ dir: 1 })
  for (let i = 0; i < 10; i += 1) s = advance(s, 16, smooth)

  const released = { ...s, dir: 0 as const }
  const after = advance(released, 16, smooth)
  assert.equal(after.target, released.target)
  assert.ok(after.current > released.current, 'position did not catch up')
})

test('a held axis reverses direction without a discontinuity', () => {
  let s = idle({ dir: 1 })
  for (let i = 0; i < 10; i += 1) s = advance(s, 16, smooth)
  const back = advance({ ...s, dir: -1, heldMs: 0 }, 16, smooth)
  assert.ok(back.target < s.target)
})

test('a zero-length frame changes nothing', () => {
  const s = idle({ target: 60, dir: 1 })
  assert.deepEqual(advance(s, 0, smooth), s)
})

test('a long move eases over more time than a short one', () => {
  const short = advance(idle({ target: 60 }), 16, smooth)
  const long = advance(idle({ target: 2000 }), 16, smooth)

  const shortFraction = short.current / 60
  const longFraction = long.current / 2000
  assert.ok(longFraction < shortFraction, `${longFraction} should be gentler than ${shortFraction}`)
})

test('easing time is capped so a jump to the end of a long page stays brisk', () => {
  let s = idle({ target: 20000 })
  for (let i = 0; i < 45; i += 1) s = advance(s, 16, smooth)
  assert.ok(s.current > 20000 * 0.9, `only reached ${s.current} after 720ms`)
})

test('held scrolling keeps a small follow lag, so it stays responsive', () => {
  let s = idle({ dir: 1 })
  for (let i = 0; i < 40; i += 1) s = advance(s, 16, smooth)
  assert.ok(s.target - s.current < 100, `lag grew to ${s.target - s.current}`)
})

test('motion eases in rather than peaking on its first frame', () => {
  const first = advance(idle({ target: 2000 }), 16, smooth)
  const later = advance(idle({ target: 2000, movingMs: 500 }), 16, smooth)
  assert.ok(first.current < later.current / 5, `${first.current} vs ${later.current}`)
})

test('the ease-in is spent within a fifth of a second', () => {
  let s = idle({ target: 2000 })
  for (let i = 0; i < 12; i += 1) s = advance(s, 16, smooth)
  const step = advance(s, 16, smooth).current - s.current
  const settledStep =
    advance({ ...s, movingMs: 5000 }, 16, smooth).current - s.current
  assert.ok(Math.abs(step - settledStep) < 1, 'still ramping after 200ms')
})
