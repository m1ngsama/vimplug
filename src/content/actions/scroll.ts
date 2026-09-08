import { advance, settled, type AxisState, type ScrollOptions } from './scroll-physics.ts'
import { resolveScrollBox, windowBox, type ScrollBox } from './scroll-target.ts'

interface ScrollDelta {
  top: number
  left: number
}

export function scrollDelta(
  action: string,
  opts: { scrollStep: number },
  v: Omit<ScrollBox, 'by'>,
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

// An absolute jump must not be added on top of motion still in flight: the delta is
// measured from the live scroll position, which the pending animation has not reached yet.
const ABSOLUTE = new Set(['scrollToTop', 'scrollToBottom', 'scrollToStart', 'scrollToEnd'])

// Only the single-step keys scroll continuously while held; a half-page key is a jump.
const HELD: Record<string, { axis: 'y' | 'x'; dir: -1 | 1 } | undefined> = {
  scrollDown: { axis: 'y', dir: 1 },
  scrollUp: { axis: 'y', dir: -1 },
  scrollRight: { axis: 'x', dir: 1 },
  scrollLeft: { axis: 'x', dir: -1 },
}

const idle = (): AxisState => ({ current: 0, target: 0, dir: 0, heldMs: 0, movingMs: 0 })



export class Scroller {
  #axes: Record<'x' | 'y', AxisState> = { x: idle(), y: idle() }
  #held = new Map<string, 'x' | 'y'>()
  #applied: Record<'x' | 'y', number> = { x: 0, y: 0 }
  #frame: number | null = null
  #last = 0

  // A constructor parameter property would need emitted code, which Node's type
  // stripping cannot do, and the unit tests run straight from TypeScript.
  readonly #opts: () => ScrollOptions

  readonly #focused: () => Element | null
  #box: ScrollBox = windowBox()

  constructor(opts: () => ScrollOptions, focused: () => Element | null = () => null) {
    this.#opts = opts
    this.#focused = focused
  }

  // keyId null means a one-shot press with no key to release, such as the command palette.
  press(action: string, keyId: string | null): boolean {
    // The box is chosen per press, from the direction being asked for, so a pane that has
    // hit its edge hands the scroll on to the region around it.
    const probe = scrollDelta(action, this.#opts(), windowBox())
    if (!probe) return false
    const axis: 'x' | 'y' = probe.left !== 0 ? 'x' : 'y'
    const dir: -1 | 1 = (probe.left || probe.top) >= 0 ? 1 : -1
    if (settled(this.#axes.x) && settled(this.#axes.y)) {
      this.#box = resolveScrollBox(this.#focused(), axis, dir)
    }

    const delta = scrollDelta(action, this.#opts(), this.#box)
    if (!delta) return false

    // An OS key repeat must not stack impulses; the held ramp already covers it.
    if (keyId !== null && this.#held.has(keyId)) return true

    if (ABSOLUTE.has(action)) this.#cancelMotion()

    // A motion starting from rest gets the full ease-in; one joining a move already under
    // way must not restart it, or every repeat of d would stutter back to zero speed.
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

  // Resets the virtual coordinates without moving the page, so the jump that follows is
  // measured from where the page actually is.
  #cancelMotion(): void {
    this.#axes = { x: idle(), y: idle() }
    this.#applied = { x: 0, y: 0 }
    this.#held.clear()
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

      for (const key of ['x', 'y'] as const) {
        this.#axes[key] = advance(this.#axes[key], dt, o)
      }
      // Easing only approaches its target, so the final frame lands on it exactly; an
      // absolute jump that stops half a pixel short is visibly wrong.
      const done = settled(this.#axes.x) && settled(this.#axes.y)

      for (const key of ['x', 'y'] as const) {
        const axis = this.#axes[key]
        const want = Math.round(done ? axis.target : axis.current)
        const shift = want - this.#applied[key]
        if (shift !== 0) {
          this.#box.by(key === 'x' ? shift : 0, key === 'y' ? shift : 0)
          this.#applied[key] = want
        }
      }

      if (done) {
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
