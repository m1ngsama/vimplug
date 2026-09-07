import { openOverlay, type Overlay } from './shell.ts'
import { helpRows } from './help.ts'
import type { Row } from './filter.ts'
import type { Binding } from '../../shared/matcher.ts'
import { clipboardTarget } from '../actions/clipboard.ts'
import { openTarget } from '../actions/index.ts'

export type OverlayKind = 'help' | 'open' | 'tabs'

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
): Promise<Overlay> {
  if (kind === 'help') {
    return openOverlay({
      placeholder: 'Filter keys',
      rows: helpRows(bindings),
      freeText: false,
      onPick: () => {},
      onClose,
    })
  }

  if (kind === 'tabs') {
    return openOverlay({
      placeholder: 'Search open tabs',
      rows: await listTabs(),
      freeText: false,
      onPick: value => {
        void chrome.runtime.sendMessage({ type: 'activateTab', id: Number(value) }).catch(() => {})
      },
      onClose,
    })
  }

  return openOverlay({
    placeholder: 'Open URL or search',
    rows: [],
    freeText: true,
    onPick: (value, _query, shift) => {
      const url = clipboardTarget(value, searchEngine)
      if (url) openTarget(url, shift)
    },
    onClose,
  })
}
