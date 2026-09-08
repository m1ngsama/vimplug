import { applyTheme, type Tokens } from '../shared/theme.ts'
import type { Mode } from './mode.ts'

// Only the modes with nothing else on screen: hint and command draw themselves, pending
// releases within a keystroke, and insert is reached by clicking a field.
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

export function createIndicator(theme: Tokens): (mode: Mode) => void {
  let host: HTMLElement | null = null
  // The shadow root is closed, so host.shadowRoot is null and the badge is held here.
  let badge: HTMLElement | null = null

  return mode => {
    const label = indicatorLabel(mode)
    if (label === null) {
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
    badge.textContent = label
  }
}
