import Link from 'next/link'
import type { Skill } from '@/lib/content'
import { WeeklyDownloads } from './count'
import { PmCommand } from './pm-command'

// A small weekly count works against the skill, so it stays hidden until it is worth showing.
const SHOW_DOWNLOADS_FROM = 100

// One full-width row per skill, so the longest install command fits on one line.
export function SkillCard({ skill }: { skill: Skill }) {
  return (
    <article className="card flex min-w-0 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{skill.title}</h3>
        <Link href={`/${skill.slug}`} className="text-sm font-medium text-accent hover:underline">
          Read the {skill.title} docs <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="-mt-2">
        <p className="max-w-2xl text-sm text-muted text-pretty">{skill.summary}</p>
        {skill.downloads !== null && skill.downloads >= SHOW_DOWNLOADS_FROM ? (
          <p className="mt-2 text-xs text-muted">
            <WeeklyDownloads name={skill.name} value={skill.downloads} /> installs last week
          </p>
        ) : null}
      </div>
      <PmCommand pkg="skills" args={`add keenskills/skills --skill ${skill.pkg}`} label="Install in your project" />
    </article>
  )
}
