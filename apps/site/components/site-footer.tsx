import Link from 'next/link'
import { skills } from '@/lib/content'

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto max-w-(--site-max) px-4 py-10 text-sm text-muted sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <p className="font-semibold text-text">Keen Skills</p>
            <p className="mt-1">MIT licensed. Made by <a href="https://x.com/gjohnpaull" target="_blank">gjohnpaull</a> and <a href="https://x.com/rajaaltus" target="_blank">rajaaltus</a>.</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 self-start">
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
              <a href="https://github.com/keenskills/skills" aria-label="GitHub" className="inline-flex size-6 items-center justify-center hover:text-text">
                <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.31-.63-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" /></svg>
              </a>
            </li>
          </ul>
        </div>
        <p className="mt-6 border-t border-border pt-6">
          Every page is checked with page-as-data at 390 and 1440 px{' '}
          <a href="https://github.com/keenskills/skills/actions/workflows/test.yml" className="text-text underline underline-offset-2">
            on every push
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
