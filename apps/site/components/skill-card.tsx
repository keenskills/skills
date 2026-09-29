import Link from 'next/link'
import type { Skill } from '@/lib/content'
import { CodeCommand } from './code-command'

export function SkillCard({ skill }: { skill: Skill }) {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)]">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{skill.title}</h3>
        <p className="mt-1.5 text-sm text-muted text-pretty">{skill.summary}</p>
      </div>
      <CodeCommand command={skill.install} />
      <Link href={`/${skill.slug}`} className="mt-auto self-start text-sm font-medium text-accent hover:underline">
        Read the {skill.title} docs <span aria-hidden="true">→</span>
      </Link>
    </article>
  )
}
