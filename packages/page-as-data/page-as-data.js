/**
 * page-as-data — read a rendered web page as data instead of a screenshot.
 *
 * Runs INSIDE the page. Inject it before the page's own scripts (CDP
 * `Page.addScriptToEvaluateOnNewDocument`, Playwright `page.addInitScript`,
 * Chrome DevTools MCP `initScript`) so it can count router requests from the
 * start — or paste it into the DevTools console. It adds `window.__pageAsData`
 * and wraps `window.fetch` to COUNT React Server Component requests (it never
 * changes one). No network calls of its own, no dependencies.
 *
 *   await __pageAsData.settle()        wait until the screen has really finished
 *   __pageAsData.read()                headings, text, dialogs, alerts, tables, forms, controls, images
 *   __pageAsData.inspect('Save')       an element's box, visibility, colours, contrast
 *   __pageAsData.layoutIssues()        overflow, cut-off controls, broken sticky, small targets
 *   await __pageAsData.click('Save')   click a control by its name, then settle
 *   await __pageAsData.fill('Email', 'a@b.co')   fill a field by its label, then settle
 *   await __pageAsData.waitFor('Saved')  wait until text is on screen, then settle
 */
;(() => {
  if (window.__pageAsData) return

  // --- in-flight React Server Component (Next.js App Router) requests ------
  // A client-side navigation leaves the DOM untouched while the server
  // renders, so "the DOM has been quiet for 250ms" alone reports the OLD
  // screen as finished.
  let rscInFlight = 0
  const originalFetch = window.fetch
  const isRscRequest = (input, init) => {
    try {
      const url = input instanceof Request ? input.url : String(input)
      if (url.includes('_rsc=')) return true
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      return headers.get('rsc') === '1'
    } catch {
      return false
    }
  }
  window.fetch = function (input, init) {
    if (!isRscRequest(input, init)) return originalFetch.call(this, input, init)
    rscInFlight++
    return originalFetch.call(this, input, init).finally(() => rscInFlight--)
  }

  // --- pending short timers -----------------------------------------------------
  // UI choreography schedules the next screen on a timer: fade out, then swap
  // the route 300-800ms later. Between the fade and the swap nothing mutates,
  // so "the DOM has been quiet for 250ms" reports the OLD screen as finished.
  // Staggered reveals do the same, 1-2s after arrival. Count timers of up to
  // 2s that have not fired yet; longer ones are idle timeouts and debounces.
  // Pollers are not counted either: a timer that re-arms itself (scheduled from
  // its own callback, or from the promise continuation it resolves) would keep
  // a reading waiting forever — pages, extensions and security tools run them.
  const SHORT_TIMER_MS = 2000
  const shortTimers = new Map() // id → { delay, source }, to say what a page is waiting on
  const originalSetTimeout = window.setTimeout
  const originalClearTimeout = window.clearTimeout
  let runningSource = null // source of the timer callback now running (and its microtasks)
  window.setTimeout = function (handler, delay, ...args) {
    if (typeof handler !== 'function' || Number(delay) > SHORT_TIMER_MS) return originalSetTimeout.call(this, handler, delay, ...args)
    const source = String(handler).replace(/\s+/g, ' ').slice(0, 80)
    const polling = runningSource === source
    const id = originalSetTimeout.call(
      this,
      function (...a) {
        shortTimers.delete(id)
        runningSource = source
        try {
          return handler.apply(this, a)
        } finally {
          // After the continuations this callback resolved have run.
          queueMicrotask(() => {
            if (runningSource === source) runningSource = null
          })
        }
      },
      delay,
      ...args,
    )
    if (!polling) shortTimers.set(id, { delay: Number(delay) || 0, source })
    return id
  }
  window.clearTimeout = function (id) {
    shortTimers.delete(id)
    return originalClearTimeout.call(this, id)
  }

  // --- helpers ----------------------------------------------------------------
  const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  // How a query is compared with a name or the screen: case-blind, and every run of
  // whitespace (a no-break space from Intl.NumberFormat, a line break) is one space,
  // since that is how the report prints it and so what gets typed back.
  const fold = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()
  const visibleText = (el) => (el?.innerText ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const main = () => document.querySelector('main') ?? document.body
  // The original timer: page-as-data's own waits must not count as the page's.
  const sleep = (ms) => new Promise((r) => originalSetTimeout(r, ms))
  const box = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })
  const cls = (el) => String(el.className?.baseVal ?? el.className ?? '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')
  const where = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : cls(el) ? `.${cls(el)}` : ''}`

  /** A control's name as a person reads it. */
  function nameOf(el) {
    const byId = (ids) => ids.split(/\s+/).map((id) => text(document.getElementById(id))).join(' ').trim()
    const forLabel = el.id ? text(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) : ''
    return (
      el.getAttribute('aria-label') ||
      (el.getAttribute('aria-labelledby') && byId(el.getAttribute('aria-labelledby'))) ||
      forLabel ||
      (el.closest('label') && text(el.closest('label'))) ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      el.getAttribute('alt') ||
      text(el) ||
      el.getAttribute('name') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
  }

  const describe = (el) => {
    const name = nameOf(el)
    return `${el.tagName.toLowerCase()}${name ? ` "${name}"` : ''}`
  }

  function isRendered(el) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
    if (el.closest('[aria-hidden="true"], [inert], [hidden]')) return false
    return true
  }

  const scrollsX = (cs) => cs.overflowX === 'auto' || cs.overflowX === 'scroll'
  const scrollsY = (cs) => cs.overflowY === 'auto' || cs.overflowY === 'scroll'
  const clipsX = (cs) => cs.overflowX !== 'visible'
  const clipsY = (cs) => cs.overflowY !== 'visible'

  const CONTROLS =
    'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=combobox], [role=checkbox], [role=radio], [role=switch]'

  // --- settle -------------------------------------------------------------------
  const pendingStreams = () => document.querySelectorAll('div[hidden][id^="S:"]').length
  const busy = () =>
    document.querySelectorAll('[aria-busy="true"], [data-skeleton], [data-slot="skeleton"], .animate-pulse, .skeleton').length

  /**
   * Resolves when no RSC request is in flight, no React stream is waiting to
   * be revealed, no skeleton or aria-busy region is mounted, no short timer
   * (≤2s) is still pending, and the DOM has been quiet for 250ms. Finishes running (finite) animations first, so a
   * reading never catches content mid-fade.
   */
  async function settle({ timeoutMs = 10000, finishAnimations = true } = {}) {
    const start = performance.now()
    let lastChange = performance.now()
    const mo = new MutationObserver(() => (lastChange = performance.now()))
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true })
    try {
      while (performance.now() - start < timeoutMs) {
        if (finishAnimations)
          for (const a of document.getAnimations()) if (a.effect?.getTiming().iterations !== Infinity) a.finish()
        const quiet = performance.now() - lastChange > 250
        if (quiet && rscInFlight === 0 && shortTimers.size === 0 && pendingStreams() === 0 && busy() === 0 && document.readyState === 'complete')
          return { settled: true, ms: Math.round(performance.now() - start) }
        await sleep(50)
      }
      return {
        settled: false,
        ms: timeoutMs,
        why: {
          rscInFlight,
          pendingShortTimers: [...shortTimers.values()],
          pendingStreams: pendingStreams(),
          busy: busy(),
          // React 19 reveals streamed content on animation frames, which a
          // background tab does not run: bring the tab to the front.
          tabHidden: document.visibilityState === 'hidden',
        },
      }
    } finally {
      mo.disconnect()
    }
  }

  // --- read: the screen as data ------------------------------------------------
  function readTables({ maxRows = 20 } = {}) {
    return [...main().querySelectorAll('table')].filter(isRendered).map((t, i) => {
      const rows = [...t.querySelectorAll('tbody tr')]
      return {
        index: i,
        caption: text(t.querySelector('caption')) || t.getAttribute('aria-label') || null,
        headers: [...t.querySelectorAll('thead th')].map(text),
        rowCount: rows.length,
        rows: rows.slice(0, maxRows).map((tr) =>
          [...tr.querySelectorAll('td, th')].map((td) => {
            // innerText keeps the line break between a name and its
            // description; textContent ran "12x16 CanvasOne photo…" together.
            const cell = (td.innerText ?? '').replace(/\s*\n\s*/g, ' · ').replace(/\s+/g, ' ').trim()
            const link = td.querySelector('a[href]')
            return link ? { text: cell, href: link.getAttribute('href') } : cell
          }),
        ),
      }
    })
  }

  function errorFor(field) {
    const ids = [field.getAttribute('aria-errormessage'), field.getAttribute('aria-describedby')].filter(Boolean).join(' ')
    const described = ids
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter((el) => el && isRendered(el))
      .map(text)
      .join(' ')
    return described || (field.validationMessage && !field.validity?.valid ? field.validationMessage : '')
  }

  function readForm() {
    return [...main().querySelectorAll('input:not([type=hidden]), select, textarea')].filter(isRendered).map((f) => {
      const invalid = f.getAttribute('aria-invalid') === 'true' || (f.willValidate && f.matches(':user-invalid'))
      const error = invalid ? errorFor(f) : ''
      return {
        label: nameOf(f),
        name: f.getAttribute('name'),
        type: f.type,
        value: f.type === 'checkbox' || f.type === 'radio' ? f.checked : f.type === 'password' ? (f.value ? '••••' : '') : f.value,
        ...(f.required ? { required: true } : {}),
        ...(f.disabled ? { disabled: true } : {}),
        ...(f.readOnly ? { readOnly: true } : {}),
        ...(invalid ? { invalid: true } : {}),
        ...(error ? { error } : {}),
      }
    })
  }

  function readControls({ max = 150 } = {}) {
    const seen = new Set()
    const out = []
    for (const el of document.querySelectorAll(CONTROLS)) {
      if (el.matches('input, select, textarea') || !isRendered(el)) continue // fields are in forms
      const name = nameOf(el)
      const role = el.tagName === 'A' ? 'link' : el.getAttribute('role') || 'button'
      const key = `${role}|${name}|${el.getAttribute('href') ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      const state = {}
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') state.disabled = true
      for (const a of ['pressed', 'expanded', 'checked', 'selected', 'current'])
        if (el.hasAttribute(`aria-${a}`)) state[a] = el.getAttribute(`aria-${a}`)
      out.push({ role, name, ...(el.getAttribute('href') ? { href: el.getAttribute('href') } : {}), ...state })
      if (out.length >= max) break
    }
    return out
  }

  function readImages() {
    const imgs = [...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 0)
    return {
      total: imgs.length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
      missingAlt: imgs.filter((i) => !i.hasAttribute('alt')).map((i) => i.currentSrc || i.src),
    }
  }

  /** What an operator sees: the answer to most "what is on this screen?" questions. */
  function read({ maxText = 4000, maxRows = 20 } = {}) {
    const dialogs = [...document.querySelectorAll('dialog[open], [role=dialog], [role=alertdialog]')]
      .filter(isRendered)
      .map((d) => {
        const title = text(d.querySelector('h1, h2, h3, [id$=title]')) || nameOf(d)
        const body = visibleText(d)
        return { title, text: (body.startsWith(title) ? body.slice(title.length) : body).trim().slice(0, 1000) }
      })
    const alerts = [...document.querySelectorAll('[role=alert], [role=status], [aria-live]:not([aria-live=off])')]
      .filter((el) => isRendered(el) && text(el))
      .map((el) => ({ role: el.getAttribute('role') || `live-${el.getAttribute('aria-live')}`, text: text(el).slice(0, 300) }))
    // Tables are returned whole in `tables`; in `text` each is one marker line,
    // so the same rows are not read twice.
    let body = main().innerText ?? ''
    ;[...main().querySelectorAll('table')].filter(isRendered).forEach((t, i) => {
      const own = t.innerText
      if (own && body.includes(own)) body = body.replace(own, `\n[table ${i}: ${t.querySelectorAll('tbody tr').length} rows — see tables]\n`)
    })
    body = body.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    return {
      url: location.pathname + location.search + location.hash,
      title: document.title,
      headings: [...document.querySelectorAll('h1, h2, h3')]
        .filter(isRendered)
        .map((h) => ({ level: Number(h.tagName[1]), text: text(h) })),
      dialogs,
      alerts,
      text: body.length > maxText ? `${body.slice(0, maxText)}… (${body.length - maxText} more characters)` : body,
      tables: readTables({ maxRows }),
      form: readForm(),
      controls: readControls(),
      images: readImages(),
      loading: { pendingStreams: pendingStreams(), busy: busy(), rscInFlight },
    }
  }

  // --- inspect: questions a screenshot is usually taken for ---------------------
  // Any CSS colour (rgb, hex, lab, oklch, color-mix…) to sRGB, by letting the
  // browser paint it: Tailwind v4 computes to lab()/oklch(), which no regex
  // over rgb() can read.
  const swatch = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  swatch.canvas.width = swatch.canvas.height = 1
  function parseColor(c) {
    if (!c || c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    swatch.clearRect(0, 0, 1, 1)
    swatch.fillStyle = '#000'
    swatch.fillStyle = c
    swatch.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = swatch.getImageData(0, 0, 1, 1).data
    return { r, g, b, a: a / 255 }
  }
  const rgb = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`

  const blend = (top, under) => ({
    r: Math.round(top.r * top.a + under.r * (1 - top.a)),
    g: Math.round(top.g * top.a + under.g * (1 - top.a)),
    b: Math.round(top.b * top.a + under.b * (1 - top.a)),
    a: 1,
  })
  const COLOR_FN = /(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi

  /**
   * What is painted behind an element: `{ colors: [...] }` — one colour, or a
   * gradient's stops — with see-through layers blended onto what is under
   * them, or `{ image }` when a picture is back there and only a screenshot
   * can say what the text sits on.
   */
  function backgroundBehind(el) {
    const WHITE = { r: 255, g: 255, b: 255, a: 1 }
    const layers = [] // see-through colours, nearest first
    // Paint the collected layers, farthest first, over `base`.
    const under = (base) => layers.reduceRight((acc, layer) => blend(layer, acc), base)
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        if (/url\(/.test(cs.backgroundImage)) return { image: where(e) }
        const stops = (cs.backgroundImage.match(COLOR_FN) ?? []).map(parseColor).filter((c) => c.a > 0)
        if (stops.length) return { colors: stops.map((s) => under(blend(s, WHITE))), gradient: where(e) }
      }
      const c = parseColor(cs.backgroundColor)
      if (c.a > 0) {
        layers.push(c)
        if (c.a >= 1) break
      }
    }
    return { colors: [under(WHITE)] }
  }

  function contrast(fg, bg) {
    const lum = ({ r, g, b }) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
  }

  /** Why an element that exists is not seen, or null when it is. */
  function hiddenReason(el) {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none') return `display: none on ${where(e)}`
      if (e.hidden) return `hidden attribute on ${where(e)}`
      if (e.getAttribute('aria-hidden') === 'true' && e === el) return 'aria-hidden="true"'
      // Opacity multiplies down the tree: a faded-out wrapper hides everything in it.
      if (Number(cs.opacity) === 0) return e === el ? 'opacity: 0' : `opacity: 0 on ${where(e)}`
    }
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden') return 'visibility: hidden'
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return 'zero size'
    return null
  }

  function findElements(query) {
    try {
      const bySelector = [...document.querySelectorAll(query)]
      if (bySelector.length) return bySelector
    } catch {
      // not a selector — match by name or visible text below
    }
    const q = fold(query)
    const matches = [...document.querySelectorAll(`${CONTROLS}, h1, h2, h3, h4, label, p, span, td, th, li, img, [role]`)].filter(
      (el) => fold(nameOf(el)).includes(q),
    )
    // Keep the innermost match: a <span> inside the <button> is the same thing.
    return matches.filter((el) => !matches.some((other) => other !== el && el.contains(other) && fold(nameOf(other)).includes(q)))
  }

  /** Answers "is it there, can I see it, where is it, what does it look like". */
  function inspect(query, { max = 5 } = {}) {
    const els = findElements(query)
    return {
      query,
      found: els.length,
      elements: els.slice(0, max).map((el) => {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        const fg = parseColor(cs.color)
        const bg = backgroundBehind(el)
        // Worst case across a gradient's stops. WCAG 1.4.3: large text
        // (24px, or 18.66px bold) needs 3:1, everything else 4.5:1.
        const ratio = bg.colors && text(el) ? Math.min(...bg.colors.map((c) => contrast(blend(fg, c), c))) : null
        const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700)
        const hidden = hiddenReason(el)
        const clipped = hidden ? null : clipOf(el)
        const vw = document.documentElement.clientWidth
        const vh = document.documentElement.clientHeight
        return {
          element: describe(el),
          text: text(el).slice(0, 200),
          box: box(r),
          visible: !hidden && !clipped?.cut,
          ...(hidden ? { hiddenBecause: hidden } : {}),
          ...(clipped?.cut ? { cutOffBy: clipped.by, visiblePct: clipped.visiblePct } : {}),
          inViewport: r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw,
          ...(el.disabled || el.getAttribute('aria-disabled') === 'true' ? { disabled: true } : {}),
          styles: {
            color: rgb(fg),
            background: bg.image
              ? `an image (on ${bg.image})`
              : bg.gradient
                ? `gradient ${bg.colors.map(rgb).join(' → ')}`
                : rgb(bg.colors[0]),
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            display: cs.display,
            position: cs.position,
            opacity: cs.opacity,
            cursor: cs.cursor,
            textAlign: cs.textAlign,
            border: cs.borderStyle === 'none' ? 'none' : `${cs.borderWidth} ${cs.borderStyle} ${cs.borderColor}`,
          },
          ...(ratio !== null ? { contrast: ratio, readable: ratio >= (large ? 3 : 4.5) } : {}),
          ...(bg.image && text(el) ? { contrast: null, needsScreenshot: 'text sits on an image; only a picture shows whether it reads' } : {}),
        }
      }),
    }
  }

  // --- actions: reproduce a bug -------------------------------------------------
  function pick(query, selector) {
    const q = fold(query)
    const candidates = [...document.querySelectorAll(selector)].filter(isRendered)
    return (
      candidates.find((el) => fold(nameOf(el)) === q) ??
      candidates.find((el) => fold(nameOf(el)).includes(q)) ??
      null
    )
  }

  /** Clicks the control whose name matches, then waits for the screen to settle. */
  async function click(name, { timeoutMs } = {}) {
    const el = pick(name, CONTROLS)
    if (!el) return { error: `No visible control named "${name}"`, controls: readControls({ max: 40 }).map((c) => c.name) }
    el.scrollIntoView({ block: 'center' })
    el.click()
    return { clicked: describe(el), ...(await settle({ timeoutMs })) }
  }

  /** Types into the field whose label matches, the way React sees typing. */
  async function fill(label, value, { timeoutMs } = {}) {
    const el = pick(label, 'input:not([type=hidden]), select, textarea')
    if (!el) return { error: `No visible field labelled "${label}"`, fields: readForm().map((f) => f.label) }
    el.focus()
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked !== (value === true || value === 'true')) el.click()
    } else {
      // React tracks the value it last set; going through the prototype's
      // setter makes it notice the change instead of reverting it.
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, String(value))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    el.blur()
    return { filled: describe(el), ...(await settle({ timeoutMs })) }
  }

  /**
   * Waits until `query` is visible text on the screen, then settles. For long
   * work whose progress keeps the DOM busy (a render, an upload): the wait ends
   * on the outcome, not on quiet.
   */
  async function waitFor(query, { timeoutMs = 10000 } = {}) {
    const q = fold(query)
    const start = performance.now()
    while (performance.now() - start < timeoutMs) {
      if (fold(visibleText(document.body)).includes(q)) {
        const settled = await settle({ timeoutMs: Math.max(1000, timeoutMs - (performance.now() - start)) })
        return { found: query, ms: Math.round(performance.now() - start), settled: settled.settled }
      }
      await sleep(100)
    }
    return { error: `"${query}" did not appear within ${timeoutMs}ms`, onScreen: visibleText(main()).slice(0, 300) }
  }

  // --- layout defects -------------------------------------------------------------
  /** How an ancestor that clips without scrolling cuts an element off, if one does. */
  function clipOf(el) {
    const r = el.getBoundingClientRect()
    let v = { l: r.left, r: r.right, t: r.top, b: r.bottom }
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (cs.position === 'fixed') break
      if (!clipsX(cs) && !clipsY(cs)) continue
      const pr = p.getBoundingClientRect()
      const next = {
        l: clipsX(cs) ? Math.max(v.l, pr.left) : v.l,
        r: clipsX(cs) ? Math.min(v.r, pr.right) : v.r,
        t: clipsY(cs) ? Math.max(v.t, pr.top) : v.t,
        b: clipsY(cs) ? Math.min(v.b, pr.bottom) : v.b,
      }
      const cutX = next.r - next.l < v.r - v.l - 1
      const cutY = next.b - next.t < v.b - v.t - 1
      if ((cutX && !scrollsX(cs)) || (cutY && !scrollsY(cs))) {
        const shown = Math.max(0, next.r - next.l) * Math.max(0, next.b - next.t)
        return { cut: true, by: where(p), visiblePct: Math.round((100 * shown) / (r.width * r.height)) }
      }
      v = next
    }
    return null
  }

  /** Controls cut off by a container that clips without scrolling, or pushed
   *  past the viewport edge where nothing scrolls to them. A control inside a
   *  scroll box it can be scrolled to is not reported. */
  function clippedControls() {
    const out = []
    const vw = document.documentElement.clientWidth
    const docScrollsX = document.documentElement.scrollWidth > vw && getComputedStyle(document.body).overflowX !== 'hidden'
    for (const el of document.querySelectorAll(CONTROLS)) {
      if (!isRendered(el)) continue
      const clip = clipOf(el)
      if (clip) {
        out.push({ control: describe(el), box: box(el.getBoundingClientRect()), visiblePct: clip.visiblePct, clippedBy: clip.by })
        continue
      }
      const r = el.getBoundingClientRect()
      if (r.right > vw + 1 && !docScrollsX) {
        let inScroller = false
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (scrollsX(getComputedStyle(p))) inScroller = true
        if (!inScroller)
          out.push({
            control: describe(el),
            box: box(r),
            visiblePct: Math.max(0, Math.round((100 * (vw - r.left)) / r.width)),
            clippedBy: 'viewport',
          })
      }
    }
    return out
  }

  /** `position: sticky` whose nearest scroll box cannot scroll on the axis it
   *  sticks on: it never sticks, and a non-zero offset just displaces it. */
  function stickyThatCannotStick() {
    const out = []
    const seen = new Set()
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (cs.position !== 'sticky' || !isRendered(el)) continue
      let scrollBox = null
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const pcs = getComputedStyle(p)
        if (pcs.overflowX !== 'visible' || pcs.overflowY !== 'visible') {
          scrollBox = p
          break
        }
      }
      if (!scrollBox || scrollBox === document.body) continue
      const vertical = cs.top !== 'auto' || cs.bottom !== 'auto'
      const bcs = getComputedStyle(scrollBox)
      if (!vertical || (scrollsY(bcs) && scrollBox.scrollHeight > scrollBox.clientHeight)) continue
      const key = `${where(scrollBox)}|${cs.top}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        element: describe(el),
        top: cs.top,
        scrollBox: where(scrollBox),
        boxOverflow: `${bcs.overflowX}/${bcs.overflowY}`,
        displacedPx: parseFloat(cs.top) ? Math.round(el.getBoundingClientRect().top - scrollBox.getBoundingClientRect().top) : 0,
      })
    }
    return out
  }

  /** WCAG 2.2 SC 2.5.8 (AA): a target under 24×24 CSS px FAILS only when a
   *  24px circle centred on it meets another target, or another undersized
   *  target's circle. Links inside a sentence are exempt. */
  function smallTargets() {
    const all = [...document.querySelectorAll(CONTROLS)].filter(isRendered).map((el) => {
      const r = el.getBoundingClientRect()
      return { el, r, cx: r.x + r.width / 2, cy: r.y + r.height / 2, small: r.width < 24 || r.height < 24 }
    })
    const circleHits = (c, r) => {
      const dx = Math.max(r.left - c.cx, 0, c.cx - r.right)
      const dy = Math.max(r.top - c.cy, 0, c.cy - r.bottom)
      return dx * dx + dy * dy < 144
    }
    const out = []
    for (const a of all) {
      if (!a.small) continue
      const el = a.el
      const sentence = el.tagName === 'A' && el.closest('p, li')
      if (sentence && text(sentence).length > text(el).length + 20) continue
      if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) continue
      const crowded = all.find(
        (b) =>
          b !== a &&
          !b.el.contains(el) &&
          !el.contains(b.el) &&
          (circleHits(a, b.r) || (b.small && Math.hypot(a.cx - b.cx, a.cy - b.cy) < 24)),
      )
      if (crowded)
        out.push({ control: describe(el), size: `${Math.round(a.r.width)}×${Math.round(a.r.height)}`, crowdedBy: describe(crowded.el) })
    }
    return out
  }

  function pageOverflow() {
    const vw = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth <= vw) return null
    const culprits = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.right <= vw + 1 || !isRendered(el)) continue
      if (el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1) continue // report the outermost
      // Inside a box that clips or scrolls sideways, it cannot widen the page.
      let contained = false
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement)
        if (clipsX(getComputedStyle(p))) contained = true
      if (contained) continue
      culprits.push({ element: `${describe(el)} (${where(el)})`, right: Math.round(r.right) })
      if (culprits.length >= 5) break
    }
    return { scrollWidth: document.documentElement.scrollWidth, viewport: vw, culprits }
  }

  function layoutIssues() {
    return {
      viewport: { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight },
      pageOverflow: pageOverflow(),
      clippedControls: clippedControls(),
      stickyThatCannotStick: stickyThatCannotStick(),
      smallTargets: smallTargets(),
    }
  }

  window.__pageAsData = { settle, read, inspect, layoutIssues, click, fill, waitFor, readTables, readForm, readControls }
})()
