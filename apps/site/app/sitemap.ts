import type { MetadataRoute } from 'next'
import { skills } from '@/lib/content'
import { SITE } from '@/lib/site.mjs'

export const dynamic = 'force-static'

// Every page of the export; tests/pages.test.mjs fails if one is missing or extra.
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number) => ({ url: `${SITE.url}${path}`, changeFrequency: 'weekly' as const, priority })
  return [
    page('/', 1),
    page('/how-to-use', 0.8),
    ...skills.flatMap((s) => [
      page(`/${s.slug}`, 0.9),
      ...s.sections.map((x) => page(`/${s.slug}/${x.slug}`, 0.6)),
      page(`/${s.slug}/skill`, 0.5),
      page(`/${s.slug}/changelog`, 0.4),
    ]),
  ]
}
