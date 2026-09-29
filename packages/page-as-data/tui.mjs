/**
 * A small terminal UI for `page-as-data init`, in the style of clack: a rail
 * on the left, ◆ for the question being asked, ◇ for one already answered.
 * Zero dependencies: node:readline keypress events and ANSI escapes.
 *
 * Every prompt takes its streams from createTUI(), so tests drive it with
 * real key bytes through a PassThrough instead of a TTY.
 */
import { emitKeypressEvents } from 'node:readline'

const CANCEL = Symbol('cancel')
export const isCancel = (value) => value === CANCEL

/** NO_COLOR wins, then FORCE_COLOR, then whether the output is a terminal. */
export function colorEnabled(output, env = process.env) {
  if (env.NO_COLOR) return false
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true
  return Boolean(output.isTTY)
}

function palette(on) {
  const wrap = (open, close) => (on ? (s) => `\x1b[${open}m${s}\x1b[${close}m` : (s) => String(s))
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    underline: wrap(4, 24),
    inverse: wrap(7, 27),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    magenta: wrap(35, 39),
    cyan: wrap(36, 39),
    gray: wrap(90, 39),
    pill: on ? (s) => `\x1b[48;5;158m\x1b[30m${s}\x1b[39m\x1b[49m` : (s) => String(s),
    shade: (n) => (on ? (s) => `\x1b[38;5;${n}m${s}\x1b[39m` : (s) => String(s)),
  }
}

// 5×5 block letters, just the ones "PAGE AS DATA" needs.
const FONT = {
  P: ['████ ', '█   █', '████ ', '█    ', '█    '],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  G: [' ████', '█    ', '█  ██', '█   █', ' ████'],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  S: [' ████', '█    ', ' ███ ', '    █', '████ '],
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  ' ': ['  ', '  ', '  ', '  ', '  '],
}

/** The block-letter title, fading down in grey, or null when the terminal is too narrow for it. */
export function banner({ columns, color }) {
  if (!columns || columns < 72) return null
  const c = palette(color)
  const shades = [255, 252, 249, 246, 243]
  return shades
    .map((shade, row) => c.shade(shade)([...'PAGE AS DATA'].map((ch) => FONT[ch][row]).join(' ').trimEnd()))
    .join('\n')
}

