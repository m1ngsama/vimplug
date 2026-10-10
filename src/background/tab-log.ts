type Tab = chrome.tabs.Tab

interface ClosedTab {
  url: string
  index: number
  windowId: number
  incognito: boolean
}

interface State {
  open: Record<number, ClosedTab>
  closed: ClosedTab[]
  recent: number[]
}

export const CLOSED_LIMIT = 25

export function emptyState(): State {
  return { open: {}, closed: [], recent: [] }
}

export function noteOpen(s: State, tab: Tab): void {
  if (tab.id === undefined || !tab.url) return
  s.open[tab.id] = {
    url: tab.url,
    index: tab.index,
    windowId: tab.windowId,
    incognito: tab.incognito,
  }
}

export function noteActive(s: State, tabId: number): void {
  s.recent = [tabId, ...s.recent.filter(id => id !== tabId)]
}

export function previousTab(s: State, current: number): number | undefined {
  return s.recent.find(id => id !== current)
}

export function byRecency(tabs: Tab[], s: State, current: number | undefined): Tab[] {
  const rank = (t: Tab): number => {
    if (t.id === current) return Infinity
    const at = s.recent.indexOf(t.id ?? -1)
    return at === -1 ? s.recent.length : at
  }
  return tabs.toSorted((a, b) => rank(a) - rank(b))
}

export function noteClosed(s: State, tabId: number): void {
  s.recent = s.recent.filter(id => id !== tabId)
  const tab = s.open[tabId]
  if (!tab) return
  delete s.open[tabId]
  s.closed.push(tab)
  if (s.closed.length > CLOSED_LIMIT) s.closed.shift()
}

export function takeClosed(s: State, incognito: boolean): ClosedTab | undefined {
  const i = s.closed.findLastIndex(t => t.incognito === incognito)
  return i === -1 ? undefined : s.closed.splice(i, 1)[0]
}

const KEY = 'tabLog'

let queue: Promise<unknown> = Promise.resolve()

// The worker dies when idle, hence storage; the queue serialises overlapping tab events.
export function updateTabLog<T>(fn: (s: State) => T): Promise<T> {
  const run = queue.then(async () => {
    const got = await chrome.storage.session.get(KEY)
    const s = { ...emptyState(), ...(got[KEY] as State | undefined) }
    const out = fn(s)
    await chrome.storage.session.set({ [KEY]: s })
    return out
  })
  queue = run.catch(() => {})
  return run
}

export async function reopenClosedTab(from: Tab): Promise<void> {
  const tab = await updateTabLog(s => takeClosed(s, from.incognito))
  if (!tab) return
  const { url, index, windowId } = tab
  await chrome.tabs
    .create({ url, index, windowId })
    .catch(() => chrome.tabs.create({ url, windowId: from.windowId }))
}
