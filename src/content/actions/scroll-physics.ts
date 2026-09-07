export interface AxisState {
  current: number
  target: number
  dir: -1 | 0 | 1
  heldMs: number
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
const TAU_MS = 55

export function advance(s: AxisState, dt: number, o: ScrollOptions): AxisState {
  if (dt <= 0) return s

  let { target, heldMs } = s
  if (s.dir !== 0) {
    heldMs += dt
    const speed = o.scrollStep * MAX_SPEED * Math.min(1, heldMs / RAMP_MS)
    target += speed * s.dir * (dt / 1000)
  }

  const k = o.scrollSmooth ? 1 - Math.exp(-dt / TAU_MS) : 1
  const current = s.current + (target - s.current) * k

  return { current, target, dir: s.dir, heldMs }
}

export function settled(s: AxisState): boolean {
  return s.dir === 0 && Math.abs(s.target - s.current) < 0.5
}
