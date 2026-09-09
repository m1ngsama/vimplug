import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

// Ad-hoc signing rather than CODE_SIGNING_ALLOWED=NO: entitlements are written only when
// something signs, and Safari will not load an extension whose appex lost its sandbox.
// Do not add CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO to drop get-task-allow — it drops the
// whole generated set, sandbox included.
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
    `MARKETING_VERSION=${version}`, // the project file carries a 1.0 placeholder
    'build',
  ],
  { stdio: 'inherit' },
)

rmSync('dist/vimplug.app', { force: true, recursive: true })
execFileSync('ditto', ['dist/xcode/Build/Products/Release/vimplug.app', 'dist/vimplug.app'])

console.info(`vimplug.app ${version} at dist/vimplug.app`)
