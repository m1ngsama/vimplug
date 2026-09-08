// Hand-written subset of the extension API. @types/chrome is a large surface we use
// almost none of; extend this as new calls are needed.
declare namespace chrome {
  namespace storage {
    interface StorageArea {
      get(keys: string | string[]): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
    }
    const local: StorageArea
    const onChanged: { addListener(cb: () => void): void }
  }

  namespace tabs {
    interface Tab {
      id?: number
      index: number
      windowId: number
      title?: string
      url?: string
      active: boolean
    }
    function query(info: {
      windowId?: number
      currentWindow?: boolean
      active?: boolean
    }): Promise<Tab[]>
    function update(tabId: number, props: { active?: boolean; url?: string }): Promise<Tab>
    function create(props: { url?: string; active?: boolean; windowId?: number }): Promise<Tab>
    function remove(tabId: number): Promise<void>
    function duplicate(tabId: number): Promise<Tab | undefined>
    function reload(tabId: number): Promise<void>
    function move(tabId: number, props: { index: number }): Promise<Tab | Tab[]>
    function get(tabId: number): Promise<Tab>
    const onActivated: { addListener(cb: (info: { tabId: number }) => void): void }
    const onUpdated: {
      addListener(cb: (tabId: number, change: { status?: string }, tab: Tab) => void): void
    }
  }

  namespace action {
    const onClicked: { addListener(cb: (tab: tabs.Tab) => void): void }
    function setBadgeText(details: { tabId?: number; text: string }): Promise<void>
    function setBadgeBackgroundColor(details: { color: string }): Promise<void>
  }

  namespace history {
    interface HistoryItem {
      url?: string
      title?: string
      visitCount?: number
    }
    function search(query: {
      text: string
      maxResults?: number
      startTime?: number
    }): Promise<HistoryItem[]>
  }

  namespace bookmarks {
    interface BookmarkTreeNode {
      id: string
      title: string
      url?: string
    }
    function search(query: { query: string } | string): Promise<BookmarkTreeNode[]>
  }

  namespace windows {
    function create(props: { url?: string }): Promise<unknown>
  }

  namespace sessions {
    function restore(sessionId?: string): Promise<unknown>
  }

  interface MessageSender {
    tab?: tabs.Tab
  }

  namespace runtime {
    function sendMessage(message: unknown): Promise<unknown>
    function getURL(path: string): string
    const onMessage: {
      addListener(
        cb: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void
    }
    const onInstalled: { addListener(cb: () => void): void }
    const onStartup: { addListener(cb: () => void): void }
  }

  namespace scripting {
    interface RegisteredContentScript {
      id: string
      js?: string[]
      matches?: string[]
      excludeMatches?: string[]
      allFrames?: boolean
      runAt?: 'document_start' | 'document_end' | 'document_idle'
      persistAcrossSessions?: boolean
    }
    function registerContentScripts(scripts: RegisteredContentScript[]): Promise<void>
    function unregisterContentScripts(filter: { ids: string[] }): Promise<void>
    function executeScript(injection: {
      target: { tabId: number }
      files: string[]
    }): Promise<unknown>
  }
}
