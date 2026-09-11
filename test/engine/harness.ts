import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { DEFAULT_DSL } from '../../src/shared/config.ts'

export { serveFixtures } from '../fixtures.ts'

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

// '' is a valid config with no bindings; loadDsl only falls back on a non-string.
function shim(dsl: string): string {
  return `const store = {}
  window.chrome = {
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
      local: {
        get: async (key) => (key in store ? { [key]: store[key] } : {}),
        set: async (items) => { Object.assign(store, items) },
      },
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

// Safari sets keyCode 229 on the keydown after compositionend, and a real IME can't be driven here.
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
