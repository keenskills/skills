import Link from 'next/link'
import type { Skill } from '@/lib/content'

export function DocsSidebar({ skill, active }: { skill: Skill; active: string }) {
  const links = [
    { key: '', href: `/${skill.slug}`, label: 'Overview' },
    ...skill.sections.map((s) => ({ key: s.slug, href: `/${skill.slug}/${s.slug}`, label: s.heading })),
    { key: 'skill', href: `/${skill.slug}/skill`, label: 'What your agent reads' },
    { key: 'changelog', href: `/${skill.slug}/changelog`, label: 'Changelog' },
  ]
  const list = (
    <ul className="flex flex-col gap-0.5 text-sm">
      {links.map((l) => (
        <li key={l.key || 'overview'}>
          <Link
            href={l.href}
            aria-current={l.key === active ? 'page' : undefined}
            className="block rounded-md px-2.5 py-1.5 text-muted hover:bg-accent-soft hover:text-text aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium aria-[current=page]:text-text"
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  )
  return (
    <>
      <details className="t-accordion card md:hidden">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          <span>{skill.title} docs</span>
          <svg className="chev size-4 shrink-0 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </summary>
        <nav aria-label={`${skill.title} docs`} className="border-t border-border p-2">
          {list}
        </nav>
      </details>
      <nav aria-label={`${skill.title} docs`} className="sticky top-6 hidden md:block">
        <p className="mb-2 px-2.5 text-xs font-medium uppercase tracking-wide text-muted">{skill.title}</p>
        {list}
      </nav>
    </>
  )
}
