export type ActionScope = 'content' | 'background'

export interface ActionDef {
  id: string
  description: string
  scope: ActionScope
  defaultKeys: string[]
}

export const ACTIONS: readonly ActionDef[] = [
  { id: 'scrollDown', description: 'Scroll down', scope: 'content', defaultKeys: ['j'] },
  { id: 'scrollUp', description: 'Scroll up', scope: 'content', defaultKeys: ['k'] },
  { id: 'scrollLeft', description: 'Scroll left', scope: 'content', defaultKeys: ['h'] },
  { id: 'scrollRight', description: 'Scroll right', scope: 'content', defaultKeys: ['l'] },
  { id: 'scrollHalfDown', description: 'Scroll half a page down', scope: 'content', defaultKeys: ['d'] },
  { id: 'scrollHalfUp', description: 'Scroll half a page up', scope: 'content', defaultKeys: ['u'] },
  { id: 'escape', description: 'Leave the current mode', scope: 'content', defaultKeys: ['<Esc>'] },

  { id: 'goBack', description: 'Go back', scope: 'content', defaultKeys: ['H'] },
  { id: 'goForward', description: 'Go forward', scope: 'content', defaultKeys: ['L'] },

  { id: 'prevTab', description: 'Previous tab', scope: 'background', defaultKeys: ['J'] },
  { id: 'nextTab', description: 'Next tab', scope: 'background', defaultKeys: ['K'] },
  { id: 'reload', description: 'Reload the page', scope: 'background', defaultKeys: ['r'] },
  { id: 'closeTab', description: 'Close the tab', scope: 'background', defaultKeys: ['x'] },
  { id: 'restoreTab', description: 'Reopen the last closed tab', scope: 'background', defaultKeys: ['X'] },
  { id: 'duplicateTab', description: 'Duplicate the tab', scope: 'background', defaultKeys: ['yt'] },
  { id: 'newTab', description: 'Open a new tab', scope: 'background', defaultKeys: ['t'] },

  { id: 'copyUrl', description: 'Copy the page URL', scope: 'content', defaultKeys: ['yy'] },
  { id: 'openClipboard', description: 'Open the clipboard URL here', scope: 'content', defaultKeys: ['p'] },
  { id: 'openClipboardNewTab', description: 'Open the clipboard URL in a new tab', scope: 'content', defaultKeys: ['P'] },
]

const IDS = new Set(ACTIONS.map(a => a.id))

export function isActionId(id: string): boolean {
  return IDS.has(id)
}
