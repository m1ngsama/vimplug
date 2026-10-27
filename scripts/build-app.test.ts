import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./build-app.ts', import.meta.url))
const distribution = {
  DEVELOPMENT_TEAM: 'ABCDE12345',
  DEVELOPER_ID_APPLICATION: 'Developer ID Application: Example Company (ABCDE12345)',
  NOTARY_PROFILE: 'release',
}

function build(env: NodeJS.ProcessEnv, check: (result: {
  status: number | null
  calls: Array<{ command: string; args: string[] }>
  app: string | undefined
  zip: boolean
}) => void) {
  const cwd = mkdtempSync(join(tmpdir(), 'vimplug-build-test-'))
  try {
    mkdirSync(join(cwd, 'dist/vimplug.app'), { recursive: true })
    writeFileSync(join(cwd, 'dist/vimplug.app/marker'), 'old app')
    writeFileSync(join(cwd, 'dist/vimplug-safari.zip'), 'old zip')
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ version: '0.0.16' }))
    const hook = join(cwd, 'tools.mjs')
    writeFileSync(hook, `
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
childProcess.execFileSync = (command, args) => {
  appendFileSync('calls.jsonl', JSON.stringify({ command, args }) + '\\n')
  if (command === 'ditto' && args[0] !== '-c') {
    mkdirSync(args[1], { recursive: true })
    writeFileSync(args[1] + '/marker', 'new app')
  }
  const step = command === 'codesign' && args[0] === '--verify'
    ? (args.at(-1) === 'dist/vimplug.app' ? 'verify-output' : 'verify-built')
    : command === 'xcrun' ? args.slice(0, 2).join(' ')
    : command === 'ditto' && args[0] !== '-c' ? 'copy' : command
  if (step === process.env.VIMPLUG_TEST_FAIL) throw new Error('Simulated ' + step + ' failure')
  if (command === 'plutil') return JSON.stringify({ 'com.apple.security.app-sandbox': true })
  if (command === 'xcrun' && args[0] === 'notarytool') return JSON.stringify({ status: 'Accepted' })
  return ''
}
syncBuiltinESMExports()
`)
    const result = spawnSync(process.execPath, ['--import', hook, script], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, DEVELOPMENT_TEAM: '', DEVELOPER_ID_APPLICATION: '', NOTARY_PROFILE: '', VIMPLUG_TEST_FAIL: '', ...env },
    })
    assert.ifError(result.error)
    const log = join(cwd, 'calls.jsonl')
    const marker = join(cwd, 'dist/vimplug.app/marker')
    check({
      status: result.status,
      calls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [],
      app: existsSync(marker) ? readFileSync(marker, 'utf8') : undefined,
      zip: existsSync(join(cwd, 'dist/vimplug-safari.zip')),
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

test('invalid signing settings preserve previous artifacts without running tools', () => {
  build({ NOTARY_PROFILE: 'release' }, result => {
    assert.notEqual(result.status, 0)
    assert.deepEqual(result.calls, [])
    assert.equal(result.app, 'old app')
    assert.equal(result.zip, true)
  })
})

test('default build verifies and copies the app without submitting to Apple', () => {
  build({}, result => {
    assert.equal(result.status, 0)
    assert.equal(result.app, 'new app')
    assert.equal(result.zip, false)
    assert.ok(result.calls[0]!.args.includes('CODE_SIGN_IDENTITY=-'))
    assert.equal(result.calls.some(c => c.command === 'xcrun'), false)
    assert.equal(result.calls.filter(c => c.command === 'codesign').length, 2)
    assert.deepEqual(result.calls.slice(-2).map(c => c.args[0]), ['-u', '-u'])
  })
})

test('the distribution app is copied only after ticket validation and signature verification', () => {
  build(distribution, result => {
    assert.equal(result.status, 0)
    assert.equal(result.app, 'new app')
    assert.equal(result.zip, false)
    const submit = result.calls.findIndex(c => c.command === 'xcrun' && c.args[0] === 'notarytool')
    const validate = result.calls.findIndex(c => c.command === 'xcrun' && c.args[1] === 'validate')
    const copy = result.calls.findIndex(c => c.command === 'ditto' && c.args[0] !== '-c')
    assert.ok(submit > 0 && validate > submit && copy > validate)
    assert.deepEqual(result.calls[validate + 1]!.args.slice(0, 3), ['--verify', '--deep', '--strict'])
    assert.deepEqual(result.calls.slice(-2).map(c => c.args[0]), ['-u', '-u'])
  })
})

for (const step of ['xcodebuild', 'verify-built', 'notarytool submit', 'copy', 'verify-output']) {
  test(`a failed ${step} leaves no delivery artifact and unregisters both paths`, () => {
    build({ ...distribution, VIMPLUG_TEST_FAIL: step }, result => {
      assert.notEqual(result.status, 0)
      assert.equal(result.app, undefined)
      assert.equal(result.zip, false)
      assert.deepEqual(result.calls.slice(-2).map(c => c.args[0]), ['-u', '-u'])
    })
  })
}
