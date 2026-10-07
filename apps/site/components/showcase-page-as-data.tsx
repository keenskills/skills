'use client'
import { useMemo, useState } from 'react'
import { hangIndent, lineKind, mergeLines, problemLines } from '@/lib/terminal.mjs'
import { Count } from './count'
import { SlidingTabs } from './sliding-tabs'
import { Command, TerminalReplay } from './terminal-replay'

type Read = { command: string; output: string; exit: number; screenshot: { src: string; width: number; height: number } }
export type PadShowcase = { fixture: string; widths: number[]; read: Record<string, Read>; check: { command: string; output: string; exit: number } }

const TONE: Record<string, string> = { error: 'text-danger', warning: 'text-warn-ink', section: 'mt-3 text-muted', title: 'text-muted' }

// Each kind of problem the read lists, counted, in the order it first appears.
const NOUN: Record<string, [string, string]> = {
  'uncaught exception': ['uncaught exception', 'uncaught exceptions'],
  'failed request': ['failed request', 'failed requests'],
  'console.error': ['console error', 'console errors'],
  'broken image': ['broken image', 'broken images'],
  'invalid field': ['invalid field', 'invalid fields'],
  layout: ['layout defect', 'layout defects'],
}
function kinds(problems: string[]) {
  const counts = new Map<string, number>()
  for (const p of problems) {
    const kind = p.split(':')[0].replace(/ \(warning\)$| ".*"$/, '')
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return [...counts].map(([kind, n]) => ({ kind, n, label: (NOUN[kind] ?? [kind, kind])[n === 1 ? 0 : 1] }))
}

const hang = (line: string) => ({ paddingLeft: `${hangIndent(line)}ch`, textIndent: `-${hangIndent(line)}ch` })

// "A screenshot vs the data": the picture page-as-data took of its own bug
// fixture, above what it read from the same page. All of it is committed
// output from scripts/build-showcases.mjs. Both widths are in the HTML: the
// screenshots crossfade in one frame, and only the lines that differ move.
export function ShowcasePageAsData({ data }: { data: PadShowcase }) {
  const [first, second] = data.widths.map(String)
  const [w, setW] = useState(first)
  const [instant, setInstant] = useState(false)
  const r = data.read[w]
  const lines = useMemo(() => mergeLines(data.read[first].output.split('\n'), data.read[second].output.split('\n')), [data, first, second])
  const found = problemLines(r.output)
  const problems = found.length
  const hidden = kinds(found)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6" data-instant={instant ? '' : undefined}>
      <div className="flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">A screenshot vs the data</h2>
          <p className="mt-1 max-w-xl text-sm text-muted text-pretty">
            One page,{' '}
            <a className="text-accent underline underline-offset-2" href={data.fixture}>
              a fixture with one of every bug
            </a>
            . First what a screenshot shows, then what page-as-data read from it.
          </p>
        </div>
        <div className="max-w-full shrink-0">
          <SlidingTabs
            label="Viewport width"
            options={data.widths.map((x) => ({ id: String(x), label: `${x} px` }))}
            value={w}
            onChange={(id, animated) => {
              setInstant(!animated)
              setW(id)
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <figure className="overflow-hidden rounded-2xl border border-border bg-code">
          <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-xs text-muted">
            <span>
              <span className="font-medium text-text">Screenshot</span> at {w} px
            </span>
            <span>The pixels, and nothing behind them</span>
          </figcaption>
          {/* The window sits on a dot grid. The phone page runs off the bottom edge, cut by the frame rather than faded; the desktop one fits whole. */}
          <div className="h-80 overflow-hidden bg-[radial-gradient(var(--ink-12)_1px,transparent_1px)] bg-size-[16px_16px] px-4 pt-6 sm:h-96 sm:px-8 sm:pt-8">
            <div
              className="t-resize mx-auto overflow-hidden rounded-t-xl bg-surface shadow-[0_0_0_1px_var(--line-strong),0_16px_40px_-12px_oklch(0_0_0/0.25)]"
              style={{ width: w === first ? 'min(100%, 260px)' : 'min(100%, 500px)' }}
            >
              <div aria-hidden="true" className="flex h-7 items-center gap-3 border-b border-border px-3">
                <span className="flex shrink-0 gap-1.5">
                  <span className="size-2 rounded-full bg-(--ink-12)" />
                  <span className="size-2 rounded-full bg-(--ink-12)" />
                  <span className="size-2 rounded-full bg-(--ink-12)" />
                </span>
                <span className="min-w-0 flex-1 truncate rounded-md bg-code px-2 py-0.5 text-center font-mono text-[10px] text-muted">localhost:3000</span>
                <span className="w-[42px] shrink-0" />
              </div>
              <div className="relative bg-white">
                {[first, second].map((id) => {
                  const s = data.read[id].screenshot
                  const on = id === w
                  return (
                    <img
                      key={id}
                      src={s.src}
                      width={s.width}
                      height={s.height}
                      alt={`Screenshot of the fixture at ${id} px wide`}
                      aria-hidden={!on}
                      className={`shot block h-auto w-full ${on ? '' : 'absolute left-0 top-0 opacity-0'}`}
                    />
                  )
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border px-4 py-2.5 text-xs">
            <span className="mr-1 text-muted">Not in the pixels</span>
            {hidden.map((h) => (
              <span key={h.kind} className="rounded-full bg-chip px-2.5 py-0.5 text-text">
                <span className="font-semibold text-danger">{h.n}</span> {h.label}
              </span>
            ))}
          </div>
        </figure>
        <figure className="overflow-hidden rounded-2xl border border-border bg-code">
          <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-xs text-muted">
            <span>
              <span className="font-medium text-text">page-as-data read</span> at {w} px
            </span>
            <span className="rounded-full bg-danger-soft px-2.5 py-0.5 font-medium text-danger">
              {instant ? problems : <Count key={problems} value={problems} />} problems · exit {r.exit}
            </span>
          </figcaption>
          <pre tabIndex={0} data-read-output={w} className="max-h-[26rem] overflow-y-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-5 [overflow-wrap:anywhere]">
            <span className="block" style={hang('  ')}>
              <span className="text-faint">$ </span>
              <Command text={r.command} />
            </span>
            {'\n'}
            {lines.map((l, i) => {
              const on = w === first ? l.a : l.b
              return (
                <span key={i} className="read-line" data-off={on ? undefined : ''} aria-hidden={!on}>
                  <span className={`block ${TONE[lineKind(l.text)] ?? 'text-text'}`} style={hang(l.text)}>
                    {l.text || ' '}
                  </span>
                </span>
              )
            })}
          </pre>
        </figure>
      </div>
      <div>
        <h3 className="font-medium">Check it in CI</h3>
        <p className="mt-1 text-sm text-muted">Every page at phone and desktop width. Exit 1 fails the build.</p>
        <div className="mt-3">
          <TerminalReplay command={data.check.command} output={data.check.output} name="check" />
        </div>
      </div>
    </div>
  )
}
