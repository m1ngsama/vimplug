import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { arch, cpus, platform, release, tmpdir, totalmem } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium, webkit, type Browser, type Page } from '@playwright/test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARTIFACT = join(ROOT, 'dist/safari/content.js')
const QUERY = 'benchmarkneedle'
const PARAGRAPHS = 10_000
const NAV_LINKS = 48
const VIEWPORT = { width: 1280, height: 800 }
const METRICS = ['firstScroll', 'hintHostAttachment', 'findQuery'] as const
type Metric = (typeof METRICS)[number]
const HELD_CASES = [
  { name: 'jIdle', key: 'j', blocked: false },
  { name: 'jBlocked', key: 'j', blocked: true },
  { name: 'kIdle', key: 'k', blocked: false },
  { name: 'kBlocked', key: 'k', blocked: true },
] as const
type HeldCase = (typeof HELD_CASES)[number]
const HELD_TIMING = { warmupMs: 800, sampleMs: 1200, blockMs: 80, blockOffsetsMs: [200, 500, 800], stopTailMs: 500, stableTailMs: 200 }

interface HeldFrame {
  rafTimestampMs: number
  observedAtMs: number
  scrollY: number
  deltaY: number | null
  callbackGapMs: number | null
  rafGapMs: number | null
  stepPxPerMs: number | null
}

interface HeldRecording {
  keys: { type: string; timestampMs: number; observedAtMs: number; trusted: boolean; scrollY: number }[]
  recordingStartedAtMs: number
  sampleStartedAtMs: number
  sampleFinishedAtMs: number
  recordingFinishedAtMs: number
  blocks: { scheduledAtMs: number; startedAtMs: number; finishedAtMs: number }[]
  frames: HeldFrame[]
}

interface Observation {
  latencyMs: number
  eventTimestampMs: number
  eventObservedAtMs: number
  frameObservedAtMs: number
  eventTrusted: boolean
}

declare global {
  interface Window {
    __vimplugBenchmark?: Promise<Observation>
    __vimplugHeld?: {
      keys: HeldRecording['keys']
      onKey: (event: KeyboardEvent) => void
      stop?: () => Promise<HeldRecording>
    }
  }
}

