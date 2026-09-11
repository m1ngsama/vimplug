import { generateLabels } from './labels.ts'
import { collectTargets, groupTargets } from './collect.ts'
import { hintText, filterHints } from './text.ts'
import { applyTheme, type Tokens } from '../../shared/theme.ts'

type FeedResult = 'pending' | 'done' | 'none'

export interface HintSession {
  feed(ch: string, shift?: boolean): FeedResult
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
/* The characters already typed, so the eye lands on what is left to press. */
.h .done { opacity: .4 }
.h[data-off] {
  opacity: .35;
  transform: scale(.92);
  background: color-mix(in srgb, var(--vp-accent) 35%, transparent);
}
/* Narrowed by link text rather than by label: there is no prefix to mark. */
.h[data-hit] { box-shadow: 0 0 0 2px color-mix(in srgb, var(--vp-accent) 45%, transparent) }
@media (prefers-reduced-motion: reduce) { .h { transition: none } }
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

function activate(
  el: Element,
  newTab: boolean,
  open: (url: string, newTab: boolean) => void,
  copy = false,
): void {
  const href = el.tagName === 'A' ? el.getAttribute('href') : null
  if (copy) {
    if (href) void navigator.clipboard.writeText(new URL(href, location.href).href)
    return
  }
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

export interface HintOptions {
  chars: string
  newTab: boolean
  copy: boolean
  theme: Tokens
  open(url: string, newTab: boolean): void
  onInvalid(): void
  targets?: Element[]
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
    // A newline cannot be typed, so no text match spans two members of a group.
    return { label: labels[i]!, text: group.map(hintText).join('\n'), el, node }
  })

  applyTheme(host, o.theme)
  document.body.append(host)

  let typed = ''
  let shifted = false

  // Labels are positioned against the viewport, so anything that moves the page makes
  // them point at the wrong things. That, not a timer, is when hints stop being valid.
  const invalidate = () => o.onInvalid()
  window.addEventListener('scroll', invalidate, { passive: true })
  window.addEventListener('resize', invalidate, { passive: true })

  const cleanup = () => {
    window.removeEventListener('scroll', invalidate)
    window.removeEventListener('resize', invalidate)
    host.remove()
  }

  const fire = (item: Item) => {
    cleanup()
    activate(item.el, o.newTab || shifted, o.open, o.copy)
  }

  return {
    cancel: cleanup,
    feed(ch: string, shift = false): FeedResult {
      typed += ch.toLowerCase()
      // Caps Lock inverts Shift, so either a capital or Shift itself asks for a new tab.
      shifted ||= shift || ch !== ch.toLowerCase()
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
        if (!live.has(n)) {
          i.node.setAttribute('data-off', '')
          return
        }
        i.node.removeAttribute('data-off')
        if (result.by === 'text') {
          i.node.setAttribute('data-hit', '')
        } else {
          // Split only the survivors: a page can carry hundreds of hints and the first
          // render must not pay for an animation none of them have started yet.
          const done = document.createElement('span')
          done.className = 'done'
          done.textContent = i.label.slice(0, typed.length)
          const rest = document.createElement('span')
          rest.textContent = i.label.slice(typed.length)
          i.node.replaceChildren(done, rest)
        }
      })
      return 'pending'
    },
  }
}
