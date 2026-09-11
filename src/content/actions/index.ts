import { ACTIONS } from '../../shared/actions.ts'
import type { Options } from '../../shared/config.ts'
import { runHistory } from './history.ts'
import { runClipboard } from './clipboard.ts'
import { runFocusInput } from './focus-input.ts'
import { runMedia } from './media.ts'
import { runUrl } from './url.ts'
import { runPager } from './pager.ts'
import type { Mode } from '../mode.ts'
import type { OverlayKind } from '../overlay/index.ts'

const SCOPE = new Map(ACTIONS.map(a => [a.id, a.scope]))

const OVERLAY_FOR: Record<string, OverlayKind | undefined> = {
  help: 'help',
  openPrompt: 'open',
  editUrl: 'edit',
  tabSearch: 'tabs',
  commandPalette: 'palette',
  openBookmark: 'bookmarks',
}

export function openTarget(url: string, newTab: boolean): void {
  if (newTab) void chrome.runtime.sendMessage({ type: 'openUrl', url }).catch(() => {})
  else location.href = url
}

// Each method reports whether it ran: the runtime only calls preventDefault on a true, so
// a failed action cannot swallow the key and strand the engine in the mode it was in.
export interface ActionContext {
  opts: Options
  enter: (m: Mode) => void
  startHint: (newTab: boolean, frames?: boolean, copy?: boolean) => boolean
  startOverlay: (kind: OverlayKind) => boolean
  find: (dir: 1 | -1 | 'open') => boolean
  clearFind: () => boolean
  awaitMark: (mode: 'set' | 'jump') => boolean
  startVisual: () => boolean
}

export function runAction(id: string, ctx: ActionContext, count = 1): boolean {
  const { opts } = ctx

  if (SCOPE.get(id) === 'background') {
    void chrome.runtime.sendMessage({ type: 'runAction', id, count }).catch(() => {})
    return true
  }

  if (
    runHistory(id, count) ||
    runMedia(id, opts.volumeStep * count) ||
    runFocusInput(id) ||
    runUrl(id) ||
    runPager(id)
  )
    return true

  if (id === 'copyUrl' || id === 'openClipboard' || id === 'openClipboardNewTab') {
    void runClipboard(id, opts.searchEngine, openTarget)
    return true
  }

  if (id === 'hint' || id === 'hintNewTab' || id === 'hintCopyUrl')
    return ctx.startHint(id === 'hintNewTab', false, id === 'hintCopyUrl')

  if (id === 'hintFrame') return ctx.startHint(false, true)

  const overlayKind = OVERLAY_FOR[id]
  if (overlayKind) return ctx.startOverlay(overlayKind)

  if (id === 'find') return ctx.find('open')

  if (id === 'findNext' || id === 'findPrev') {
    let stepped = false
    for (let i = 0; i < count; i += 1) stepped = ctx.find(id === 'findNext' ? 1 : -1) || stepped
    return stepped
  }

  if (id === 'setMark' || id === 'jumpMark')
    return ctx.awaitMark(id === 'setMark' ? 'set' : 'jump')

  if (id === 'visualMode') return ctx.startVisual()

  if (id === 'passthrough') {
    ctx.enter('passthrough')
    return true
  }

  if (id === 'escape') {
    ctx.clearFind()
    ctx.enter('normal')
    return true
  }

  return false
}
