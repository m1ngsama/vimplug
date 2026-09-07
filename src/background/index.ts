import { readDsl } from './storage.ts'
import { registrationFor, isDisabled, REGISTRATION_ID } from './injection.ts'
import { runTabAction } from './tabs.ts'
import { disabledHosts } from '../shared/config.ts'

async function sync(): Promise<void> {
  const reg = registrationFor(__TARGET__, disabledHosts(await readDsl()))
  await chrome.scripting.unregisterContentScripts({ ids: [REGISTRATION_ID] }).catch(() => {})
  await chrome.scripting.registerContentScripts([reg])
}

chrome.runtime.onInstalled.addListener(() => void sync())
chrome.runtime.onStartup.addListener(() => void sync())
chrome.storage.onChanged.addListener(() => void sync())

function messageType(m: unknown): string | null {
  if (typeof m !== 'object' || m === null) return null
  const t = (m as { type?: unknown }).type
  return typeof t === 'string' ? t : null
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const type = messageType(msg)

  if (type === 'openUrl') {
    const url = String((msg as { url?: unknown }).url ?? '')
    if (url) void chrome.tabs.create({ url, windowId: sender.tab?.windowId })
    reply({ ok: true })
    return true
  }

  if (type === 'runAction') {
    const id = String((msg as { id?: unknown }).id ?? '')
    const tab = sender.tab
    if (tab) void runTabAction(id, tab).then(ok => reply({ ok }))
    else reply({ ok: false })
    return true
  }

  if (type === 'getDsl') {
    void readDsl().then(dsl => reply({ dsl }))
    return true
  }

  if (type === 'siteEnabled') {
    const host = String((msg as { host?: unknown }).host ?? '')
    void readDsl().then(src => reply({ enabled: !isDisabled(disabledHosts(src), host) }))
    return true
  }

  return false
})
