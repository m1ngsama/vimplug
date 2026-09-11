import { filterRows, type Row } from './filter.ts'
import { applyTheme, type Tokens } from '../../shared/theme.ts'

export interface Overlay {
  close(): void
  setRows(rows: Row[]): void
}

// Enter keeps what a search found, Escape puts the page back; onClose alone cannot tell.
export type CloseReason = 'cancel' | 'pick' | 'submit'

interface OverlayConfig {
  placeholder: string
  value?: string
  rows: Row[]
  onPick(value: string, query: string, shift: boolean): void
  onClose(reason: CloseReason): void
  onInput?(query: string): void
  // Lets Enter mean something when there are no rows to pick, as in find.
  onSubmit?(query: string): void
  // Live sources rank their own results, so the shell must not filter them again.
  live?: boolean
  // Applied at render time against the live input, so a row standing for what was typed
  // is never a keystroke behind the async results it sits among.
  compose?(rows: Row[], query: string): Row[]
  theme: Tokens
}

const STYLE = `
:host { all: initial }
.wrap {
  position: fixed; inset: 0; z-index: 2147483647;
  display: flex; justify-content: center; align-items: flex-start;
  padding-top: 12vh; background: var(--vp-scrim);
  font: 14px/1.5 ui-sans-serif, -apple-system, system-ui, sans-serif;
}
.panel {
  width: min(680px, 92vw); background: var(--vp-bg); color: var(--vp-fg);
  border-radius: 10px; box-shadow: 0 18px 48px rgba(0,0,0,.32); overflow: hidden;
}
input {
  width: 100%; box-sizing: border-box; border: 0; outline: 0;
  padding: 14px 16px; font: inherit; font-size: 15px;
  background: transparent; color: inherit;
}
ul { list-style: none; margin: 0; padding: 0; max-height: 46vh; overflow-y: auto;
     border-top: 1px solid var(--vp-border) }
li { padding: 8px 16px; cursor: pointer }
li[aria-selected="true"] { background: color-mix(in srgb, var(--vp-accent) 22%, var(--vp-bg)) }
.sub { display: block; font-size: 12px; color: var(--vp-muted);
       overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
`

export function openOverlay(cfg: OverlayConfig): Overlay {
  const host = document.createElement('div')
  host.dataset.vimplugUi = ''
  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = STYLE
  const wrap = document.createElement('div')
  wrap.className = 'wrap'
  const panel = document.createElement('div')
  panel.className = 'panel'
  const input = document.createElement('input')
  input.placeholder = cfg.placeholder
  input.value = cfg.value ?? ''
  const list = document.createElement('ul')

  // Our input lives in a shadow root, so retargeting shows the page a plain div as the
  // event target. Every site's "is the user typing in a field?" check then says no and its
  // single-key shortcuts fire on each character: on GitHub, typing a query runs the s
  // shortcut and the caret is gone. Keys typed into the panel are ours.
  for (const type of ['keydown', 'keypress', 'keyup', 'input']) {
    host.addEventListener(type, e => e.stopPropagation())
  }

  panel.append(input, list)
  wrap.append(panel)
  shadow.append(style, wrap)
  applyTheme(host, cfg.theme)
  document.body.append(host)

  let shown: Row[] = cfg.rows
  let cursor = 0
  let closed = false

  const close = (reason: CloseReason = 'cancel') => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', guard, true)
    host.remove()
    cfg.onClose(reason)
  }

  let rows = cfg.rows
  const render = () => {
    const base = cfg.live ? rows : filterRows(rows, input.value)
    shown = cfg.compose ? cfg.compose(base, input.value) : base
    cursor = Math.min(cursor, Math.max(0, shown.length - 1))
    list.replaceChildren(
      ...shown.map((r, i) => {
        const li = document.createElement('li')
        li.setAttribute('aria-selected', String(i === cursor))
        li.textContent = r.label
        if (r.sub) {
          const sub = document.createElement('span')
          sub.className = 'sub'
          sub.textContent = r.sub
          li.append(sub)
        }
        li.addEventListener('mousedown', e => {
          e.preventDefault()
          close('pick')
          cfg.onPick(r.value, input.value, false)
        })
        return li
      }),
    )
  }

  input.addEventListener('input', () => {
    render()
    cfg.onInput?.(input.value)
  })

  // Only navigation and submit keys are intercepted. Everything else, spaces included,
  // reaches the input untouched.
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault()
      cursor = Math.min(cursor + 1, shown.length - 1)
      render()
      return
    }
    if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault()
      cursor = Math.max(cursor - 1, 0)
      render()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const row = shown[cursor]
      if (row) {
        close('pick')
        cfg.onPick(row.value, input.value, e.shiftKey)
        return
      }
      // A find has no rows, and vim's <CR> commits the search rather than doing nothing.
      if (cfg.onSubmit) {
        const query = input.value
        close('submit')
        cfg.onSubmit(query)
      }
    }
  })

  // Some pages refocus their own field on a timer, which owes nothing to our events and so
  // survives the focus shield. Taking it back on the next task beats that timer.
  input.addEventListener('blur', () => {
    if (closed) return
    setTimeout(() => {
      if (!closed) input.focus()
    }, 0)
  })

  // The timer can still win a single keystroke in the gap. While the panel is open the key
  // is ours, so anything landing elsewhere is dropped rather than typed into the page.
  const guard = (e: KeyboardEvent) => {
    if (closed || e.target === host) return
    e.preventDefault()
    e.stopImmediatePropagation()
    input.focus()
  }
  document.addEventListener('keydown', guard, true)

  wrap.addEventListener('mousedown', e => {
    if (e.target === wrap) close()
  })

  render()
  input.focus()

  return {
    close,
    setRows(next: Row[]) {
      if (closed) return
      rows = next
      cursor = 0
      render()
    },
  }
}
