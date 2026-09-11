import { openOverlay, type Overlay, type CloseReason } from './shell.ts'
import { helpRows } from './help.ts'
import { paletteRows } from './palette.ts'
import type { Row } from './filter.ts'
import type { Binding } from '../../shared/matcher.ts'
import type { Tokens } from '../../shared/theme.ts'
import { clipboardTarget, looksLikeUrl } from '../actions/clipboard.ts'
import { openTarget } from '../actions/index.ts'

export type OverlayKind = 'help' | 'open' | 'edit' | 'tabs' | 'palette' | 'find' | 'bookmarks'

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
  onClose: (reason: CloseReason) => void,
  runById: (id: string) => void,
  theme: Tokens,
  onFind?: (query: string) => void,
): Promise<Overlay> {
  if (kind === 'find') {
    return openOverlay({
      placeholder: 'Find in page',
      rows: [],
      onInput: onFind,
      onPick: () => {},
      onSubmit: () => {},
      onClose,
      theme,
    })
  }

  if (kind === 'palette') {
    return openOverlay({
      placeholder: 'Run an action',
      rows: paletteRows(bindings),
      onPick: runById,
      onClose,
      theme,
    })
  }

  if (kind === 'help') {
    return openOverlay({
      placeholder: 'Filter keys',
      rows: helpRows(bindings),
      onPick: () => {},
      onClose,
      theme,
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
      theme,
    })
  }

  const bookmarksOnly = kind === 'bookmarks'
  const initial = kind === 'edit' ? location.href : ''
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

  const withRaw = (rows: Row[], query: string): Row[] => {
    const raw = query.trim()
    if (raw === '' || bookmarksOnly) return rows
    if (looksLikeUrl(raw)) return [{ label: raw, sub: 'open', value: `raw:${raw}` }, ...rows]
    return [...rows, { label: `Search for ${raw}`, sub: 'search', value: `raw:${raw}` }]
  }

  const overlay = openOverlay({
    placeholder: bookmarksOnly ? 'Search bookmarks' : 'Open URL, search, or jump to a page',
    rows: [],
    value: initial,
    live: true,
    compose: withRaw,
    onInput: query => {
      void suggest(query, bookmarksOnly ? 'bookmark' : undefined).then(rows =>
        overlay.setRows(rows),
      )
    },
    onPick: (value, _query, shift) => pick(value, shift),
    onClose,
    theme,
  })

  void suggest(initial, bookmarksOnly ? 'bookmark' : undefined).then(rows => overlay.setRows(rows))
  return overlay
}
