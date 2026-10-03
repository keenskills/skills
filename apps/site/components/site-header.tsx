import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-(--site-max) items-center gap-5 px-4 text-sm sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Keen Skills
        </Link>
        <ul className="flex items-center gap-4 text-muted">
          <li>
            <Link href="/how-to-use" className="inline-flex min-h-6 items-center hover:text-text">
              How to use
            </Link>
          </li>
        </ul>
        <div className="ml-auto flex items-center gap-3">
          <a href="https://github.com/keenskills/skills" className="inline-flex min-h-6 items-center text-muted hover:text-text">
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
