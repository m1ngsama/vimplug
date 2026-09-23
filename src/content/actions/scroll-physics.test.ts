import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advance, frameClock, push, settled, type AxisState } from './scroll-physics.ts'

const smooth = { scrollStep: 60, scrollSmooth: true }
const instant = { scrollStep: 60, scrollSmooth: false }

const idle = (over: Partial<AxisState> = {}): AxisState => ({
  current: 0,
  target: 0,
  dir: 0,
  velocity: 0,
  heldMs: 0,
  leftMs: 0,
  ...over,
})

test('a one-shot impulse converges on the target', () => {
  let s = push(idle(), 60)
  for (let i = 0; i < 60; i += 1) s = advance(s, 16, smooth)
  assert.ok(Math.abs(s.current - 60) < 0.5, `settled at ${s.current}`)
})

test('smoothing moves part of the way each frame, never overshooting', () => {
  const s = advance(push(idle(), 60), 16, smooth)
  assert.ok(s.current > 0, 'did not move')
  assert.ok(s.current < 60, 'jumped the whole way')
})

test('without smoothing the position lands on the target at once', () => {
  assert.equal(advance(push(idle(), 60), 16, instant).current, 60)
})

test('a tap adds nothing beyond its step', () => {
  let s = idle({ dir: 1 })
  for (let i = 0; i < 4; i += 1) s = advance(s, 16, smooth)
  assert.equal(s.target, 0)
})

test('holding grows the target over time', () => {
  let a = idle({ dir: 1 })
  for (let i = 0; i < 10; i += 1) a = advance(a, 16, smooth)
  const b = advance(a, 16, smooth)
  assert.ok(a.target > 0)
  assert.ok(b.target > a.target)
})

test('holding accelerates: a later frame covers more ground than an early one', () => {
  let s = idle({ dir: 1 })
  for (let i = 0; i < 6; i += 1) s = advance(s, 16, smooth)
  const first = advance(s, 16, smooth)
  const firstGain = first.current - s.current

  s = first
  for (let i = 0; i < 30; i += 1) s = advance(s, 16, smooth)
  const later = advance(s, 16, smooth)
  const laterGain = later.current - s.current

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
  let back: AxisState = { ...s, dir: -1, heldMs: 0 }
  for (let i = 0; i < 10; i += 1) back = advance(back, 16, smooth)
  assert.ok(back.target < s.target)
})

test('a jump of any length lands within the same quarter second', () => {
  for (const distance of [60, 400, 40000]) {
    let s = push(idle(), distance)
    let ms = 0
    while (!settled(s)) {
      s = advance(s, 16, smooth)
      ms += 16
    }
    assert.ok(ms <= 240, `${distance}px took ${ms}ms`)
  }
})

test('a released hold comes to rest within the same quarter second', () => {
  let s = idle({ dir: 1 })
  for (let i = 0; i < 60; i += 1) s = advance(s, 16, smooth)
  s = { ...s, dir: 0 }
  let ms = 0
  while (!settled(s)) {
    s = advance(s, 16, smooth)
    ms += 16
  }
  assert.ok(ms <= 240, `took ${ms}ms`)
})

test('a zero-length frame changes nothing', () => {
  const s = idle({ target: 60, dir: 1 })
  assert.deepEqual(advance(s, 0, smooth), s)
})

test('held scrolling keeps a small follow lag, so it stays responsive', () => {
  let s = idle({ dir: 1 })
  for (let i = 0; i < 40; i += 1) s = advance(s, 16, smooth)
  assert.ok(s.target - s.current < 100, `lag grew to ${s.target - s.current}`)
})

const frameSteps = (s: AxisState, frames: number, each?: (i: number, s: AxisState) => AxisState) => {
  const steps: number[] = []
  for (let i = 0; i < frames; i += 1) {
    if (each) s = each(i, s)
    const next = advance(s, 16, smooth)
    steps.push(next.current - s.current)
    s = next
  }
  return steps
}

test('taps in quick succession keep an even pace', () => {
  const steps = frameSteps(idle(), 50, (i, s) => (i % 7 === 0 ? push(s, 60) : s)).slice(21, 49)
  const ratio = Math.max(...steps) / Math.min(...steps)
  assert.ok(ratio < 1.5, `frame steps range ${Math.min(...steps)} to ${Math.max(...steps)}`)
})

test('a hold never slows down before it reaches full speed', () => {
  const steps = frameSteps({ ...push(idle(), 60), dir: 1 }, 40)
  for (let i = 1; i < steps.length; i += 1) {
    assert.ok(steps[i]! >= steps[i - 1]! - 0.2, `frame ${i} slowed from ${steps[i - 1]} to ${steps[i]}`)
  }
})

test('reversing mid-glide turns around without a jump in speed', () => {
  let s = push(idle(), 60)
  for (let i = 0; i < 6; i += 1) s = advance(s, 16, smooth)
  const before = s.velocity
  const after = advance(push(s, -60), 16, smooth).velocity
  assert.ok(Math.abs(after - before) < Math.abs(before) / 2, `${before} to ${after}`)
})

const roundedFrames = (hz: number, n: number) =>
  Array.from({ length: n }, (_, i) => Math.round(((i + 1) * 1000) / hz) - Math.round((i * 1000) / hz))

test('frames rounded to whole milliseconds still advance evenly', () => {
  const tick = frameClock()
  const dts = roundedFrames(60, 120).map(tick).slice(60)
  const spread = Math.max(...dts) - Math.min(...dts)
  assert.ok(spread < 0.2, `frame lengths vary by ${spread}ms`)
})

test('a dropped frame advances by two frames', () => {
  const tick = frameClock()
  roundedFrames(60, 60).forEach(tick)
  assert.ok(Math.abs(tick(33) - 2000 / 60) < 0.2)
})

test('a long stall advances by no more than three frames', () => {
  const tick = frameClock()
  roundedFrames(60, 60).forEach(tick)
  assert.ok(tick(235) < 3.1 * (1000 / 60))
})

test('the frame length adapts to a faster display', () => {
  const tick = frameClock()
  const dts = roundedFrames(120, 200).map(tick)
  assert.ok(Math.abs(dts.at(-1)! - 1000 / 120) < 0.2, `settled on ${dts.at(-1)}ms`)
})
