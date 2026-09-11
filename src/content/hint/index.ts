import { generateLabels } from './labels.ts'
import { collectTargets, groupTargets } from './collect.ts'
import { hintText, filterHints } from './text.ts'
import { applyTheme, type Tokens } from '../../shared/theme.ts'

export interface HintSession {
  feed(ch: string, shift?: boolean): void
  back(): void
  confirm(): void
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
  background: var(--vp-accent);
  color: var(--vp-accent-fg);
  border: 1px solid color-mix(in srgb, var(--vp-accent-fg) 45%, var(--vp-accent));
  border-radius: 3px;
  padding: 0 3px;
  font: bold 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  text-transform: uppercase;
  pointer-events: none;
  white-space: nowrap;
  transform-origin: 0 0;
  transition: opacity 90ms ease, transform 90ms ease, background-color 90ms ease;
}
.h .done { opacity: .4 }
.h[data-off] {
  opacity: .35;
  transform: scale(.92);
  background: color-mix(in srgb, var(--vp-accent) 35%, transparent);
}
.h[data-hit] { box-shadow: 0 0 0 2px color-mix(in srgb, var(--vp-accent) 45%, transparent) }
@media (prefers-reduced-motion: reduce) { .h { transition: none } }
`

const FOCUSABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'IFRAME'])
const SETTLE_MS = 200

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

export interface HintOptions {
  chars: string
  newTab: boolean
  copy: boolean
  theme: Tokens
  open(url: string, newTab: boolean, background?: boolean): void
  notify(text: string): void
  onEnd(): void
  targets?: Element[]
}

function activate(el: Element, o: HintOptions, shifted: boolean): void {
  const href = el.tagName === 'A' ? el.getAttribute('href') : null
  const url = href ? new URL(href, location.href).href : null
  if (o.copy) {
    if (url) {
      navigator.clipboard.writeText(url).then(
        () => o.notify('Copied link'),
        () => o.notify('Copy failed'),
      )
    }
    return
  }
  if ((o.newTab || shifted) && url) {
    o.open(url, true, shifted)
    return
  }
  if (FOCUSABLE.has(el.tagName) || (el as HTMLElement).isContentEditable) {
    ;(el as HTMLElement).focus()
    return
  }
  realClick(el)
}

export function startHint(o: HintOptions): HintSession | null {
  const targets = o.targets ?? collectTargets(document)
  if (targets.length === 0) return null

  const groups = groupTargets(targets)
  const labels = generateLabels(groups.length, o.chars.toLowerCase())
  if (labels.length === 0) return null

  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647'
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = STYLE
  shadow.append(style)

  const items: Item[] = groups.map((group, i) => {
    const el = group[0]!
    const r = el.getBoundingClientRect()
    const node = document.createElement('span')
    node.className = 'h'
    node.textContent = labels[i]!
    node.style.top = `${Math.max(0, r.top)}px`
    node.style.left = `${Math.max(0, r.left)}px`
    shadow.append(node)
    return { label: labels[i]!, text: group.map(hintText).join('\n'), el, node }
  })

  applyTheme(host, o.theme)
  document.body.append(host)

  let typed = ''
  let shifted = false
  let settling: ReturnType<typeof setTimeout> | undefined

  const invalidate = () => o.onEnd()
  window.addEventListener('scroll', invalidate, { passive: true })
  window.addEventListener('resize', invalidate, { passive: true })

  const cleanup = () => {
    clearTimeout(settling)
    window.removeEventListener('scroll', invalidate)
    window.removeEventListener('resize', invalidate)
    host.remove()
  }

  const fire = (item: Item) => {
    cleanup()
    activate(item.el, o, shifted)
    o.onEnd()
  }

  const plain = (i: Item) => {
    if (i.node.firstElementChild) i.node.textContent = i.label
  }

  const show = () => {
    clearTimeout(settling)
    const result = filterHints(items, typed)
    if (typed === '' || result.kind === 'none') {
      for (const i of items) {
        i.node.removeAttribute('data-off')
        i.node.removeAttribute('data-hit')
        plain(i)
      }
      return
    }
    if (result.kind === 'match') return fire(items[result.index]!)

    const live = new Set(result.indexes)
    items.forEach((i, n) => {
      i.node.toggleAttribute('data-off', !live.has(n))
      i.node.toggleAttribute('data-hit', live.has(n) && result.by === 'text')
      if (!live.has(n) || result.by === 'text') return plain(i)
      const done = document.createElement('span')
      done.className = 'done'
      done.textContent = i.label.slice(0, typed.length)
      const rest = document.createElement('span')
      rest.textContent = i.label.slice(typed.length)
      i.node.replaceChildren(done, rest)
    })

    if (result.indexes.length === 1) {
      const only = items[result.indexes[0]!]!
      if (result.by === 'label') fire(only)
      else settling = setTimeout(() => fire(only), SETTLE_MS)
    }
  }

  return {
    cancel: cleanup,
    feed(ch: string, shift = false) {
      const next = typed + ch.toLowerCase()
      if (filterHints(items, next).kind === 'none') return
      typed = next
      shifted ||= shift || ch !== ch.toLowerCase()
      show()
    },
    back() {
      if (typed === '') return o.onEnd()
      typed = typed.slice(0, -1)
      show()
    },
    confirm() {
      const result = filterHints(items, typed)
      if (typed !== '' && result.kind === 'filter') fire(items[result.indexes[0]!]!)
    },
  }
}
