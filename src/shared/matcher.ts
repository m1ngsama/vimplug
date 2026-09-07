import { keyId, type Key, type KeyMatching } from './keys.ts'

export interface Binding {
  keys: Key[]
  action: string
}

export type MatchResult =
  | { kind: 'none' }
  | { kind: 'pending' }
  | { kind: 'match'; action: string }

interface Node {
  action?: string
  children: Map<string, Node>
}

export class Matcher {
  readonly #root: Node = { children: new Map() }
  readonly #matching: KeyMatching
  #cursor: Node

  constructor(bindings: Binding[], matching: KeyMatching) {
    this.#matching = matching
    for (const b of bindings) {
      let node = this.#root
      for (const k of b.keys) {
        const id = keyId(k, matching)
        let next = node.children.get(id)
        if (!next) {
          next = { children: new Map() }
          node.children.set(id, next)
        }
        node = next
      }
      node.action = b.action
    }
    this.#cursor = this.#root
  }

  get pending(): boolean {
    return this.#cursor !== this.#root
  }

  reset(): void {
    this.#cursor = this.#root
  }

  step(k: Key): MatchResult {
    const next = this.#cursor.children.get(keyId(k, this.#matching))
    if (!next) {
      this.reset()
      return { kind: 'none' }
    }
    // A node with children stays pending even if it also carries an action, so a
    // longer binding shadows a shorter one sharing its prefix.
    if (next.children.size > 0) {
      this.#cursor = next
      return { kind: 'pending' }
    }
    this.reset()
    return next.action === undefined ? { kind: 'none' } : { kind: 'match', action: next.action }
  }
}
