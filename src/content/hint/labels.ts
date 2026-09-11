export function generateLabels(count: number, chars: string): string[] {
  const n = chars.length
  if (count <= 0 || n < 2) return []

  const labels = chars.split('')
  while (labels.length < count) {
    const shortest = Math.min(...labels.map(l => l.length))
    let idx = labels.length - 1
    while (labels[idx]!.length !== shortest) idx -= 1

    const parent = labels.splice(idx, 1)[0]!
    for (const c of chars) labels.push(parent + c)
  }
  return labels.slice(0, count)
}
