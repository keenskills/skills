import Link from 'next/link'
import { SkillCard } from '@/components/skill-card'
import { agents, skills } from '@/lib/content'

const STEPS = [
  { title: 'Install the skill', body: 'Run init in your project. It finds the agents you use and writes the skill in each one’s own format.' },
  { title: 'Ask your agent', body: 'Say what you need in plain words: check this page on a phone, or draw this system on one A4 page.' },
  { title: 'Get real output', body: 'Your agent reads the page as data, or builds a draw.io file with PNG and PDF, and fixes what it finds.' },
]

const FAQS = [
  {
    q: 'Which coding agents do they work with?',
    a: 'Claude Code, Codex and other agents that read AGENTS.md, Gemini CLI, Cursor, Windsurf, Cline and GitHub Copilot. init finds the ones your project uses; --agent picks them yourself.',
  },
  {
    q: 'What do they need?',
    a: 'Node 22 or newer to install. page-as-data also needs Chrome, Chromium or Edge. The diagram skill needs Python 3.9 or newer, and draw.io desktop for PNG and PDF export.',
  },
  { q: 'Can I install only one?', a: 'Yes. Each skill is its own npm package and its own Claude Code plugin, with its own version and changelog.' },
  { q: 'How do I remove one?', a: 'Run the same package with uninstall. It removes what init wrote and nothing else.' },
  { q: 'Are they free?', a: 'Yes. Both are MIT licensed and open source on GitHub.' },
]

export default function Home() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <p className="text-sm font-medium text-accent">Open-source agent skills</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Sharper senses for your coding agent</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted text-pretty">
          Skills that let an agent read what a web page really shows, and draw architecture diagrams you can print. Each one installs with a single command.
        </p>
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
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {skills.map((s) => (
            <SkillCard key={s.slug} skill={s} />
          ))}
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
            <details key={f.q} className="group px-5 py-4">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 text-sm text-muted text-pretty">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  )
}
