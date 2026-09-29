import Link from 'next/link'
import type { Skill } from '@/lib/content'
import { Count } from './count'
import { PmCommand } from './pm-command'

export function SkillCard({ skill }: { skill: Skill }) {
  return (
    <article className="card flex min-w-0 flex-col gap-4 p-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{skill.title}</h3>
        <p className="mt-1.5 text-sm text-muted text-pretty">{skill.summary}</p>
        {skill.downloads !== null ? (
          <p className="mt-2 text-xs text-muted">
            <Count value={skill.downloads} /> installs last week
          </p>
        ) : null}
      </div>
      <PmCommand pkg={skill.name} args="init" />
      <Link href={`/${skill.slug}`} className="mt-auto self-start text-sm font-medium text-accent hover:underline">
        Read the {skill.title} docs <span aria-hidden="true">→</span>
      </Link>
    </article>
  )
}
