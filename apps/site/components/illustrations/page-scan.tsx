'use client'
import type { CSSProperties } from 'react'
import { useScene } from './use-scene'

const d = (ms: number) => ({ ['--d' as string]: `${ms}ms` }) as CSSProperties

// Marker positions on the drawn page, and when the scan beam passes each one:
// the beam starts at 400 ms and sweeps y 64 → 284 in 1600 ms, so t = 400 + (y - 64) / 220 * 1600.
const MARKS = [
  { x: 206, y: 111, at: 750 }, // button cut off by the toolbar
  { x: 88, y: 178, at: 1230 }, // broken image
  { x: 330, y: 237, at: 1660 }, // page wider than the viewport
  { x: 262, y: 268, at: 1880 }, // uncaught exception in the console
]

// Illustration of page-as-data: a page is scanned and four problems are marked.
// The list beside it is real output; the drawing is not the fixture itself.
export function PageScan({ problems, summary }: { problems: string[]; summary: string }) {
  const { ref, replay } = useScene<HTMLDivElement>()
  return (
    <div ref={ref} className="scene grid items-start gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="relative rounded-2xl bg-code p-4 pb-12 sm:p-6 sm:pb-12">
        <svg viewBox="0 0 360 300" role="img" aria-labelledby="scan-title" className="block h-auto w-full overflow-visible">
          <title id="scan-title">Illustration: page-as-data scans a web page and marks four problems a screenshot would not explain</title>
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
          <g className="sc sc-rise">
            <rect x="8" y="8" width="300" height="284" rx="14" fill="var(--surface)" stroke="var(--line-strong)" />
            <path d="M8 40h300" stroke="var(--line-strong)" />
            {[24, 36, 48].map((cx) => (
              <circle key={cx} cx={cx} cy="24" r="3.5" fill="var(--ink-12)" />
            ))}
            <rect x="68" y="16" width="208" height="16" rx="8" fill="var(--code)" />
            <text x="80" y="27.5" fontSize="9.5" fill="var(--muted)" fontFamily="var(--font-mono)">
              localhost:3000/orders
            </text>
            <rect x="28" y="56" width="132" height="12" rx="6" fill="var(--ink-12)" />
            <rect x="28" y="76" width="196" height="8" rx="4" fill="var(--ink-06)" />
            <rect x="28" y="96" width="168" height="30" rx="8" fill="var(--code)" stroke="var(--line-strong)" />
            <rect x="36" y="103" width="52" height="16" rx="6" fill="var(--ink-12)" />
            <rect x="94" y="103" width="52" height="16" rx="6" fill="var(--ink-12)" />
            <g clipPath="url(#scan-toolbar)">
              <rect x="168" y="103" width="60" height="16" rx="6" fill="var(--text)" />
            </g>
            <rect x="28" y="140" width="120" height="76" rx="8" fill="none" stroke="var(--line-strong)" strokeDasharray="4 4" />
            <path d="M80 170l16 16M96 170l-16 16" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" />
            <rect x="160" y="146" width="128" height="8" rx="4" fill="var(--ink-06)" />
            <rect x="160" y="162" width="100" height="8" rx="4" fill="var(--ink-06)" />
            <rect x="160" y="178" width="116" height="8" rx="4" fill="var(--ink-06)" />
            <rect x="28" y="228" width="320" height="18" rx="6" fill="var(--ink-12)" />
            <rect x="308" y="228" width="40" height="18" fill="url(#scan-hatch)" />
            <rect x="28" y="256" width="260" height="24" rx="6" fill="var(--code)" stroke="var(--line-strong)" />
            <text x="38" y="272" fontSize="10" fill="var(--faint)" fontFamily="var(--font-mono)">
              › console
            </text>
          </g>
          <rect className="sc sc-beam" style={d(400)} x="8" y="44" width="300" height="40" fill="url(#scan-beam)" />
          {MARKS.map((m, i) => (
            <g key={i}>
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
        <p className="font-mono text-xs uppercase tracking-wide text-muted">Problems</p>
        <ol className="mt-3 grid gap-2.5">
          {problems.map((p, i) => (
            <li key={i} className="sc sc-rise flex gap-3" style={d(MARKS[i].at + 80)}>
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-danger-soft text-[11px] font-semibold text-danger">{i + 1}</span>
              <span data-scan-line="" className="min-w-0 font-mono text-[12.5px] leading-5 text-text [overflow-wrap:anywhere]">
                {p}
              </span>
            </li>
          ))}
        </ol>
        <p className="sc sc-pop mt-4 inline-flex rounded-full bg-danger-soft px-3 py-1 text-xs font-medium text-danger" style={d(2200)}>
          {summary}
        </p>
        <p className="mt-3 text-xs text-muted">Illustration. The four lines are real page-as-data output for its bug fixture.</p>
      </div>
    </div>
  )
}
