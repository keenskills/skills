// A fake terminal for driving the interactive prompts with real key bytes.
import { PassThrough } from 'node:stream'

export const KEY = { up: '\x1b[A', down: '\x1b[B', left: '\x1b[D', right: '\x1b[C', space: ' ', enter: '\r', ctrlC: '\x03', backspace: '\x7f' }

export function fakeTerminal() {
  const input = new PassThrough()
  const output = new PassThrough()
  let text = ''
  output.on('data', (d) => (text += d))
  const plain = () => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
  return {
    input,
    output,
    get text() {
      return text
    },
    plain,
    /** Resolves once `needle` has been printed, so keys reach the prompt that asked. */
    async until(needle, timeoutMs = 2000) {
      const end = Date.now() + timeoutMs
      while (!plain().includes(needle)) {
        if (Date.now() > end) throw new Error(`Timed out waiting for "${needle}". Screen:\n${plain()}`)
        await new Promise((r) => setTimeout(r, 5))
      }
    },
    /** Lets written output reach `text`: a PassThrough delivers it on a later tick. */
    flush: () => new Promise((r) => setImmediate(r)),
    async keys(...sequences) {
      for (const s of sequences) {
        input.write(s)
        await new Promise((r) => setImmediate(r))
      }
    },
  }
}
