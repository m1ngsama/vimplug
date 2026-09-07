import { Matcher } from '../shared/matcher.ts'
import { resolveForHost, DEFAULT_DSL } from '../shared/config.ts'
import { ModeMachine, needsKeydown, type Mode } from './mode.ts'
import { fromEvent } from './event-keys.ts'
import { boundKeyIds, shouldHandle } from './dispatch.ts'
import { deepActiveElement, modeForFocus } from './focus.ts'
import { runAction, openTarget, type ActionContext } from './actions/index.ts'
import { startHint, type HintSession } from './hint/index.ts'
import { startOverlay } from './overlay/index.ts'
import type { Overlay } from './overlay/shell.ts'

async function loadDsl(): Promise<string> {
  const res = await chrome.runtime.sendMessage({ type: 'getDsl' }).catch(() => null)
  const dsl = (res as { dsl?: unknown } | null)?.dsl
  return typeof dsl === 'string' ? dsl : DEFAULT_DSL
}

async function main(): Promise<void> {
  const site = resolveForHost(await loadDsl(), location.hostname)
  if (site.disabled) return

  const { keyMatching } = site.options
  const matcher = new Matcher(site.bindings.normal, keyMatching)
  const boundIds = boundKeyIds(site.bindings.normal, keyMatching)
  const modes = new ModeMachine()

  let hint: HintSession | null = null

  let overlay: Overlay | null = null
  // Set before the overlay is built: its input takes focus synchronously, so a handle
  // assigned from the promise would arrive after focusin has already re-synced the mode.
  let overlayOpen = false

  const ctx: ActionContext = {
    opts: site.options,
    enter: (m: Mode) => modes.enter(m),
    startHint: (newTab: boolean, frames = false) => {
      const targets = frames
        ? Array.from(document.querySelectorAll('iframe')).filter(f => {
            const r = f.getBoundingClientRect()
            return r.width > 0 && r.height > 0
          })
        : undefined
      const session = startHint(site.options.hintChars, newTab, openTarget, targets)
      if (!session) return
      hint = session
      modes.enter('hint')
    },
    startOverlay: kind => {
      if (overlayOpen) return
      overlayOpen = true
      modes.enter('command')
      void startOverlay(kind, site.bindings.normal, site.options.searchEngine, () => {
        overlay = null
        overlayOpen = false
        modes.enter('normal')
      }).then(o => {
        overlay = o
      })
    },
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (hint) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') modes.enter('normal')
      else if (e.key.length === 1 && hint.feed(e.key) !== 'pending') {
        hint = null
        modes.enter('normal')
      }
      return
    }

    const key = fromEvent(e)
    if (!shouldHandle(key, boundIds, keyMatching)) return
    const r = matcher.step(key)
    if (r.kind === 'match' && runAction(r.action, ctx)) e.preventDefault()
  }

  // Passthrough detaches the main listener, so it needs its own way out. This one only
  // observes Esc and never calls preventDefault, so the page keeps its own Esc handling.
  let escapeHatch: ((e: KeyboardEvent) => void) | null = null
  const setHatch = (on: boolean) => {
    if (on && !escapeHatch) {
      escapeHatch = e => {
        if (e.key === 'Escape') modes.enter('normal')
      }
      document.addEventListener('keydown', escapeHatch, true)
    } else if (!on && escapeHatch) {
      document.removeEventListener('keydown', escapeHatch, true)
      escapeHatch = null
    }
  }

  // Invariant 1: the mode machine is the only thing that attaches or detaches the
  // listener, so insert mode leaves nothing on the typing path.
  let attached = false
  const attach = () => {
    if (attached) return
    document.addEventListener('keydown', onKeydown, true)
    attached = true
  }
  const detach = () => {
    if (!attached) return
    document.removeEventListener('keydown', onKeydown, true)
    attached = false
    matcher.reset()
  }
  modes.onChange((next, prev) => {
    if (needsKeydown(next)) attach()
    else detach()
    setHatch(next === 'passthrough')
    // Covers the mode machine's own timeout, so a stale overlay cannot outlive hint mode.
    if (prev === 'hint' && next !== 'hint') {
      hint?.cancel()
      hint = null
    }
  })

  // Our own overlay input takes focus; syncing on it would drop us back to normal and
  // re-attach the global listener over the field the user is typing in.
  const syncMode = () => {
    if (overlayOpen) return
    modes.enter(modeForFocus(deepActiveElement(document)))
  }
  document.addEventListener('focusin', syncMode, true)
  // focusout fires before the new element takes focus.
  document.addEventListener('focusout', () => queueMicrotask(syncMode), true)

  syncMode()
  if (needsKeydown(modes.current)) attach()

  document.documentElement.dataset.vimplug = 'on'
}

void main()
