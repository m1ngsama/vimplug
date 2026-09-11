import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

// Ad-hoc signed: unsigned, the appex loses its sandbox entitlement and Safari won't load it.
// CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO would strip the sandbox along with get-task-allow.
execFileSync(
  'xcodebuild',
  [
    '-project', 'xcode/vimplug/vimplug.xcodeproj',
    '-scheme', 'vimplug',
    '-configuration', 'Release',
    '-destination', 'platform=macOS',
    '-derivedDataPath', 'dist/xcode',
    '-quiet',
    'CODE_SIGN_IDENTITY=-',
    'CODE_SIGN_STYLE=Manual',
    'DEVELOPMENT_TEAM=',
    'PROVISIONING_PROFILE_SPECIFIER=',
    `MARKETING_VERSION=${version}`,
    'build',
  ],
  { stdio: 'inherit' },
)

const built = 'dist/xcode/Build/Products/Release/vimplug.app'
rmSync('dist/vimplug.app', { force: true, recursive: true })
execFileSync('ditto', [built, 'dist/vimplug.app'])

// Each build otherwise adds a duplicate to Safari's extension list; -u fails on unscanned paths.
for (const app of [built, 'dist/vimplug.app']) {
  try {
    execFileSync(LSREGISTER, ['-u', resolve(app)], { stdio: 'ignore' })
  } catch {}
}

console.info(`vimplug.app ${version} at dist/vimplug.app`)
