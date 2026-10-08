'use client'
import { useState } from 'react'
import { d, SceneStatus, Typed, TYPE, type Step, ScenePlay } from './scene-parts'
import { useScene } from './use-scene'

type Lint = { command: string; output: string; exit: number }

// The run, in ms: the draft is built, linted, fixed one change at a time, linted again and rendered.
const LINT = 1900
const FIX = [2900, 3300, 3700]
const RELINT = 4300
const found = (i: number) => LINT + 150 + i * 180

const BOXES = [
  { x: 24, w: 96, label: 'Edge', at: 250 },
  { x: 136, w: 184, label: 'VNet · 10.40.0.0/16', at: 370 },
  { x: 336, w: 120, label: 'Messaging · data', at: 490 },
]
// Each 28 px icon where the finished diagram has it.
const NODES: [string, number, number][] = [
  ['Users', 58, 90],
  ['AFD', 58, 150],
  ['Entra', 58, 210],
  ['AGW', 170, 150],
  ['AKS', 242, 90],
  ['Functions', 242, 210],
  ['Bus', 382, 90],
  ['EVH', 382, 150],
  ['Cosmos', 382, 210],
]
const [USERS, AFD, ENTRA, COSMOS] = [0, 1, 2, 8]
const EDGES = ['M72 138V150', 'M86 164H170', 'M198 164H220V104H242', 'M198 164H220V224H242', 'M270 104H382', 'M270 104H326V164H382', 'M270 224H382']

// The draft's three faults, as the real draft has them: the users icon is drawn
// 44/28 too big, afd sits 7 px under its row, and entra is parked 12 px from
// cosmos, which also leaves its own place empty. One fix undoes each.
const GROWN = 44 / 28
const DROPPED = 7
const CROWDED = NODES[COSMOS][1] + 12 - NODES[ENTRA][1]

// What the lint flags, in the order of its output: where the pin sits, which fix clears it, which nodes it is about.
const MARKS = [
  { x: 105, y: 84, fix: 0, nodes: [USERS] },
  { x: 437, y: 210, fix: 2, nodes: [ENTRA, COSMOS] },
  { x: 102, y: 158, fix: 1, nodes: [AFD] },
  { x: 106, y: 206, fix: 2, nodes: [ENTRA] },
]
// The fix printed under each finding; the empty place has none of its own, entra's move fills it.
const ANSWER = [0, 2, 1, null]

const Tick = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
    <path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// Illustration of one run of the diagram skill's loop: build, lint, fix, lint