const { values } = parseArgs({
  options: {
    suite: { type: 'string', default: 'latency' },
    engine: { type: 'string', default: 'webkit' },
    samples: { type: 'string', default: '30' },
    warmup: { type: 'string', default: '5' },
    output: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help) {
  console.log('Usage: pnpm benchmark [--suite latency|held] [--engine webkit|chromium] [--samples N>=5] [--warmup N>=1] [--output /tmp/result.json]')
  console.log('Uses existing dist/safari/content.js without rebuilding. JSON defaults to a new OS temporary directory; output must not exist.')
  console.log('latency (default): first scroll, hint host attachment, and find query frame-observed latency.')
  console.log('held: j/k, idle or three 80 ms main-thread blocks ~300 ms apart, after 800 ms cruise warmup; 1200 ms sample and 500 ms keyup tail.')
  console.log('Samples and warmups are fresh pages per metric/case. Held steps, callback gaps and normalized step/time are callback observations, not actual paint or real Safari.')
  process.exit(0)
}

function integer(value: string, name: string, minimum: number): number {
  const n = Number(value)
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(n) || n < minimum)
    throw new Error(`--${name} must be an integer >= ${minimum}`)
  return n
}

const suite = values.suite
if (suite !== 'latency' && suite !== 'held') throw new Error('--suite must be latency or held')
const engine = values.engine
if (engine !== 'webkit' && engine !== 'chromium') throw new Error('--engine must be webkit or chromium')
const samples = integer(values.samples!, 'samples', 5)
const warmup = integer(values.warmup!, 'warmup', 1)
const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex')
const artifact = await readFile(ARTIFACT)
const artifactSha = sha256(artifact)
const { loadEngine } = await import('../test/engine/harness.ts')

function revision() {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trimEnd()
  const status = git('status', '--porcelain=v1', '--untracked-files=normal')
  return { head: git('rev-parse', 'HEAD'), dirty: status !== '', status }
}

const sourceAtStart = revision()
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>vimplug benchmark</title>
<style>
  html { scroll-behavior: auto }
  body { margin: 24px; font: 16px/24px sans-serif; color: #111; background: #fff }
  nav { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px }
  p { margin: 16px 0; max-width: 900px }
</style><body><nav>${Array.from({ length: NAV_LINKS }, (_, i) => `<a href="#article">Navigation ${i + 1}</a>`).join('')}</nav>
<main id="article">${Array.from({ length: PARAGRAPHS }, (_, i) =>
  `<p>Paragraph ${i + 1}. Fixed local text exercises a large document without external resources. ${i === 5000 ? QUERY : 'Ordinary searchable content.'}${i % 20 === 0 ? ` <a href="#article">Reference ${i + 1}</a>` : ''}</p>`,
).join('')}</main></body></html>`

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  res.end(html)
})

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(done => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 0)))
  }))
}

async function freshPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    locale: 'en-US',
    timezoneId: 'UTC',
  })
  page.setDefaultTimeout(10_000)
  return page
}

async function measure(browser: Browser, url: string, metric: Metric): Promise<Observation> {
  const page = await freshPage(browser)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await loadEngine(page, url)
    await settle(page)
    if (metric === 'findQuery') {
      await page.keyboard.press('/')
      await settle(page)
    }
    await page.evaluate(({ metric, query }) => {
      if (document.visibilityState !== 'visible' || window.scrollY !== 0)
        throw new Error('The sample must start visible at scrollY=0')
      const highlights = (CSS as unknown as { highlights?: Map<string, Set<Range>> }).highlights
      if (metric === 'findQuery' && !highlights)
        throw new Error('CSS Custom Highlight API is required for the find metric')
      if (metric === 'findQuery' && !(document.activeElement instanceof HTMLElement &&
          'vimplugUi' in document.activeElement.dataset))
        throw new Error('The blank find panel must have focus')

      const ready = (): boolean => {
        if (metric === 'firstScroll') return window.scrollY > 0
        if (metric === 'hintHostAttachment') {
          const host = document.body.lastElementChild
          return host instanceof HTMLElement && host.style.zIndex === '2147483647' &&
            host.style.position === 'fixed' && host.style.width === '0px' &&
            !('vimplugUi' in host.dataset)
        }
        const current = highlights?.get('vimplug-find-current')
        const range = current?.values().next().value
        if (current?.size !== 1 || !range || range.toString() !== query) return false
        const rect = range.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight
      }
      if (ready()) throw new Error('The response state was already present before input')

      window.__vimplugBenchmark = new Promise<Observation>((resolve, reject) => {
        const type = metric === 'findQuery' ? 'input' : 'keydown'
        let frame = 0
        const cleanup = () => {
          clearTimeout(timeout)
          cancelAnimationFrame(frame)
          window.removeEventListener(type, onEvent, true)
        }
        const timeout = setTimeout(() => {
          cleanup()
          reject(new Error(`Timed out observing ${metric}`))
        }, 10_000)
        const onEvent = (event: Event) => {
          if (event instanceof KeyboardEvent && event.key !== (metric === 'firstScroll' ? 'j' : 'f')) return
          window.removeEventListener(type, onEvent, true)
          const eventObservedAtMs = performance.now()
          const eventTimestampMs = event.timeStamp
          if (!event.isTrusted || eventTimestampMs < 0 || eventTimestampMs > eventObservedAtMs) {
            cleanup()
            reject(new Error('Expected a trusted event with a performance-clock timestamp'))
            return
          }
          const observe = () => {
            if (!ready()) {
              frame = requestAnimationFrame(observe)
              return
            }
            // The rAF timestamp can predate a blocking event handler; sample the clock in the callback.
            const frameObservedAtMs = performance.now()
            cleanup()
            resolve({
              latencyMs: frameObservedAtMs - eventTimestampMs,
              eventTimestampMs,
              eventObservedAtMs,
              frameObservedAtMs,
              eventTrusted: event.isTrusted,
            })
          }
          queueMicrotask(() => { frame = requestAnimationFrame(observe) })
        }
        window.addEventListener(type, onEvent, true)
      })
    }, { metric, query: QUERY })

    if (metric === 'findQuery') await page.keyboard.insertText(QUERY)
    else await page.keyboard.press(metric === 'firstScroll' ? 'j' : 'f')
    const observation = await page.evaluate(() => {
      if (!window.__vimplugBenchmark) throw new Error('Missing page-side observer')
      return window.__vimplugBenchmark
    })
    if (errors.length) throw new Error(errors.join('\n'))
    return observation
  } finally {
    await page.close()
  }
}

async function measureHeld(browser: Browser, url: string, testCase: HeldCase): Promise<HeldRecording> {
  const page = await freshPage(browser)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await loadEngine(page, url)
    await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2))
    await settle(page)
    await page.evaluate(key => {
      if (document.visibilityState !== 'visible') throw new Error('The held sample must be visible')
      const keys: HeldRecording['keys'] = []
      const onKey = (event: KeyboardEvent) => {
        if (event.key === key) keys.push({
          type: event.type, timestampMs: event.timeStamp, observedAtMs: performance.now(),
          trusted: event.isTrusted, scrollY,
        })
      }
      window.addEventListener('keydown', onKey, true)
      window.addEventListener('keyup', onKey, true)
      window.__vimplugHeld = { keys, onKey }
    }, testCase.key)
    await page.keyboard.down(testCase.key)
    // Register after keydown so every Scroller callback runs before its observer, including after a stall.
    await page.evaluate(({ timing, blocked }) => new Promise<void>(done => {
      const observer = window.__vimplugHeld!
      const recordingStartedAtMs = performance.now()
      const recording: HeldRecording = {
        keys: observer.keys, recordingStartedAtMs,
        sampleStartedAtMs: recordingStartedAtMs + timing.warmupMs,
        sampleFinishedAtMs: 0, recordingFinishedAtMs: 0, blocks: [], frames: [],
      }
      let frame = 0
      const observe = (rafTimestampMs: number) => {
        const observedAtMs = performance.now()
        const previous = recording.frames.at(-1)
        const deltaY = previous ? scrollY - previous.scrollY : null
        const callbackGapMs = previous ? observedAtMs - previous.observedAtMs : null
        recording.frames.push({
          rafTimestampMs, observedAtMs, scrollY, deltaY, callbackGapMs,
          rafGapMs: previous ? rafTimestampMs - previous.rafTimestampMs : null,
          stepPxPerMs: callbackGapMs && deltaY !== null ? deltaY / callbackGapMs : null,
        })
        frame = requestAnimationFrame(observe)
      }
      frame = requestAnimationFrame(observe)
      if (blocked) for (const offset of timing.blockOffsetsMs) {
        const scheduledAtMs = recording.sampleStartedAtMs + offset
        setTimeout(() => {
          const startedAtMs = performance.now()
          while (performance.now() - startedAtMs < timing.blockMs) { /* Deliberate main-thread stall. */ }
          recording.blocks.push({ scheduledAtMs, startedAtMs, finishedAtMs: performance.now() })
        }, Math.max(0, scheduledAtMs - performance.now()))
      }
      observer.stop = () => new Promise(resolve => {
        const keyup = observer.keys.find(event => event.type === 'keyup')
        if (!keyup) throw new Error('Missing keyup before stop tail')
        setTimeout(() => {
          cancelAnimationFrame(frame)
          recording.recordingFinishedAtMs = performance.now()
          window.removeEventListener('keydown', observer.onKey, true)
          window.removeEventListener('keyup', observer.onKey, true)
          resolve(recording)
        }, Math.max(0, Math.ceil(keyup.observedAtMs + timing.stopTailMs - performance.now())))
      })
      setTimeout(() => {
        recording.sampleFinishedAtMs = performance.now()
        done()
      }, timing.warmupMs + timing.sampleMs)
    }), { timing: HELD_TIMING, blocked: testCase.blocked })
    await page.keyboard.up(testCase.key)
    const recording = await page.evaluate(() => window.__vimplugHeld!.stop!())
    if (errors.length) throw new Error(errors.join('\n'))
    heldSteps(recording, testCase)
    return recording
  } finally {
    await page.close()
  }
}

function distribution(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return {
    median: sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    max: sorted.at(-1)!,
  }
}

function heldSteps(recording: HeldRecording, testCase: HeldCase) {
  const { keys, frames, blocks, sampleStartedAtMs, sampleFinishedAtMs, recordingFinishedAtMs } = recording
  const [down, up] = keys
  if (keys.length !== 2 || down?.type !== 'keydown' || up?.type !== 'keyup' ||
      keys.some(key => !key.trusted || key.timestampMs < 0 || key.timestampMs > key.observedAtMs) ||
      down.observedAtMs >= sampleStartedAtMs || up.observedAtMs < sampleFinishedAtMs)
    throw new Error(`${testCase.name}: expected one trusted keydown/keyup pair around the sample`)
  if (blocks.length !== (testCase.blocked ? 3 : 0) || blocks.some(block =>
    block.startedAtMs < sampleStartedAtMs || block.finishedAtMs > sampleFinishedAtMs ||
    block.finishedAtMs - block.startedAtMs < HELD_TIMING.blockMs))
    throw new Error(`${testCase.name}: expected all actual 80 ms blocks inside the sample`)
  const steady = frames.filter((frame, index) => index > 0 &&
    frames[index - 1]!.observedAtMs >= sampleStartedAtMs && frame.observedAtMs <= sampleFinishedAtMs)
  const recovery = blocks.map(block => {
    const first = steady.findIndex(frame => frame.observedAtMs >= block.finishedAtMs)
    return first < 0 ? [] : steady.slice(first, first + 2)
  })
  if (recovery.some(frames => frames.length !== 2) || new Set(recovery.flat()).size !== blocks.length * 2)
    throw new Error(`${testCase.name}: missing distinct recovery callbacks`)
  // Chromium may deliver a stale-timestamp callback immediately before the actual catch-up callback.
  const post = recovery.map(frames => frames.reduce((largest, frame) =>
    Math.abs(frame.deltaY!) > Math.abs(largest.deltaY!) ? frame : largest))
  const normal = steady.filter(frame => !recovery.flat().includes(frame) && !blocks.some(block =>
    frame.observedAtMs - frame.callbackGapMs! < block.finishedAtMs && frame.observedAtMs > block.startedAtMs))
  const direction = testCase.key === 'j' ? 1 : -1
  if (normal.length < 20 || !normal.every(frame => frame.callbackGapMs! >= 0) ||
      steady.some(frame => frame.deltaY! * direction < -1) ||
      (distribution(normal.map(frame => frame.deltaY! * direction))?.median ?? 0) <= 0)
    throw new Error(`${testCase.name}: insufficient steady directional movement (${JSON.stringify({
      normalFrames: normal.length,
      callbackGapMs: distribution(normal.map(frame => frame.callbackGapMs!)),
      stepPx: distribution(normal.map(frame => frame.deltaY! * direction)),
      reverseFrames: steady.filter(frame => frame.deltaY! * direction < -1),
      nonpositiveGaps: normal.filter(frame => frame.callbackGapMs! <= 0),
      blocks,
    })})`)
  const tail = frames.filter(frame => frame.observedAtMs >= up.observedAtMs)
  const stable = tail.filter(frame => frame.observedAtMs >= up.observedAtMs + HELD_TIMING.stopTailMs - HELD_TIMING.stableTailMs)
  const stableRangePx = Math.max(...stable.map(frame => frame.scrollY)) - Math.min(...stable.map(frame => frame.scrollY))
  if (stable.length < 5 || stable.at(-1)!.observedAtMs - stable[0]!.observedAtMs < 100 ||
      stableRangePx > 1 || recordingFinishedAtMs < up.observedAtMs + HELD_TIMING.stopTailMs)
    throw new Error(`${testCase.name}: keyup did not produce a stable stop tail`)
  return { normal, post, steady, direction, tailMovementPx: (tail.at(-1)!.scrollY - up.scrollY) * direction, stableRangePx }
}

function summarizeHeld(recordings: HeldRecording[], testCase: HeldCase) {
  const steps = recordings.map(recording => heldSteps(recording, testCase))
  const direction = testCase.key === 'j' ? 1 : -1
  const normal = steps.flatMap(step => step.normal)
  const post = steps.flatMap(step => step.post)
  return {
    samples: recordings.length,
    normalStepPx: distribution(normal.map(frame => frame.deltaY! * direction)),
    postBlockStepPx: distribution(post.map(frame => frame.deltaY! * direction)),
    callbackGapMs: distribution(steps.flatMap(step => step.steady.map(frame => frame.callbackGapMs!))),
    postBlockCallbackGapMs: distribution(post.map(frame => frame.callbackGapMs!)),
    normalStepPxPerMs: distribution(normal.filter(frame => frame.stepPxPerMs !== null).map(frame => frame.stepPxPerMs! * direction)),
    postBlockStepPxPerMs: distribution(post.filter(frame => frame.stepPxPerMs !== null).map(frame => frame.stepPxPerMs! * direction)),
    zeroGapCallbacks: steps.reduce((count, step) => count + step.steady.filter(frame => frame.callbackGapMs === 0).length, 0),
    stopTailMovementPx: distribution(steps.map(step => step.tailMovementPx)),
    stopTailStableRangePx: distribution(steps.map(step => step.stableRangePx)),
    observations: recordings,
  }
}

function summarize(observations: Observation[]) {
  const sorted = observations.map(o => o.latencyMs).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const medianMs = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
  return {
    unit: 'ms',
    samples: observations.length,
    medianMs,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    observations,
  }
}

let browser: Browser | undefined
try {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture server address')
  const url = `http://127.0.0.1:${address.port}/benchmark`
  browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true })
  const observations: Record<Metric, Observation[]> = { firstScroll: [], hintHostAttachment: [], findQuery: [] }
  const heldObservations: Record<string, HeldRecording[]> = Object.fromEntries(HELD_CASES.map(testCase => [testCase.name, []]))
  const startedAt = new Date().toISOString()
  for (let round = 0; round < warmup + samples; round++) {
    if (suite === 'latency') for (const metric of METRICS) {
      const result = await measure(browser, url, metric)
      if (round >= warmup) observations[metric].push(result)
    }
    else for (const testCase of HELD_CASES) {
      const result = await measureHeld(browser, url, testCase)
      if (round >= warmup) heldObservations[testCase.name]!.push(result)
    }
  }
  if (sha256(await readFile(ARTIFACT)) !== artifactSha)
    throw new Error('The build artifact changed during the benchmark; run again without rebuilding')

  const report = {
    schemaVersion: 1,
    suite,
    startedAt,
    finishedAt: new Date().toISOString(),
    measurement: suite === 'held' ? {
      kind: 'automated browser engine measurement with the test harness chrome.* shim',
      clock: 'raw rAF timestamp and performance.now() in an observer registered after awaited keyboard.down; step/time uses callback clock gaps',
      metric: 'held-scroll callback-observed displacement and cadence, not actual paint or pixel presentation',
      limitations: [
        'No actual paint, input-to-photon or real Safari measurement; rAF ordering and cadence affect the observations.',
        'A single trusted keydown is held until keyup, without OS repeat events; the shim does not measure extension plumbing.',
        'Main-thread stalls run from timers after cruise warmup; scheduled and actual block times are recorded.',
        'Each case uses a fresh page and context, starts at document midpoint, and must stop stably after keyup.',
        'Steps are direction-normalized; post-block selects the larger step of the first two callbacks after each block, covering stale-timestamp recovery callbacks.',
        'Callback clock gaps can be zero after a block; raw samples are retained, but undefined step/time rates are excluded from rate summaries.',
        'Compare repeated serial runs on the same machine and engine; pooled frame percentiles are descriptive, not independent trials.',
      ],
      warmupPerCase: warmup,
      samplesPerCase: samples,
      orderPerRound: HELD_CASES.map(testCase => testCase.name),
      timing: HELD_TIMING,
      percentile: 'nearest-rank p95; median averages the two middle values for an even sample count',
    } : {
      kind: 'automated browser engine measurement with the test harness chrome.* shim',
      clock: 'page-side event.timeStamp to performance.now() in the first rAF callback observing the response state',
      metric: 'frame-observed latency; the observed state is eligible for a subsequent rendering opportunity, not proof of pixel presentation',
      limitations: [
        'No hardware input-to-photon or actual paint timing; rAF callback ordering and frame cadence can inflate or quantize results.',
        'Playwright WebKit is not real Safari, and the shim does not measure extension plumbing.',
        'First scroll response only; no held-scroll smoothness, frame pacing, or issue #12 coverage.',
        'Hint host attachment is observable, but its closed shadow tree and rendered labels are not inspected.',
        'Find measures one inserted query after the blank panel settles, not opening the panel or character-by-character typing.',
        'Warmups reuse the browser process, but every metric sample uses a fresh page and browser context; no cross-page engine state is reused.',
        'Compare repeated runs on the same idle machine and engine; small-sample p95 estimates are noisy.',
      ],
      warmupPerMetric: warmup,
      samplesPerMetric: samples,
      orderPerRound: METRICS,
      percentile: 'nearest-rank p95; median averages the two middle values for an even sample count',
      input: { firstScroll: "page.keyboard.press('j')", hintHostAttachment: "page.keyboard.press('f')", findQuery: `page.keyboard.insertText('${QUERY}')` },
      conditions: { firstScroll: 'scrollY > 0', hintHostAttachment: 'fixed zero-width hint host attached as the last body child', findQuery: 'current CSS highlight equals the query and its range is inside the viewport' },
    },
    environment: {
      engine,
      browserVersion: browser.version(),
      headless: true,
      playwrightVersion: JSON.parse(await readFile(join(ROOT, 'node_modules/@playwright/test/package.json'), 'utf8')).version as string,
      node: process.version,
      os: { platform: platform(), release: release(), arch: arch() },
      cpu: { model: cpus()[0]?.model ?? 'unknown', logicalCores: cpus().length },
      memoryBytes: totalmem(),
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      locale: 'en-US',
      timezoneId: 'UTC',
    },
    source: { atStart: sourceAtStart, atEnd: revision() },
    artifact: { path: ARTIFACT, sha256: artifactSha, bytes: artifact.length },
    fixture: {
      paragraphs: PARAGRAPHS,
      links: NAV_LINKS + PARAGRAPHS / 20,
      navigationLinks: NAV_LINKS,
      query: QUERY,
      queryOccurrences: 1,
      queryParagraph: 5001,
      bytes: Buffer.byteLength(html),
      sha256: sha256(html),
      externalResources: 0,
    },
    metrics: suite === 'latency'
      ? Object.fromEntries(METRICS.map(metric => [metric, summarize(observations[metric])]))
      : Object.fromEntries(HELD_CASES.map(testCase => [testCase.name, summarizeHeld(heldObservations[testCase.name]!, testCase)])),
  }
  const output = values.output ? resolve(values.output) : join(await mkdtemp(join(tmpdir(), 'vimplug-benchmark-')), 'result.json')
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  if (suite === 'latency') {
    for (const metric of METRICS) {
      const summary = summarize(observations[metric])
      console.log(`${metric}: median ${summary.medianMs.toFixed(2)} ms, p95 ${summary.p95Ms.toFixed(2)} ms (n=${summary.samples})`)
    }
    console.log(`Frame-observed engine latency, not actual paint or real Safari. JSON: ${output}`)
  } else {
    for (const testCase of HELD_CASES) {
      const summary = summarizeHeld(heldObservations[testCase.name]!, testCase)
      const post = summary.postBlockStepPx
      console.log(`${testCase.name}: normal median ${summary.normalStepPx!.median.toFixed(2)} px; post-block ${post ? `median ${post.median.toFixed(2)}, p95 ${post.p95.toFixed(2)}, max ${post.max.toFixed(2)} px` : 'n/a'}; callback gap p95 ${summary.callbackGapMs!.p95.toFixed(2)} ms (n=${summary.samples})`)
    }
    console.log(`Held-scroll callback observations, not actual paint or real Safari. JSON: ${output}`)
  }
} finally {
  try {
    await browser?.close()
  } finally {
    if (server.listening)
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}
