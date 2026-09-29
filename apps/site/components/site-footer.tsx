import Link from 'next/link'
import { skills } from '@/lib/content'

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <div>
          <p className="font-semibold text-text">Keen Skills</p>
          <p className="mt-1">MIT licensed. Made by rajaaltus and gjohnpaull.</p>
          <p className="mt-1">
            Every page is checked with page-as-data at 390 and 1440 px{' '}
            <a href="https://github.com/keenskills/skills/actions/workflows/test.yml" className="text-text underline underline-offset-2">
              on every push
            </a>
            .
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {skills.map((s) => (
            <li key={s.slug}>
              <Link href={`/${s.slug}`} className="inline-flex min-h-6 items-center hover:text-text">
                {s.title}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/how-to-use" className="inline-flex min-h-6 items-center hover:text-text">
              How to use
            </Link>
          </li>
          <li>
            <a href="https://github.com/keenskills/skills" className="inline-flex min-h-6 items-center hover:text-text">
              GitHub
            </a>
          </li>
        </ul>
      </div>
    </footer>
  )
}
