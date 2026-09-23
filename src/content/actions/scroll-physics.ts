export interface AxisState {
  current: number
  target: number
  velocity: number
  dir: -1 | 0 | 1
  heldMs: number
  leftMs: number
}

export interface ScrollOptions {
  scrollStep: number
  scrollSmooth: boolean
}

// Native smooth scrollBy restarts its easing on every key repeat, so the engine eases toward its own target.
// Held keys wait this long before scrolling on their own, so a tap moves exactly one step however long it lasts.
const HOLD_MS = 80
const RAMP_MS = 250
const FOLLOW_MS = 40
const MAX_STEPS_PER_SECOND = 22

// Safari's own Home, End and Page Down land in about 210ms whatever the distance; a glide over this long matches them.
const GLIDE_MS = 220

// A motion already under way keeps its speed; a new target only bends its path, or every tap would jolt it.
export function push(s: AxisState, delta: number): AxisState {
  const velocity = s.velocity || delta / GLIDE_MS
  return { ...s, target: s.target + delta, velocity, leftMs: GLIDE_MS }
}

const topSpeed = (o: ScrollOptions) => (o.scrollStep * MAX_STEPS_PER_SECOND) / 1000

function holdSpeed(heldMs: number, o: ScrollOptions): number {
  const x = Math.min(1, heldMs / RAMP_MS)
  return topSpeed(o) * x * x * (3 - 2 * x)
}

export function advance(s: AxisState, dt: number, o: ScrollOptions): AxisState {
  if (dt <= 0) return s
  const heldMs = s.dir !== 0 ? s.heldMs + dt : s.heldMs
  const holding = s.dir !== 0 && heldMs > HOLD_MS

  if (!o.scrollSmooth) {
    const target = holding ? s.target + holdSpeed(heldMs, o) * s.dir * dt : s.target
    return { ...s, current: target, target, velocity: 0, heldMs, leftMs: 0 }
  }

  if (holding) {
    const want = s.dir * Math.min(topSpeed(o), Math.max(holdSpeed(heldMs, o), s.velocity * s.dir))
    const velocity = want + (s.velocity - want) * Math.exp(-dt / FOLLOW_MS)
    const current = s.current + ((s.velocity + velocity) / 2) * dt
    return { ...s, current, target: current + (velocity * GLIDE_MS) / 3, velocity, heldMs, leftMs: GLIDE_MS }
  }

  if (s.leftMs <= dt) return { ...s, current: s.target, velocity: 0, heldMs, leftMs: 0 }

  const t = s.leftMs
  const u = dt / t
  const d = s.target - s.current
  const v = s.velocity
  const current = s.current + v * t * (u - 2 * u * u + u ** 3) + d * (3 * u * u - 2 * u ** 3)
  const velocity = v * (1 - 4 * u + 3 * u * u) + (d / t) * (6 * u - 6 * u * u)
  return { ...s, current, velocity, heldMs, leftMs: t - dt }
}

export function settled(s: AxisState): boolean {
  return s.dir === 0 && s.leftMs === 0 && Math.abs(s.target - s.current) < 0.5
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
