import { applyTheme, type Tokens } from '../shared/theme.ts'
import type { Mode } from './mode.ts'

/**
 * vim tells you which mode you are in, and until now nothing here did. Only the modes that
 * are otherwise invisible get a label: hint and command already draw themselves, pending
 * releases on its own within a keystroke, and insert is reached by clicking a text field,
 * which announces itself. That leaves the two you enter deliberately and could otherwise
 * sit in without knowing.
 */
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

export interface Indicator {
  show(mode: Mode): void
  destroy(): void
}

export function createIndicator(theme: Tokens): Indicator {
  let host: HTMLElement | null = null
  // The shadow root is closed, so host.shadowRoot is null and the badge has to be held
  // here rather than looked up again.
  let badge: HTMLElement | null = null

  const remove = () => {
    host?.remove()
    host = null
    badge = null
  }

  return {
    show(mode: Mode) {
      const label = indicatorLabel(mode)
      if (label === null) {
        remove()
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
    },
    destroy: remove,
  }
}
