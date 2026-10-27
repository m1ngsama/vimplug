import { expect, type BrowserContext, type Page, type Worker } from '@playwright/test'
import { REGISTRATION_ID, registrationFor } from '../../src/background/injection.ts'
import type { Target } from '../../src/shared/manifest-def.ts'

export async function waitForRegistration(ctx: BrowserContext, target: Target): Promise<void> {
  const worker = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker')
  await expect.poll(
    () => worker.evaluate(id => chrome.scripting.getRegisteredContentScripts({ ids: [id] }), REGISTRATION_ID),
    { message: `${target} content-script registration` },
  ).toMatchObject([registrationFor(target, [])])
}

export function startupErrors(ctx: BrowserContext): string[] {
  const errors: string[] = []
  ctx.on('weberror', error => errors.push(error.error().stack ?? error.error().message))
  ctx.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const watch = (worker: Worker) => worker.on('console', message => {
    if (message.type() === 'error') errors.push(`${worker.url()}: ${message.text()}`)
  })
  ctx.serviceWorkers().forEach(watch)
  ctx.on('serviceworker', watch)
  return errors
}

export async function openEnginePage(
  ctx: BrowserContext,
  url: string,
  errors: string[],
): Promise<Page> {
  const page = await ctx.newPage()
  try {
    await page.goto(url)
    await page.waitForFunction(() => document.documentElement.dataset.vimplug === 'on')
    return page
  } catch (error) {
    const snapshot = async () => ({
      url: page.url(),
      page: await page.evaluate(() => ({
        readyState: document.readyState,
        engine: document.documentElement?.dataset.vimplug,
      })).catch(String),
      workers: await Promise.all(ctx.serviceWorkers().map(async worker => ({
        url: worker.url(),
        state: await worker.evaluate(async () => ({
          registration: await chrome.scripting.getRegisteredContentScripts(),
          storage: await chrome.storage.local.get('dsl'),
        })).catch(String),
      }))),
      errors,
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    const diagnostic = await Promise.race([
      snapshot(),
      new Promise(resolve => { timer = setTimeout(() => resolve('Startup diagnostics timed out'), 1000) }),
    ]).finally(() => clearTimeout(timer))
    console.error('Extension startup failed:', JSON.stringify(diagnostic))
    throw error
  }
}
