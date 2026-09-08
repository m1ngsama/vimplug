import { filterRows, type Row } from './filter.ts'

export interface Overlay {
  close(): void
  setRows(rows: Row[]): void
}

interface OverlayConfig {
  placeholder: string
  rows: Row[]
  onPick(value: string, query: string, shift: boolean): void
  onClose(): void
  onInput?(query: string): void
  // Live sources rank their own results, so the shell must not filter them again.
  live?: boolean
  // Applied at render time against the live input, so a row standing for what was typed
  // is never a keystroke behind the async results it sits among.
  compose?(rows: Row[], query: string): Row[]
}

const STYLE = `
:host { all: initial }
.wrap {
  position: fixed; inset: 0; z-index: 2147483647;
  display: flex; justify-content: center; align-items: flex-start;
  padding-top: 12vh; background: rgba(0,0,0,.28);
  font: 14px/1.5 ui-sans-serif, -apple-system, system-ui, sans-serif;
}
.panel {
  width: min(680px, 92vw); background: #fbfaf8; color: #21201c;
  border-radius: 10px; box-shadow: 0 18px 48px rgba(0,0,0,.32); overflow: hidden;
}
input {
  width: 100%; box-sizing: border-box; border: 0; outline: 0;
  padding: 14px 16px; font: inherit; font-size: 15px;
  background: transparent; color: inherit;
}
ul { list-style: none; margin: 0; padding: 0; max-height: 46vh; overflow-y: auto;
     border-top: 1px solid #e6e2dc }
li { padding: 8px 16px; cursor: pointer }
li[aria-selected="true"] { background: #eceae5 }
.sub { display: block; font-size: 12px; color: #6b675f;
       overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
@media (prefers-color-scheme: dark) {
  .panel { background: #21201c; color: #f5f4f1 }
  ul { border-top-color: #3a3833 }
  li[aria-selected="true"] { background: #333029 }
  .sub { color: #a39f96 }
}
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
  const list = document.createElement('ul')

  panel.append(input, list)
  wrap.append(panel)
  shadow.append(style, wrap)
  document.body.append(host)

  let shown: Row[] = cfg.rows
  let cursor = 0
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    host.remove()
    cfg.onClose()
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
          close()
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
      if (!row) return
      close()
      cfg.onPick(row.value, input.value, e.shiftKey)
    }
  })

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
