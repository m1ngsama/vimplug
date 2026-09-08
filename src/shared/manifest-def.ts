export type Target = 'chrome' | 'safari'

export function buildManifest(target: Target, version: string): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'vimplug',
    version,
    description: 'Keyboard-driven browser control.',
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
    // No default_popup: clicking should toggle the site outright, not open a menu.
    action: { default_title: 'Toggle vimplug on this site' },
    permissions: ['scripting', 'storage', 'tabs', 'history', 'bookmarks', 'sessions'],
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
