// Safari path. Fail-closed: registers nothing and loads nothing until the background
// confirms this host is enabled.
async function boot(): Promise<void> {
  const res = await chrome.runtime
    .sendMessage({ type: 'siteEnabled', host: location.hostname })
    .catch(() => null)
  if ((res as { enabled?: unknown } | null)?.enabled !== true) return
  await import(chrome.runtime.getURL('content.js'))
}

void boot()
