const HAS_PROTOCOL = /^[a-z][a-z0-9+.-]*:\/\//i
const BARE_HOST = /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/
const LOCALHOST = /^localhost(:\d+)?([/?#].*)?$/i
// Dev servers are almost never TLS, so loopback keeps http the way the omnibox does.
const LOOPBACK = /^(localhost|127(\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(:\d+)?([/?#].*)?$/i

export function looksLikeUrl(text: string): boolean {
  const t = text.trim()
  return t !== '' && (HAS_PROTOCOL.test(t) || LOOPBACK.test(t) || BARE_HOST.test(t) || LOCALHOST.test(t))
}

export function clipboardTarget(text: string, searchEngine: string): string {
  const t = text.trim()
  if (t.length === 0) return ''
  if (HAS_PROTOCOL.test(t)) return t
  if (LOOPBACK.test(t)) return `http://${t}`
  if (BARE_HOST.test(t) || LOCALHOST.test(t)) return `https://${t}`
  return searchEngine.replace('%s', encodeURIComponent(t))
}

export async function runClipboard(
  action: string,
  searchEngine: string,
  openTarget: (url: string, newTab: boolean) => void,
): Promise<boolean> {
  if (action === 'copyUrl') {
    await navigator.clipboard.writeText(location.href)
    return true
  }
  if (action === 'openClipboard' || action === 'openClipboardNewTab') {
    const url = clipboardTarget(await navigator.clipboard.readText(), searchEngine)
    if (url) openTarget(url, action === 'openClipboardNewTab')
    return true
  }
  return false
}
