import { Matcher } from '../shared/matcher.ts'
import { resolveForHost, DEFAULT_DSL } from '../shared/config.ts'
import { ModeMachine, needsKeydown } from './mode.ts'
import { fromEvent } from './event-keys.ts'
import { boundKeyIds, shouldHandle } from './dispatch.ts'
import { deepActiveElement, modeForFocus } from './focus.ts'
import { runScroll } from './actions/scroll.ts'

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

  const onKeydown = (e: KeyboardEvent) => {
    const key = fromEvent(e)
    if (!shouldHandle(key, boundIds, keyMatching)) return
    const r = matcher.step(key)
    if (r.kind === 'match' && runScroll(r.action, site.options)) e.preventDefault()
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
  modes.onChange(next => (needsKeydown(next) ? attach() : detach()))

  const syncMode = () => modes.enter(modeForFocus(deepActiveElement(document)))
  document.addEventListener('focusin', syncMode, true)
  // focusout fires before the new element takes focus.
  document.addEventListener('focusout', () => queueMicrotask(syncMode), true)

  syncMode()
  if (needsKeydown(modes.current)) attach()

  document.documentElement.dataset.vimplug = 'on'
}

void main()
