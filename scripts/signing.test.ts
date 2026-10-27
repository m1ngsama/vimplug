import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { notarize, signingConfig, verifyApp, type Runner } from './signing.ts'

const TEAM = 'ABCDE12345'
const IDENTITY = `Developer ID Application: Example Company (${TEAM})`
const APP = '/tmp/test/vimplug.app'
const SANDBOX = { 'com.apple.security.app-sandbox': true }

function fake(options: { response?: string; fail?: string; entitlements?: object } = {}) {
  const calls: Array<{ command: string; args: string[]; input?: string }> = []
  const execute: Runner = (command, args, input) => {
    calls.push({ command, args, input })
    if (`${command} ${args.slice(0, 2).join(' ')}` === options.fail) throw new Error('Tool failed')
    if (command === 'xcrun' && args[0] === 'notarytool')
      return options.response ?? JSON.stringify({ status: 'Accepted', id: 'submission-id' })
    if (command === 'plutil') return JSON.stringify(options.entitlements ?? SANDBOX)
    return command === 'codesign' && args[0] === '-d' ? '<plist/>' : ''
  }
  return { calls, execute }
}

test('ad-hoc and local Apple Development settings keep the existing defaults', () => {
  for (const env of [{}, { DEVELOPMENT_TEAM: TEAM }]) {
    const config = signingConfig(env)
    assert.deepEqual(config.settings, [
      `CODE_SIGN_IDENTITY=${'DEVELOPMENT_TEAM' in env ? 'Apple Development' : '-'}`,
      'CODE_SIGN_STYLE=Manual',
      `DEVELOPMENT_TEAM=${'DEVELOPMENT_TEAM' in env ? TEAM : ''}`,
      'PROVISIONING_PROFILE_SPECIFIER=',
    ])
    assert.equal(config.profile, '')
    assert.equal(config.developerId, '')
  }
})

test('Developer ID uses explicit target entitlements and secure timestamps', () => {
  const config = signingConfig({ DEVELOPMENT_TEAM: TEAM, DEVELOPER_ID_APPLICATION: IDENTITY })
  assert.equal(config.settings[0], `CODE_SIGN_IDENTITY=${IDENTITY}`)
  assert.ok(config.settings.includes('CODE_SIGN_ENTITLEMENTS=$(SRCROOT)/$(TARGET_NAME)/Distribution.entitlements'))
  assert.ok(config.settings.includes('CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO'))
  assert.ok(config.settings.includes('ENABLE_HARDENED_RUNTIME=YES'))
  assert.ok(config.settings.includes('OTHER_CODE_SIGN_FLAGS=--timestamp'))
  assert.equal(config.profile, '')
  assert.equal(signingConfig({ DEVELOPMENT_TEAM: TEAM, DEVELOPER_ID_APPLICATION: IDENTITY, NOTARY_PROFILE: 'release' }).profile, 'release')
})

for (const env of [
  { DEVELOPER_ID_APPLICATION: IDENTITY },
  { DEVELOPMENT_TEAM: 'bad' },
  { DEVELOPMENT_TEAM: TEAM, DEVELOPER_ID_APPLICATION: 'Apple Development' },
  { DEVELOPMENT_TEAM: TEAM, DEVELOPER_ID_APPLICATION: 'Developer ID Application: Example (ZZZZZ99999)' },
  { NOTARY_PROFILE: 'release' },
  { DEVELOPMENT_TEAM: TEAM, NOTARY_PROFILE: 'release' },
  { DEVELOPMENT_TEAM: ' ' },
  { DEVELOPER_ID_APPLICATION: ' ' },
  { NOTARY_PROFILE: ' ' },
]) {
  test(`invalid signing environment fails before any command: ${JSON.stringify(env)}`, () => {
    assert.throws(() => signingConfig(env))
  })
}

test('empty values do not enable signing or notarization', () => {
  assert.deepEqual(signingConfig({ DEVELOPMENT_TEAM: '', DEVELOPER_ID_APPLICATION: '', NOTARY_PROFILE: '' }), signingConfig({}))
})

test('signature verification checks app and extension entitlements only for distribution', () => {
  const local = fake()
  verifyApp(APP, false, local.execute)
  assert.deepEqual(local.calls, [{ command: 'codesign', args: ['--verify', '--deep', '--strict', APP], input: undefined }])
  const distribution = fake()
  verifyApp(APP, true, distribution.execute)
  assert.deepEqual(distribution.calls.filter(c => c.command === 'codesign' && c.args[0] === '-d').map(c => c.args.at(-1)), [
    APP, `${APP}/Contents/PlugIns/vimplug Extension.appex`,
  ])
  assert.equal(distribution.calls.filter(c => c.command === 'plutil').length, 2)
})

for (const entitlements of [{}, { ...SANDBOX, 'com.apple.security.get-task-allow': true }, { ...SANDBOX, 'com.apple.security.get-task-allow': false }]) {
  test(`unsafe distribution entitlements stop verification: ${JSON.stringify(entitlements)}`, () => {
    const runner = fake({ entitlements })
    assert.throws(() => verifyApp(APP, true, runner.execute), /Distribution entitlements/)
  })
}

test('notarization requires Accepted before stapling and verifies the stapled app', () => {
  const runner = fake()
  notarize(APP, 'release', runner.execute)
  assert.deepEqual(runner.calls.slice(0, 4).map(c => [c.command, ...c.args.slice(0, 2)]), [
    ['ditto', '-c', '-k'], ['xcrun', 'notarytool', 'submit'], ['xcrun', 'stapler', 'staple'], ['xcrun', 'stapler', 'validate'],
  ])
  const submit = runner.calls[1]!.args
  assert.deepEqual(submit.slice(3), ['--keychain-profile', 'release', '--wait', '--output-format', 'json'])
  assert.equal(existsSync(dirname(submit[2]!)), false)
  assert.equal(runner.calls[4]!.command, 'codesign')
})

for (const response of ['invalid JSON', 'null', '{}', '{"status":"Invalid","id":"rejected-id"}', '{"status":"In Progress"}', '{"status":"Unknown"}']) {
  test(`a non-Accepted response stops notarization: ${response}`, () => {
    const runner = fake({ response })
    assert.throws(() => notarize(APP, 'release', runner.execute))
    assert.equal(runner.calls.length, 2)
    assert.equal(existsSync(dirname(runner.calls[1]!.args[2]!)), false)
  })
}

for (const fail of ['ditto -c -k', 'xcrun notarytool submit', 'xcrun stapler staple', 'xcrun stapler validate', 'codesign --verify --deep']) {
  test(`tool failure stops the sequence and removes the upload archive: ${fail}`, () => {
    const runner = fake({ fail })
    assert.throws(() => notarize(APP, 'release', runner.execute), /Tool failed/)
    assert.equal(`${runner.calls.at(-1)!.command} ${runner.calls.at(-1)!.args.slice(0, 2).join(' ')}`, fail)
    assert.equal(existsSync(dirname(runner.calls[0]!.args.at(-1)!)), false)
  })
}

test('an empty notarization profile executes no commands', () => {
  const runner = fake()
  assert.throws(() => notarize(APP, '', runner.execute))
  assert.deepEqual(runner.calls, [])
})
