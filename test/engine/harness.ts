import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { DEFAULT_DSL } from '../../src/shared/config.ts'

export { serveFixtures } from '../fixtures.ts'

// Playwright cannot load a Safari extension, so the Safari artifact is injected instead
// and the few chrome.* calls it makes are shimmed. Extension plumbing is left to test/e2e.
const ENGINE = readFileSync(resolve('dist/safari/content.js'), 'utf8')

// addInitScript runs before documentElement exists, earlier than document_start.
function atDocumentStart(src: string): string {
  return `(() => {
    const run = () => { ${src} }
    if (document.documentElement) run()
    else new MutationObserver((_, o) => {
      if (document.documentElement) { o.disconnect(); run() }
    }).observe(document, { childList: true })
  })()`
}

// loadDsl only falls back when the reply is not a string, so '' would read as a valid
// config with no bindings at all.
function shim(dsl: string): string {
  return `window.chrome = {
    runtime: {
      getURL: (p) => p,
      sendMessage: async (msg) => {
        ;(window.__vimplugSent ??= []).push(msg)
        if (msg.type === 'getDsl') return { dsl: ${JSON.stringify(dsl)} }
        if (msg.type === 'siteEnabled') return { enabled: true }
        if (msg.type === 'suggest') return { rows: [] }
        if (msg.type === 'listTabs') return { tabs: [] }
        return {}
      },
    },
    storage: {
      local: { get: async () => ({}), set: async () => {} },
      onChanged: { addListener() {} },
    },
  }`
}

export async function loadEngine(page: Page, url: string, dsl = DEFAULT_DSL): Promise<void> {
  await page.addInitScript({ content: shim(dsl) })
  await page.addInitScript({ content: atDocumentStart(ENGINE) })
  await page.goto(url)
  await page.waitForFunction(() => document.documentElement.dataset.vimplug === 'on')
}

export function state(
  page: Page,
): Promise<{ panels: number; scrollY: number; focusInOverlay: boolean }> {
  return page.evaluate(() => ({
    panels: document.querySelectorAll('[data-vimplug-ui]').length,
    scrollY: window.scrollY,
    focusInOverlay:
      document.activeElement instanceof HTMLElement &&
      'vimplugUi' in document.activeElement.dataset,
  }))
}

// keyCode is the part Safari still sets when it fires compositionend before the last
// keydown, and a real IME cannot be driven through Playwright.
export function composingKey(page: Page, key: string, code: string): Promise<void> {
  return page.evaluate(
    ([k, c]) => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: k,
          code: c,
          keyCode: 229,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      )
    },
    [key, code],
  )
}
