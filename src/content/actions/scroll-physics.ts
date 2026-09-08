export interface AxisState {
  current: number
  target: number
  dir: -1 | 0 | 1
  heldMs: number
  movingMs: number
}

export interface ScrollOptions {
  scrollStep: number
  scrollSmooth: boolean
}

// Native smooth scrolling cannot be driven by key repeat: each scrollBy replaces the
// animation in flight rather than adding to it, so a held key restarts the easing 30
// times a second and never leaves its slow phase. The engine keeps its own target and
// eases toward it, which composes.
const RAMP_MS = 220
const MAX_SPEED = 22 // multiples of scrollStep per second

// A fixed time constant makes long moves violent: a half page and a single step would
// take the same time, so the half page travels seven times faster. Easing duration grows
// with the distance left to cover, capped so a jump to the end of a long page stays brisk.
// Held scrolling keeps only a small follow lag, so it stays at the responsive end.
const TAU_MIN_MS = 40
const TAU_MAX_MS = 140
const TAU_PER_PX = 0.15

// Exponential easing is pure ease-out: velocity peaks on the very first frame, so motion
// starts by lurching. This envelope spends the opening moments accelerating instead,
// which is the difference between a jolt and a glide. Sustained scrolling passes through
// it once and is unaffected thereafter.
const EASE_IN_MS = 120

export function advance(s: AxisState, dt: number, o: ScrollOptions): AxisState {
  if (dt <= 0) return s

  let { target, heldMs } = s
  const movingMs = s.movingMs + dt
  if (s.dir !== 0) {
    heldMs += dt
    const speed = o.scrollStep * MAX_SPEED * Math.min(1, heldMs / RAMP_MS)
    target += speed * s.dir * (dt / 1000)
  }

  const remaining = Math.abs(target - s.current)
  const tau = Math.min(TAU_MAX_MS, TAU_MIN_MS + remaining * TAU_PER_PX)
  const easeIn = Math.min(1, movingMs / EASE_IN_MS)
  const k = o.scrollSmooth ? (1 - Math.exp(-dt / tau)) * easeIn : 1
  const current = s.current + (target - s.current) * k

  return { current, target, dir: s.dir, heldMs, movingMs }
}

export function settled(s: AxisState): boolean {
  return s.dir === 0 && Math.abs(s.target - s.current) < 0.5
}
