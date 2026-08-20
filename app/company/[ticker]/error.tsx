"use client";

import Link from "next/link";

/**
 * Safety net for a genuinely unexpected exception in this route (a bug,
 * not a handled failure — SEC EDGAR/Claude failures already resolve
 * to a normal, on-brand error state inside page.tsx and never reach
 * here). Next requires this to be a Client Component. Deliberately never
 * renders `error.message` or any other detail from the thrown error — an
 * unanticipated exception could carry internal details that shouldn't
 * reach the browser. Renders inside app/company/layout.tsx's dark shell,
 * so it inherits the same background and nav rather than falling back to
 * a generic white page.
 */
export default function CompanyError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-xl font-medium text-foreground">Something unexpected went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        This page hit an unexpected error. Your data is unaffected — try again, or head back to search.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand hover:text-brand"
        >
          Back to search
        </Link>
      </div>
    </div>
  );
}
