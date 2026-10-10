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

let previous: MarkPosition | null = null

export function rememberPosition(at?: MarkPosition): void {
  const box = scrolledBox()
  previous = at ?? { x: box.scrollX, y: box.scrollY }
}

function jumpBack(): boolean {
  const to = previous
  if (!to) return false
  rememberPosition()
  scrolledBox().to(to.x, to.y)
  return true
}

const isGlobal = (ch: string): boolean => /^[A-Z]$/.test(ch)
const globalKey = (ch: string): string => `mark:global:${ch}`

export async function saveMark(ch: string): Promise<void> {
  if (isGlobal(ch)) {
    const at = { url: location.href, x: window.scrollX, y: window.scrollY }
    return chrome.storage.local.set({ [globalKey(ch)]: at })
  }
  const key = markKey(location.hostname, location.pathname, ch)
  const box = scrolledBox()
  await chrome.storage.local.set({ [key]: { x: box.scrollX, y: box.scrollY } })
}

export async function jumpMark(ch: string): Promise<boolean> {
  if (ch === '`') return jumpBack()
  const key = isGlobal(ch) ? globalKey(ch) : markKey(location.hostname, location.pathname, ch)
  const got = await chrome.storage.local.get(key)
  const pos = got[key] as (MarkPosition & { url?: string }) | undefined
  if (!pos) return false
  if (pos.url !== undefined && pos.url !== location.href) {
    void chrome.runtime.sendMessage({ type: 'gotoMark', ...pos }).catch(() => {})
    return true
  }
  rememberPosition()
  if (pos.url === undefined) scrolledBox().to(pos.x, pos.y)
  else window.scrollTo(pos.x, pos.y)
  return true
}
