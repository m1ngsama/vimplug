export function resolveTabTarget(index: number, count: number, dir: 1 | -1): number {
  if (count <= 0) return 0
  return (index + dir + count) % count
}

async function step(windowId: number, dir: 1 | -1): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId })
  const current = tabs.findIndex(t => t.active)
  if (current === -1) return
  const target = tabs[resolveTabTarget(current, tabs.length, dir)]
  if (target?.id !== undefined) await chrome.tabs.update(target.id, { active: true })
}

export async function runTabAction(id: string, tab: chrome.tabs.Tab): Promise<boolean> {
  const tabId = tab.id
  switch (id) {
    case 'nextTab':
      await step(tab.windowId, 1)
      return true
    case 'prevTab':
      await step(tab.windowId, -1)
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
