'use client'
import type { CSSProperties } from 'react'
import { useScene } from './use-scene'

const d = (ms: number) => ({ ['--d' as string]: `${ms}ms` }) as CSSProperties

const BOXES = [
  { x: 24, w: 96, label: 'Clients', at: 300 },
  { x: 136, w: 184, label: 'VNet · 10.20.0.0/16', at: 450 },
  { x: 336, w: 120, label: 'Data', at: 600 },
]
const ICONS: [number, number][] = [[58, 100], [58, 180], [170, 100], [242, 100], [170, 180], [242, 180], [382, 90], [382, 150], [382, 210]]
const NAMES = ['Web', 'Mobile', 'Gateway', 'AKS', 'Functions', 'Bus', 'SQL', 'Cosmos', 'Lake']
const EDGES = ['M86 114H170', 'M86 194H170', 'M198 114H242', 'M270 114H320V104H382', 'M270 194H320V164H382', 'M270 194H320V224H382']
const FLAWED = 5 // this icon is drawn 1.55x too big in the draft
const NUDGED = 7 // this label sits on its neighbour's in the draft

// Illustration of the diagram skill's loop: draw, lint flags two faults, fix, render.
// The counts beside it come from the real lint of the Northwind draft.
export function DiagramDraw({ findings, fixes }: { findings: number; fixes: number }) {
  const { ref, replay } = useScene<HTMLDivElement>()
  const steps = [
    { at: 200, text: 'Build the diagram from a Python script', tone: 'text-text' },
    { at: 2200, text: `Lint: ${findings} findings`, tone: 'text-warn' },
    { at: 2900, text: `Fix: ${fixes} changes to the script`, tone: 'text-text' },
    { at: 3400, text: 'Render: A4 PDF, PNG and .drawio · lint clean', tone: 'text-ok' },
  ]
  return (
    <div ref={ref} className="scene grid items-start gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="relative rounded-2xl bg-code p-4 pb-12 sm:p-6 sm:pb-12">
        <svg viewBox="0 0 480 300" role="img" aria-labelledby="draw-title" className="block h-auto w-full">
          <title id="draw-title">Illustration: the diagram skill draws an architecture diagram, lints it, fixes an oversized icon and an overlapping label, and renders it</title>
          <g className="sc sc-rise">
            <rect x="8" y="8" width="464" height="284" rx="10" fill="var(--surface)" stroke="var(--line-strong)" />
            <rect x="24" y="22" width="180" height="10" rx="5" fill="var(--ink-12)" />
            <rect x="404" y="20" width="52" height="14" rx="7" fill="var(--accent-soft)" />
          </g>
          {BOXES.map((b) => (
            <g key={b.label}>
              <rect className="sc sc-draw" pathLength={1} style={d(b.at)} x={b.x} y="52" width={b.w} height="220" rx="10" fill="none" stroke="var(--line-strong)" strokeWidth="1.25" />
              <text className="sc sc-rise" style={d(b.at + 200)} x={b.x + 10} y="68" fontSize="10" fill="var(--muted)">
                {b.label}
              </text>
            </g>
          ))}
          {EDGES.map((e, i) => (
            <path key={e} className="sc sc-draw" pathLength={1} style={d(1300 + i * 80)} d={e} fill="none" stroke="var(--faint)" strokeWidth="1.25" />
          ))}
          {ICONS.map(([x, y], i) => (
            <g key={i} className="sc sc-pop" style={d(900 + i * 60)}>
              <g className={i === FLAWED ? 'sc sc-fix' : undefined} style={i === FLAWED ? d(2900) : undefined}>
                <rect x={x} y={y} width="28" height="28" rx="7" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1" />
                <path d={`M${x + 8} ${y + 11}h12M${x + 8} ${y + 17}h8`} stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              </g>
              <text className={i === NUDGED ? 'sc sc-nudge' : undefined} style={i === NUDGED ? d(2900) : undefined} x={x + 14} y={y + 42} textAnchor="middle" fontSize="9" fill="var(--muted)">
                {NAMES[i]}
              </text>
            </g>
          ))}
          <path className="sc sc-flow" pathLength={1} style={d(3400)} d="M86 114H320V104H382" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
          {[[256, 194], [396, 186]].map(([cx, cy]) => (
            <circle key={cx} className="sc sc-flash" style={d(2200)} cx={cx} cy={cy} r="20" fill="none" stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="3 3" />
          ))}
        </svg>
        <button
          type="button"
          onClick={replay}
          aria-label="Replay the diagram illustration"
          className="press absolute bottom-3 right-3 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted shadow-[var(--card-shadow)] hover:text-text"
        >
          Replay
        </button>
      </div>
      <div className="min-w-0">
        <ol className="grid gap-3">
          {steps.map((s, i) => (
            <li key={s.text} className="sc sc-rise flex items-baseline gap-3" style={d(s.at)}>
              <span className="font-mono text-xs text-muted">0{i + 1}</span>
              <span className={`text-sm ${s.tone}`}>{s.text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">Illustration. The counts are from the real lint of the Northwind draft.</p>
      </div>
    </div>
  )
}
