import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

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

const built = 'dist/xcode/Build/Products/Release/vimplug.app'
rmSync('dist/vimplug.app', { force: true, recursive: true })
execFileSync('ditto', [built, 'dist/vimplug.app'])

// xcodebuild registers its product with LaunchServices, so without this every build leaves
// another vimplug in Safari's extension list, indistinguishable from the installed one.
// `-u` exits 1 when the path was never scanned, which is the normal case on a first build.
for (const app of [built, 'dist/vimplug.app']) {
  try {
    execFileSync(LSREGISTER, ['-u', resolve(app)], { stdio: 'ignore' })
  } catch {}
}

console.info(`vimplug.app ${version} at dist/vimplug.app`)
