import { ACTIONS } from '../../shared/actions.ts'
import type { Options } from '../../shared/config.ts'
import { runScroll } from './scroll.ts'
import { runHistory } from './history.ts'
import { runClipboard } from './clipboard.ts'

const SCOPE = new Map(ACTIONS.map(a => [a.id, a.scope]))

export function openTarget(url: string, newTab: boolean): void {
  if (newTab) void chrome.runtime.sendMessage({ type: 'openUrl', url }).catch(() => {})
  else location.href = url
}

export function runAction(id: string, opts: Options): boolean {
  if (SCOPE.get(id) === 'background') {
    void chrome.runtime.sendMessage({ type: 'runAction', id }).catch(() => {})
    return true
  }
  if (runScroll(id, opts) || runHistory(id)) return true

  if (id === 'copyUrl' || id === 'openClipboard' || id === 'openClipboardNewTab') {
    void runClipboard(id, opts.searchEngine, openTarget)
    return true
  }
  return false
}
