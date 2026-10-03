import type { Metadata } from 'next'
import Link from 'next/link'
import { HeroReveal } from '@/components/hero-reveal'
import { DiagramDraw } from '@/components/illustrations/diagram-draw'
import { DocCheck } from '@/components/illustrations/doc-check'
import { PageScan } from '@/components/illustrations/page-scan'
import diagrams from '@/content/showcase/architecture-diagrams.json'
import docs from '@/content/showcase/design-documents.json'
import pad from '@/content/showcase/page-as-data.json'
import { pageMeta } from '@/lib/meta'
import { SITE } from '@/lib/site.mjs'
import { problemLines } from '@/lib/terminal.mjs'
import { JsonLd } from '@/components/json-ld'
import { SkillCard } from '@/components/skill-card'
import { agents, skills } from '@/lib/content'

export const metadata: Metadata = pageMeta({ path: '/' })

const STEPS = [
  { title: 'Install the skill', body: 'Run init in your project. It finds the agents you use and writes the skill in each one’s own format.' },
  { title: 'Ask your agent', body: 'Say what you need in plain words: check this page on a phone, draw this system on one A4 page, or write the design document on our template.' },
  { title: 'Get real output', body: 'Your agent reads the page as data, builds a draw.io file with PNG and PDF, or writes a Word document, and fixes what its checks find.' },
]

const FAQS = [
  {
    q: 'Which coding agents do they work with?',
    a: 'Claude Code, Codex and other agents that read AGENTS.md, Gemini CLI, Cursor, Windsurf, Cline and GitHub Copilot. init finds the ones your project uses; --agent picks them yourself.',
  },
  {
    q: 'What do they need?',
    a: 'Node 22 or newer to install. page-as-data also needs Chrome, Chromium or Edge. The diagram skill needs Python 3.9 or newer, and draw.io desktop for PNG and PDF export. The design document skill needs Python 3.9 or newer with python-docx, and Microsoft Word on Windows to refresh the table of contents and export the PDF.',
  },
  { q: 'Can I install only one?', a: 'Yes. Each skill is its own npm package and its own Claude Code plugin, with its own version and changelog.' },
  { q: 'How do I remove one?', a: 'Run the same package with uninstall. It removes what init wrote and nothing else.' },
  { q: 'Are they free?', a: 'Yes. All of them are MIT licensed and open source on GitHub.' },
]

// The four PROBLEMS lines the page-scan illustration numbers, in marker order.
const PICK = [/cut off/, /^broken image/, /wide in a/, /^uncaught exception/]
const problems = problemLines(pad.read['390'].output)
const scanLines = PICK.map((re) => problems.find((l) => re.test(l.replace(/^layout: /, ''))) ?? '')
if (scanLines.some((l) => !l)) throw new Error('page-scan: a picked PROBLEMS line is missing from the showcase output')

// The lint findings and fixes the diagram illustration draws, in the order it numbers them.
const FOUND = [/^users: icon is/, /^entra \/ cosmos: labels overlap/, /^afd \/ evh: .*common baseline/, /^whitespace: /]
const FIXED = [/^users: icon back/, /^afd: moved/, /^entra: moved back/]
const lintLines = diagrams.draft.lint.output.split('\n')
const findings = FOUND.map((re) => lintLines.find((l) => re.test(l)) ?? '')
const fixes = FIXED.map((re) => diagrams.fixes.find((l) => re.test(l)) ?? '')
if (lintLines.length !== FOUND.length || diagrams.fixes.length !== FIXED.length || [...findings, ...fixes].some((l) => !l)) {
  throw new Error('diagram-draw: the showcase lint output no longer matches the faults the illustration draws')
}

// The design document illustration shows each defect's first check line, cut to its first clause.
const docLines = docs.draft.check.output.split('\n')
const docFindings = docs.fixes.map((_, i) => {
  const line = docLines[docs.owner.indexOf(i)]
  if (!line) throw new Error(`doc-check: defect ${i + 1} has no line in the showcase check output`)
  return line.length > 40 ? line.slice(0, line.indexOf(': ')) : line
})

