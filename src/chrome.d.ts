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

  namespace runtime {
    function sendMessage(message: unknown): Promise<unknown>
    function getURL(path: string): string
    const onMessage: {
      addListener(
        cb: (
          message: unknown,
          sender: unknown,
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
  }
}
