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

export function openTarget(url: string, newTab: boolean, background = false): void {
  if (!newTab) {
    location.href = url
    return
  }
  const msg = background ? { type: 'openUrl', url, active: false } : { type: 'openUrl', url }
  void chrome.runtime.sendMessage(msg).catch(() => {})
}

// Return false when nothing ran: a true swallows the key and can strand the engine in a mode.
export interface ActionContext {
  opts: Options
  enter: (m: Mode) => void
  startHint: (newTab: boolean, frames?: boolean, copy?: boolean) => boolean
  startOverlay: (kind: OverlayKind) => boolean
  find: (dir: 1 | -1 | 'open') => boolean
  clearFind: () => boolean
  awaitMark: (mode: 'set' | 'jump') => boolean
  startVisual: () => boolean
  notify: (text: string) => void
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
    runFocusInput(id, count) ||
    runUrl(id) ||
    runPager(id)
  )
    return true

  if (id === 'copyUrl' || id === 'openClipboard' || id === 'openClipboardNewTab') {
    const done = runClipboard(id, opts.searchEngine, openTarget)
    if (id === 'copyUrl') done.then(() => ctx.notify('Copied URL'), () => ctx.notify('Copy failed'))
    else void done.catch(() => {})
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
