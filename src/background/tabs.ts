export function resolveTabTarget(index: number, total: number, dir: 1 | -1, repeat = 1): number {
  if (total <= 0) return 0
  return (((index + dir * repeat) % total) + total) % total
}

async function step(windowId: number, dir: 1 | -1, repeat: number): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId })
  const current = tabs.findIndex(t => t.active)
  if (current === -1) return
  const target = tabs[resolveTabTarget(current, tabs.length, dir, repeat)]
  if (target?.id !== undefined) await chrome.tabs.update(target.id, { active: true })
}

// The tab you were on a moment ago is the one you are most likely to want next, which is
// why every serious tab switcher has a single key for it.
let previousTabId: number | null = null
let currentTabId: number | null = null

export function noteActiveTab(tabId: number): void {
  if (tabId === currentTabId) return
  previousTabId = currentTabId
  currentTabId = tabId
}

export function lastTabId(): number | null {
  return previousTabId
}

async function moveBy(tab: chrome.tabs.Tab, offset: number): Promise<void> {
  if (tab.id === undefined) return
  const tabs = await chrome.tabs.query({ windowId: tab.windowId })
  const index = resolveTabTarget(tab.index, tabs.length, offset > 0 ? 1 : -1, Math.abs(offset))
  await chrome.tabs.move(tab.id, { index })
}

async function jumpToEdge(tab: chrome.tabs.Tab, edge: 'first' | 'last'): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId: tab.windowId })
  const target = edge === 'first' ? tabs[0] : tabs.at(-1)
  if (target?.id !== undefined) await chrome.tabs.update(target.id, { active: true })
}

export async function runTabAction(id: string, tab: chrome.tabs.Tab, count = 1): Promise<boolean> {
  const tabId = tab.id
  switch (id) {
    case 'lastTab': {
      const last = lastTabId()
      if (last !== null) await chrome.tabs.update(last, { active: true }).catch(() => {})
      return true
    }
    case 'moveTabLeft':
      await moveBy(tab, -count)
      return true
    case 'moveTabRight':
      await moveBy(tab, count)
      return true
    case 'firstTab':
      await jumpToEdge(tab, 'first')
      return true
    case 'lastTabInWindow':
      await jumpToEdge(tab, 'last')
      return true
    case 'nextTab':
      await step(tab.windowId, 1, count)
      return true
    case 'prevTab':
      await step(tab.windowId, -1, count)
      return true
    case 'reload':
      if (tabId !== undefined) await chrome.tabs.reload(tabId)
      return true
    case 'closeTab':
      if (tabId !== undefined) await chrome.tabs.remove(tabId)
      return true
    case 'restoreTab':
      await chrome.sessions.restore()
      return true
    case 'duplicateTab':
      if (tabId !== undefined) await chrome.tabs.duplicate(tabId)
      return true
    case 'newTab':
      await chrome.tabs.create({ windowId: tab.windowId })
      return true
    default:
      return false
  }
}
