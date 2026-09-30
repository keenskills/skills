'use client'
import { useState } from 'react'
import { d, SceneStatus, Typed, type Step } from './scene-parts'
import { useScene } from './use-scene'

// The run, in ms: the command is typed, Chrome opens, the page loads and settles,
// then the beam sweeps y 64 → 284 in 1600 ms, so a defect at y is found at
// BEAM + (y - 64) / 220 * 1600. Each pin sits beside its defect, not on it.
const OPEN = 400
const BEAM = 1600
const found = (y: number) => Math.round(BEAM + ((y - 64) / 220) * 1600)

const MARKS = [
  { x: 259, y: 111, at: found(111) }, // button cut off by the toolbar
  { x: 148, y: 140, at: found(178) }, // broken image
  { x: 348, y: 228, at: found(237) }, // page wider than the viewport
  { x: 276, y: 268, at: found(268) }, // uncaught exception in the console
]

const STATUS: Step[] = [
  { text: 'Opening Chrome', at: OPEN, end: OPEN + 500 },
  { text: 'Waiting for the page to settle', at: OPEN + 600, end: BEAM - 200, live: true },
]

const NOTE = { fontSize: 8, fontFamily: 'var(--font-mono)', fill: 'var(--danger)' }

// Illustration of one page-as-data run: the command, the page loading and
// settling in Chrome, the scan, and each defect drawn as it is found. The
// command and the list are real output, and the labels on the drawing are cut
// from those lines; the drawing is not the fixture itself.
export function PageScan({ command, problems, summary }: { command: string; problems: string[]; summary: string }) {
  const { ref, replay } = useScene<HTMLDivElement>()
  const [hot, setHot] = useState<number | null>(null)
  const over = (i: number) => ({ 'data-hot': hot === i ? '' : undefined, onPointerEnter: () => setHot(i), onPointerLeave: () => setHot(null) })

  const host = command.match(/https?:\/\/([^/\s]+)/)?.[1] ?? 'localhost'
  const shown = problems[0].match(/\((\d+)% visible\)/)?.[1]
  const image = problems[1].split('/').pop() ?? ''
  const wide = problems[2].match(/(\d+)px wide in a (\d+)px/)
  const thrown = problems[3].replace(/^uncaught exception: /, '').split(' | ')[0].slice(0, 30)

  return (
    <div ref={ref} data-hot={hot ?? undefined} className="scene grid items-start gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="relative rounded-2xl bg-code p-4 pb-12 sm:p-6 sm:pb-12">
        <svg viewBox="0 0 360 300" role="img" aria-labelledby="scan-title" className="block h-auto w-full overflow-visible">
          <title id="scan-title">Illustration: page-as-data opens a page in Chrome, waits for it to settle, scans it and marks four problems a screenshot would not explain</title>
          <defs>
            <linearGradient id="scan-beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="0.55" stopColor="var(--accent)" stopOpacity="0.2" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <clipPath id="scan-toolbar">
              <rect x="28" y="96" width="168" height="30" rx="8" />
            </clipPath>
            <pattern id="scan-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2" height="6" fill="var(--danger)" opacity="0.45" />
            </pattern>
          </defs>

          {/* Chrome opens: the window, the address typed in, a load bar and a spinner that ends in a tick. */}
          <g className="sc sc-rise" style={d(OPEN)}>
            <rect x="8" y="8" width="300" height="284" rx="14" fill="var(--surface)" stroke="var(--line-strong)" />
            <path d="M8 40h300" stroke="var(--line-strong)" />
            {[24, 36, 48].map((cx) => (
              <circle key={cx} cx={cx} cy="24" r="3.5" fill="var(--ink-12)" />
            ))}
            <rect x="68" y="16" width="208" height="16" rx="8" fill="var(--code)" />
            <text x="80" y="27.5" fontSize="9.5" fill="var(--muted)" fontFamily="var(--font-mono)">
              {host}
            </text>
          </g>
          <rect className="sc sc-cover" style={{ ...d(OPEN + 100), animationTimingFunction: `steps(${host.length}, end)` }} x="78" y="18" width={host.length * 5.8 + 6} height="12" fill="var(--code)" />
          <rect className="sc sc-load" style={d(OPEN + 100)} x="9" y="39" width="298" height="2" fill="var(--accent)" />
          <circle className="sc sc-spin" style={d(OPEN + 150)} cx="292" cy="24" r="4.5" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="16 12.3" />
          <path className="sc sc-draw" pathLength={1} style={d(BEAM - 100)} d="M288 24.5l3 3 5.5-6.5" fill="none" stroke="var(--ok)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

          {/* The page settles: content arrives a block at a time. */}
          <g className="sc sc-rise" style={d(OPEN + 350)}>
            <rect x="28" y="56" width="132" height="12" rx="6" fill="var(--ink-12)" />
            <rect x="28" y="76" width="196" height="8" rx="4" fill="var(--ink-06)" />
          </g>
          <g className="sc sc-rise" style={d(OPEN + 450)}>
            <rect x="28" y="96" width="168" height="30" rx="8" fill="var(--code)" stroke="var(--line-strong)" />
            <rect x="36" y="103" width="52" height="16" rx="6" fill="var(--ink-12)" />
            <rect x="94" y="103" width="52" height="16" rx="6" fill="var(--ink-12)" />
            <g clipPath="url(#scan-toolbar)">
              <rect x="187" y="103" width="60" height="16" rx="6" fill="var(--text)" />
            </g>
          </g>
          <g className="sc sc-rise" style={d(OPEN + 550)}>
            <rect x="28" y="140" width="120" height="76" rx="8" fill="none" stroke="var(--line-strong)" strokeDasharray="4 4" />
            <rect x="160" y="146" width="128" height="8" rx="4" fill="var(--ink-06)" />
            <rect x="160" y="162" width="100" height="8" rx="4" fill="var(--ink-06)" />
            <rect x="160" y="178" width="116" height="8" rx="4" fill="var(--ink-06)" />
          </g>
          <g className="sc sc-rise" style={d(OPEN + 650)}>
            <rect x="28" y="228" width="320" height="18" rx="6" fill="var(--ink-12)" />
          </g>
          <g className="sc sc-rise" style={d(OPEN + 750)}>
            <rect x="28" y="256" width="260" height="24" rx="6" fill="var(--code)" stroke="var(--line-strong)" />
            <text x="38" y="272" fontSize="10" fill="var(--faint)" fontFamily="var(--font-mono)">
              › console
            </text>
          </g>

          <rect className="sc sc-beam" style={d(BEAM)} x="8" y="44" width="300" height="40" fill="url(#scan-beam)" />

          {/* What the beam finds, drawn where it is: the whole button, the missing file, the overflow, the error. */}
          <rect className="sc sc-draw" pathLength={1} style={d(MARKS[0].at)} x="187" y="103" width="60" height="16" rx="6" fill="none" stroke="var(--danger)" strokeWidth="1.25" />
          {shown && (
            <text className="sc sc-rise" style={d(MARKS[0].at + 60)} x="187" y="136" {...NOTE}>
              {shown}% visible
            </text>
          )}
          <path className="sc sc-draw" pathLength={1} style={d(MARKS[1].at)} d="M80 166l16 16M96 166l-16 16" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
          <text className="sc sc-rise" style={d(MARKS[1].at + 60)} x="88" y="200" textAnchor="middle" {...NOTE}>
            {image}
          </text>
          <rect className="sc sc-pop" style={d(MARKS[2].at)} x="308" y="228" width="40" height="18" fill="url(#scan-hatch)" />
          <path className="sc sc-draw" pathLength={1} style={d(MARKS[2].at)} d="M309 251v4h38v-4" fill="none" stroke="var(--danger)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          {wide && (
            <text className="sc sc-rise" style={d(MARKS[2].at + 60)} x="328" y="267" textAnchor="middle" {...NOTE}>
              +{Number(wide[1]) - Number(wide[2])}px
            </text>
          )}
          <text className="sc sc-rise" style={d(MARKS[3].at)} x="102" y="271.5" {...NOTE} fontSize={8.5}>
            {thrown}
          </text>

          {MARKS.map((m, i) => (
            <g key={i} className="scan-pin" {...over(i)}>
              <circle className="sc sc-ping" style={d(m.at)} cx={m.x} cy={m.y} r="9" fill="none" stroke="var(--danger)" strokeWidth="1.5" />
              <g className="sc sc-pop" style={d(m.at)}>
                <circle cx={m.x} cy={m.y} r="9" fill="var(--danger)" />
                <text x={m.x} y={m.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--surface)">
                  {i + 1}
                </text>
              </g>
            </g>
          ))}
        </svg>
        <SceneStatus steps={STATUS} final="Settled, then read as data" at={BEAM - 100} />
        <button
          type="button"
          onClick={replay}
          aria-label="Replay the page-as-data illustration"
          className="press absolute bottom-3 right-3 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted shadow-[var(--card-shadow)] hover:text-text"
        >
          Replay
        </button>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[12.5px] leading-5 text-muted [overflow-wrap:anywhere]">
          <span className="text-faint">$ </span>
          <Typed text={command} at={0} />
        </p>
        <p className="sc sc-line mt-4 font-mono text-xs uppercase tracking-wide text-muted" style={d(BEAM)}>
          Problems
        </p>
        <ol className="mt-3 grid gap-2.5">
          {problems.map((p, i) => (
            <li key={i} className="scan-row sc sc-line flex gap-3" style={d(MARKS[i].at + 80)} {...over(i)}>
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-danger-soft text-[11px] font-semibold text-danger">{i + 1}</span>
              <span data-scan-line="" className="scan-text min-w-0 font-mono text-[12.5px] leading-5 text-text [overflow-wrap:anywhere]">
                {p}
              </span>
            </li>
          ))}
        </ol>
        <p className="sc sc-pop mt-4 inline-flex rounded-full bg-danger-soft px-3 py-1 text-xs font-medium text-danger" style={d(MARKS[3].at + 300)}>
          {summary}
        </p>
        <p className="mt-3 text-xs text-muted">Illustration. The command and the four lines are real page-as-data output for its bug fixture.</p>
      </div>
    </div>
  )
}
