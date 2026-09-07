export interface MarkPosition {
  x: number
  y: number
}

export function markKey(host: string, path: string, ch: string): string {
  return `mark:${host}${path}:${ch}`
}

export function isMarkChar(ch: string): boolean {
  return /^[a-z]$/i.test(ch)
}

export async function saveMark(ch: string): Promise<void> {
  const key = markKey(location.hostname, location.pathname, ch)
  await chrome.storage.local.set({ [key]: { x: window.scrollX, y: window.scrollY } })
}

export async function jumpMark(ch: string): Promise<boolean> {
  const key = markKey(location.hostname, location.pathname, ch)
  const got = await chrome.storage.local.get(key)
  const pos = got[key] as MarkPosition | undefined
  if (!pos) return false
  window.scrollTo({ left: pos.x, top: pos.y, behavior: 'instant' })
  return true
}
