import { Matcher } from '../shared/matcher.ts'
import { resolveForHost, DEFAULT_DSL } from '../shared/config.ts'
import { ModeMachine } from './mode.ts'
import { fromEvent } from './event-keys.ts'
import { boundKeyIds, shouldHandle } from './dispatch.ts'
import { runScroll } from './actions/scroll.ts'

async function loadDsl(): Promise<string> {
  const res = await chrome.runtime.sendMessage({ type: 'getDsl' }).catch(() => null)
  const dsl = (res as { dsl?: unknown } | null)?.dsl
  return typeof dsl === 'string' ? dsl : DEFAULT_DSL
}

async function main(): Promise<void> {
  const site = resolveForHost(await loadDsl(), location.hostname)
  if (site.disabled) return

  const matcher = new Matcher(site.bindings.normal, site.options.keyMatching)
  const boundIds = boundKeyIds(site.bindings.normal, site.options.keyMatching)
  const modes = new ModeMachine()

  const onKeydown = (e: KeyboardEvent) => {
    const key = fromEvent(e)
    if (!shouldHandle(key, boundIds, site.options.keyMatching)) return
    const r = matcher.step(key)
    if (r.kind === 'match' && runScroll(r.action, site.options)) e.preventDefault()
  }

  document.addEventListener('keydown', onKeydown, true)
  void modes
}

void main()