export function createTUI({ input = process.stdin, output = process.stdout, color = colorEnabled(output) } = {}) {
  const c = palette(color)
  const write = (s) => output.write(s)
  const bar = c.gray('│')
  const pointer = (on) => (on ? c.cyan('❯') : ' ')
  const tick = (on) => (on ? c.green('●') : c.dim('○'))

  /**
   * Runs one question: draws it, redraws it in place on every key, and on
   * enter collapses it to a single ◇ line. Ctrl-C or Esc cancels.
   */
  function ask({ message, state, body, answer, onKey }) {
    return new Promise((resolve) => {
      let drawn = 0
      const frame = (mode) => {
        if (mode === 'done') return `${bar}\n${c.green('◇')}  ${message} ${c.gray('›')} ${c.dim(answer(state))}`
        if (mode === 'cancel') return `${bar}\n${c.red('■')}  ${message} ${c.gray('›')} ${c.dim('cancelled')}`
        const lines = body(state)
        if (state.error) lines.push(c.yellow(`▲ ${state.error}`))
        return [bar, `${c.cyan('◆')}  ${c.bold(message)}`, ...lines.map((l) => `${c.cyan('│')}  ${l}`), c.cyan('└')].join('\n')
      }
      const draw = (mode) => {
        const text = frame(mode)
        // Back to the first line of the last frame, clear to the end, draw again.
        if (drawn) write(`\x1b[${drawn}A\r\x1b[J`)
        write(`${text}\n`)
        drawn = text.split('\n').length
      }
      const raw = Boolean(input.isTTY && input.setRawMode)
      const finish = (value, mode) => {
        input.off('keypress', onKeypress)
        if (raw) input.setRawMode(false)
        // Paused, not closed: keys typed before the next question are kept for it.
        input.pause()
        draw(mode)
        write('\x1b[?25h')
        resolve(value)
      }
      function onKeypress(str, key = {}) {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(CANCEL, 'cancel')
        state.error = null
        const result = onKey(str, key, state)
        if (result && 'value' in result) return finish(result.value, 'done')
        draw('active')
      }
      emitKeypressEvents(input)
      if (raw) input.setRawMode(true)
      write('\x1b[?25l')
      input.on('keypress', onKeypress)
      input.resume()
      draw('active')
    })
  }

  // A key that types a character, not one that moves or confirms.
  const printable = (str, key) => typeof str === 'string' && str.length === 1 && str >= ' ' && !key.ctrl && !key.meta

  /** Pick any number of options, with search, a Select All row and a description of the highlighted one. */
  function multiselect({ message, options, initial = [], noun = 'options' }) {
    const state = { cursor: 0, query: '', selected: new Set(initial), error: null }
    const visible = () => {
      const q = state.query.toLowerCase()
      return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q))
    }
    return ask({
      message,
      state,
      answer: (s) => options.filter((o) => s.selected.has(o.value)).map((o) => o.label).join(', '),
      body: (s) => {
        const vis = visible()
        const allOn = vis.length > 0 && vis.every((o) => s.selected.has(o.value))
        const lines = [`Search: ${s.query}${c.inverse(' ')}`, c.dim('↑↓ move, space select, enter confirm'), '']
        lines.push(`${pointer(s.cursor === 0)} ${tick(allOn)} ${c.underline('Select All')} ${c.dim(`(${s.selected.size}/${options.length})`)}`)
        lines.push(`  ${c.dim('─'.repeat(28))}`)
        if (!vis.length) lines.push(`  ${c.dim(`No match for "${s.query}"`)}`)
        vis.forEach((o, i) => {
          const here = s.cursor === i + 1
          lines.push(`${pointer(here)} ${tick(s.selected.has(o.value))} ${here ? c.cyan(o.label) : o.label}${o.hint ? `  ${c.dim(o.hint)}` : ''}`)
        })
        const description = s.cursor === 0 ? `Select or clear all ${vis.length} ${noun}.` : (vis[s.cursor - 1]?.description ?? '')
        lines.push('', c.dim('Description'), description)
        return lines
      },
      onKey: (str, key, s) => {
        const vis = visible()
        const rows = vis.length + 1
        if (key.name === 'up') s.cursor = (s.cursor - 1 + rows) % rows
        else if (key.name === 'down') s.cursor = (s.cursor + 1) % rows
        else if (key.name === 'space') {
          if (s.cursor === 0) {
            const allOn = vis.length > 0 && vis.every((o) => s.selected.has(o.value))
            for (const o of vis) allOn ? s.selected.delete(o.value) : s.selected.add(o.value)
          } else {
            const o = vis[s.cursor - 1]
            s.selected.has(o.value) ? s.selected.delete(o.value) : s.selected.add(o.value)
          }
        } else if (key.name === 'return') {
          if (!s.selected.size) s.error = 'Select at least one.'
          else return { value: options.filter((o) => s.selected.has(o.value)).map((o) => o.value) }
        } else if (key.name === 'backspace') {
          s.query = s.query.slice(0, -1)
          s.cursor = 0
        } else if (printable(str, key)) {
          s.query += str
          s.cursor = 0
        }
      },
    })
  }

  /** Pick one option. */
  function select({ message, options, initial = 0 }) {
    const state = { cursor: initial, error: null }
    return ask({
      message,
      state,
      answer: (s) => options[s.cursor].label,
      body: (s) =>
        options.map((o, i) => `${pointer(s.cursor === i)} ${tick(s.cursor === i)} ${s.cursor === i ? c.cyan(o.label) : o.label}${o.hint ? `  ${c.dim(o.hint)}` : ''}`),
      onKey: (str, key, s) => {
        if (key.name === 'up') s.cursor = (s.cursor - 1 + options.length) % options.length
        else if (key.name === 'down') s.cursor = (s.cursor + 1) % options.length
        else if (key.name === 'return') return { value: options[s.cursor].value }
      },
    })
  }

  /** Type a line. An empty enter takes `initial`. */
  function text({ message, initial = '', validate }) {
    const state = { value: '', error: null }
    const result = (s) => s.value || initial
    return ask({
      message,
      state,
      answer: result,
      body: (s) => [`${s.value || c.dim(initial)}${c.inverse(' ')}`],
      onKey: (str, key, s) => {
        if (key.name === 'return') {
          const error = validate?.(result(s))
          if (error) s.error = error
          else return { value: result(s) }
        } else if (key.name === 'backspace') s.value = s.value.slice(0, -1)
        else if (printable(str, key)) s.value += str
      },
    })
  }

  /** Yes or no. */
  function confirm({ message, initial = true }) {
    const state = { value: initial, error: null }
    return ask({
      message,
      state,
      answer: (s) => (s.value ? 'Yes' : 'No'),
      body: (s) => [`${tick(s.value)} ${s.value ? c.cyan('Yes') : 'Yes'} ${c.dim('/')} ${tick(!s.value)} ${s.value ? 'No' : c.cyan('No')}`],
      onKey: (str, key, s) => {
        if (['left', 'right', 'tab'].includes(key.name)) s.value = !s.value
        else if (str === 'y' || str === 'Y') s.value = true
        else if (str === 'n' || str === 'N') s.value = false
        else if (key.name === 'return') return { value: s.value }
      },
    })
  }

  /** A line that animates while work runs; in a non-terminal it prints only the result. */
  function spinner() {
    const frames = ['◒', '◐', '◓', '◑']
    let timer = null
    let message = ''
    return {
      start(msg) {
        message = msg
        if (!output.isTTY) return
        let i = 0
        write(`${bar}\n`)
        timer = setInterval(() => write(`\r\x1b[K${c.magenta(frames[i++ % frames.length])}  ${message}`), 80)
      },
      stop(msg, ok = true) {
        if (timer) {
          clearInterval(timer)
          timer = null
          write('\r\x1b[K\x1b[1A')
        }
        ok ? step(msg) : warn(msg)
      },
    }
  }

  const intro = (title) => write(`${c.gray('┌')}  ${c.pill(` ${title} `)}\n`)
  const step = (msg) => write(`${bar}\n${c.green('◇')}  ${msg}\n`)
  const warn = (msg) => write(`${bar}\n${c.yellow('▲')}  ${msg}\n`)
  const note = (lines) => write(`${lines.map((l) => `${bar}  ${l}`).join('\n')}\n`)
  const outro = (msg) => write(`${bar}\n${c.gray('└')}  ${msg}\n\n`)

  return { c, color, multiselect, select, text, confirm, spinner, intro, step, warn, note, outro, write }
}
