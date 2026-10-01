import Script from 'next/script'
import { SITE } from '@/lib/site.mjs'

// Google Analytics 4, on the property d2studio.dev uses. The tag is only
// fetched on the live host, so local builds, previews and the site's own
// page-as-data check make no request to Google and record nothing.
export function Analytics() {
  return (
    <Script id="google-analytics" strategy="afterInteractive">
      {`if (location.hostname === '${SITE.host}') {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=${SITE.analytics}';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${SITE.analytics}');
}`}
    </Script>
  )
}
