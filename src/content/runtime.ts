import { Matcher } from '../shared/matcher.ts'
import { resolveForHost, DEFAULT_DSL } from '../shared/config.ts'
import { ModeMachine, needsKeydown, type Mode } from './mode.ts'
import { fromEvent } from './event-keys.ts'
import { boundKeyIds, shouldHandle } from './dispatch.ts'
import { deepActiveElement, modeForFocus, ownsEscape } from './focus.ts'
import { runAction, openTarget, type ActionContext } from './actions/index.ts'
import { Scroller } from './actions/scroll.ts'
import { keyId } from '../shared/keys.ts'
import { CountBuffer } from '../shared/count.ts'
import { startHint, type HintSession } from './hint/index.ts'
import { resolveTheme } from '../shared/theme.ts'
import { startOverlay } from './overlay/index.ts'
import { createFind, type FindSession } from './find/index.ts'
import { isMarkChar, saveMark, jumpMark } from './marks.ts'
import { beginVisual, moveVisual, yankVisual, clearVisual } from './visual.ts'
import { createIndicator } from './indicator.ts'
import { shieldOurFocus } from './focus-shield.ts'
import type { Overlay } from './overlay/shell.ts'

async function loadDsl(): Promise<string> {
  const res = await chrome.runtime.sendMessage({ type: 'getDsl' }).catch(() => null)
  const dsl = (res as { dsl?: unknown } | null)?.dsl
  return typeof dsl === 'string' ? dsl : DEFAULT_DSL
}

declare global {
  interface Window {
    __vimplugLoaded?: true
  }
}

