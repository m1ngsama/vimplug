// Labels are prefix-free but not fixed width: the shortest available label is expanded
// only when more are needed, so the first targets keep one-character hints even on a page
// with dozens of them. Prefix-free is what lets a hint fire the moment its last character
// arrives, with no timeout and no ambiguity.
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
