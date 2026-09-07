export type Mode = 'normal' | 'insert' | 'hint' | 'command' | 'passthrough'

// hint draws over the page and reads raw keys, so it needs the global listener. command
// owns a real text input, so the listener must be off or it would eat what is typed.
const NEEDS_KEYDOWN: Record<Mode, boolean> = {
  normal: true,
  hint: true,
  command: false,
  insert: false,
  passthrough: false,
}

// command is dismissible on screen, so it does not need a deadline. hint does.
const TRANSIENT: ReadonlySet<Mode> = new Set<Mode>(['hint'])

export function needsKeydown(m: Mode): boolean {
  return NEEDS_KEYDOWN[m]
}

export class ModeMachine {
  #current: Mode = 'normal'
  #timer: ReturnType<typeof setTimeout> | null = null
  readonly #timeout: number
  readonly #listeners: Array<(next: Mode, prev: Mode) => void> = []

  constructor(timeoutMs = 5000) {
    this.#timeout = timeoutMs
  }

  get current(): Mode {
    return this.#current
  }

  onChange(cb: (next: Mode, prev: Mode) => void): void {
    this.#listeners.push(cb)
  }

  enter(next: Mode): void {
    if (next === this.#current) return
    const prev = this.#current
    this.#current = next

    if (this.#timer !== null) {
      clearTimeout(this.#timer)
      this.#timer = null
    }
    // Transient modes always have a way out, so a botched rebind cannot wedge the engine.
    if (TRANSIENT.has(next)) {
      this.#timer = setTimeout(() => this.enter('normal'), this.#timeout)
    }

    for (const cb of this.#listeners) cb(next, prev)
  }
}
