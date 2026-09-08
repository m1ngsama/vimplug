import { hasModifier, type Key } from './keys.ts'

const MAX = 1000

// vim's numeric prefix. A bare 0 is left alone because it is a binding of its own here,
// scroll to the left edge; inside a count it is just a digit.
export class CountBuffer {
  #digits = ''

  get value(): number {
    return this.#digits === '' ? 1 : Math.min(MAX, Number(this.#digits))
  }

  get pending(): boolean {
    return this.#digits !== ''
  }

  feed(k: Key): boolean {
    if (hasModifier(k)) return false
    const digit = /^Digit([0-9])$/.exec(k.code)?.[1]
    if (digit === undefined || k.shift) return false
    if (digit === '0' && this.#digits === '') return false

    this.#digits += digit
    return true
  }

  take(): number {
    const n = this.value
    this.reset()
    return n
  }

  reset(): void {
    this.#digits = ''
  }
}
