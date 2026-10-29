import type { Metadata } from 'next'
import Link from 'next/link'
import { AgentLogo } from '@/components/agent-logo'
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
import { InstallPanel } from '@/components/install-panel'
import { PmCommand } from '@/components/pm-command'
import { NightSky } from '@/components/night-sky'
import { ProofStage, type Proof } from '@/components/proof-stage'
import { agents, skills, type Skill } from '@/lib/content'
import './home.css'

export const metadata: Metadata = pageMeta({ path: '/' })

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

// Each skill's proof beside its row: its README's lead image, and where the
// README shows no output, the clean final run of its showcase.
const VERDICT: Record<string, Proof['verdict']> = {
  'architecture-diagrams': diagrams.final.lint,
  'design-documents': docs.final.check,
}
const proofs: Proof[] = skills.map((s) => {
  if (!s.lead) throw new Error(`${s.slug}: its README has no lead image for the home page`)
  return { slug: s.slug, title: s.title, summary: s.summary, version: s.version, lead: s.lead, verdict: s.lead.output ? null : (VERDICT[s.slug] ?? null) }
})

const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']

// A chapter per skill: its name, the package's own summary, its install and docs, then
// the scene built from its real output.
function Chapter({ skill, id, children }: { skill: Skill; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="chapter">
      <div className="section-head">
        <h2 id={id} className="display-section">
          {skill.title}
        </h2>
        <p className="section-lede">{skill.summary}</p>
      </div>
      <div className="chapter-actions">
        <div className="chapter-install">
          <PmCommand pkg="skills" args={`add keenskills/skills --skill ${skill.pkg}`} label="Install in your project" />
        </div>
        <Link href={`/${skill.slug}`} className="text-link">
          Read the {skill.title} docs
        </Link>
      </div>
      <div className="panel chapter-scene">{children}</div>
    </section>
  )
}

export default function Home() {
  return (
    <div id="home">
      <section className="hero night" aria-labelledby="hero-title">
        <div className="ground" aria-hidden="true">
          <NightSky seed={7} />
        </div>
        <div className="hero-copy">
          <HeroReveal>
            <h1 id="hero-title" className="t-stagger-line t-stagger-line--1 display-hero">{SITE.tagline}</h1>
            <p className="t-stagger-line t-stagger-line--2 hero-lede">Open-source skills for coding agents, each installed with one command.</p>
            <div className="t-stagger-line t-stagger-line--3 hero-actions">
              <Link href="#skills" className="pill pill-lit">
                Browse skills
              </Link>
              <Link href="/how-to-use" className="pill">
                How to use
              </Link>
            </div>
          </HeroReveal>
        </div>
        <InstallPanel channels={skills.map((s) => ({ pkg: s.pkg, title: s.title, version: s.version }))} />
      </section>

      <section id="skills" aria-labelledby="skills-title" className="skills scroll-mt-6">
        <div className="section-head">
          <h2 id="skills-title" className="display-section">
            {COUNT[skills.length] ?? skills.length} skills, each its own install.
          </h2>
          <p className="section-lede">Pick one to see what it hands back.</p>
        </div>
        <ProofStage proofs={proofs} />
      </section>

      <Chapter skill={skills[0]} id="see-pad">
        <PageScan command={pad.read['390'].command} problems={scanLines} summary={`${problems.length} problems, exit ${pad.read['390'].exit}`} />
      </Chapter>
      <Chapter skill={skills[1]} id="see-diagrams">
        <DiagramDraw draft={diagrams.draft.lint} findings={findings} fixes={fixes} final={diagrams.final.lint} files={diagrams.downloads.map((f) => f.href.split('/').pop() ?? f.ext)} />
      </Chapter>
      <Chapter skill={skills[2]} id="see-docs">
        <DocCheck draft={docs.draft.check} findings={docFindings} fixes={docs.fixes} final={docs.final.check} files={docs.downloads.map((f) => f.href.split('/').pop() ?? f.ext)} />
      </Chapter>

      <section aria-labelledby="agents-title" className="pair">
        <div className="section-head">
          <h2 id="agents-title" className="display-section">
            Works with the agent you use
          </h2>
        </div>
        <ul className="agent-rows">
          {agents.map((a) => (
            <li key={a.id} className="agent-row">
              <span className="agent-name">
                <AgentLogo id={a.id} />
                {a.label}
              </span>
              <code className="agent-path">{a.path}</code>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-title" className="pair">
        <div className="section-head">
          <h2 id="faq-title" className="display-section">
            Questions
          </h2>
        </div>
        <div className="faq-list">
          {FAQS.map((f) => (
            <details key={f.q} className="t-accordion faq-item">
              <summary className="cursor-pointer">
                <span>{f.q}</span>
                <svg className="chev size-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
              </summary>
              <p className="faq-answer">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="closing night" aria-labelledby="closing-title">
        <div className="ground" aria-hidden="true">
          <NightSky seed={11} horizon={0.8} />
        </div>
        <h2 id="closing-title" className="display-closing">
          Free, and open source.
        </h2>
        <p className="closing-lede">MIT licensed, every line on GitHub.</p>
        <div className="hero-actions">
          <a href={SITE.repo} className="pill pill-lit">
            Open the repository
          </a>
          <Link href="/how-to-use" className="pill">
            Install guide
          </Link>
        </div>
      </section>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }}
      />
    </div>
  )
}
