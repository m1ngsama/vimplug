import { readDsl, writeDsl } from '../shared/storage.ts'
import { registrationFor, isDisabled, hostOf, REGISTRATION_ID } from './injection.ts'
import { runTabAction } from './tabs.ts'
import { disabledHosts } from '../shared/config.ts'
import { toggleSite } from '../shared/dsl/edits.ts'

async function sync(): Promise<void> {
  const reg = registrationFor(__TARGET__, disabledHosts(await readDsl()))
  await chrome.scripting.unregisterContentScripts({ ids: [REGISTRATION_ID] }).catch(() => {})
  await chrome.scripting.registerContentScripts([reg])
}

async function offAt(host: string): Promise<boolean> {
  return host !== '' && isDisabled(disabledHosts(await readDsl()), host)
}

async function refreshBadge(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return
  const off = await offAt(hostOf(tab.url))
  await chrome.action.setBadgeText({ tabId: tab.id, text: off ? 'off' : '' })
}

chrome.action.onClicked.addListener(tab => {
  const host = hostOf(tab.url)
  if (host === '') return
  void (async () => {
    const src = await readDsl()
    await writeDsl(toggleSite(src, host, !isDisabled(disabledHosts(src), host)))
    await refreshBadge(tab)
    if (tab.id !== undefined) await chrome.tabs.reload(tab.id)
  })()
})

chrome.tabs.onActivated.addListener(info => {
  void chrome.tabs.get(info.tabId).then(refreshBadge)
})
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (change.status === 'complete') void refreshBadge(tab)
})

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setBadgeBackgroundColor({ color: '#8a6d1f' })
  void sync()
})
chrome.runtime.onStartup.addListener(() => void sync())
chrome.storage.onChanged.addListener(() => void sync())

function messageType(m: unknown): string | null {
  if (typeof m !== 'object' || m === null) return null
  const t = (m as { type?: unknown }).type
  return typeof t === 'string' ? t : null
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const type = messageType(msg)

  if (type === 'listTabs') {
    void chrome.tabs.query({}).then(tabs =>
      reply({
        tabs: tabs.map(t => ({ id: t.id, title: t.title ?? '', url: t.url ?? '' })),
      }),
    )
    return true
  }

  if (type === 'activateTab') {
    const id = Number((msg as { id?: unknown }).id)
    if (Number.isFinite(id)) void chrome.tabs.update(id, { active: true })
    reply({ ok: true })
    return true
  }

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
