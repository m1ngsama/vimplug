export type Target = 'chrome' | 'safari'

export function buildManifest(target: Target): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'vimplug',
    version: '0.0.1',
    description: 'Keyboard-driven browser control.',
    permissions: ['scripting', 'storage', 'tabs'],
    host_permissions: ['<all_urls>'],
    background: { service_worker: 'background.js', type: 'module' },
    options_ui: { page: 'options.html', open_in_tab: true },
    ...(target === 'safari'
      ? { browser_specific_settings: { safari: { strict_min_version: '16.4' } } }
      : {}),
  }
}
