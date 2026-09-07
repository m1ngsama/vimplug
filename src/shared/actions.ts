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
  { id: 'escape', description: 'Leave the current mode', scope: 'content', defaultKeys: ['<Esc>'] },
]

const IDS = new Set(ACTIONS.map(a => a.id))

export function isActionId(id: string): boolean {
  return IDS.has(id)
}
