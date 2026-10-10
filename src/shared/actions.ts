type ActionScope = 'content' | 'background'

export type ActionGroup = 'Scroll' | 'Navigation' | 'Tabs' | 'Open' | 'Media' | 'Modes'

interface ActionDef {
  id: string
  description: string
  scope: ActionScope
  group: ActionGroup
  defaultKeys: string[]
}

export const ACTIONS: readonly ActionDef[] = [
  { id: 'scrollDown', description: 'Scroll down', group: 'Scroll', scope: 'content', defaultKeys: ['j'] },
  { id: 'scrollUp', description: 'Scroll up', group: 'Scroll', scope: 'content', defaultKeys: ['k'] },
  { id: 'scrollLeft', description: 'Scroll left', group: 'Scroll', scope: 'content', defaultKeys: ['h'] },
  { id: 'scrollRight', description: 'Scroll right', group: 'Scroll', scope: 'content', defaultKeys: ['l'] },
  { id: 'scrollHalfDown', description: 'Scroll half a page down', group: 'Scroll', scope: 'content', defaultKeys: ['d'] },
  { id: 'scrollHalfUp', description: 'Scroll half a page up', group: 'Scroll', scope: 'content', defaultKeys: ['u'] },
  { id: 'scrollPageDown', description: 'Scroll a page down', group: 'Scroll', scope: 'content', defaultKeys: [] },
  { id: 'scrollPageUp', description: 'Scroll a page up', group: 'Scroll', scope: 'content', defaultKeys: [] },
  { id: 'scrollToTop', description: 'Scroll to the top', group: 'Scroll', scope: 'content', defaultKeys: ['gg'] },
  { id: 'scrollToBottom', description: 'Scroll to the bottom', group: 'Scroll', scope: 'content', defaultKeys: ['G'] },
  { id: 'scrollToStart', description: 'Scroll to the left edge', group: 'Scroll', scope: 'content', defaultKeys: ['0'] },
  { id: 'scrollToEnd', description: 'Scroll to the right edge', group: 'Scroll', scope: 'content', defaultKeys: ['$'] },
  { id: 'escape', description: 'Leave the current mode', group: 'Modes', scope: 'content', defaultKeys: ['<Esc>'] },

  { id: 'goBack', description: 'Go back', group: 'Navigation', scope: 'content', defaultKeys: ['H'] },
  { id: 'goForward', description: 'Go forward', group: 'Navigation', scope: 'content', defaultKeys: ['L'] },

  { id: 'prevTab', description: 'Previous tab', group: 'Tabs', scope: 'background', defaultKeys: ['J', 'gT'] },
  { id: 'nextTab', description: 'Next tab', group: 'Tabs', scope: 'background', defaultKeys: ['K', 'gt'] },
  { id: 'reload', description: 'Reload the page', group: 'Tabs', scope: 'background', defaultKeys: ['r'] },
  { id: 'reloadHard', description: 'Reload the page, bypassing the cache', group: 'Tabs', scope: 'background', defaultKeys: ['R'] },
  { id: 'closeTab', description: 'Close the tab', group: 'Tabs', scope: 'background', defaultKeys: ['x'] },
  { id: 'restoreTab', description: 'Reopen the last closed tab', group: 'Tabs', scope: 'background', defaultKeys: ['X'] },
  { id: 'duplicateTab', description: 'Duplicate the tab', group: 'Tabs', scope: 'background', defaultKeys: ['yt'] },
  { id: 'newTab', description: 'Open a new tab', group: 'Tabs', scope: 'background', defaultKeys: ['t'] },

  { id: 'copyUrl', description: 'Copy the page URL', group: 'Open', scope: 'content', defaultKeys: ['yy'] },
  { id: 'copyTitle', description: 'Copy the page title', group: 'Open', scope: 'content', defaultKeys: ['yl'] },
  { id: 'copyMarkdownLink', description: 'Copy the page as a Markdown link', group: 'Open', scope: 'content', defaultKeys: ['ym'] },
  { id: 'openClipboard', description: 'Open the clipboard URL here', group: 'Open', scope: 'content', defaultKeys: ['p'] },
  { id: 'openClipboardNewTab', description: 'Open the clipboard URL in a new tab', group: 'Open', scope: 'content', defaultKeys: ['P'] },

  { id: 'focusInput', description: 'Focus the first text field', group: 'Navigation', scope: 'content', defaultKeys: ['gi'] },
  { id: 'passthrough', description: 'Suspend vimplug until Esc', group: 'Modes', scope: 'content', defaultKeys: ['i'] },

  { id: 'volumeUp', description: 'Raise media volume', group: 'Media', scope: 'content', defaultKeys: ['='] },
  { id: 'volumeDown', description: 'Lower media volume', group: 'Media', scope: 'content', defaultKeys: ['-'] },
  { id: 'toggleMute', description: 'Mute or unmute media', group: 'Media', scope: 'content', defaultKeys: ['m'] },

  { id: 'hint', description: 'Show hints for clickable elements', group: 'Open', scope: 'content', defaultKeys: ['f'] },
  { id: 'hintNewTab', description: 'Show hints, opening links in a new tab', group: 'Open', scope: 'content', defaultKeys: ['F'] },
  { id: 'hintMulti', description: 'Show hints, opening several links in background tabs', group: 'Open', scope: 'content', defaultKeys: ['<A-f>'] },

  { id: 'openPrompt', description: 'Open a URL or search', group: 'Open', scope: 'content', defaultKeys: ['o'] },
  { id: 'openPromptNewTab', description: 'Open a URL or search in a new tab', group: 'Open', scope: 'content', defaultKeys: ['O'] },
  { id: 'editUrl', description: 'Edit the page URL', group: 'Open', scope: 'content', defaultKeys: ['ge'] },
  { id: 'editUrlNewTab', description: 'Edit the page URL and open it in a new tab', group: 'Open', scope: 'content', defaultKeys: ['gE'] },
  { id: 'tabSearch', description: 'Search open tabs', group: 'Tabs', scope: 'content', defaultKeys: ['T'] },
  { id: 'openBookmark', description: 'Search bookmarks', group: 'Open', scope: 'content', defaultKeys: ['b'] },
  { id: 'openBookmarkNewTab', description: 'Search bookmarks, opening in a new tab', group: 'Open', scope: 'content', defaultKeys: ['B'] },
  { id: 'lastTab', description: 'Back to the previous tab', group: 'Tabs', scope: 'background', defaultKeys: ['^'] },
  { id: 'moveTabLeft', description: 'Move the tab left', group: 'Tabs', scope: 'background', defaultKeys: ['<lt>'] },
  { id: 'moveTabRight', description: 'Move the tab right', group: 'Tabs', scope: 'background', defaultKeys: ['>'] },
  { id: 'firstTab', description: 'First tab', group: 'Tabs', scope: 'background', defaultKeys: ['g0'] },
  { id: 'lastTabInWindow', description: 'Last tab', group: 'Tabs', scope: 'background', defaultKeys: ['g$'] },
  { id: 'toggleMuteTab', description: 'Mute or unmute the tab', group: 'Tabs', scope: 'background', defaultKeys: [] },
  { id: 'closeOtherTabs', description: 'Close every other tab', group: 'Tabs', scope: 'background', defaultKeys: [] },
  { id: 'closeTabsLeft', description: 'Close the tabs to the left', group: 'Tabs', scope: 'background', defaultKeys: [] },
  { id: 'closeTabsRight', description: 'Close the tabs to the right', group: 'Tabs', scope: 'background', defaultKeys: [] },
  { id: 'urlUp', description: 'Up one URL level', group: 'Navigation', scope: 'content', defaultKeys: ['gu'] },
  { id: 'urlRoot', description: 'Go to the site root', group: 'Navigation', scope: 'content', defaultKeys: ['gU'] },
  { id: 'pagePrev', description: 'Follow the previous-page link', group: 'Navigation', scope: 'content', defaultKeys: ['[['] },
  { id: 'pageNext', description: 'Follow the next-page link', group: 'Navigation', scope: 'content', defaultKeys: [']]'] },
  { id: 'hintCopyUrl', description: 'Copy a link URL by hint', group: 'Open', scope: 'content', defaultKeys: ['yf'] },
  { id: 'help', description: 'Show keyboard help', group: 'Modes', scope: 'content', defaultKeys: ['?'] },

  { id: 'hintFrame', description: 'Focus an iframe by hint', group: 'Open', scope: 'content', defaultKeys: ['gf'] },

  { id: 'commandPalette', description: 'Run any action by name', group: 'Modes', scope: 'content', defaultKeys: [':'] },
  { id: 'repeatLast', description: 'Repeat the last action', group: 'Modes', scope: 'content', defaultKeys: ['.'] },

  { id: 'find', description: 'Search within the page', group: 'Navigation', scope: 'content', defaultKeys: ['/'] },
  { id: 'findNext', description: 'Next search match', group: 'Navigation', scope: 'content', defaultKeys: ['n'] },
  { id: 'findPrev', description: 'Previous search match', group: 'Navigation', scope: 'content', defaultKeys: ['N'] },
  { id: 'findSelection', description: 'Find the next occurrence of the selection', group: 'Navigation', scope: 'content', defaultKeys: ['*'] },
  { id: 'findSelectionBack', description: 'Find the previous occurrence of the selection', group: 'Navigation', scope: 'content', defaultKeys: ['#'] },

  { id: 'setMark', description: 'Set a mark at this position', group: 'Navigation', scope: 'content', defaultKeys: ['M'] },
  { id: 'jumpMark', description: 'Jump to a mark', group: 'Navigation', scope: 'content', defaultKeys: ['`'] },

  { id: 'visualMode', description: 'Select text with the keyboard', group: 'Modes', scope: 'content', defaultKeys: ['v'] },
]

const IDS = new Set(ACTIONS.map(a => a.id))

export function isActionId(id: string): boolean {
  return IDS.has(id)
}
