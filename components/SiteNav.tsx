"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

/**
 * The one navigation header for the whole site — the marketing homepage
 * and every /company/[ticker] state (success, loading, error, demo) all
 * render this exact component, so "EQUITYLENS" and its single nav link
 * look and behave identically everywhere. Only the link's destination
 * and label change: "Analyze" -> #hero on the homepage itself,
 * "Search" -> "/" on the analyzer, sending the user back to the
 * marketing page's search rather than duplicating a second search box
 * in the header.
 */
export function SiteNav({
  linkHref = "#hero",
  linkLabel = "Analyze",
}: {
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-40 border-b border-mkt-border bg-mkt-bg/70 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.2em] text-mkt-ink">
          EQUITYLENS
        </Link>
        <Link
          href={linkHref}
          className="group flex items-center gap-1.5 text-sm font-medium text-mkt-ink-muted transition-colors duration-200 hover:text-mkt-ink"
        >
          {linkLabel}
          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </motion.header>
  );
}