async function main(): Promise<void> {
  const site = resolveForHost(await loadDsl(), location.hostname)
  if (site.disabled) return

  const { keyMatching } = site.options
  const matcher = new Matcher(site.bindings.normal, keyMatching)
  const boundIds = boundKeyIds(site.bindings.normal, keyMatching)
  const modes = new ModeMachine()
  const count = new CountBuffer()
  const theme = resolveTheme(
    site.options,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const indicator = createIndicator(theme)
  const scroller = new Scroller(
    () => site.options,
    () => deepActiveElement(document),
  )

  let hint: HintSession | null = null
  let heldFromHint = false

  let overlay: Overlay | null = null
  // Set before building: the input focuses synchronously, and focusin would re-sync the mode first.
  let overlayOpen = false
  const finder = createFind(theme)
  let awaitingMark: 'set' | 'jump' | null = null

  const dispatch = (id: string, key: string | null, times = 1): boolean =>
    scroller.press(id, key, times) || runAction(id, ctx, times)

  const ctx: ActionContext = {
    opts: site.options,
    enter: (m: Mode) => modes.enter(m),
    startHint: (newTab: boolean, frames = false, copy = false) => {
      const targets = frames
        ? Array.from(document.querySelectorAll('iframe')).filter(f => {
            const r = f.getBoundingClientRect()
            return r.width > 0 && r.height > 0
          })
        : undefined
      const session = startHint({
        chars: site.options.hintChars,
        newTab,
        copy,
        theme,
        open: openTarget,
        notify: indicator.flash,
        onEnd: () => {
          if (modes.current === 'hint') modes.enter('normal')
        },
        targets,
      })
      if (!session) return false
      hint = session
      modes.enter('hint')
      return true
    },
    startVisual: () => {
      if (!beginVisual()) return false
      modes.enter('visual')
      return true
    },
    awaitMark: kind => {
      awaitingMark = kind
      modes.enter('pending')
      return true
    },
    clearFind: () => {
      finder?.clear()
      return true
    },
    find: dir => {
      if (dir === 'open') return ctx.startOverlay('find')
      if (!finder) return false
      const at = finder.step(dir)
      if (at) indicator.flash(`${at.index + 1}/${at.total}`)
      return true
    },
    notify: indicator.flash,
    startOverlay: kind => {
      if (overlayOpen) return false
      overlayOpen = true
      const origin = kind === 'find' ? { x: window.scrollX, y: window.scrollY } : null
      modes.enter('command')
      void startOverlay(
        kind,
        site.bindings.normal,
        site.options.searchEngine,
        reason => {
          overlay = null
          overlayOpen = false
          if (origin && reason === 'cancel') {
            finder?.clear()
            window.scrollTo(origin.x, origin.y)
          }
          if (origin && reason === 'submit') finder?.select()
          modes.enter('normal')
        },
        id => dispatch(id, null),
        theme,
        query => {
          const found = finder?.search(query) ?? 0
          if (found === 0 && origin) window.scrollTo(origin.x, origin.y)
          return found
        },
      ).then(o => {
        overlay = o
      })
      return true
    },
  }

  // Safari ends composition before the final keydown, so isComposing is false on it; justEnded covers that key.
  let composing = false
  let justEnded = false
  document.addEventListener('compositionstart', () => (composing = true), true)
  document.addEventListener(
    'compositionend',
    () => {
      composing = false
      justEnded = true
      setTimeout(() => (justEnded = false), 0)
    },
    true,
  )

  const fromInputMethod = (e: KeyboardEvent): boolean =>
    composing || justEnded || e.isComposing || e.keyCode === 229

  const onKeydown = (e: KeyboardEvent) => {
    if (fromInputMethod(e)) return
    if (e.repeat && heldFromHint) {
      e.preventDefault()
      return
    }

    if (awaitingMark) {
      e.preventDefault()
      const kind = awaitingMark
      awaitingMark = null
      if (isMarkChar(e.key)) {
        void (kind === 'set' ? saveMark(e.key) : jumpMark(e.key))
      }
      modes.enter('normal')
      return
    }

    if (modes.current === 'visual') {
      if (e.key === 'Escape') {
        e.preventDefault()
        clearVisual()
        modes.enter('normal')
      } else if (e.key === 'y') {
        e.preventDefault()
        yankVisual().then(
          n => {
            if (n > 0) indicator.flash(`Copied ${n} characters`)
          },
          () => indicator.flash('Copy failed'),
        )
        modes.enter('normal')
      } else if (moveVisual(e.key)) {
        e.preventDefault()
      }
      return
    }

    if (hint) {
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return
      if (e.key === 'Escape') modes.enter('normal')
      else if (e.key === 'Backspace') hint.back()
      else if (e.key === 'Enter') hint.confirm()
      else if (e.key.length === 1) hint.feed(e.key, e.shiftKey)
      return
    }

    const key = fromEvent(e)
    if (!shouldHandle(key, boundIds, keyMatching)) return

    if (!matcher.pending && count.feed(key)) {
      e.preventDefault()
      return
    }

    const r = matcher.step(key)
    if (r.kind === 'none') count.reset()
    if (r.kind === 'match' && dispatch(r.action, keyId(key, keyMatching), count.take())) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }

  const onKeyup = (e: KeyboardEvent) => {
    heldFromHint = false
    scroller.release(keyId(fromEvent(e), keyMatching))
  }

  let escapeHatch: ((e: KeyboardEvent) => void) | null = null
  const setHatch = (on: boolean) => {
    if (on && !escapeHatch) {
      escapeHatch = e => {
        if (e.key !== 'Escape' || fromInputMethod(e)) return
        if (modes.current !== 'insert') return modes.enter('normal')
        const field = deepActiveElement(document)
        if (field && !ownsEscape(field)) (field as HTMLElement).blur()
      }
      document.addEventListener('keydown', escapeHatch, true)
    } else if (!on && escapeHatch) {
      document.removeEventListener('keydown', escapeHatch, true)
      escapeHatch = null
    }
  }

  let attached = false
  const attach = () => {
    if (attached) return
    document.addEventListener('keydown', onKeydown, true)
    document.addEventListener('keyup', onKeyup, true)
    attached = true
  }
  const detach = () => {
    if (!attached) return
    document.removeEventListener('keydown', onKeydown, true)
    document.removeEventListener('keyup', onKeyup, true)
    attached = false
    matcher.reset()
    scroller.releaseAll()
  }
  modes.onChange((next, prev) => {
    if (needsKeydown(next)) attach()
    else detach()
    setHatch(next === 'passthrough' || next === 'insert')
    indicator.mode(next)
    if (prev === 'hint' && next !== 'hint') {
      hint?.cancel()
      hint = null
      heldFromHint = true
    }
    if (prev === 'pending' && next !== 'pending') awaitingMark = null
  })

  // A key held while the window loses focus never sends its keyup.
  window.addEventListener('blur', () => scroller.releaseAll())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scroller.releaseAll()
  })

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

if (!window.__vimplugLoaded) {
  window.__vimplugLoaded = true
  // Before main() awaits the config: registration order decides who wins a focus fight.
  shieldOurFocus()
  void main()
}
