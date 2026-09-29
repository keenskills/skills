// HTML built at build time from this repository's own markdown, never from user input.
export function Prose({ html }: { html: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
}
