export function runHistory(action: string, count = 1): boolean {
  if (action === 'goBack') history.go(-count)
  else if (action === 'goForward') history.go(count)
  else return false
  return true
}
