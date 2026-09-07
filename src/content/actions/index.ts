import { ACTIONS } from '../../shared/actions.ts'
import type { Options } from '../../shared/config.ts'
import { runScroll } from './scroll.ts'
import { runHistory } from './history.ts'
import { runClipboard } from './clipboard.ts'
import { runFocusInput } from './focus-input.ts'
import { runMedia } from './media.ts'
import type { Mode } from '../mode.ts'

const SCOPE = new Map(ACTIONS.map(a => [a.id, a.scope]))

export function openTarget(url: string, newTab: boolean): void {
  if (newTab) void chrome.runtime.sendMessage({ type: 'openUrl', url }).catch(() => {})
  else location.href = url
}

export interface ActionContext {
  opts: Options
  enter: (m: Mode) => void
  startHint: (newTab: boolean) => void
}

export function runAction(id: string, ctx: ActionContext): boolean {
  const { opts } = ctx

  if (SCOPE.get(id) === 'background') {
    void chrome.runtime.sendMessage({ type: 'runAction', id }).catch(() => {})
    return true
  }

  if (runScroll(id, opts) || runHistory(id) || runMedia(id, opts.volumeStep) || runFocusInput(id))
    return true

  if (id === 'copyUrl' || id === 'openClipboard' || id === 'openClipboardNewTab') {
    void runClipboard(id, opts.searchEngine, openTarget)
    return true
  }

  if (id === 'hint' || id === 'hintNewTab') {
    ctx.startHint(id === 'hintNewTab')
    return true
  }

  if (id === 'passthrough') {
    ctx.enter('passthrough')
    return true
  }

  if (id === 'escape') {
    ctx.enter('normal')
    return true
  }

  return false
}
