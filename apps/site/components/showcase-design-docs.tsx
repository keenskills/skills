'use client'
import { useState, type ReactNode } from 'react'
import { SlidingTabs } from './sliding-tabs'
import { SuccessCheck } from './success-check'
import { Command } from './terminal-replay'
import { useTextSwap } from './use-text-swap'

type Check = { command: string; output: string; exit: number }
type Run = { text: string; bold?: boolean }
type Block = { kind: string; runs?: Run[]; title?: string | null; head?: string[]; rows?: string[][] }
export type DesignDocsShowcase = {
  example: string
  draft: { check: Check; doc: Block[] }
  fixes: string[]
  marks: string[]
  owner: number[]
  final: { check: Check; doc: Block[] }
  downloads: { label: string; href: string; ext: string }[]
}

const STEPS = [
  { id: 'draft', label: 'Draft' },
  { id: 'fix', label: 'Fix' },
  { id: 'final', label: 'Final' },
]

// Splits text at the first occurrence of each mark not yet used, so every
// defect is marked once, where the check found it.
function marked(text: string, marks: string[], used: Set<number>, render: (i: number, s: string) => ReactNode) {
  const out: ReactNode[] = []
  let rest = text
  for (;;) {
    let best: { i: number; at: number } | null = null
    marks.forEach((m, i) => {
      const at = used.has(i) ? -1 : rest.indexOf(m)
      if (at !== -1 && (!best || at < best.at)) best = { i, at }
    })
    if (!best) break
    const { i, at } = best as { i: number; at: number }
    used.add(i)
    if (at) out.push(rest.slice(0, at))
    out.push(render(i, marks[i]))
    rest = rest.slice(at + marks[i].length)
  }
  if (rest) out.push(rest)
  return out
}

