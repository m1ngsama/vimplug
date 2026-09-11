import { deepActiveElement } from './focus.ts'
import { resolveScrollBox } from './actions/scroll-target.ts'

interface MarkPosition {
  x: number
  y: number
}

export function markKey(host: string, path: string, ch: string): string {
  return `mark:${host}${path}:${ch}`
}

export function isMarkChar(ch: string): boolean {
  return /^[a-z]$/i.test(ch)
}

const scrolledBox = () => resolveScrollBox(deepActiveElement(document), 'y')

export async function saveMark(ch: string): Promise<void> {
  const key = markKey(location.hostname, location.pathname, ch)
  const box = scrolledBox()
  await chrome.storage.local.set({ [key]: { x: box.scrollX, y: box.scrollY } })
}

export async function jumpMark(ch: string): Promise<boolean> {
  const key = markKey(location.hostname, location.pathname, ch)
  const got = await chrome.storage.local.get(key)
  const pos = got[key] as MarkPosition | undefined
  if (!pos) return false
  const box = scrolledBox()
  box.by(pos.x - box.scrollX, pos.y - box.scrollY)
  return true
}
