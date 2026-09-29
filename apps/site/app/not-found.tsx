import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted">There is no page at this address.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
        Back to Keen Skills
      </Link>
    </section>
  )
}
