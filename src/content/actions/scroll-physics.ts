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

// Native smooth scrollBy restarts its easing on every key repeat, so the engine eases toward its own target.
const RAMP_MS = 220
const MAX_STEPS_PER_SECOND = 22

const TAU_MIN_MS = 40
const TAU_MAX_MS = 140
const TAU_PER_PX = 0.15

const EASE_IN_MS = 120

export function advance(s: AxisState, dt: number, o: ScrollOptions): AxisState {
  if (dt <= 0) return s

  let { target, heldMs } = s
  const movingMs = s.movingMs + dt
  if (s.dir !== 0) {
    heldMs += dt
    const speed = o.scrollStep * MAX_STEPS_PER_SECOND * Math.min(1, heldMs / RAMP_MS)
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
