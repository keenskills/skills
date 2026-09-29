'use client'
import { useState } from 'react'
import { CompareSlider } from './compare-slider'
import { SlidingTabs } from './sliding-tabs'
import { SuccessCheck } from './success-check'
import { Command } from './terminal-replay'
import { useTextSwap } from './use-text-swap'

type Lint = { command: string; output: string; exit: number }
type Img = { src: string; width: number; height: number }
export type DiagramShowcase = {
  example: string
  draft: { lint: Lint; image: Img }
  fixes: string[]
  final: { lint: Lint; image: Img }
  downloads: { label: string; href: string; ext: string }[]
}

const STEPS = [
  { id: 'draft', label: 'Draft', slider: 100 },
  { id: 'fix', label: 'Fix', slider: 50 },
  { id: 'final', label: 'Final', slider: 0 },
]

// Where each fixed element sits on the page, as a fraction of its width and
// height. A fix names its element first ("users: ..."); one not listed here
// is shown as text only.
const FOCUS: Record<string, [number, number]> = { users: [0.085, 0.361], afd: [0.085, 0.433], entra: [0.898, 0.616] }
const ZOOM = 0.13 // the part of the page's width a detail shows

// One detail of a render, enlarged: the same image as the slider, as a background.
function Detail({ image, at, label }: { image: Img; at: [number, number]; label: string }) {
  const h = (ZOOM * image.width * 3) / 4 / image.height
  const pos = (c: number, part: number) => `${(100 * Math.min(Math.max(c - part / 2, 0), 1 - part)) / (1 - part)}%`
  return (
    <span
      role="img"
      aria-label={label}
      className="block aspect-[4/3] w-28 rounded-md border border-border bg-white bg-no-repeat sm:w-32"
      style={{ backgroundImage: `url(${image.src})`, backgroundSize: `${100 / ZOOM}% auto`, backgroundPosition: `${pos(at[0], ZOOM)} ${pos(at[1], h)}` }}
    />
  )
}

// The skill's own loop on its worked example: a first draft, the real linter's
// findings, the fixes, the final render. All committed output of build-showcases.
export function ShowcaseDiagrams({ data }: { data: DiagramShowcase }) {
  const [step, setStep] = useState('draft')
  const [pos, setPos] = useState(100)
  const [animate, setAnimate] = useState(false)
  const findings = data.draft.lint.output.split('\n').length
  const [chip, chipRef] = useTextSwap(step === 'final' ? 'lint: clean' : `lint: ${findings} findings`)
  const lint = step === 'final' ? data.final.lint : data.draft.lint

  // Arrow keys move through the steps with no motion; a click glides and staggers.
  const go = (id: string, animated: boolean) => {
    setAnimate(animated)
    setStep(id)
    setPos(STEPS.find((s) => s.id === id)!.slider)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Lint, render, look, fix</h2>
          <p className="mt-1 max-w-xl text-sm text-muted text-pretty">
            The skill&rsquo;s own loop on{' '}
            <a className="text-accent underline underline-offset-2" href={data.example}>
              the Northwind example
            </a>{' '}
            (a fictional company): a first draft, the real linter&rsquo;s findings, the fixes, and the final render.
          </p>
          <p className="mt-1 max-w-xl text-xs text-muted text-pretty">
            The draft was made by undoing three of the example&rsquo;s details; its findings, the fixes and both renders are real output.
          </p>
        </div>
        <div className="max-w-full shrink-0">
          <SlidingTabs label="Step" options={STEPS} value={step} onChange={go} />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <CompareSlider
          before={{ ...data.draft.image, alt: 'First draft of the Northwind order platform diagram' }}
          after={{ ...data.final.image, alt: 'Final Northwind order platform diagram, A4 landscape' }}
          value={pos}
          onChange={(v) => {
            setAnimate(false)
            setPos(v)
          }}
          animate={animate}
        />
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-code">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <span className={`inline-flex items-center gap-2 text-xs font-medium ${step === 'final' ? 'text-ok' : 'text-warn'}`}>
              {step === 'final' ? <SuccessCheck /> : null}
              <span ref={chipRef} className="t-text-swap">
                {chip}
              </span>
            </span>
            <span data-lint-exit="" className="font-mono text-xs text-muted">exit {step === 'fix' ? '—' : lint.exit}</span>
          </div>
          {step === 'fix' ? (
            <ol className="divide-y divide-border" data-lint-output="fix">
              {data.fixes.map((f, i) => {
                const at = FOCUS[f.slice(0, f.indexOf(':'))]
                return (
                  <li key={f} className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 ${animate ? 'term-line' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
                    {at ? (
                      <span className="flex shrink-0 items-center gap-2">
                        <Detail image={data.draft.image} at={at} label={`Draft, enlarged: ${f}`} />
                        <svg className="size-4 shrink-0 text-faint" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                        <Detail image={data.final.image} at={at} label={`Final, enlarged: ${f}`} />
                      </span>
                    ) : null}
                    <span className="min-w-40 flex-1 font-mono text-[12.5px] leading-5">
                      <span className="text-faint">{i + 1}. </span>
                      {f}
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <pre tabIndex={0} data-lint-output={step} className="whitespace-pre-wrap p-4 font-mono text-[12.5px] leading-6 [overflow-wrap:anywhere]">
              <span className="block pl-[2ch] -indent-[2ch]">
                <span className="text-faint">$ </span>
                <Command text={lint.command} />
              </span>
              {lint.output.split('\n').map((l) => (
                <span key={l} className={`block pl-[2ch] -indent-[2ch] ${step === 'final' ? 'text-ok' : 'text-warn'}`}>
                  {l}
                </span>
              ))}
            </pre>
          )}
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {data.downloads.map((d) => (
          <li key={d.href} className="min-w-40 flex-1">
            <a href={d.href} download className="press card card-hover flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>{d.label}</span>
              <span className="font-mono text-xs text-muted">{d.ext}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
