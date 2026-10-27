export interface AxisState {
  current: number
  target: number
  speed: number
  dir: -1 | 0 | 1
  heldMs: number
  step: number
}

export interface ScrollOptions {
  scrollStep: number
  scrollSmooth: boolean
}

const MIN_MS = 100
const SETTLE_MS = 75
const CRUISE_PX = 150
const FRAME_MS = 1000 / 60

const duration = (px: number) => Math.max(MIN_MS, 20 * Math.log(px))

const cruise = (step: number) => Math.min(1.6 * step, Math.max(0.5 * step, CRUISE_PX)) / duration(step)

export function push(s: AxisState, delta: number): AxisState {
  const target = s.target + delta
  const gap = Math.abs(target - s.current)
  return { ...s, target, speed: gap / duration(gap) }
}

export function advance(s: AxisState, dt: number, o: ScrollOptions): AxisState {
  if (dt <= 0) return s
  const held = s.dir !== 0
  const heldMs = held ? s.heldMs + dt : s.heldMs

  let speed = s.speed
  if (held && heldMs > SETTLE_MS) {
    const want = cruise(s.step)
    const k = 1.05 ** (dt / FRAME_MS)
    speed = speed < want ? Math.min(want, speed * k) : Math.max(want, speed / k)
  }

  const gap = s.target - s.current
  const reach = speed * dt
  const past = o.scrollSmooth ? reach - Math.abs(gap) : heldMs > MIN_MS ? reach : 0
  if (past < 0) return { ...s, current: s.current + Math.sign(gap) * reach, speed, heldMs }

  const current = s.target + (held ? s.dir * past : 0)
  return { ...s, current, target: current, speed: held ? speed : 0, heldMs }
}

export function settled(s: AxisState): boolean {
  return s.dir === 0 && Math.abs(s.target - s.current) < 0.5
}

// Safari rounds rAF timestamps to whole milliseconds; stepping by them makes every frame a different length.
// Advance one learned frame per callback; catching up missed frames makes the resumed scroll lurch.
export function frameClock(period = 1000 / 60): (elapsed: number) => number {
  return elapsed => {
    const frames = Math.max(1, Math.round(elapsed / period))
    period += (elapsed / frames - period) / 16
    return period
  }
}
