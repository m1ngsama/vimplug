import { ACTIONS } from '../../shared/actions.ts'
import type { Binding } from '../../shared/matcher.ts'
import type { Row } from './filter.ts'

export function paletteRows(bindings: Binding[]): Row[] {
  const keys = new Map<string, string[]>()
  for (const b of bindings) {
    if (!b.notation) continue
    keys.set(b.action, [...(keys.get(b.action) ?? []), b.notation])
  }
  return ACTIONS.map(a => ({
    label: a.description,
    sub: (keys.get(a.id) ?? []).join('  '),
    value: a.id,
  }))
}
