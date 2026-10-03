import type { Metadata } from 'next'
import { Geist_Mono, Fira_Sans } from 'next/font/google'
import { Analytics } from '@/components/analytics'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { SITE } from '@/lib/site.mjs'
import { THEME_SCRIPT } from '@/lib/theme-script.mjs'
import './globals.css'
import './motion.css'
import './scenes.css'

const sans = Fira_Sans({
  subsets: ['latin'],
  variable: '--font-fira-sans',
  weight: ['300', '400', '500', '600', '700'],
})
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

// What every page shares. Titles, canonical URLs and social cards are per page: lib/meta.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ['agent skills', 'coding agents', 'Claude Code skills', 'AGENTS.md', 'Codex', 'Cursor', 'Gemini CLI', 'page-as-data', 'architecture diagrams', 'draw.io', 'design documents', 'Word documents', 'web UI testing', 'open source'],
  authors: [{ name: SITE.maker.name, url: SITE.maker.url }],
  creator: SITE.maker.name,
  publisher: SITE.maker.name,
  category: 'technology',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  formatDetection: { telephone: false, email: false, address: false },
}

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  inLanguage: 'en',
  publisher: { '@type': 'Organization', name: SITE.maker.name, url: SITE.maker.url },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <noscript>
          <style>{'.t-stagger-line{opacity:1!important;transform:none!important;filter:none!important}'}</style>
        </noscript>
      </head>
      <body className="min-h-dvh bg-bg font-sans text-text antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-(--site-max) px-4 sm:px-6">
          {children}
        </main>
        <SiteFooter />
        <JsonLd data={WEBSITE} />
        <Analytics />
      </body>
    </html>
  )
}
