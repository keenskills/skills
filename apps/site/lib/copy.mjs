// Copy that tells the truth: the button says "Copied" only when the text got there.
// Clipboard API first; execCommand for pages or browsers that refuse it.
export async function copyText(text, { clipboard = globalThis.navigator?.clipboard, doc = globalThis.document } = {}) {
  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(text)
      return true
    }
  } catch {}
  try {
    const ta = doc.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    doc.body.appendChild(ta)
    ta.select()
    const ok = doc.execCommand('copy')
    ta.remove()
    return Boolean(ok)
  } catch {
    return false
  }
}
