import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type Runner = (command: string, args: string[], input?: string) => string

export const run: Runner = (command, args, input) => execFileSync(command, args, {
  encoding: 'utf8',
  input,
  stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'],
})

export function signingConfig(env: NodeJS.ProcessEnv) {
  const value = (key: string): string => {
    const text = env[key] ?? ''
    if (text && text.trim() !== text) throw new Error(`${key} must not have surrounding whitespace`)
    return text
  }
  const team = value('DEVELOPMENT_TEAM')
  const developerId = value('DEVELOPER_ID_APPLICATION')
  const profile = value('NOTARY_PROFILE')
  if (team && !/^[A-Z0-9]{10}$/.test(team)) throw new Error('DEVELOPMENT_TEAM must be a 10-character team ID')
  if (developerId) {
    const match = /^Developer ID Application: .+ \(([A-Z0-9]{10})\)$/.exec(developerId)
    if (!team || match?.[1] !== team)
      throw new Error('DEVELOPER_ID_APPLICATION must name a Developer ID Application certificate for DEVELOPMENT_TEAM')
  }
  if (profile && !developerId) throw new Error('NOTARY_PROFILE requires DEVELOPER_ID_APPLICATION and DEVELOPMENT_TEAM')
  return {
    developerId,
    profile,
    settings: [
      `CODE_SIGN_IDENTITY=${developerId || (team ? 'Apple Development' : '-')}`,
      'CODE_SIGN_STYLE=Manual',
      `DEVELOPMENT_TEAM=${team}`,
      'PROVISIONING_PROFILE_SPECIFIER=',
      ...(developerId ? [
        'CODE_SIGN_ENTITLEMENTS=$(SRCROOT)/$(TARGET_NAME)/Distribution.entitlements',
        'CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO',
        'ENABLE_HARDENED_RUNTIME=YES',
        'OTHER_CODE_SIGN_FLAGS=--timestamp',
      ] : []),
    ],
  }
}

export function verifyApp(app: string, distribution: boolean, execute: Runner = run): void {
  execute('codesign', ['--verify', '--deep', '--strict', app])
  if (!distribution) return
  for (const bundle of [app, join(app, 'Contents/PlugIns/vimplug Extension.appex')]) {
    const plist = execute('codesign', ['-d', '--entitlements', '-', '--xml', bundle])
    const entitlements = JSON.parse(execute('plutil', ['-convert', 'json', '-o', '-', '-'], plist)) as Record<string, unknown>
    if (entitlements['com.apple.security.app-sandbox'] !== true || 'com.apple.security.get-task-allow' in entitlements)
      throw new Error(`Distribution entitlements must retain sandbox and omit get-task-allow: ${bundle}`)
  }
}

export function notarize(app: string, profile: string, execute: Runner = run): void {
  if (!profile || profile.trim() !== profile) throw new Error('A nonempty NOTARY_PROFILE is required')
  const scratch = mkdtempSync(join(tmpdir(), 'vimplug-notary-'))
  try {
    const archive = join(scratch, 'vimplug.zip')
    execute('ditto', ['-c', '-k', '--keepParent', app, archive])
    const result = JSON.parse(execute('xcrun', [
      'notarytool', 'submit', archive, '--keychain-profile', profile, '--wait', '--output-format', 'json',
    ])) as { status?: string; id?: string } | null
    if (result?.status !== 'Accepted')
      throw new Error(`Notarization did not succeed: ${result?.status ?? 'missing status'} (${result?.id ?? 'no submission ID'})`)
    execute('xcrun', ['stapler', 'staple', app])
    execute('xcrun', ['stapler', 'validate', app])
    verifyApp(app, true, execute)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
