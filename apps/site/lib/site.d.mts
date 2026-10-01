export const SITE: {
  url: string
  host: string
  name: string
  tagline: string
  description: string
  repo: string
  maker: { name: string; url: string }
  twitter: string
  analytics: string
  og: { width: number; height: number }
}
export function ogImage(slug?: string): string
