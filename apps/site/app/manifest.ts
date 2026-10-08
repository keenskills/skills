import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site.mjs'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    display: 'browser',
    background_color: '#0f0f0f',
    theme_color: '#0f0f0f',
    icons: [{ src: '/icon-light.png', sizes: '512x512', type: 'image/png' }],
  }
}
