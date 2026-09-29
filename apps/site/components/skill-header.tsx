import type { Skill } from '@/lib/content'
import { PmCommand } from './pm-command'

export function SkillHeader({ skill }: { skill: Skill }) {
  return (
    <header className="border-b border-border pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{skill.title}</h1>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted">{`v${skill.version}`}</span>
      </div>
      <p className="mt-3 max-w-2xl text-muted text-pretty">{skill.summary}</p>
      <div className="mt-6 max-w-xl">
        <PmCommand pkg={skill.name} args="init" label="Install in your project" />
      </div>
      <ul className="mt-4 flex flex-wrap gap-4 text-sm">
        <li>
          <a href={skill.npm} className="inline-flex min-h-6 items-center text-accent hover:underline">
            {skill.name} on npm
          </a>
        </li>
        <li>
          <a href={skill.repo} className="inline-flex min-h-6 items-center text-accent hover:underline">
            Source on GitHub
          </a>
        </li>
      </ul>
    </header>
  )
}