// A document as Word lays out its body, drawn from the real .docx: headings,
// paragraphs with their bold runs, bullets, and tables in the accent colour.
function Doc({ blocks, marks = [], mark }: { blocks: Block[]; marks?: string[]; mark?: (i: number, s: string) => ReactNode }) {
  const used = new Set<number>()
  const runs = (rs: Run[] = []) =>
    rs.map((r, k) => {
      const body = mark ? marked(r.text, marks, used, mark) : r.text
      return r.bold ? <strong key={k}>{body}</strong> : <span key={k}>{body}</span>
    })
  const out: ReactNode[] = []
  let list: ReactNode[] = []
  const flush = () => {
    if (list.length) out.push(<ul key={`ul${out.length}`} className="ml-5 list-disc space-y-1">{list}</ul>)
    list = []
  }
  blocks.forEach((b, i) => {
    if (b.kind === 'li') return void list.push(<li key={i}>{runs(b.runs)}</li>)
    flush()
    if (b.kind === 'h1') out.push(<p key={i} className="pt-2 text-[15px] font-semibold text-accent">{runs(b.runs)}</p>)
    else if (b.kind === 'h2' || b.kind === 'h3') out.push(<p key={i} className="font-semibold text-accent">{runs(b.runs)}</p>)
    else if (b.kind === 'table')
      out.push(
        <div key={i} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11.5px] leading-4">
            <thead>
              {b.title ? (
                <tr>
                  <th colSpan={b.head?.length} className="border border-line-strong bg-accent px-2 py-1 font-semibold text-bg">{b.title}</th>
                </tr>
              ) : null}
              <tr>
                {b.head?.map((h) => (
                  <th key={h} className="border border-line-strong bg-accent px-2 py-1 font-semibold text-bg">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows?.map((r, k) => (
                <tr key={k}>
                  {r.map((c, j) => (
                    <td key={j} className="border border-line-strong px-2 py-1 align-top">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
    else out.push(<p key={i} className="text-pretty">{runs(b.runs)}</p>)
  })
  flush()
  return <>{out}</>
}
// The skill's own loop on its worked example: a first draft, the real check's
// findings, the fixes, the final document. All committed output of build-showcases.
export function ShowcaseDesignDocs({ data }: { data: DesignDocsShowcase }) {
  const [step, setStep] = useState('draft')
  const [animate, setAnimate] = useState(false)
  const [hot, setHot] = useState<number | null>(null)
  const lines = data.draft.check.output.split('\n')
  const [chip, chipRef] = useTextSwap(step === 'final' ? 'check: clean' : `check: ${lines.length} findings`)
  const check = step === 'final' ? data.final.check : data.draft.check
  const over = (i: number) => ({ onPointerEnter: () => setHot(i), onPointerLeave: () => setHot(null) })

  // Arrow keys move through the steps with no motion; a click cross-fades and staggers.
  const go = (id: string, animated: boolean) => {
    setAnimate(animated)
    setStep(id)
  }

  const pin = (i: number, s: string) => (
    <mark key={`m${i}`} className="doc-mark" data-n={i + 1} data-hot={hot === i ? '' : undefined} data-fixed={step === 'fix' ? '' : undefined}>
      {s}
      <span aria-hidden="true" className="doc-pin">
        {i + 1}
      </span>
    </mark>
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Write, check, fix</h2>
          <p className="mt-1 max-w-xl text-sm text-muted text-pretty">
            The skill&rsquo;s own loop on{' '}
            <a className="text-accent underline underline-offset-2" href={data.example}>
              the Contoso example
            </a>{' '}
            (a fictional company): a first draft, the real check&rsquo;s findings, the fixes, and the final document.
          </p>
          <p className="mt-1 max-w-xl text-xs text-muted text-pretty">
            The draft was made by putting back five habits of generated text; its findings, the fixes and both documents are real output.
          </p>
        </div>
        <div className="max-w-full shrink-0">
          <SlidingTabs label="Step" options={STEPS} value={step} onChange={go} />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div className="card grid overflow-hidden" data-doc-step={step}>
          <div
            className="doc-layer col-start-1 row-start-1 grid gap-3 p-5 text-[13px] leading-5 sm:p-8"
            data-animate={animate ? '' : undefined}
            data-hidden={step === 'final' ? '' : undefined}
            aria-hidden={step === 'final'}
            inert={step === 'final'}
            data-doc="draft"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted">Network Security Design · first draft</p>
            <Doc blocks={data.draft.doc} marks={data.marks} mark={pin} />
          </div>
          <div
            className="doc-layer col-start-1 row-start-1 grid content-start gap-3 p-5 text-[13px] leading-5 sm:p-8"
            data-animate={animate ? '' : undefined}
            data-hidden={step === 'final' ? undefined : ''}
            aria-hidden={step !== 'final'}
            inert={step !== 'final'}
            data-doc="final"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted">Network Security Design · version 1.0</p>
            <Doc blocks={data.final.doc} />
          </div>
        </div>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-code">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <span className={`inline-flex items-center gap-2 text-xs font-medium ${step === 'final' ? 'text-ok' : 'text-warn'}`}>
              {step === 'final' ? <SuccessCheck /> : null}
              <span ref={chipRef} className="t-text-swap">
                {chip}
              </span>
            </span>
            <span data-check-exit="" className="font-mono text-xs text-muted">exit {step === 'fix' ? '—' : check.exit}</span>
          </div>
          {step === 'fix' ? (
            <ol className="divide-y divide-border" data-check-output="fix">
              {data.fixes.map((f, i) => (
                <li key={f} className={`flex gap-3 px-4 py-3 ${animate ? 'term-line' : ''}`} style={{ animationDelay: `${i * 60}ms` }} {...over(i)}>
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ok-soft text-[11px] font-semibold text-ok">{i + 1}</span>
                  <span className="min-w-0 font-mono text-[12.5px] leading-5 [overflow-wrap:anywhere]">{f}</span>
                </li>
              ))}
            </ol>
          ) : (
            <pre tabIndex={0} data-check-output={step} className="whitespace-pre-wrap p-4 font-mono text-[12.5px] leading-6 [overflow-wrap:anywhere]">
              <span className="block pl-[2ch] -indent-[2ch]">
                <span className="text-faint">$ </span>
                <Command text={check.command} />
              </span>
              {check.output.split('\n').map((l, i) =>
                step === 'final' ? (
                  <span key={l} className="block text-ok">
                    {l}
                  </span>
                ) : (
                  <span key={l} className="flex gap-2 text-warn" {...over(data.owner[i])}>
                    <span aria-label={`problem ${data.owner[i] + 1}`} className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-warn-soft text-[10px] font-semibold leading-none">
                      {data.owner[i] + 1}
                    </span>
                    <span className="min-w-0">{l}</span>
                  </span>
                ),
              )}
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
