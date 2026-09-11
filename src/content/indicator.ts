import { applyTheme, type Tokens } from '../shared/theme.ts'
import type { Mode } from './mode.ts'

export function indicatorLabel(m: Mode): string | null {
  if (m === 'passthrough') return '-- INSERT --'
  if (m === 'visual') return '-- VISUAL --'
  return null
}

const STYLE = `
:host { all: initial }
.badge {
  position: fixed; left: 12px; bottom: 12px; z-index: 2147483646;
  padding: 4px 10px; border-radius: 6px;
  background: var(--vp-accent); color: var(--vp-accent-fg);
  font: 600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .04em; pointer-events: none;
}
`

const FLASH_MS = 1500

export interface Indicator {
  mode(m: Mode): void
  flash(text: string): void
}

export function createIndicator(theme: Tokens): Indicator {
  let host: HTMLElement | null = null
  let badge: HTMLElement | null = null
  let label: string | null = null
  let flashing: ReturnType<typeof setTimeout> | undefined

  const render = (text: string | null) => {
    if (text === null) {
      host?.remove()
      host = null
      badge = null
      return
    }
    if (!badge) {
      host = document.createElement('div')
      host.dataset.vimplugUi = ''
      const shadow = host.attachShadow({ mode: 'closed' })
      const style = document.createElement('style')
      style.textContent = STYLE
      badge = document.createElement('div')
      badge.className = 'badge'
      shadow.append(style, badge)
      applyTheme(host, theme)
      document.body.append(host)
    }
    badge.textContent = text
  }

  return {
    mode(m) {
      label = indicatorLabel(m)
      if (flashing === undefined) render(label)
    },
    flash(text) {
      clearTimeout(flashing)
      render(text)
      flashing = setTimeout(() => {
        flashing = undefined
        render(label)
      }, FLASH_MS)
    },
  }
}
