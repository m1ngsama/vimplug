import { DEFAULT_DSL } from './config.ts'

const KEY = 'dsl'

export async function readDsl(): Promise<string> {
  const got = await chrome.storage.local.get(KEY)
  const stored = got[KEY]
  return typeof stored === 'string' ? stored : DEFAULT_DSL
}

export async function writeDsl(src: string): Promise<void> {
  await chrome.storage.local.set({ [KEY]: src })
}
