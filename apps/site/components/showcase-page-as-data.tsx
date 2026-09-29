'use client'
import { useState } from 'react'
import { lineKind } from '@/lib/terminal.mjs'
import { SlidingTabs } from './sliding-tabs'
import { TerminalReplay } from './terminal-replay'

type Read = { command: string; output: string; exit: number; screenshot: { src: string; width: number; height: number } }
export type PadShowcase = { fixture: string; widths: number[]; read: Record<string, Read>; check: { command: string; output: string; exit: number } }

const TONE: Record<string, string> = { error: 'text-danger', warning: 'text-warn', section: 'mt-3 text-muted', title: 'text-muted' }

// "A screenshot vs the data": the picture page-as-data took of its own bug
// fixture, next to what it read from the same page. All of it is committed
// output from scripts/build-showcases.mjs.
export function ShowcasePageAsData({ data }: { data: PadShowcase }) {
  const [w, setW] = useState(String(data.widths[0]))
  const r = data.read[w]
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">A screenshot vs the data</h2>
          <p className="mt-1 max-w-xl text-sm text-muted text-pretty">
            One page,{' '}
            <a className="text-accent underline underline-offset-2" href={data.fixture}>
              a fixture with one of every bug
            </a>
            . On the left, what a screenshot shows. On the right, what page-as-data read from it.
          </p>
        </div>
        <SlidingTabs label="Viewport width" options={data.widths.map((x) => ({ id: String(x), label: `${x} px` }))} value={w} onChange={setW} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <figure className="card flex min-w-0 flex-col justify-between gap-3 p-3 lg:h-[42rem]">
          <div className="t-resize mx-auto overflow-hidden rounded-lg border border-border bg-white" style={{ width: w === '390' ? 'min(100%, 280px)' : '100%' }}>
            <img src={r.screenshot.src} width={r.screenshot.width} height={r.screenshot.height} alt={`Screenshot of the fixture at ${w} px wide`} className="block h-auto w-full" />
          </div>
          <figcaption className="text-xs text-muted">A screenshot at {w} px: the pixels, and nothing behind them.</figcaption>
        </figure>
        <figure className="card flex min-w-0 flex-col overflow-hidden lg:h-[42rem]">
          <pre tabIndex={0} data-read-output={w} className="max-h-[36rem] min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px] leading-5 lg:max-h-none">
            <span className="text-faint">$ </span>
            {r.command}
            {'\n\n'}
            {r.output.split('\n').map((l, i) => (
              <span key={i} className={`block ${TONE[lineKind(l)] ?? 'text-text'}`}>
                {l || ' '}
              </span>
            ))}
          </pre>
          <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
            page-as-data read at {w} px · exit {r.exit}
          </figcaption>
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
