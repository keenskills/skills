import type { Metadata } from 'next'
import { ogImage, SITE } from './site.mjs'

/**
 * A page's title, description, canonical URL and social card. Open Graph and
 * Twitter fields do not merge across segments in Next, so every page states
 * all of them through here. `skill` picks that skill's card over the site's.
 */
export function pageMeta({ title, description = SITE.description, path, skill }: { title?: string; description?: string; path: string; skill?: string }): Metadata {
  const full = title ? `${title} · ${SITE.name}` : `${SITE.name}: ${SITE.tagline}`
  const image = { url: ogImage(skill), width: SITE.og.width, height: SITE.og.height, alt: full, type: 'image/png' }
  return {
    title: title ?? { absolute: full },
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE.name, locale: 'en_US', url: path, title: full, description, images: [image] },
    twitter: { card: 'summary_large_image', title: full, description, images: [{ url: image.url, alt: full }], creator: SITE.twitter },
  }
}
