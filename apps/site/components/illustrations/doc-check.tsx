'use client'
import { useState } from 'react'
import { d, SceneStatus, Typed, TYPE, type Step } from './scene-parts'
import { useScene } from './use-scene'

type Check = { command: string; output: string; exit: number }

// The run, in ms: the draft is built, checked, fixed one change at a time, checked again.
const CHECK = 1900
const FIX = [2900, 3150, 3400, 3650, 3900]
const RECHECK = 4500
const found = (i: number) => CHECK + 150 + i * 180

// Two pages of the Contoso draft, as Word lays them out, left at x 40 and right at x 264.
const PAGES = [24, 248]
const L = 40
const R = 264
type Bar = [x: number, y: number, w: number]
const HEADINGS: Bar[] = [[L, 44, 50], [L, 96, 40], [L, 148, 78], [R, 44, 96], [R, 96, 92]]
const LINES: Bar[] = [
  [L, 58, 176], [L, 68, 176], [L, 78, 120],
  [L + 12, 110, 150], [L + 12, 120, 130], [L + 12, 130, 110],
  [L, 162, 176],
  [R, 58, 176], [R, 68, 176], [R, 78, 130],
]
// The Current State sentence: the draft says how the facts were collected, the fix states them as of a date.
const PROVENANCE: Bar = [L, 172, 70]
const PROVENANCE_DRAFT = 150
// The bold lead-in paragraph the fix removes, and the table under it that moves up.
const LEAD_Y = 110
const MOVED = 14

// Where check marks each defect, in the order of its findings; pins sit at the top right.
const MARKS = [
  { x: 134, y: 63, w: 14 },
  { x: 40, y: 167, w: 150 },
  { x: 300, y: 63, w: 72 },
  { x: 330, y: 73, w: 8 },
  { x: 262, y: 105, w: 26 },
]

const Tick = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
    <path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function Table({ x, y, rows, title, at }: { x: number; y: number; rows: number[]; title?: boolean; at: number }) {
  let top = y
  const head = title ? [top, (top += 10)] : [top]
  top += 10
  return (
    <g className="sc sc-pop" style={d(at)}>
      {head.map((ty) => (
        <rect key={ty} x={x} y={ty} width="176" height="10" fill="var(--accent)" opacity="0.85" />
      ))}
      {rows.map((h, i) => {
        const ry = top + rows.slice(0, i).reduce((a, b) => a + b, 0)
        return (
          <g key={i}>
            <rect x={x} y={ry} width="176" height={h} fill="none" stroke="var(--line-strong)" />
            <rect x={x + 4} y={ry + 3} width="60" height="4" rx="2" fill="var(--ink-12)" />
            <rect x={x + 92} y={ry + 3} width="70" height="4" rx="2" fill="var(--ink-12)" />
          </g>
        )
      })}
    </g>
  )
}

