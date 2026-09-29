'use client'
import { useState } from 'react'
import { CompareSlider } from './compare-slider'
import { SlidingTabs } from './sliding-tabs'
import { SuccessCheck } from './success-check'
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

// The skill's own loop on its worked example: a first draft, the real linter's
// findings, the fixes, the final render. All committed output of build-showcases.
export function ShowcaseDiagrams({ data }: { data: DiagramShowcase }) {
  const [step, setStep] = useState('draft')
  const [pos, setPos] = useState(100)
  const [animate, setAnimate] = useState(false)
  const findings = data.draft.lint.output.split('\n').length
  const [chip, chipRef] = useTextSwap(step === 'final' ? 'lint: clean' : `lint: ${findings} findings`)
  const lint = step === 'final' ? data.final.lint : data.draft.lint

  const go = (id: string) => {
    setAnimate(true)
    setStep(id)
    setPos(STEPS.find((s) => s.id === id)!.slider)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
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
        <SlidingTabs label="Step" options={STEPS} value={step} onChange={go} />
      </div>
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
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="card min-w-0 overflow-hidden">
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
            <ol className="list-decimal space-y-1.5 py-4 pl-9 pr-4 font-mono text-[12.5px] leading-5" data-lint-output="fix">
              {data.fixes.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ol>
          ) : (
            <pre tabIndex={0} data-lint-output={step} className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6">
              <span className="text-faint">$ </span>
              {lint.command}
              {'\n'}
              <span className={step === 'final' ? 'text-ok' : 'text-warn'}>{lint.output}</span>
            </pre>
          )}
        </div>
        <ul className="flex flex-wrap content-start gap-2 md:flex-col md:flex-nowrap">
          {data.downloads.map((d) => (
            <li key={d.href}>
              <a href={d.href} download className="press card card-hover flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>{d.label}</span>
                <span className="font-mono text-xs text-muted">{d.ext}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
