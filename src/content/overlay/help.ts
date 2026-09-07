import { ACTIONS } from '../../shared/actions.ts'
import type { Binding } from '../../shared/matcher.ts'
import type { Row } from './filter.ts'

// Generated from the action registry and the bindings actually in force, so the help
// panel cannot drift from what the keys really do.
export function helpRows(bindings: Binding[]): Row[] {
  const keys = new Map<string, string[]>()
  for (const b of bindings) {
    if (!b.notation) continue
    keys.set(b.action, [...(keys.get(b.action) ?? []), b.notation])
  }
  return ACTIONS.filter(a => keys.has(a.id)).map(a => ({
    label: a.description,
    sub: keys.get(a.id)!.join('  '),
    value: a.id,
  }))
}