// Illustration of one run of the design document skill's loop: build, check,
// fix, check clean. The commands, findings and fixes are real output for the
// Contoso draft, each finding cut to its first clause; the pages are a small
// stand-in for that document with its five defects.
export function DocCheck({ draft, findings, fixes, final, files }: { draft: Check; findings: string[]; fixes: string[]; final: Check; files: string[] }) {
  const { ref, replay } = useScene<HTMLDivElement>()
  const [hot, setHot] = useState<number | null>(null)
  const count = draft.output.split('\n').length

  const status: Step[] = [
    { text: 'Building on the client template', at: 0, end: CHECK - 150 },
    { text: 'Checking the draft', at: CHECK - 50, end: FIX[0] - 150, live: true },
    { text: `Applying ${fixes.length} fixes`, at: FIX[0] - 50, end: RECHECK - 150 },
  ]

  return (
    <div ref={ref} className="scene grid items-start gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="relative rounded-2xl bg-code p-4 pb-12 sm:p-6 sm:pb-12">
        <svg viewBox="0 0 480 300" role="img" aria-labelledby="doc-title" className="block h-auto w-full">
          <title id="doc-title">Illustration: the design document skill builds a two-page Word document, checks it, removes an em dash, wording about how facts were collected, AI vocabulary, a semicolon and a bold lead-in, and checks it clean</title>
          {PAGES.map((x, i) => (
            <g key={x} className="sc sc-rise" style={d(i * 120)}>
              <rect x={x} y="14" width="208" height="272" rx="4" fill="var(--surface)" stroke="var(--line-strong)" />
              <rect x={x + 16} y="26" width="70" height="4" rx="2" fill="var(--ink-06)" />
            </g>
          ))}
          {HEADINGS.map(([x, y, w], i) => (
            <rect key={`h${i}`} className="sc sc-rise" style={d(320 + i * 70)} x={x} y={y - 3} width={w} height="6" rx="3" fill="var(--accent)" />
          ))}
          {LINES.map(([x, y, w], i) => (
            <rect key={`l${i}`} className="sc sc-rise" style={d(420 + i * 45)} x={x} y={y - 2} width={w} height="4" rx="2" fill="var(--ink-12)" />
          ))}
          {LINES.slice(3, 6).map(([x, y]) => (
            <circle key={`b${y}`} className="sc sc-rise" style={d(560)} cx={x - 7} cy={y} r="1.75" fill="var(--muted)" />
          ))}
          <g className="sc sc-rise" style={d(900)}>
            <rect className="sc sc-stretch sc-left" style={d(FIX[1], { grow: PROVENANCE_DRAFT / PROVENANCE[2] })} x={PROVENANCE[0]} y={PROVENANCE[1] - 2} width={PROVENANCE[2]} height="4" rx="2" fill="var(--ink-12)" />
          </g>
          <Table x={L} y={188} rows={[10, 10]} at={1000} />
          <Table x={L} y={228} rows={[18]} title at={1080} />

          {/* The bold lead-in: drawn in, held until its fix, then gone; the table under it moves up. */}
          <g className="sc sc-mark" style={d(1150, { dur: FIX[4] - 1150 + 200 })}>
            <rect x={R} y={LEAD_Y - 2.5} width="22" height="5" rx="2.5" fill="var(--text)" />
            <rect x={R + 26} y={LEAD_Y - 2} width="140" height="4" rx="2" fill="var(--ink-12)" />
          </g>
          <g className="sc sc-nudge" style={d(FIX[4] + 100, { tx: 0, ty: MOVED })}>
            <Table x={R} y={LEAD_Y} rows={[18]} at={1200} />
          </g>

          {MARKS.map((m, i) => (
            <g key={i}>
              <rect className="sc sc-mark" style={d(found(i), { dur: FIX[i] - found(i) + 200 })} x={m.x} y={m.y} width={m.w} height="10" rx="2" fill="var(--warn-soft)" stroke="var(--warn)" strokeWidth="1" />
              <circle className="sc sc-ping" style={d(found(i))} cx={m.x + m.w} cy={m.y - 2} r="7" fill="none" stroke="var(--warn)" strokeWidth="1.5" />
              <g className="sc sc-mark" style={d(found(i), { dur: FIX[i] - found(i) + 200 })}>
                <circle cx={m.x + m.w} cy={m.y - 2} r="7" fill="var(--warn)" />
                <text x={m.x + m.w} y={m.y + 1.5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--surface)">
                  {i + 1}
                </text>
              </g>
              <g className="sc sc-flash" style={d(FIX[i] + 100, { dur: 900 })}>
                <circle cx={m.x + m.w} cy={m.y - 2} r="7" fill="var(--ok)" />
                <path d={`M${m.x + m.w - 3} ${m.y - 1.5}l2 2 4-4.5`} fill="none" stroke="var(--surface)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <rect className="draw-ring" data-hot={hot === i ? '' : undefined} x={m.x - 3} y={m.y - 3} width={m.w + 6} height="16" rx="4" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            </g>
          ))}

          {/* Clean: both page outlines answer in green. */}
          {PAGES.map((x) => (
            <rect key={`ok${x}`} className="sc sc-flash" style={d(RECHECK + 150)} x={x} y="14" width="208" height="272" rx="4" fill="none" stroke="var(--ok)" strokeWidth="1.5" />
          ))}
        </svg>
        <ul aria-label="Delivered files" className="mt-3 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={f} className="sc sc-pop rounded-md bg-surface px-2 py-1 font-mono text-[11px] text-muted shadow-[var(--card-shadow)]" style={d(RECHECK + 350 + i * 60)}>
              {f}
            </li>
          ))}
        </ul>
        <SceneStatus steps={status} final="Check clean. Ready for the client." at={RECHECK + 150} />
        <button
          type="button"
          onClick={replay}
          aria-label="Replay the design document illustration"
          className="press absolute bottom-3 right-3 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted shadow-[var(--card-shadow)] hover:text-text"
        >
          Replay
        </button>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[12.5px] leading-5 text-muted [overflow-wrap:anywhere]">
          <span className="text-faint">$ </span>
          <Typed text={draft.command} at={CHECK - draft.command.length * TYPE - 50} />
        </p>
        <ol className="mt-3 grid gap-2.5">
          {findings.map((f, i) => (
            <li key={f} className="sc sc-line flex gap-3" style={d(found(i) + 80)} onPointerEnter={() => setHot(i)} onPointerLeave={() => setHot(null)}>
              <span className="mt-0.5 grid size-5 shrink-0">
                <span className="sc sc-swap-out col-start-1 row-start-1 grid place-items-center rounded-full bg-warn-soft text-[11px] font-semibold text-warn" style={d(FIX[i] + 100)}>
                  {i + 1}
                </span>
                <span className="sc sc-swap-in col-start-1 row-start-1 grid place-items-center rounded-full bg-ok-soft text-ok" style={d(FIX[i] + 100)}>
                  <Tick />
                </span>
              </span>
              <span className="min-w-0 font-mono text-[12.5px] leading-5 [overflow-wrap:anywhere]">
                <span className="block text-text">{f}</span>
                <span className="sc sc-line block text-ok" style={d(FIX[i] + 60)}>
                  {fixes[i]}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="sc sc-pop mt-4 inline-flex rounded-full bg-warn-soft px-3 py-1 text-xs font-medium text-warn" style={d(found(findings.length - 1) + 300)}>
          {count} findings · exit {draft.exit}
        </p>
        <p className="mt-4 font-mono text-[12.5px] leading-5 text-muted [overflow-wrap:anywhere]">
          <span className="sc sc-char text-faint" style={d(RECHECK - final.command.length * TYPE - 50)}>
            ${' '}
          </span>
          <Typed text={final.command} at={RECHECK - final.command.length * TYPE - 50} />
        </p>
        <p className="sc sc-pop mt-3 inline-flex rounded-full bg-ok-soft px-3 py-1 text-xs font-medium text-ok" style={d(RECHECK + 150)}>
          {final.output} · exit {final.exit}
        </p>
        <p className="mt-3 text-xs text-muted">Illustration. The commands, findings, fixes and files are real output for the Contoso draft, each finding cut to its first clause.</p>
      </div>
    </div>
  )
}
