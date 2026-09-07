import { ACTIONS } from '../../shared/actions.ts'
import type { Options } from '../../shared/config.ts'
import { runScroll } from './scroll.ts'
import { runHistory } from './history.ts'

const SCOPE = new Map(ACTIONS.map(a => [a.id, a.scope]))

export function runAction(id: string, opts: Options): boolean {
  if (SCOPE.get(id) === 'background') {
    void chrome.runtime.sendMessage({ type: 'runAction', id }).catch(() => {})
    return true
  }
  return runScroll(id, opts) || runHistory(id)
}
