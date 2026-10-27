import { test, expect, type Page } from '@playwright/test'
import { loadEngine, serveFixtures } from './harness.ts'

let base: string
let stop: () => Promise<void>

interface FrameQueue {
  step(elapsed: number): void
}

declare global {
  interface Window {
    __scrollFrames: FrameQueue
  }
}

test.beforeAll(async () => {
  ;({ base, stop } = await serveFixtures())
})

test.afterAll(async () => {
  await stop()
})

async function controlled(page: Page, path = '/tall') {
  await loadEngine(page, `${base}${path}`)
  await page.evaluate(() => {
    let next = 0
    let now: number | undefined
    const callbacks = new Map<number, FrameRequestCallback>()
    window.requestAnimationFrame = callback => {
      callbacks.set(++next, callback)
      return next
    }
    window.cancelAnimationFrame = id => { callbacks.delete(id) }
    window.__scrollFrames = {
      step(elapsed) {
        now = (now ?? performance.now()) + elapsed
        for (const id of [...callbacks.keys()]) {
          const callback = callbacks.get(id)
          callbacks.delete(id)
          callback?.(now)
        }
      },
    }
  })
}

async function frames(page: Page, count = 1, elapsed = 1000 / 60) {
  return page.evaluate(({ count, elapsed }) => {
    for (let i = 0; i < count; i++) window.__scrollFrames.step(elapsed)
    return document.getElementById('pane')?.scrollTop ?? window.scrollY
  }, { count, elapsed })
}

for (const path of ['/tall', '/pane']) {
  for (const key of ['j', 'k']) {
    test(`${key} in ${path} resumes with one step after late callbacks`, async ({ page }) => {
      await controlled(page, path)
      if (key === 'k') {
        await page.evaluate(() => {
          const pane = document.getElementById('pane')
          if (pane) pane.scrollTop = 2500
          else window.scrollTo(0, 2500)
        })
      }
      await page.keyboard.down(key)
      let before = await frames(page, 90)
      const normal = await frames(page)
      const step = Math.abs(normal - before)
      expect(step).toBeGreaterThan(0)
      before = normal
      for (const elapsed of [33, 53, 235]) {
        const after = await frames(page, 1, elapsed)
        const delta = after - before
        expect(Math.sign(delta)).toBe(key === 'j' ? 1 : -1)
        expect(Math.abs(delta)).toBeGreaterThanOrEqual(step - 2)
        expect(Math.abs(delta)).toBeLessThanOrEqual(step + 2)
        before = after
      }
      const resumed = await frames(page)
      expect(Math.sign(resumed - before)).toBe(key === 'j' ? 1 : -1)
      expect(Math.abs(resumed - before)).toBeGreaterThanOrEqual(step - 2)
      expect(Math.abs(resumed - before)).toBeLessThanOrEqual(step + 2)
      await page.keyboard.up(key)
      expect(await frames(page, 1, 235)).toBe(resumed)
      expect(await frames(page, 10)).toBe(resumed)
      if (path === '/pane') expect(await page.evaluate(() => window.scrollY)).toBe(0)
    })
  }
}

for (const count of [1, 5]) {
  test(`a released ${count}-step motion retains its target across a late callback`, async ({ page }) => {
    await controlled(page)
    if (count > 1) await page.keyboard.press(String(count))
    await page.keyboard.press('j')
    await frames(page, 1, 53)
    expect(await frames(page, 60)).toBe(count * 60)
    expect(await frames(page, 1, 235)).toBe(count * 60)
  })
}

for (const boundary of ['blur', 'hidden', 'insert', 'hint']) {
  test(`${boundary} ends a cruising hold before a late callback`, async ({ page }) => {
    await controlled(page)
    await page.keyboard.down('j')
    const before = await frames(page, 90)
    if (boundary === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    else if (boundary === 'hidden') await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    else if (boundary === 'insert') await page.keyboard.press('i')
    else {
      await page.evaluate(() => {
        const button = document.createElement('button')
        button.textContent = 'Target'
        button.style.cssText = 'position:fixed;top:100px;left:100px'
        document.body.appendChild(button)
      })
      await page.keyboard.press('f')
      expect(await page.evaluate(() => document.body.lastElementChild instanceof HTMLElement &&
        document.body.lastElementChild.style.zIndex === '2147483647')).toBe(true)
    }
    expect(await frames(page, 1, 235)).toBe(before)
    expect(await frames(page, 10)).toBe(before)
    await page.keyboard.up('j')
  })
}
