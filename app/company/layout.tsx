import { SiteNav } from "@/components/SiteNav";

/**
 * Shared shell for every /company/[ticker] state — success, loading,
 * the provider-error card, and the not-found state all render inside
 * this same dark background with the same fixed nav, so none of them
 * ever flash back to a generic light page. `pt-24` clears the fixed
 * SiteNav; individual pages don't each need to account for it.
 */
export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mkt-bg">
      <SiteNav linkHref="/" linkLabel="Search" />
      <div className="pt-24">{children}</div>
    </div>
  );
}
