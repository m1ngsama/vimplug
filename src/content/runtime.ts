import { Matcher } from '../shared/matcher.ts'
import { resolveForHost, DEFAULT_DSL } from '../shared/config.ts'
import { ModeMachine, needsKeydown, type Mode } from './mode.ts'
import { fromEvent } from './event-keys.ts'
import { boundKeyIds, shouldHandle } from './dispatch.ts'
import { deepActiveElement, modeForFocus } from './focus.ts'
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

// Content scripts of one extension share an isolated world per frame, so this flag is
// invisible to the page and survives a second injection. Re-registering scripts while a
// page is loading can deliver the engine twice; two engines would double every keystroke.
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
  const showMode = createIndicator(theme)
  const scroller = new Scroller(
    () => site.options,
    () => deepActiveElement(document),
  )

  let hint: HintSession | null = null

  let overlay: Overlay | null = null
  // Set before the overlay is built: its input takes focus synchronously, so a handle
  // assigned from the promise would arrive after focusin has already re-synced the mode.
  let overlayOpen = false
  const finder = createFind(theme)
  let awaitingMark: 'set' | 'jump' | null = null

  // The runtime owns key identity so actions never need to know which key ran them.
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
        onInvalid: () => modes.enter('normal'),
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
      // Opening needs no finder: without the Highlight API only the painting is skipped.
      if (dir === 'open') return ctx.startOverlay('find')
      if (!finder) return false
      finder.step(dir)
      return true
    },
    startOverlay: kind => {
      if (overlayOpen) return false
      overlayOpen = true
      // Cancelling a search puts the page back, so where it sat has to be kept.
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
          modes.enter('normal')
        },
        id => dispatch(id, null),
        theme,
        query => {
          // Typing past the last match must not leave the page on the result of whatever
          // prefix matched before it.
          if ((finder?.search(query) ?? 0) === 0 && origin) window.scrollTo(origin.x, origin.y)
        },
      ).then(o => {
        overlay = o
      })
      return true
    },
  }

  // Safari ends the composition before delivering the final keydown, so isComposing is
  // false on the key that closed the IME; justEnded covers it and clears on the next task.
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
        void yankVisual()
        modes.enter('normal')
      } else if (moveVisual(e.key)) {
        e.preventDefault()
      }
      return
    }

    if (hint) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') modes.enter('normal')
      else if (e.key.length === 1 && hint.feed(e.key, e.shiftKey) !== 'pending') {
        hint = null
        modes.enter('normal')
      }
      return
    }

    const key = fromEvent(e)
    if (!shouldHandle(key, boundIds, keyMatching)) return

    // A digit only starts a count when no binding is half-typed, so g0 could still reach
    // the matcher if it were ever bound.
    if (!matcher.pending && count.feed(key)) {
      e.preventDefault()
      return
    }

    const r = matcher.step(key)
    if (r.kind === 'none') count.reset()
    if (r.kind === 'match' && dispatch(r.action, keyId(key, keyMatching), count.take())) {
      e.preventDefault()
      // A key we acted on is not the page's too. Sites bind bare letters: MDN and GitHub
      // both take `/` to their own search box, and preventDefault cannot undo a focus()
      // they called themselves.
      e.stopImmediatePropagation()
    }
  }

  const onKeyup = (e: KeyboardEvent) => scroller.release(keyId(fromEvent(e), keyMatching))

  // Passthrough detaches the main listener, so it needs its own way out. This one only
  // observes Esc and never calls preventDefault, so the page keeps its own Esc handling.
  let escapeHatch: ((e: KeyboardEvent) => void) | null = null
  const setHatch = (on: boolean) => {
    if (on && !escapeHatch) {
      escapeHatch = e => {
        // Escape ends an IME candidate list too, and that one is not a request to leave.
        if (e.key === 'Escape' && !fromInputMethod(e)) modes.enter('normal')
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
    setHatch(next === 'passthrough')
    showMode(next)
    // Covers the mode machine's own timeout, so a stale overlay cannot outlive hint mode.
    if (prev === 'hint' && next !== 'hint') {
      hint?.cancel()
      hint = null
    }
    if (prev === 'pending' && next !== 'pending') awaitingMark = null
  })

  // Our own overlay input takes focus; syncing on it would drop us back to normal and
  // re-attach the global listener over the field the user is typing in.
  // A key held when the window loses focus never delivers its keyup, and the axis would
  // keep accelerating against a page nobody is looking at.
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
