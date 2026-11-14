'use client'
import { useRef, useState, type KeyboardEvent } from 'react'
import type { Lead } from '@/lib/content'
import { problemLines } from '@/lib/terminal.mjs'

export type Proof = { slug: string; title: string; summary: string; version: string; lead: Lead; verdict: { command: string; output: string } | null }

// The skills as a list of levels: each row is the skill's name, its summary and
// its version, and picking a row sets the panel beside it to that skill's proof
// (its README's lead image, with the tool's real output). Every panel is in the
// server HTML; inactive ones are inert and unseen, and share one cell so the
// panel never changes height.
export function ProofStage({ proofs }: { proofs: Proof[] }) {
  const [active, setActive] = useState(proofs[0].slug)
  const list = useRef<HTMLDivElement>(null)

  const onKey = (e: KeyboardEvent) => {
    const i = proofs.findIndex((p) => p.slug === active)
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + proofs.length) % proofs.length
    setActive(proofs[next].slug)
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div className="levels">
      <div ref={list} role="tablist" aria-orientation="vertical" aria-label="Skill output" className="panel level-list" onKeyDown={onKey}>
        {proofs.map((p) => (
          <button
            key={p.slug}
            type="button"
            role="tab"
            id={`proof-tab-${p.slug}`}
            aria-controls={`proof-${p.slug}`}
            aria-selected={active === p.slug}
            tabIndex={active === p.slug ? 0 : -1}
            className="level"
            onClick={() => setActive(p.slug)}
          >
            <span className="level-name">{p.title}</span>
            <span className="level-line">{p.summary}</span>
            <span className="level-figure">v{p.version}</span>
          </button>
        ))}
      </div>
      <div className="panel proof-stage">
        {proofs.map((p, i) => (
          <figure key={p.slug} id={`proof-${p.slug}`} role="tabpanel" aria-labelledby={`proof-tab-${p.slug}`} data-active={active === p.slug} inert={active !== p.slug} className="proof-panel" data-shape={p.lead.width > p.lead.height ? 'wide' : 'tall'}>
            <img src={p.lead.src} alt={p.lead.output ? p.lead.alt : ''} width={p.lead.width} height={p.lead.height} className="proof-image" loading={i === 0 ? undefined : 'lazy'} />
            <div className="proof-read min-w-0">
              {p.lead.command && p.lead.output ? <ReadOut command={p.lead.command} output={p.lead.output} /> : null}
              {p.verdict ? (
                <p className="proof-verdict">
                  <span className="proof-command">
                    <span className="proof-prompt">$ </span>
                    {p.verdict.command}
                  </span>
                  <span className="proof-clean">{p.verdict.output}</span>
                </p>
              ) : null}
              {p.lead.output ? null : <figcaption className="proof-caption">{p.lead.alt}</figcaption>}
            </div>
          </figure>
        ))}
      </div>
    </div>
  )
}

// The PROBLEMS lines of a read, numbered, under the command that printed them.
function ReadOut({ command, output }: { command: string; output: string }) {
  const problems = problemLines(output)
  return (
    <div>
      <p className="proof-command">
        <span className="proof-prompt">$ </span>
        {command}
      </p>
      <ol className="proof-problems">
        {problems.map((l, i) => (
          <li key={i}>
            <span className="proof-n">{i + 1}</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{l}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
