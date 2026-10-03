import Link from 'next/link'
import { skills, type Skill } from '@/lib/content'

// Closes every docs page with the skill after this one, wrapping round to the first.
export function NextSkill({ skill }: { skill: Skill }) {
  const next = skills[(skills.findIndex((s) => s.slug === skill.slug) + 1) % skills.length]
  if (!next || next.slug === skill.slug) return null
  return (
    <nav aria-label="Next skill" className="mt-16 border-t border-border pt-8">
      <Link href={`/${next.slug}`} aria-label={`Next skill: ${next.title}`} className="card card-hover group flex items-center gap-4 px-5 py-4">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">Next skill</span>
          <span className="mt-1 block font-semibold tracking-tight">{next.title}</span>
          <span className="mt-1 block text-sm text-muted text-pretty">{next.summary}</span>
        </span>
        <svg className="size-5 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text motion-reduce:transition-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </Link>
    </nav>
  )
}
