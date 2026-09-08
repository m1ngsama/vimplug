import { openOverlay, type Overlay } from './shell.ts'
import { helpRows } from './help.ts'
import { paletteRows } from './palette.ts'
import type { Row } from './filter.ts'
import type { Binding } from '../../shared/matcher.ts'
import { clipboardTarget, looksLikeUrl } from '../actions/clipboard.ts'
import { openTarget } from '../actions/index.ts'

export type OverlayKind = 'help' | 'open' | 'tabs' | 'palette' | 'find' | 'bookmarks'

interface Suggested {
  kind: 'tab' | 'bookmark' | 'history'
  title: string
  url: string
  tabId?: number
}

const LABEL: Record<Suggested['kind'], string> = {
  tab: 'tab',
  bookmark: 'bookmark',
  history: 'history',
}

async function suggest(query: string, only?: 'bookmark'): Promise<Row[]> {
  const res = await chrome.runtime.sendMessage({ type: 'suggest', query, only }).catch(() => null)
  const rows = (res as { rows?: Suggested[] } | null)?.rows ?? []
  return rows.map(r => ({
    label: r.title || r.url,
    // The source matters: one row switches to a tab you already have, another opens a page.
    sub: `${LABEL[r.kind]}  ${r.url}`,
    value: r.tabId === undefined ? `url:${r.url}` : `tab:${r.tabId}`,
  }))
}

async function listTabs(): Promise<Row[]> {
  const res = await chrome.runtime.sendMessage({ type: 'listTabs' }).catch(() => null)
  const tabs = (res as { tabs?: Array<{ id?: number; title: string; url: string }> } | null)?.tabs
  return (tabs ?? [])
    .filter(t => t.id !== undefined)
    .map(t => ({ label: t.title || t.url, sub: t.url, value: String(t.id) }))
}

export async function startOverlay(
  kind: OverlayKind,
  bindings: Binding[],
  searchEngine: string,
  onClose: () => void,
  runById: (id: string) => void,
  onFind?: (query: string) => void,
): Promise<Overlay> {
  if (kind === 'find') {
    return openOverlay({
      placeholder: 'Find in page',
      rows: [],
      onInput: onFind,
      onPick: () => {},
      onClose,
    })
  }

  if (kind === 'palette') {
    return openOverlay({
      placeholder: 'Run an action',
      rows: paletteRows(bindings),
      onPick: runById,
      onClose,
    })
  }

  if (kind === 'help') {
    return openOverlay({
      placeholder: 'Filter keys',
      rows: helpRows(bindings),
      onPick: () => {},
      onClose,
    })
  }

  if (kind === 'tabs') {
    return openOverlay({
      placeholder: 'Search open tabs',
      rows: await listTabs(),
      onPick: value => {
        void chrome.runtime.sendMessage({ type: 'activateTab', id: Number(value) }).catch(() => {})
      },
      onClose,
    })
  }

  const bookmarksOnly = kind === 'bookmarks'
  const pick = (value: string, shift: boolean) => {
    if (value.startsWith('tab:')) {
      void chrome.runtime
        .sendMessage({ type: 'activateTab', id: Number(value.slice(4)) })
        .catch(() => {})
      return
    }
    const raw = value.startsWith('url:') || value.startsWith('raw:') ? value.slice(4) : value
    const url = clipboardTarget(raw, searchEngine)
    if (url) openTarget(url, shift)
  }

  // What you typed is a row like any other, so Enter always means "take the highlighted
  // row" and never has to guess between navigating and searching. A URL leads, because
  // typing one is unambiguous; a phrase trails the matches it might have been looking for.
  const withRaw = (rows: Row[], query: string): Row[] => {
    const raw = query.trim()
    if (raw === '' || bookmarksOnly) return rows
    if (looksLikeUrl(raw)) return [{ label: raw, sub: 'open', value: `raw:${raw}` }, ...rows]
    return [...rows, { label: `Search for ${raw}`, sub: 'search', value: `raw:${raw}` }]
  }

  const overlay = openOverlay({
    placeholder: bookmarksOnly ? 'Search bookmarks' : 'Open URL, search, or jump to a page',
    rows: [],
    live: true,
    compose: withRaw,
    onInput: query => {
      void suggest(query, bookmarksOnly ? 'bookmark' : undefined).then(rows =>
        overlay.setRows(rows),
      )
    },
    onPick: (value, _query, shift) => pick(value, shift),
    onClose,
  })

  void suggest('', bookmarksOnly ? 'bookmark' : undefined).then(rows => overlay.setRows(rows))
  return overlay
}
