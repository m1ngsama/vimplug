export interface AxisState {
  current: number
  target: number
  dir: -1 | 0 | 1
  heldMs: number
  movingMs: number
  leftMs: number
}

export interface ScrollOptions {
  scrollStep: number
  scrollSmooth: boolean
}

// Native smooth scrollBy restarts its easing on every key repeat, so the engine eases toward its own target.
// Held keys wait this long before scrolling on their own, so a tap moves exactly one step however long it lasts.
const HOLD_MS = 80
const RAMP_MS = 100
const MAX_STEPS_PER_SECOND = 22

// Safari's own Home, End and Page Down land in about 210ms whatever the distance; an ease-out over this long matches them.
const GLIDE_MS = 220
const EASE_IN_MS = 60

export function push(s: AxisState, delta: number): AxisState {
  return { ...s, target: s.target + delta, leftMs: GLIDE_MS }
}

export function advance(s: AxisState, dt: number, o: ScrollOptions): AxisState {
  if (dt <= 0) return s

  let { target, heldMs } = s
  const movingMs = s.movingMs + dt
  if (s.dir !== 0) {
    heldMs += dt
    const ramp = Math.min(1, Math.max(0, heldMs - HOLD_MS) / RAMP_MS)
    const speed = o.scrollStep * MAX_STEPS_PER_SECOND * ramp
    target += speed * s.dir * (dt / 1000)
  }

  const left = s.dir !== 0 ? GLIDE_MS : s.leftMs
  const easeIn = Math.min(1, movingMs / EASE_IN_MS)
  const k = o.scrollSmooth && left > dt ? (1 - (1 - dt / left) ** 3) * easeIn : 1
  const current = s.current + (target - s.current) * k

  return { current, target, dir: s.dir, heldMs, movingMs, leftMs: Math.max(0, left - dt) }
}

export function settled(s: AxisState): boolean {
  return s.dir === 0 && Math.abs(s.target - s.current) < 0.5
}

// Safari rounds rAF timestamps to whole milliseconds; stepping by them makes every frame a different length.
// A longer stall is not made up for, or the page would lurch hundreds of pixels when it resumes.
export function frameClock(period = 1000 / 60): (elapsed: number) => number {
  return elapsed => {
    const frames = Math.max(1, Math.round(elapsed / period))
    period += (elapsed / frames - period) / 16
    return Math.min(frames, 3) * period
  }
}
