// Fixed-width labels: no label is a prefix of another, so a hint fires the moment its
// last character arrives with no timeout and no ambiguity.
export function generateLabels(count: number, chars: string): string[] {
  const n = chars.length
  if (count <= 0 || n === 0) return []

  let width = 1
  for (let capacity = n; capacity < count; capacity *= n) width += 1

  const out: string[] = []
  for (let i = 0; i < count; i += 1) {
    let rest = i
    let label = ''
    for (let pos = 0; pos < width; pos += 1) {
      label = chars[rest % n] + label
      rest = Math.floor(rest / n)
    }
    out.push(label)
  }
  return out
}
