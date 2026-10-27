// A page CSP with a strict style-src drops injected <style> elements, which leaves our UI unstyled.
// Constructable stylesheets are not subject to it, so they go first.
export function styleShadow(shadow: ShadowRoot, css: string): void {
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    shadow.adoptedStyleSheets = [sheet]
    return
  } catch {
    // No constructable stylesheets here.
  }
  const style = document.createElement('style')
  style.textContent = css
  shadow.append(style)
}
