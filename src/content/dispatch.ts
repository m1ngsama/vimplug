import { hasModifier, keyId, type Key, type KeyMatching } from '../shared/keys.ts'
import type { Binding } from '../shared/matcher.ts'

export function boundKeyIds(bindings: Binding[], matching: KeyMatching): ReadonlySet<string> {
  const out = new Set<string>()
  for (const b of bindings) {
    const first = b.keys[0]
    if (first) out.add(keyId(first, matching))
  }
  return out
}

export function shouldHandle(
  k: Key,
  boundIds: ReadonlySet<string>,
  matching: KeyMatching,
): boolean {
  if (!hasModifier(k)) return true
  return boundIds.has(keyId(k, matching))
}
