import { shieldOurFocus } from './focus-shield.ts'

async function boot(): Promise<void> {
  const res = await chrome.runtime
    .sendMessage({ type: 'siteEnabled', host: location.hostname })
    .catch(() => null)
  if ((res as { enabled?: unknown } | null)?.enabled !== true) return
  await import(chrome.runtime.getURL('content.js'))
}

// Before the awaits in boot(), or the page's own focus handlers get there first.
shieldOurFocus()
void boot()
