export interface Row {
  label: string
  sub?: string
  value: string
}

export function filterRows<T extends Row>(rows: T[], query: string): T[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return rows
  return rows.filter(r => {
    const hay = `${r.label} ${r.sub ?? ''}`.toLowerCase()
    return terms.every(t => hay.includes(t))
  })
}
