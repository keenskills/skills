import Link from 'next/link'
import { skills } from '@/lib/content'

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4 text-sm sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Keen Skills
        </Link>
        <ul className="flex items-center gap-4 text-muted">
          {skills.map((s) => (
            <li key={s.slug} className="hidden sm:block">
              <Link href={`/${s.slug}`} className="hover:text-text">
                {s.title}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/how-to-use" className="hover:text-text">
              How to use
            </Link>
          </li>
        </ul>
        <a href="https://github.com/keenskills/skills" className="ml-auto text-muted hover:text-text">
          GitHub
        </a>
      </nav>
    </header>
  )
}