// clean, render. The commands, findings and fixes are real output for the
// Northwind draft, each cut to its first clause; the drawing is a small
// stand-in for that diagram with the same three faults.
export function DiagramDraw({ draft, findings, fixes, final, files }: { draft: Lint; findings: string[]; fixes: string[]; final: Lint; files: string[] }) {
  const { ref, replay, playing } = useScene<HTMLDivElement>()
  const [hot, setHot] = useState<number[] | null>(null)
  const over = (nodes: number[]) => ({ onPointerEnter: () => setHot(nodes), onPointerLeave: () => setHot(null) })

  const status: Step[] = [
    { text: 'Building from the Python script', at: 0, end: LINT - 150 },
    { text: 'Linting the draft', at: LINT - 50, end: FIX[0] - 150, live: true },
    { text: `Applying ${fixes.length} fixes`, at: FIX[0] - 50, end: RELINT - 150 },
  ]

  return (
    <div ref={ref} className="scene grid items-start gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="dots relative rounded-2xl bg-code p-4 pb-12 sm:p-6 sm:pb-12">
        <svg viewBox="0 0 480 300" role="img" aria-labelledby="draw-title" className="block h-auto w-full">
          <title id="draw-title">Illustration: the diagram skill draws an architecture diagram, lints it, fixes an oversized icon, an icon off its row and an overlapping label, and renders it</title>
          <defs>
            <pattern id="draw-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2" height="6" fill="var(--warn)" opacity="0.4" />
            </pattern>
            {/* The D2 chip's light, as SVG: a sink, shadow pressing in from the top and the highlight on the bottom edge. */}
            <linearGradient id="draw-chip-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--d2-top)" />
              <stop offset="0.12" stopColor="transparent" />
              <stop offset="0.94" stopColor="transparent" />
              <stop offset="1" stopColor="var(--d2-bottom)" />
            </linearGradient>
            <filter id="draw-chip-shadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="var(--d2-drop)" />
            </filter>
            {/* Dot grid inside each group box, 12px pitch. */}
            <pattern id="draw-dots" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="1" fill="var(--text)" fillOpacity="0.08" />
            </pattern>
          </defs>
          <g className="sc sc-rise">
            <rect x="8" y="8" width="464" height="284" rx="10" fill="var(--surface)" stroke="var(--line-strong)" />
            <rect x="24" y="22" width="180" height="10" rx="5" fill="var(--ink-12)" />
            <rect x="404" y="20" width="52" height="14" rx="7" fill="var(--accent-soft)" />
          </g>
          {BOXES.map((b) => (
            <g key={b.label}>
              <rect className="sc sc-rise" style={d(b.at + 100)} x={b.x} y="52" width={b.w} height="220" rx="10" fill="url(#draw-dots)" />
              <rect className="sc sc-draw" pathLength={1} style={d(b.at)} x={b.x} y="52" width={b.w} height="220" rx="10" fill="none" stroke="var(--line-strong)" strokeWidth="1.25" />
              <text className="sc sc-rise" style={d(b.at + 200)} x={b.x + 10} y="68" fontSize="10" fill="var(--muted)">
                {b.label}
              </text>
            </g>
          ))}
          {EDGES.map((e, i) => (
            <path key={e} className="sc sc-draw" pathLength={1} style={d(1050 + i * 60)} d={e} fill="none" stroke="var(--faint)" strokeWidth="0.75" />
          ))}

          {/* What the lint points at: the row's baseline afd is off, and the place entra left empty. */}
          <path className="sc sc-flash" style={d(found(2), { dur: FIX[1] - found(2) + 200 })} d="M44 192H424" fill="none" stroke="var(--warn)" strokeWidth="1" strokeDasharray="3 3" />
          <rect className="sc sc-flash" style={d(found(3), { dur: FIX[2] - found(3) + 200 })} x="36" y="202" width="72" height="60" rx="6" fill="url(#draw-hatch)" />

          {NODES.map(([name, x, y], i) => {
            const node = (
              <>
                <g className={i === USERS ? 'sc sc-fix' : undefined} style={i === USERS ? d(FIX[0], { grow: GROWN }) : undefined}>
                  {/* A D2 chip: one plate, a hairline set off the edge, the sunken light, and the mark in the chip's own ink. */}
                  <rect x={x - 1} y={y - 1} width="30" height="30" rx="8" fill="none" stroke="var(--d2-edge)" strokeWidth="0.5" />
                  <rect x={x} y={y} width="28" height="28" rx="7" fill="var(--chip)" filter="url(#draw-chip-shadow)" />
                  <rect x={x} y={y} width="28" height="28" rx="7" fill="url(#draw-chip-light)" />
                  <rect x={x + 0.25} y={y + 0.25} width="27.5" height="27.5" rx="6.75" fill="none" stroke="var(--d2-ring)" strokeWidth="0.5" />
                  <path d={`M${x + 8} ${y + 11}h12M${x + 8} ${y + 17}h8`} stroke="oklch(0.623 0.214 259.815)" strokeWidth="1.5" strokeLinecap="round" />
                </g>
                <text x={x + 14} y={y + 42} textAnchor="middle" fontSize="9" fill="var(--muted)">
                  {name}
                </text>
              </>
            )
            const moved = i === AFD ? d(FIX[1], { tx: 0, ty: DROPPED }) : i === ENTRA ? d(FIX[2], { tx: CROWDED, ty: 0, dur: 650 }) : null
            return (
              <g key={name} className="sc sc-pop" style={d(700 + i * 50)}>
                {moved ? (
                  <g className="sc sc-nudge" style={moved}>
                    {node}
                  </g>
                ) : (
                  node
                )}
              </g>
            )
          })}

          {MARKS.map((m, i) => (
            <g key={i}>
              <circle className="sc sc-ping" style={d(found(i))} cx={m.x} cy={m.y} r="11" fill="none" stroke="var(--warn)" strokeWidth="1.5" />
              <g className="sc sc-mark" style={d(found(i), { dur: FIX[m.fix] - found(i) + 200 })}>
                <circle cx={m.x} cy={m.y} r="11" fill="var(--warn)" />
                <text x={m.x} y={m.y + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="oklch(0.25 0.03 85)">
                  {i + 1}
                </text>
              </g>
              <g className="sc sc-flash" style={d(FIX[m.fix] + 100, { dur: 900 })}>
                <circle cx={m.x} cy={m.y} r="11" fill="var(--ok)" />
                <path d={`M${m.x - 4.5} ${m.y + 0.5}l3 3 6-7`} fill="none" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>
          ))}

          {/* Clean: the page outline answers in green and one request runs the main path. */}
          <rect className="sc sc-flash" style={d(RELINT + 150)} x="8" y="8" width="464" height="284" rx="10" fill="none" stroke="var(--ok)" strokeWidth="1.5" />
          <path className="sc sc-flow" pathLength={1} style={d(RELINT + 300)} d="M86 164H220V104H382" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />

          {NODES.map(([name, x, y], i) => (
            <circle key={name} className="draw-ring" data-hot={hot?.includes(i) ? '' : undefined} cx={x + 14} cy={y + 14} r="23" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
          ))}
        </svg>
        <ul aria-label="Rendered files" className="mt-3 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={f} className="sc sc-pop rounded-md bg-surface px-2 py-1 font-mono text-[11px] text-muted shadow-[var(--card-shadow)]" style={d(RELINT + 350 + i * 60)}>
              {f}
            </li>
          ))}
        </ul>
        <SceneStatus steps={status} final="Lint clean. Rendered for print." at={RELINT + 150} />
        <ScenePlay onClick={replay} playing={playing} label="diagram" />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[12.5px] leading-5 text-muted [overflow-wrap:anywhere]">
          <span className="text-faint">$ </span>
          <Typed text={draft.command} at={LINT - draft.command.length * TYPE - 50} />
        </p>
        <ol className="mt-3 grid gap-2.5">
          {findings.map((f, i) => {
            const at = FIX[MARKS[i].fix]
            const fix = ANSWER[i]
            return (
              <li key={f} className="sc sc-line flex gap-3" style={d(found(i) + 80)} {...over(MARKS[i].nodes)}>
                <span className="mt-0.5 grid size-5 shrink-0">
                  <span className="sc sc-swap-out col-start-1 row-start-1 grid place-items-center rounded-full bg-warn-soft text-[11px] font-semibold text-warn-ink" style={d(at + 100)}>
                    {i + 1}
                  </span>
                  <span className="sc sc-swap-in col-start-1 row-start-1 grid place-items-center rounded-full bg-ok-soft text-ok" style={d(at + 100)}>
                    <Tick />
                  </span>
                </span>
                <span className="min-w-0 font-mono text-[12.5px] leading-5 [overflow-wrap:anywhere]">
                  <span className="block text-text">{f.split(' - ')[0]}</span>
                  {fix !== null && (
                    <span className="sc sc-line block text-ok" style={d(at + 60)}>
                      {fixes[fix].split(/ \(|, /)[0]}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="sc sc-pop mt-4 inline-flex rounded-full bg-warn-soft px-3 py-1 text-xs font-medium text-warn-ink" style={d(found(findings.length - 1) + 300)}>
          {findings.length} findings · exit {draft.exit}
        </p>
        <p className="mt-4 font-mono text-[12.5px] leading-5 text-muted [overflow-wrap:anywhere]">
          <span className="sc sc-char text-faint" style={d(RELINT - final.command.length * TYPE - 50)}>
            ${' '}
          </span>
          <Typed text={final.command} at={RELINT - final.command.length * TYPE - 50} />
        </p>
        <p className="sc sc-pop mt-3 inline-flex rounded-full bg-ok-soft px-3 py-1 text-xs font-medium text-ok" style={d(RELINT + 150)}>
          lint clean · exit {final.exit}
        </p>
        <p className="mt-3 text-xs text-muted">Illustration. The commands, findings, fixes and files are real output for the Northwind draft, each line cut to its first clause.</p>
      </div>
    </div>
  )
}
