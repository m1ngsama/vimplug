const KEY = 'findHistory'

export function pushHistory(list: string[], query: string, max = 20): string[] {
  if (query === '') return list
  return [query, ...list.filter(q => q !== query)].slice(0, max)
}

let history: string[] = []

export const findHistory = (): string[] => history

export async function loadFindHistory(): Promise<void> {
  chrome.storage.onChanged.addListener((changes, area) => {
    const next = area === 'local' ? changes[KEY]?.newValue : undefined
    if (Array.isArray(next)) history = next
  })
  const got = await chrome.storage.local.get(KEY)
  if (Array.isArray(got[KEY])) history = got[KEY]
}

export function rememberFind(query: string): void {
  history = pushHistory(history, query)
  if (!chrome.extension?.inIncognitoContext)
    void chrome.storage.local.set({ [KEY]: history }).catch(() => {})
}
