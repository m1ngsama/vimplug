import { DEFAULT_DSL } from './config.ts'

const KEY = 'dsl'

export const CONFIG_VERSION = 1

interface Stored {
  version: number
  dsl: string
}

export function migrate(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object' && raw !== null) {
    const dsl = (raw as Partial<Stored>).dsl
    if (typeof dsl === 'string') return dsl
  }
  return DEFAULT_DSL
}

export async function readDsl(): Promise<string> {
  const got = await chrome.storage.local.get(KEY)
  return migrate(got[KEY])
}

export async function writeDsl(dsl: string): Promise<void> {
  await chrome.storage.local.set({ [KEY]: { version: CONFIG_VERSION, dsl } satisfies Stored })
}