export default function Home() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <HeroReveal>
        <p className="t-stagger-line t-stagger-line--1 text-sm font-medium text-accent">Open-source agent skills</p>
        <h1 className="t-stagger-line t-stagger-line--2 mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{SITE.tagline}</h1>
        <p className="t-stagger-line t-stagger-line--3 mt-4 max-w-2xl text-lg text-muted text-pretty">
          Skills that let an agent read what a web page really shows, draw architecture diagrams you can print, and write design documents that read as written by a consultant. Each one installs with a single command.
        </p>
        </HeroReveal>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="#skills" className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg">
            Browse skills
          </Link>
          <Link href="/how-to-use" className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium">
            How to use
          </Link>
        </div>
      </section>

      <section id="skills" aria-labelledby="skills-title" className="scroll-mt-6 pb-16">
        <h2 id="skills-title" className="text-xl font-semibold tracking-tight">
          Skills
        </h2>
        <div className="mt-6 grid gap-4">
          {skills.map((s) => (
            <SkillCard key={s.slug} skill={s} />
          ))}
        </div>
      </section>

      <section aria-labelledby="see-pad" className="border-t border-border py-16">
        <h2 id="see-pad" className="text-xl font-semibold tracking-tight">
          Reads the page, not the pixels
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted text-pretty">
          page-as-data opens the page in Chrome, waits until it has settled, and reports what is on screen and what broke behind it.
        </p>
        <div className="mt-8">
          <PageScan command={pad.read['390'].command} problems={scanLines} summary={`${problems.length} problems · exit ${pad.read['390'].exit}`} />
        </div>
      </section>

      <section aria-labelledby="see-diagrams" className="border-t border-border py-16">
        <h2 id="see-diagrams" className="text-xl font-semibold tracking-tight">
          Draws, checks and fixes its own diagrams
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted text-pretty">
          The diagram skill writes a build script, lints the result for overlaps and wasted space, fixes what it finds and renders print-ready files.
        </p>
        <div className="mt-8">
          <DiagramDraw draft={diagrams.draft.lint} findings={findings} fixes={fixes} final={diagrams.final.lint} files={diagrams.downloads.map((f) => f.href.split('/').pop() ?? f.ext)} />
        </div>
      </section>

      <section aria-labelledby="see-docs" className="border-t border-border py-16">
        <h2 id="see-docs" className="text-xl font-semibold tracking-tight">
          Writes the document, then checks how it reads
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted text-pretty">
          The design document skill builds the Word file on the client&rsquo;s own template, checks it for what makes text read as generated or reveals how the facts were collected, and fixes what it finds.
        </p>
        <div className="mt-8">
          <DocCheck draft={docs.draft.check} findings={docFindings} fixes={docs.fixes} final={docs.final.check} files={docs.downloads.map((f) => f.href.split('/').pop() ?? f.ext)} />
        </div>
      </section>

      <section aria-labelledby="steps-title" className="border-t border-border py-16">
        <h2 id="steps-title" className="text-xl font-semibold tracking-tight">
          Three steps, no setup
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent">{i + 1}</span>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted text-pretty">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="agents-title" className="border-t border-border py-16">
        <h2 id="agents-title" className="text-xl font-semibold tracking-tight">
          Works with the agent you use
        </h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {agents.map((a) => (
            <li key={a.id} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
              {a.label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-title" className="border-t border-border py-16">
        <h2 id="faq-title" className="text-xl font-semibold tracking-tight">
          Questions
        </h2>
        <div className="card mt-6 divide-y divide-border">
          {FAQS.map((f) => (
            <details key={f.q} className="t-accordion px-5 py-4">
              <summary className="cursor-pointer font-medium">
                <span>{f.q}</span>
                <svg className="chev size-4 shrink-0 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
              </summary>
              <p className="mt-2 text-sm text-muted text-pretty">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }}
      />
    </>
  )
}
