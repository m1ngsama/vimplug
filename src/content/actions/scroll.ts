import { advance, frameClock, settled, type AxisState, type ScrollOptions } from './scroll-physics.ts'
import { resolveScrollBox, windowBox, type ScrollBox } from './scroll-target.ts'

interface ScrollDelta {
  top: number
  left: number
}

export function scrollDelta(
  action: string,
  opts: { scrollStep: number },
  v: Omit<ScrollBox, 'to'>,
): ScrollDelta | null {
  const d = opts.scrollStep
  const half = v.height / 2
  switch (action) {
    case 'scrollToTop':
      return { top: 0 - v.scrollY, left: 0 }
    case 'scrollToBottom':
      return { top: Math.max(0, v.maxY - v.scrollY), left: 0 }
    case 'scrollToStart':
      return { top: 0, left: 0 - v.scrollX }
    case 'scrollToEnd':
      return { top: 0, left: Math.max(0, v.maxX - v.scrollX) }
    case 'scrollDown':
      return { top: d, left: 0 }
    case 'scrollUp':
      return { top: -d, left: 0 }
    case 'scrollRight':
      return { top: 0, left: d }
    case 'scrollLeft':
      return { top: 0, left: -d }
    case 'scrollHalfDown':
      return { top: half, left: 0 }
    case 'scrollHalfUp':
      return { top: -half, left: 0 }
    default:
      return null
  }
}

const ABSOLUTE = new Set(['scrollToTop', 'scrollToBottom', 'scrollToStart', 'scrollToEnd'])

const HELD: Record<string, { axis: 'y' | 'x'; dir: -1 | 1 } | undefined> = {
  scrollDown: { axis: 'y', dir: 1 },
  scrollUp: { axis: 'y', dir: -1 },
  scrollRight: { axis: 'x', dir: 1 },
  scrollLeft: { axis: 'x', dir: -1 },
}

const idle = (): AxisState => ({ current: 0, target: 0, dir: 0, heldMs: 0, movingMs: 0 })


export class Scroller {
  #axes: Record<'x' | 'y', AxisState> = { x: idle(), y: idle() }
  #held = new Map<string, { axis: 'x' | 'y'; dir: -1 | 1 }>()
  #origin = { x: 0, y: 0 }
  #seen = { x: 0, y: 0 }
  #frame: number | null = null
  #last = 0
  readonly #tick = frameClock()

  readonly #opts: () => ScrollOptions

  readonly #focused: () => Element | null
  #box: ScrollBox = windowBox()

  constructor(opts: () => ScrollOptions, focused: () => Element | null = () => null) {
    this.#opts = opts
    this.#focused = focused
  }

  press(action: string, keyId: string | null, count = 1): boolean {
    const probe = scrollDelta(action, this.#opts(), windowBox())
    if (!probe) return false
    const axis: 'x' | 'y' = probe.left !== 0 ? 'x' : 'y'
    const dir: -1 | 1 = (probe.left || probe.top) >= 0 ? 1 : -1
    if (settled(this.#axes.x) && settled(this.#axes.y)) {
      this.#box = resolveScrollBox(this.#focused(), axis, dir)
    }

    const raw = scrollDelta(action, this.#opts(), this.#box)
    if (!raw) return false
    const scale = ABSOLUTE.has(action) ? 1 : count
    const delta = { top: raw.top * scale, left: raw.left * scale }

    if (keyId !== null && this.#held.has(keyId)) return true

    if (ABSOLUTE.has(action)) this.#cancelMotion()

    for (const key of ['x', 'y'] as const) {
      if (settled(this.#axes[key])) this.#axes[key].movingMs = 0
    }

    this.#axes.y.target += delta.top
    this.#axes.x.target += delta.left

    const hold = keyId === null ? undefined : HELD[action]
    if (hold) {
      const axis = this.#axes[hold.axis]
      axis.dir = hold.dir
      axis.heldMs = 0
      this.#held.set(keyId!, hold)
    }

    this.#run()
    return true
  }

  release(keyId: string): void {
    const hold = this.#held.get(keyId)
    if (!hold) return
    this.#held.delete(keyId)
    const axis = this.#axes[hold.axis]
    const still = [...this.#held.values()].findLast(h => h.axis === hold.axis)
    if (still && still.dir !== axis.dir) axis.heldMs = 0
    axis.dir = still?.dir ?? 0
  }

  #cancelMotion(): void {
    this.#axes = { x: idle(), y: idle() }
    this.#anchor()
    this.#held.clear()
  }

  #anchor(): void {
    this.#origin = { x: this.#box.scrollX, y: this.#box.scrollY }
    this.#seen = { ...this.#origin }
  }

  stop(): void {
    if (this.#frame !== null) cancelAnimationFrame(this.#frame)
    this.#frame = null
    this.#cancelMotion()
  }

  releaseAll(): void {
    for (const { axis } of this.#held.values()) this.#axes[axis].dir = 0
    this.#held.clear()
  }

  #run(): void {
    if (this.#frame !== null) return
    this.#anchor()
    this.#last = performance.now()
    const step = (now: number) => {
      const dt = this.#tick(now - this.#last)
      this.#last = now
      const o = this.#opts()

      for (const key of ['x', 'y'] as const) {
        this.#axes[key] = advance(this.#axes[key], dt, o)
      }
      const done = settled(this.#axes.x) && settled(this.#axes.y)

      // Positions are absolute: Safari floors each scroll to a zoomed pixel, and relative steps would drop that remainder every frame.
      const next = { x: 0, y: 0 }
      for (const key of ['x', 'y'] as const) {
        const at = key === 'x' ? this.#box.scrollX : this.#box.scrollY
        this.#origin[key] += at - this.#seen[key]
        const axis = this.#axes[key]
        next[key] = this.#origin[key] + (done ? axis.target : axis.current)
      }
      this.#box.to(next.x, next.y)
      this.#seen = { x: this.#box.scrollX, y: this.#box.scrollY }

      if (done) {
        this.#frame = null
        this.#axes = { x: idle(), y: idle() }
        return
      }
      this.#frame = requestAnimationFrame(step)
    }
    this.#frame = requestAnimationFrame(step)
  }
}
