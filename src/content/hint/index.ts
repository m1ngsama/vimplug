import { generateLabels } from './labels.ts'
import { collectTargets } from './collect.ts'

export type FeedResult = 'pending' | 'done' | 'none'

export interface HintSession {
  feed(ch: string): FeedResult
  cancel(): void
}

interface Item {
  label: string
  el: Element
  node: HTMLElement
}

const STYLE = `
.h {
  position: fixed;
  z-index: 2147483647;
  background: #ffd76e;
  color: #21201c;
  border: 1px solid #b8933a;
  border-radius: 3px;
  padding: 0 3px;
  font: bold 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  text-transform: uppercase;
  pointer-events: none;
  white-space: nowrap;
}
.h[data-off] { opacity: .25 }
`

const FOCUSABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function activate(el: Element, newTab: boolean, open: (url: string, newTab: boolean) => void): void {
  const href = el.tagName === 'A' ? el.getAttribute('href') : null
  if (newTab && href) {
    open(new URL(href, location.href).href, true)
    return
  }
  if (FOCUSABLE.has(el.tagName) || (el as HTMLElement).isContentEditable) {
    ;(el as HTMLElement).focus()
    return
  }
  ;(el as HTMLElement).click()
}

export function startHint(
  chars: string,
  newTab: boolean,
  open: (url: string, newTab: boolean) => void,
): HintSession | null {
  const targets = collectTargets(document)
  if (targets.length === 0) return null

  const labels = generateLabels(targets.length, chars.toLowerCase())
  if (labels.length === 0) return null

  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647'
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = STYLE
  shadow.append(style)

  const items: Item[] = targets.map((el, i) => {
    const r = el.getBoundingClientRect()
    const node = document.createElement('span')
    node.className = 'h'
    node.textContent = labels[i]!
    node.style.top = `${Math.max(0, r.top)}px`
    node.style.left = `${Math.max(0, r.left)}px`
    shadow.append(node)
    return { label: labels[i]!, el, node }
  })

  document.body.append(host)

  let typed = ''
  const cleanup = () => host.remove()

  return {
    cancel: cleanup,
    feed(ch: string): FeedResult {
      typed += ch.toLowerCase()
      const hit = items.find(i => i.label === typed)
      if (hit) {
        cleanup()
        activate(hit.el, newTab, open)
        return 'done'
      }
      const live = items.filter(i => i.label.startsWith(typed))
      if (live.length === 0) {
        cleanup()
        return 'none'
      }
      for (const i of items) {
        if (i.label.startsWith(typed)) i.node.removeAttribute('data-off')
        else i.node.setAttribute('data-off', '')
      }
      return 'pending'
    },
  }
}
