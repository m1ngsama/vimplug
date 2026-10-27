import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advance, frameClock, push, settled, type AxisState } from './scroll-physics.ts'

const smooth = { scrollStep: 60, scrollSmooth: true }
const instant = { scrollStep: 60, scrollSmooth: false }

const idle = (over: Partial<AxisState> = {}): AxisState => ({
  current: 0,
  target: 0,
  speed: 0,
  dir: 0,
  heldMs: 0,
  step: 0,
  ...over,
})

const run = (s: AxisState, frames: number, o = smooth) => {
  for (let i = 0; i < frames; i += 1) s = advance(s, 16, o)
  return s
}

const tap = (px: number): AxisState => ({ ...push(idle(), px), dir: 1, step: px })

test('a step lands in a tenth of a second', () => {
  const s = run(push(idle(), 60), 7)
  assert.equal(s.current, 60)
  assert.ok(settled(s))
})

test('a step moves at one speed from start to finish', () => {
  let s = push(idle(), 60)
  const gains: number[] = []
  for (let i = 0; i < 6; i += 1) {
    const next = advance(s, 16, smooth)
    gains.push(next.current - s.current)
    s = next
  }
  assert.ok(Math.max(...gains) - Math.min(...gains) < 0.01, `${gains}`)
})

test('without smoothing the position lands on the target at once', () => {
  assert.equal(advance(push(idle(), 60), 16, instant).current, 60)
})

test('a key released before its step ends moves exactly one step', () => {
  const s = run({ ...run(tap(60), 4), dir: 0 }, 10)
  assert.equal(s.current, 60)
})

test('a key still down when its step ends keeps scrolling', () => {
  const s = run(tap(60), 10)
  assert.ok(s.current > 60, `stopped at ${s.current}`)
  assert.equal(s.target, s.current)
})

test('a held step speeds up to its clamped cruise speed', () => {
  const s = run(tap(60), 60)
  const gain = advance(s, 16, smooth).current - s.current
  assert.ok(Math.abs(gain - 16 * 0.96) < 0.01, `${gain}px a frame`)
})

test('a held half page slows down to half its speed', () => {
  const first = advance(tap(400), 16, smooth).current
  const s = run(tap(400), 60)
  const gain = advance(s, 16, smooth).current - s.current
  assert.ok(Math.abs(gain - first / 2) < 0.01, `${gain}px a frame after ${first}`)
})

test('a hold changes speed gradually', () => {
  let s = tap(60)
  let last = 0
  for (let i = 0; i < 40; i += 1) {
    const next = advance(s, 16, smooth)
    const gain = next.current - s.current
    if (i > 0) assert.ok(gain > last - 0.01 && gain < last * 1.06, `frame ${i}: ${last} to ${gain}`)
    last = gain
    s = next
  }
})

test('releasing a hold stops on the spot', () => {
  const held = run(tap(60), 60)
  const s = advance({ ...held, dir: 0 }, 16, smooth)
  assert.equal(s.current, held.current)
  assert.ok(settled(s))
})

test('a second tap mid-step still lands both steps', () => {
  const s = run(push(run(push(idle(), 60), 3), 60), 7)
  assert.equal(s.current, 120)
})

test('a long jump takes longer, but never a quarter second', () => {
  const ms = [60, 400, 40000].map(distance => {
    let s = push(idle(), distance)
    let t = 0
    while (!settled(s)) {
      s = advance(s, 16, smooth)
      t += 16
    }
    return t
  })
  assert.ok(ms[0]! < ms[1]! && ms[1]! < ms[2]!, `${ms}`)
  assert.ok(ms[2]! <= 240, `${ms}`)
})

test('a reversed hold turns around at once', () => {
  const down = run(tap(60), 20)
  const up = advance({ ...push(down, -60), dir: -1, heldMs: 0 }, 16, smooth)
  assert.ok(up.current < down.current)
})

test('a zero-length frame changes nothing', () => {
  const s = tap(60)
  assert.deepEqual(advance(s, 0, smooth), s)
})

test('without smoothing a tap moves exactly one step', () => {
  assert.equal(run(tap(60), 5, instant).current, 60)
})

test('without smoothing a hold scrolls on after its step', () => {
  assert.ok(run(tap(60), 12, instant).current > 60)
})

const roundedFrames = (hz: number, n: number) =>
  Array.from({ length: n }, (_, i) => Math.round(((i + 1) * 1000) / hz) - Math.round((i * 1000) / hz))

test('frames rounded to whole milliseconds still advance evenly', () => {
  const tick = frameClock()
  const dts = roundedFrames(60, 120).map(tick).slice(60)
  const spread = Math.max(...dts) - Math.min(...dts)
  assert.ok(spread < 0.2, `frame lengths vary by ${spread}ms`)
})

for (const hz of [60, 120]) {
  for (const elapsed of [33, 53, 83, 235]) {
    test(`a ${elapsed}ms late callback advances one learned ${hz}Hz frame`, () => {
      const tick = frameClock()
      roundedFrames(hz, 200).forEach(tick)
      assert.ok(Math.abs(tick(elapsed) - 1000 / hz) < 0.5)
      assert.ok(Math.abs(tick(1000 / hz) - 1000 / hz) < 0.5)
    })
  }
}

test('repeated stalls do not build up time debt or change the learned cadence', () => {
  const tick = frameClock()
  roundedFrames(60, 60).forEach(tick)
  for (let i = 0; i < 30; i++) {
    for (const elapsed of [1000 / 60, 53, 1000 / 60, 235]) {
      assert.ok(Math.abs(tick(elapsed) - 1000 / 60) < 0.5)
    }
  }
})

for (const options of [smooth, instant]) {
  test(`a cruising hold does not catch up with scrollSmooth=${options.scrollSmooth}`, () => {
    const tick = frameClock()
    let s = tap(60)
    for (const elapsed of roundedFrames(60, 90)) s = advance(s, tick(elapsed), options)
    for (const elapsed of [33, 53, 235, 1000 / 60]) {
      const next = advance(s, tick(elapsed), options)
      const distance = next.current - s.current
      assert.ok(distance > 15 && distance < 17, `${distance}px after ${elapsed}ms`)
      s = next
    }
    const stopped = advance({ ...s, dir: 0 }, tick(235), options)
    assert.equal(stopped.current, s.current)
    assert.ok(settled(stopped))
  })
}

for (const distance of [60, 300]) {
  test(`a released ${distance}px target still lands exactly after a stall`, () => {
    const tick = frameClock()
    let s = push(idle(), distance)
    s = advance(s, tick(53), smooth)
    for (const elapsed of roundedFrames(60, 60)) s = advance(s, tick(elapsed), smooth)
    assert.equal(s.current, distance)
    assert.ok(settled(s))
  })
}

test('the frame length adapts to a faster display', () => {
  const tick = frameClock()
  const dts = roundedFrames(120, 200).map(tick)
  assert.ok(Math.abs(dts.at(-1)! - 1000 / 120) < 0.2, `settled on ${dts.at(-1)}ms`)
})
