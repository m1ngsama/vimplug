export function runHistory(action: string): boolean {
  if (action === 'goBack') history.back()
  else if (action === 'goForward') history.forward()
  else return false
  return true
}
