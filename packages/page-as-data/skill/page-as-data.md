# Read a web page as data, not a screenshot

`page-as-data` reads a rendered page in Chrome and prints it as text: what is on screen, what broke behind it, and layout defects. Use it whenever you check, debug or verify web UI work. Take a screenshot only for what data cannot answer: images, charts and overall visual polish.

It needs Node 22+ and Chrome, Chromium or Edge.

## Pick a Chrome

- Public pages and a local dev server: add `--launch`. It starts its own headless Chrome.
- Pages behind a sign-in: ask the user to start Chrome with `--remote-debugging-port=9222` and its own `--user-data-dir`, and to sign in once. `page-as-data` attaches to port 9222 by default and opens its own tab.

## Read a screen

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/orders --launch
npx @rajaaltus/page-as-data read http://localhost:3000/orders --width 390 --launch   # phone
```

The output lists PROBLEMS first (uncaught exceptions, `console.error`, failed requests, broken images, invalid fields, layout defects), then dialogs, alerts, headings, form fields, tables, buttons and the visible text. Add `--json` for the full result.

## Reproduce a bug

Steps run in the order given. The page settles after each one.

```sh
npx @rajaaltus/page-as-data read http://localhost:3000/orders --launch \
  --click "New order" --fill "Email=a@b.co" --press Enter --wait-for "Saved"
```

- `--click "Name"`: click a button or link by its name.
- `--fill "Label=value"`: fill a field by its label.
- `--press Key`: a real key press: `F9`, `Enter`, `Escape`, a character.
- `--wait-for "text"`: wait until the text is on screen (up to `--timeout`, default 15000 ms).

## Is it visible? Is it readable?

`--inspect "Save"` takes visible text or a CSS selector. It gives the element's box, whether it is visible and why not, its colours and its WCAG contrast. Repeatable.

## Before calling UI work done

```sh
npx @rajaaltus/page-as-data check http://localhost:3000/ http://localhost:3000/orders --widths 390,1440 --launch
```

It must exit `0`. Exit codes: `0` nothing found, `1` problems found, `2` could not run (no Chrome, bad URL, a step could not find its control). `--strict` also fails on warnings.

## A screenshot, only when needed

`--screenshot out.png` on `read` also saves a picture. Use it for images, charts and the overall look. Everything else is already in the data.
