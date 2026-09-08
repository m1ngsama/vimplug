export type Target = 'chrome' | 'safari'

export function buildManifest(target: Target): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'vimplug',
    version: '0.0.1',
    description: 'Keyboard-driven browser control.',
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
    permissions: ['scripting', 'storage', 'tabs'],
    host_permissions: ['<all_urls>'],
    // Safari rejects `type: module` on service workers and ignores open_in_tab.
    background: { service_worker: 'background.js' },
    options_ui:
      target === 'safari' ? { page: 'options.html' } : { page: 'options.html', open_in_tab: true },
    ...(target === 'safari'
      ? {
          browser_specific_settings: { safari: { strict_min_version: '16.4' } },
          // bootstrap.js reaches the engine through import(), which needs it exposed.
          web_accessible_resources: [{ resources: ['content.js'], matches: ['<all_urls>'] }],
        }
      : {}),
  }
}
