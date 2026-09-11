type SelectionCommand = [alter: string, direction: string, granularity: string]

const MOVES: Record<string, SelectionCommand> = {
  l: ['extend', 'forward', 'character'],
  h: ['extend', 'backward', 'character'],
  j: ['extend', 'forward', 'line'],
  k: ['extend', 'backward', 'line'],
  w: ['extend', 'forward', 'word'],
  b: ['extend', 'backward', 'word'],
  '0': ['extend', 'backward', 'lineboundary'],
  $: ['extend', 'forward', 'lineboundary'],
}

export function selectionCommand(key: string): SelectionCommand | null {
  return MOVES[key] ?? null
}

interface ModifiableSelection extends Selection {
  modify(alter: string, direction: string, granularity: string): void
}

function selection(): ModifiableSelection | null {
  const sel = window.getSelection()
  return sel && typeof (sel as ModifiableSelection).modify === 'function'
    ? (sel as ModifiableSelection)
    : null
}

export function beginVisual(): boolean {
  const sel = selection()
  if (!sel) return false
  if (sel.rangeCount > 0 && !sel.isCollapsed) return true

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    if (!node.data.trim()) continue
    const rect = node.parentElement?.getBoundingClientRect()
    if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) continue
    const range = document.createRange()
    range.setStart(node, 0)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  }
  return false
}

export function moveVisual(key: string): boolean {
  const cmd = selectionCommand(key)
  const sel = selection()
  if (!cmd || !sel) return false
  sel.modify(...cmd)
  return true
}

export async function yankVisual(): Promise<void> {
  const text = window.getSelection()?.toString() ?? ''
  if (text) await navigator.clipboard.writeText(text)
  window.getSelection()?.removeAllRanges()
}

export function clearVisual(): void {
  window.getSelection()?.removeAllRanges()
}
