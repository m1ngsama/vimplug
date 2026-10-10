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

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export function spread(boxes: Box[]): Array<{ x: number; y: number }> {
  const placed: Box[] = []
  for (const box of boxes) {
    const at = { ...box }
    for (let hit = placed.find(p => overlaps(p, at)); hit; hit = placed.find(p => overlaps(p, at)))
      at.x = hit.x + hit.w + 1
    placed.push(at)
  }
  return placed.map(({ x, y }) => ({ x, y }))
}
