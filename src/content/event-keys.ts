import type { Key } from '../shared/keys.ts'

export function fromEvent(e: KeyboardEvent): Key {
  return {
    code: e.code,
    key: e.key,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    alt: e.altKey,
    shift: e.shiftKey,
  }
}
