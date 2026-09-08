import { generateLabels } from './labels.ts'
import { collectTargets } from './collect.ts'
import { hintText, filterHints } from './text.ts'

export type FeedResult = 'pending' | 'done' | 'none'

export interface HintSession {
  feed(ch: string): FeedResult
  cancel(): void
}

interface Item {
  label: string
  text: string
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

const FOCUSABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'IFRAME'])

// Many players and frameworks act on the pointer sequence and ignore a bare click(), so
// hints replay what a real mouse does before clicking. YouTube's skip-ad button is one.
function realClick(el: Element): void {
  const r = el.getBoundingClientRect()
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: r.left + r.width / 2,
    clientY: r.top + r.height / 2,
  }
  const down = { ...base, button: 0, buttons: 1 }

  el.dispatchEvent(new PointerEvent('pointerover', base))
  el.dispatchEvent(new MouseEvent('mouseover', base))
  el.dispatchEvent(new PointerEvent('pointerdown', down))
  el.dispatchEvent(new MouseEvent('mousedown', down))
  ;(el as HTMLElement).focus?.()
  el.dispatchEvent(new PointerEvent('pointerup', base))
  el.dispatchEvent(new MouseEvent('mouseup', base))
  ;(el as HTMLElement).click()
}

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
  realClick(el)
}

export function startHint(
  chars: string,
  newTab: boolean,
  open: (url: string, newTab: boolean) => void,
  targets: Element[] = collectTargets(document),
): HintSession | null {
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
    return { label: labels[i]!, text: hintText(el), el, node }
  })

  document.body.append(host)

  let typed = ''
  const cleanup = () => host.remove()

  const fire = (item: Item) => {
    cleanup()
    activate(item.el, newTab, open)
  }

  return {
    cancel: cleanup,
    feed(ch: string): FeedResult {
      typed += ch.toLowerCase()
      const result = filterHints(items, typed)

      if (result.kind === 'none') {
        cleanup()
        return 'none'
      }
      if (result.kind === 'match') {
        fire(items[result.index]!)
        return 'done'
      }
      if (result.indexes.length === 1) {
        fire(items[result.indexes[0]!]!)
        return 'done'
      }

      const live = new Set(result.indexes)
      items.forEach((i, n) => {
        if (live.has(n)) i.node.removeAttribute('data-off')
        else i.node.setAttribute('data-off', '')
      })
      return 'pending'
    },
  }
}
