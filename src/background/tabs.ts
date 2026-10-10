import { previousTab, reopenClosedTab, updateTabLog } from './tab-log.ts'

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

export function nextZoom(action: string, current: number, count: number): number {
  if (action === 'zoomReset') return 0
  const next = current + (action === 'zoomIn' ? 0.1 : -0.1) * count
  return Math.min(5, Math.max(0.25, Math.round(next * 100) / 100))
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

const CLOSES: Record<string, (index: number, current: number) => boolean> = {
  closeOtherTabs: (i, current) => i !== current,
  closeTabsLeft: (i, current) => i < current,
  closeTabsRight: (i, current) => i > current,
}

export function tabsToClose(action: string, tabs: chrome.tabs.Tab[], current: number): number[] {
  const closes = CLOSES[action]
  if (!closes) return []
  return tabs.filter(t => !t.pinned && closes(t.index, current)).flatMap(t => t.id ?? [])
}

export async function runTabAction(id: string, tab: chrome.tabs.Tab, count = 1): Promise<boolean> {
  const tabId = tab.id
  switch (id) {
    case 'lastTab': {
      const last = await updateTabLog(s => previousTab(s, tabId ?? -1))
      if (last !== undefined) await chrome.tabs.update(last, { active: true }).catch(() => {})
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
    case 'reloadHard':
      if (tabId !== undefined) await chrome.tabs.reload(tabId, { bypassCache: true })
      return true
    case 'toggleMuteTab':
      if (tabId !== undefined) await chrome.tabs.update(tabId, { muted: !tab.mutedInfo?.muted })
      return true
    case 'togglePinTab': {
      if (tabId === undefined) return false
      const pinned = !tab.pinned
      const now = await chrome.tabs.update(tabId, { pinned })
      return now?.pinned === pinned
    }
    case 'zoomIn':
    case 'zoomOut':
    case 'zoomReset': {
      const { getZoom, setZoom } = chrome.tabs
      if (tabId === undefined || !getZoom || !setZoom) return false
      await setZoom(tabId, nextZoom(id, await getZoom(tabId), count))
      return true
    }
    case 'viewSource':
      if (__TARGET__ === 'safari' || !tab.url) return false
      await chrome.tabs.create({
        url: `view-source:${tab.url}`,
        index: tab.index + 1,
        windowId: tab.windowId,
      })
      return true
    case 'moveTabToWindow':
      if (tabId === undefined) return false
      // Safari's windows.create takes no tabId, so the page is reopened rather than moved.
      if (__TARGET__ !== 'safari') await chrome.windows.create({ tabId })
      else if (tab.url) {
        await chrome.windows.create({ url: tab.url })
        await chrome.tabs.remove(tabId)
      } else return false
      return true
    case 'closeOtherTabs':
    case 'closeTabsLeft':
    case 'closeTabsRight': {
      const tabs = await chrome.tabs.query({ windowId: tab.windowId })
      await chrome.tabs.remove(tabsToClose(id, tabs, tab.index))
      return true
    }
    case 'closeTab':
      if (tabId !== undefined) await chrome.tabs.remove(tabId)
      return true
    case 'restoreTab':
      if (chrome.sessions) await chrome.sessions.restore().catch(() => {})
      else await reopenClosedTab(tab)
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
