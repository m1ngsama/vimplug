import { ACTIONS } from '../../shared/actions.ts'
import type { Options } from '../../shared/config.ts'
import { runScroll } from './scroll.ts'
import { runHistory } from './history.ts'
import { runClipboard } from './clipboard.ts'
import { runFocusInput } from './focus-input.ts'
import { runMedia } from './media.ts'
import type { Mode } from '../mode.ts'
import type { OverlayKind } from '../overlay/index.ts'

const SCOPE = new Map(ACTIONS.map(a => [a.id, a.scope]))

const OVERLAY_FOR: Record<string, OverlayKind | undefined> = {
  help: 'help',
  openPrompt: 'open',
  tabSearch: 'tabs',
  commandPalette: 'palette',
}

export function openTarget(url: string, newTab: boolean): void {
  if (newTab) void chrome.runtime.sendMessage({ type: 'openUrl', url }).catch(() => {})
  else location.href = url
}

export interface ActionContext {
  opts: Options
  enter: (m: Mode) => void
  startHint: (newTab: boolean, frames?: boolean) => void
  startOverlay: (kind: OverlayKind) => void
  find: (dir: 1 | -1 | 'open') => void
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

  if (id === 'hintFrame') {
    ctx.startHint(false, true)
    return true
  }

  const overlayKind = OVERLAY_FOR[id]
  if (overlayKind) {
    ctx.startOverlay(overlayKind)
    return true
  }

  if (id === 'find' || id === 'findNext' || id === 'findPrev') {
    ctx.find(id === 'find' ? 'open' : id === 'findNext' ? 1 : -1)
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
