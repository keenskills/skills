'use client'
import { useEffect, useRef, useState } from 'react'
import { hangIndent, replaySchedule } from '@/lib/terminal.mjs'

const TONE: Record<string, string> = {
  error: 'text-danger',
  fail: 'text-danger font-medium',
  warning: 'text-warn',
  'warn-head': 'text-warn font-medium',
  pass: 'text-ok',
  summary: 'text-text font-medium',
  detail: 'text-muted',
  section: 'text-muted',
  title: 'text-text',
  text: 'text-muted',
  blank: '',
}
const SETTLE_MS = 1100

// A command wraps between its words, never inside a flag such as --launch.
export function Command({ text }: { text: string }) {
  return text.split(' ').map((word, i) => (
    <span key={i}>
      {i ? ' ' : ''}
      <span className="whitespace-nowrap">{word}</span>
    </span>
  ))
}

// A replay of a real `check` run: the command, a shimmering "settling" line while
// it "runs", then the real output line by line. Plays once when scrolled into
// view; Replay runs it again. Reduced motion (and the server HTML) show it finished.
export function TerminalReplay({ command, output, name }: { command: string; output: string; name: string }) {
  const plan = replaySchedule(output.split('\n'))
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'idle' | 'settling' | 'printing' | 'done'>('done')
  const [shown, setShown] = useState(plan.length)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const stop = () => timers.current.forEach(clearTimeout)
  const play = () => {
    stop()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('done')
      setShown(plan.length)
      return
    }
    setShown(0)
    setPhase('settling')
    // Chained, each wait under 2 s: page-as-data's settle waits for short timers,
    // so a check of this page reads the finished output.
    timers.current = [
      setTimeout(() => {
        setPhase('printing')
        timers.current = [
          ...plan.map((l, i) => setTimeout(() => setShown(i + 1), l.at)),
          setTimeout(() => setPhase('done'), (plan.at(-1)?.at ?? 0) + 40),
        ]
      }, SETTLE_MS),
    ]
  }

  useEffect(() => {
    const el = box.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setPhase('idle')
    setShown(0)
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        play()
      },
      { rootMargin: '0px 0px -20% 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={box} className="overflow-hidden rounded-2xl border border-border bg-code">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className="font-mono text-xs text-muted">Terminal</span>
        <button type="button" onClick={play} aria-label="Replay the check" className="press rounded-full bg-chip px-3 py-1 text-xs font-medium hover:bg-chip-hover">
          Replay
        </button>
      </div>
      <pre tabIndex={0} data-check-output={name} className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap p-4 font-mono text-[12.5px] leading-6 [overflow-wrap:anywhere]">
        <span className="block pl-[2ch] -indent-[2ch]">
          <span className="text-faint">$ </span>
          <span className="text-text">
            <Command text={command} />
          </span>
        </span>
        {phase === 'settling' ? (
          <span className="t-shimmer" data-text="Settling each page…">
            Settling each page…
          </span>
        ) : null}
        {plan.slice(0, shown).map((l, i) => (
          <span
            key={i}
            data-kind={l.kind}
            className={`block ${TONE[l.kind]} ${phase === 'printing' ? 'term-line' : ''}`}
            style={{ paddingLeft: `${hangIndent(l.text)}ch`, textIndent: `-${hangIndent(l.text)}ch` }}
          >
            {l.text || ' '}
          </span>
        ))}
      </pre>
    </div>
  )
}
