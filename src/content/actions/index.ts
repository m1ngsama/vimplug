import { ACTIONS } from '../../shared/actions.ts'
import type { Options } from '../../shared/config.ts'
import { runHistory } from './history.ts'
import { copyNotice, runClipboard } from './clipboard.ts'
import { runFocusInput } from './focus-input.ts'
import { runMedia } from './media.ts'
import { runUrl } from './url.ts'
import { runPager } from './pager.ts'
import type { Mode } from '../mode.ts'
import type { OverlayKind } from '../overlay/index.ts'

const SCOPE = new Map(ACTIONS.map(a => [a.id, a.scope]))

const OVERLAY_FOR: Record<string, [kind: OverlayKind, newTab?: boolean] | undefined> = {
  help: ['help'],
  openPrompt: ['open'],
  openPromptNewTab: ['open', true],
  editUrl: ['edit'],
  editUrlNewTab: ['edit', true],
  tabSearch: ['tabs'],
  commandPalette: ['palette'],
  openBookmark: ['bookmarks'],
  openBookmarkNewTab: ['bookmarks', true],
}

interface HintKind {
  newTab?: boolean
  frames?: boolean
  copy?: boolean
  keep?: boolean
}

const HINT_FOR: Record<string, HintKind | undefined> = {
  hint: {},
  hintNewTab: { newTab: true },
  hintCopyUrl: { copy: true },
  hintFrame: { frames: true },
  hintMulti: { keep: true },
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
  startHint: (kind: HintKind) => boolean
  startOverlay: (kind: OverlayKind, newTab?: boolean) => boolean
  find: (dir: 1 | -1 | 'open') => boolean
  findSelection: (dir: 1 | -1) => boolean
  clearFind: () => boolean
  awaitMark: (mode: 'set' | 'jump') => boolean
  startVisual: () => boolean
  passNextKey: () => boolean
  notify: (text: string) => void
}

export function runAction(id: string, ctx: ActionContext, count = 1): boolean {
  const { opts } = ctx

  if (SCOPE.get(id) === 'background') {
    void chrome.runtime.sendMessage({ type: 'runAction', id, count }).then(
      res => {
        if ((res as { ok?: boolean } | null)?.ok === false)
          ctx.notify('Not available in this browser')
      },
      () => {},
    )
    return true
  }

  if (
    runHistory(id, count) ||
    runMedia(id, opts.volumeStep * count) ||
    runFocusInput(id, count) ||
    runUrl(id, count) ||
    runPager(id)
  )
    return true

  const copied = copyNotice(id)
  if (copied || id === 'openClipboard' || id === 'openClipboardNewTab') {
    const done = runClipboard(id, opts.searchEngine, openTarget)
    if (copied) done.then(() => ctx.notify(copied), () => ctx.notify('Copy failed'))
    else void done.catch(() => {})
    return true
  }

  const hint = HINT_FOR[id]
  if (hint) return ctx.startHint(hint)

  const overlay = OVERLAY_FOR[id]
  if (overlay) return ctx.startOverlay(...overlay)

  if (id === 'find') return ctx.find('open')

  if (id === 'findNext' || id === 'findPrev') {
    let stepped = false
    for (let i = 0; i < count; i += 1) stepped = ctx.find(id === 'findNext' ? 1 : -1) || stepped
    return stepped
  }

  if (id === 'findSelection' || id === 'findSelectionBack')
    return ctx.findSelection(id === 'findSelection' ? 1 : -1)

  if (id === 'setMark' || id === 'jumpMark')
    return ctx.awaitMark(id === 'setMark' ? 'set' : 'jump')

  if (id === 'visualMode') return ctx.startVisual()

  if (id === 'focusTopFrame') {
    if (window === top) return false
    void chrome.runtime.sendMessage({ type: 'focusTop' }).catch(() => {})
    return true
  }

  if (id === 'passNextKey') return ctx.passNextKey()

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
