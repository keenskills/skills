// What the site says about itself outside its pages: metadata, the sitemap,
// the social cards (scripts/build-og.mjs) and analytics all read it from here.
export const SITE = {
  url: 'https://keenskills.d2studio.dev',
  host: 'keenskills.d2studio.dev',
  name: 'Keen Skills',
  tagline: 'Sharper senses for your coding agent',
  description: 'Open-source skills that let coding agents read web pages as data and draw print-ready architecture diagrams. One command to install.',
  repo: 'https://github.com/keenskills/skills',
  maker: { name: 'D2 Studio', url: 'https://d2studio.dev' },
  twitter: '@rajaaltus',
  // The GA4 property of d2studio.dev, which this site is a subdomain of.
  analytics: 'G-B8D62CCV41',
  og: { width: 1200, height: 630 },
}

/** The social card of a page: the skill's own for its pages, the site's for the rest. */
export const ogImage = (slug) => `/og/${slug ?? 'home'}.png`
