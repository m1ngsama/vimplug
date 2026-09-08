import { defineConfig } from '@playwright/test'

export default defineConfig({
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  projects: [
    // Safari cannot be driven by Playwright, but it is WebKit, and so is this. Engine
    // behaviour that depends on DOM, focus, event order or IME is verified here first.
    { name: 'engine-webkit', testDir: 'test/engine', use: { browserName: 'webkit' } },
    { name: 'engine-chromium', testDir: 'test/engine', use: { browserName: 'chromium' } },
    // Loads the real extension, so it covers the plumbing the injected engine cannot.
    { name: 'extension', testDir: 'test/e2e' },
  ],
})
