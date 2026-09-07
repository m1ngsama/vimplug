import { advance, settled, type AxisState, type ScrollOptions } from './scroll-physics.ts'

export interface ScrollDelta {
  top: number
  left: number
}

export function scrollDelta(
  action: string,
  opts: { scrollStep: number },
  viewportHeight: number,
): ScrollDelta | null {
  const d = opts.scrollStep
  const half = viewportHeight / 2
  switch (action) {
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

// Only the single-step keys scroll continuously while held; a half-page key is a jump.
const HELD: Record<string, { axis: 'y' | 'x'; dir: -1 | 1 } | undefined> = {
  scrollDown: { axis: 'y', dir: 1 },
  scrollUp: { axis: 'y', dir: -1 },
  scrollRight: { axis: 'x', dir: 1 },
  scrollLeft: { axis: 'x', dir: -1 },
}

const idle = (): AxisState => ({ current: 0, target: 0, dir: 0, heldMs: 0 })

export class Scroller {
  #axes: Record<'x' | 'y', AxisState> = { x: idle(), y: idle() }
  #held = new Map<string, 'x' | 'y'>()
  #applied: Record<'x' | 'y', number> = { x: 0, y: 0 }
  #frame: number | null = null
  #last = 0

  // A constructor parameter property would need emitted code, which Node's type
  // stripping cannot do, and the unit tests run straight from TypeScript.
  readonly #opts: () => ScrollOptions

  constructor(opts: () => ScrollOptions) {
    this.#opts = opts
  }

  // keyId null means a one-shot press with no key to release, such as the command palette.
  press(action: string, keyId: string | null): boolean {
    const delta = scrollDelta(action, this.#opts(), window.innerHeight)
    if (!delta) return false

    // An OS key repeat must not stack impulses; the held ramp already covers it.
    if (keyId !== null && this.#held.has(keyId)) return true

    this.#axes.y.target += delta.top
    this.#axes.x.target += delta.left

    const hold = keyId === null ? undefined : HELD[action]
    if (hold) {
      const axis = this.#axes[hold.axis]
      axis.dir = hold.dir
      axis.heldMs = 0
      this.#held.set(keyId!, hold.axis)
    }

    this.#run()
    return true
  }

  release(keyId: string): void {
    const axis = this.#held.get(keyId)
    if (!axis) return
    this.#held.delete(keyId)
    this.#axes[axis].dir = 0
  }

  releaseAll(): void {
    for (const axis of this.#held.values()) this.#axes[axis].dir = 0
    this.#held.clear()
  }

  #run(): void {
    if (this.#frame !== null) return
    this.#last = performance.now()
    const step = (now: number) => {
      const dt = now - this.#last
      this.#last = now
      const o = this.#opts()

      let moved = false
      for (const key of ['x', 'y'] as const) {
        const after = advance(this.#axes[key], dt, o)
        this.#axes[key] = after
        const want = Math.round(after.current)
        const shift = want - this.#applied[key]
        if (shift !== 0) {
          window.scrollBy({ [key === 'y' ? 'top' : 'left']: shift, behavior: 'instant' })
          this.#applied[key] = want
          moved = true
        }
      }

      if (!moved && settled(this.#axes.x) && settled(this.#axes.y)) {
        this.#frame = null
        this.#axes = { x: idle(), y: idle() }
        this.#applied = { x: 0, y: 0 }
        return
      }
      this.#frame = requestAnimationFrame(step)
    }
    this.#frame = requestAnimationFrame(step)
  }
}
